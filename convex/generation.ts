import { action } from "./_generated/server";
import { v } from "convex/values";
import { blobToBase64, decryptSecret, requireUser } from "./lib";
import { makeFunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";

interface FlashcardResponse {
  title: string;
  description?: string;
  flashcards: Array<{
    question: string;
    answer: string;
  }>;
}

const getEncryptedOpenRouterKeyRef = makeFunctionReference<
  "query",
  { userId: string },
  string | null
>("settings:getEncryptedOpenRouterKey");

const getImagesForGenerationRef = makeFunctionReference<
  "query",
  { userId: string; imageIds: Array<Id<"images">> },
  Array<{
    _id: Id<"images">;
    filename: string;
    mimeType: string;
    size: number;
    storageId: Id<"_storage">;
    userId: string;
    createdAt: number;
  }>
>("images:getImagesForGeneration");

const createGeneratedFlashcardsRef = makeFunctionReference<
  "mutation",
  {
    userId: string;
    model: string;
    prompt: string;
    response: string;
    imageIds: Array<Id<"images">>;
    tokensUsed?: number;
    customInstructions?: string;
    title: string;
    description?: string;
    flashcards: Array<{ question: string; answer: string }>;
  },
  {
    flashcardSet: {
      _id: Id<"flashcardSets">;
      title: string;
      description?: string;
      flipMode: boolean;
      createdAt: number;
    } | null;
    flashcards: Array<{
      _id: Id<"flashcards">;
      question: string;
      answer: string;
      orderIndex: number;
    }>;
  }
>("flashcards:createGeneratedFlashcards");

function buildPrompt(imageCount: number, customInstructions?: string) {
  let prompt =
    imageCount > 1
      ? `You will see ${imageCount} images below. These are all pages from the same homework or study material. Please look at ALL ${imageCount} images carefully before creating flashcards.

Create flashcards to help a student learn the content from ALL the images.`
      : "Analyze this homework/study material image and create flashcards to help a student learn the content.";

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
- Focus on what a student would need to know for homework/tests${imageCount > 1 ? "\n- Make sure to create flashcards from content in ALL images, not just the first one" : ""}${customInstructions ? "\n- Follow the special instructions provided above" : ""}

Return ONLY the JSON object, no other text.`;

  return prompt;
}

function parseFlashcardResponse(response: string): FlashcardResponse {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in model response.");
  }

  const flashcardData = JSON.parse(jsonMatch[0]) as FlashcardResponse;
  if (!flashcardData.title || !Array.isArray(flashcardData.flashcards)) {
    throw new Error("Invalid flashcard data structure.");
  }

  return flashcardData;
}

export const generateFlashcards = action({
  args: {
    imageIds: v.array(v.id("images")),
    model: v.string(),
    customInstructions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const encryptedKey = await ctx.runQuery(getEncryptedOpenRouterKeyRef, {
      userId,
    });

    if (!encryptedKey) {
      throw new Error("Add your OpenRouter API key before generating flashcards.");
    }

    const apiKey = await decryptSecret(encryptedKey);
    const images = await ctx.runQuery(getImagesForGenerationRef, {
      userId,
      imageIds: args.imageIds,
    });

    const prompt = buildPrompt(images.length, args.customInstructions);
    const messageContent: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [{ type: "text", text: prompt }];

    for (const image of images) {
      const blob = await ctx.storage.get(image.storageId);
      if (!blob) {
        throw new Error(`Image not found: ${image.filename}`);
      }

      const base64Image = await blobToBase64(blob);
      messageContent.push({
        type: "image_url",
        image_url: {
          url: `data:${image.mimeType};base64,${base64Image}`,
        },
      });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.SITE_URL ?? "http://localhost:3000",
        "X-Title": "Tutor App",
      },
      body: JSON.stringify({
        model: args.model,
        messages: [
          {
            role: "user",
            content: messageContent,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    const payload = (await response.json()) as {
      error?: { message?: string };
      usage?: { total_tokens?: number };
      choices?: Array<{ message?: { content?: string } }>;
    };

    if (!response.ok) {
      throw new Error(payload.error?.message ?? "OpenRouter request failed.");
    }

    const modelResponse = payload.choices?.[0]?.message?.content;
    if (!modelResponse) {
      throw new Error("No response from language model.");
    }

    const flashcardData = parseFlashcardResponse(modelResponse);

    return ctx.runMutation(createGeneratedFlashcardsRef, {
      userId,
      model: args.model,
      prompt,
      response: modelResponse,
      imageIds: args.imageIds,
      tokensUsed: payload.usage?.total_tokens,
      customInstructions: args.customInstructions,
      title: flashcardData.title,
      description: flashcardData.description,
      flashcards: flashcardData.flashcards,
    });
  },
});
