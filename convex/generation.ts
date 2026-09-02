import { action } from "./_generated/server";
import { v } from "convex/values";
import { blobToBase64, decryptSecret, requireUser } from "./lib";
import { makeFunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";

interface FlashcardResponse {
  title: string;
  description?: string;
  languages?: { front?: string | null; back?: string | null };
  pronunciation?: { front?: boolean; back?: boolean };
  flashcards: Array<{
    question: string;
    answer: string;
  }>;
}

interface OpenRouterErrorPayload {
  error?: {
    code?: number;
    message?: string;
    metadata?: {
      provider_name?: string;
      raw?: unknown;
    };
  };
  usage?: { total_tokens?: number };
  choices?: Array<{ message?: { content?: string } }>;
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
    frontLanguage?: string;
    backLanguage?: string;
    speakFront?: boolean;
    speakBack?: boolean;
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
    imageCount === 0
      ? `Create flashcards to help a student learn the topic described in the request below. Use your own knowledge of the subject; there are no images.

Request: ${customInstructions ?? ""}`
      : imageCount > 1
        ? `You will see ${imageCount} images below. These are all pages from the same homework or study material. Please look at ALL ${imageCount} images carefully before creating flashcards.

Create flashcards to help a student learn the content from ALL the images.`
        : "Analyze this homework/study material image and create flashcards to help a student learn the content.";

  if (customInstructions && imageCount > 0) {
    prompt += `\n\nSpecial Instructions: ${customInstructions}`;
  }

  prompt += `

Please respond with a JSON object in this exact format:
{
  "title": "Brief title for this flashcard set",
  "description": "Optional description of what this covers",
  "languages": { "front": "BCP-47 code of the language the questions are written in, e.g. nl", "back": "BCP-47 code of the language the answers are written in, e.g. fr" },
  "pronunciation": { "front": false, "back": true },
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
- For vocabulary, phrases, and translations (language learning): put ONLY the word or sentence in one language on the front and ONLY its translation on the back. Never wrap it in a question such as "How do you say ... in French:" or "Wat betekent ...". The front "le chien", back "de hond" is correct; the front "Hoe zeg je 'de hond' in het Frans?" is wrong
- Likewise for terms and definitions, dates, formulas, and lists: the front is the term or cue itself, the back is the definition or fact. Only phrase the front as a full question when the material is really a question, such as a maths problem or a comprehension question
- Keep the front short; put explanations on the back
- Cover key concepts, definitions, formulas, and important facts
- If there are math problems, include step-by-step solutions in answers
- Make questions progressively more challenging when appropriate
- "pronunciation" marks the sides that are in a language the student is learning (vocabulary, phrases, sentences), so the app can read them aloud. Set both to false for material that is not about learning a language
- Focus on what a student would need to know for homework/tests${imageCount > 1 ? "\n- Make sure to create flashcards from content in ALL images, not just the first one" : ""}${imageCount === 0 ? "\n- Follow the request above closely: its topic, level, language, and any number of cards it asks for" : customInstructions ? "\n- Follow the special instructions provided above" : ""}

Return ONLY the JSON object, no other text.`;

  return prompt;
}

function cleanLanguage(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(trimmed) ? trimmed : undefined;
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

function formatOpenRouterError(payload: OpenRouterErrorPayload) {
  const message = payload.error?.message?.trim();
  const providerName = payload.error?.metadata?.provider_name?.trim();
  const rawError = payload.error?.metadata?.raw;

  if (message === "Provider returned error") {
    const rawMessage =
      typeof rawError === "string"
        ? rawError.trim()
        : rawError &&
            typeof rawError === "object" &&
            "message" in rawError &&
            typeof rawError.message === "string"
          ? rawError.message.trim()
          : null;

    if (rawMessage) {
      return providerName
        ? `${providerName} rejected the image request: ${rawMessage}`
        : `The model provider rejected the image request: ${rawMessage}`;
    }

    return providerName
      ? `${providerName} rejected the image request. Try a different model.`
      : "The selected model provider rejected the image request. Try a different model.";
  }

  if (message) {
    return providerName ? `${providerName}: ${message}` : message;
  }

  return "OpenRouter request failed.";
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

    if (images.length === 0 && !args.customInstructions?.trim()) {
      throw new Error("Add a photo or describe what the flashcards should be about.");
    }

    if (images.length !== args.imageIds.length) {
      throw new Error("One or more selected images could not be loaded. Please re-upload and try again.");
    }

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
        // No `temperature`: reasoning models such as GPT-5.x reject it, and with
        // `require_parameters` OpenRouter then finds no endpoint at all.
        // Reasoning tokens count towards max_tokens, so leave headroom.
        max_tokens: 8000,
        provider: {
          require_parameters: true,
        },
      }),
    });

    const payload = (await response.json()) as OpenRouterErrorPayload;

    if (!response.ok) {
      throw new Error(formatOpenRouterError(payload));
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
      frontLanguage: cleanLanguage(flashcardData.languages?.front),
      backLanguage: cleanLanguage(flashcardData.languages?.back),
      speakFront: flashcardData.pronunciation?.front === true,
      speakBack: flashcardData.pronunciation?.back === true,
      flashcards: flashcardData.flashcards,
    });
  },
});
