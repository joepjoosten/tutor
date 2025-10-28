import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ImageModel, LLMInteractionModel, FlashcardSetModel, FlashcardModel } from '@/lib/models';
import path from 'path';
import fs from 'fs';

// Initialize OpenRouter client (lazy to avoid build errors)
function getOpenAIClient() {
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Tutor App',
    },
  });
}

interface FlashcardResponse {
  title: string;
  description?: string;
  flashcards: Array<{
    question: string;
    answer: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const { imageIds, model, customInstructions } = await request.json();

    // Support both single imageId (legacy) and multiple imageIds
    const ids = imageIds ? (Array.isArray(imageIds) ? imageIds : [imageIds]) : [];

    if (ids.length === 0 || !model) {
      return NextResponse.json(
        { error: 'Missing required fields: imageIds (or imageId), model' },
        { status: 400 }
      );
    }

    // Check for API key
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured. Please set OPENROUTER_API_KEY in .env file.' },
        { status: 500 }
      );
    }

    // Get all images from database and convert to base64
    const imageContents = [];
    for (const imageId of ids) {
      const image = ImageModel.findById(imageId);
      if (!image) {
        return NextResponse.json(
          { error: `Image not found: ${imageId}` },
          { status: 404 }
        );
      }

      // Read image file and convert to base64
      const imagePath = path.join(process.cwd(), 'public', image.filepath);
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:${image.mime_type};base64,${base64Image}`;

      imageContents.push({
        id: imageId,
        dataUrl,
      });
    }

    // Prepare prompt for LLM
    let prompt = '';

    if (ids.length > 1) {
      prompt = `You will see ${ids.length} images below. These are all pages from the same homework or study material. Please look at ALL ${ids.length} images carefully before creating flashcards.

Create flashcards to help a student learn the content from ALL the images.`;
    } else {
      prompt = `Analyze this homework/study material image and create flashcards to help a student learn the content.`;
    }

    if (customInstructions) {
      prompt += `\n\nSpecial Instructions: ${customInstructions}`;
    }

    prompt += `

Please respond with a JSON object in this exact format:
{
  "title": "Brief title for this flashcard set",
  "description": "Optional description of what this covers",
  "flashcards": [
    {
      "question": "Clear, specific question",
      "answer": "Detailed, helpful answer"
    }
  ]
}

Guidelines:
- Create as many flashcards as needed to cover all the important content
- Questions should be clear and test understanding
- Answers should be complete but concise
- Cover key concepts, definitions, formulas, and important facts
- If there are math problems, include step-by-step solutions in answers
- Make questions progressively more challenging when appropriate
- Focus on what a student would need to know for homework/tests${ids.length > 1 ? '\n- Make sure to create flashcards from content in ALL images, not just the first one' : ''}${customInstructions ? '\n- Follow the special instructions provided above' : ''}

Return ONLY the JSON object, no other text.`;

    // Build messages array - put prompt first, then all images
    const messageContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      {
        type: 'text',
        text: prompt,
      },
    ];

    // Add all images to the message
    for (let i = 0; i < imageContents.length; i++) {
      const img = imageContents[i];
      messageContent.push({
        type: 'image_url',
        image_url: {
          url: img.dataUrl,
        },
      });
    }

    // Call OpenRouter API
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'user',
          content: messageContent,
        },
      ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from LLM');
    }

    // Parse JSON response
    let flashcardData: FlashcardResponse;
    try {
      // Try to extract JSON if there's extra text
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        flashcardData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch {
      console.error('Failed to parse LLM response:', response);
      throw new Error('Invalid JSON response from LLM');
    }

    // Validate response structure
    if (!flashcardData.title || !Array.isArray(flashcardData.flashcards)) {
      throw new Error('Invalid flashcard data structure');
    }

    // Save LLM interaction (use first image ID as primary reference)
    const llmInteraction = LLMInteractionModel.create({
      image_id: ids[0],
      model: model,
      prompt: prompt,
      response: response,
      tokens_used: completion.usage?.total_tokens,
    });

    // Create flashcard set
    const flashcardSet = FlashcardSetModel.create({
      title: flashcardData.title,
      description: flashcardData.description,
      llm_interaction_id: llmInteraction.id,
    });

    // Create flashcards
    const flashcards = flashcardData.flashcards.map((card, index) => ({
      set_id: flashcardSet.id,
      question: card.question,
      answer: card.answer,
      order_index: index,
    }));

    FlashcardModel.bulkCreate(flashcards);

    // Get created flashcards
    const createdFlashcards = FlashcardModel.findBySetId(flashcardSet.id);

    return NextResponse.json({
      success: true,
      flashcardSet,
      flashcards: createdFlashcards,
    });
  } catch (error) {
    console.error('Flashcard generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate flashcards' },
      { status: 500 }
    );
  }
}
