import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import { decryptSecret, requireUser } from "./lib";
import {
  DEFAULT_CHAT_MODEL,
  runFlashcardChat,
  type ChatImage,
  type ChatSet,
  type FlashcardChatStore,
} from "./chatAgent";

const MAX_HISTORY_MESSAGES = 40;
// Photos attached to the model per turn: the set's source pages plus the most
// recent photos from the conversation. Each photo costs tokens on every turn.
const MAX_ATTACHED_IMAGES = 10;

const toolActionValidator = v.array(
  v.object({
    tool: v.string(),
    summary: v.string(),
  })
);

async function requireOwnedSet(
  ctx: { db: { get: (id: Id<"flashcardSets">) => Promise<Doc<"flashcardSets"> | null> } },
  userId: string,
  setId: Id<"flashcardSets">
) {
  const set = await ctx.db.get(setId);
  if (!set || set.userId !== userId) {
    throw new Error("Flashcard set not found.");
  }
  return set;
}

export const listMessages = query({
  args: { setId: v.id("flashcardSets") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const set = await ctx.db.get(args.setId);
    if (!set || set.userId !== userId) {
      return [];
    }
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_setId_createdAt", (q) => q.eq("setId", args.setId))
      .collect();

    return Promise.all(
      messages.map(async (message) => {
        const images = await Promise.all(
          (message.imageIds ?? []).map(async (imageId) => {
            const image = await ctx.db.get(imageId);
            if (!image || image.userId !== userId) return null;
            return { id: imageId, url: await ctx.storage.getUrl(image.storageId) };
          })
        );
        return {
          _id: message._id,
          role: message.role,
          content: message.content,
          toolActions: message.toolActions,
          createdAt: message.createdAt,
          images: images.filter((image) => image !== null),
        };
      })
    );
  },
});

export const clearMessages = mutation({
  args: { setId: v.id("flashcardSets") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await requireOwnedSet(ctx, userId, args.setId);
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_setId_createdAt", (q) => q.eq("setId", args.setId))
      .collect();
    await Promise.all(messages.map((message) => ctx.db.delete(message._id)));
  },
});

export const getChatContext = internalQuery({
  args: {
    userId: v.string(),
    setId: v.id("flashcardSets"),
    imageIds: v.array(v.id("images")),
  },
  handler: async (ctx, args) => {
    const set = await requireOwnedSet(ctx, args.userId, args.setId);

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_setId_createdAt", (q) => q.eq("setId", args.setId))
      .collect();
    const history = messages.slice(-MAX_HISTORY_MESSAGES);

    const interaction = set.llmInteractionId
      ? await ctx.db.get(set.llmInteractionId)
      : null;

    // Source pages first, then photos from the conversation, newest last.
    const orderedImageIds: Array<Id<"images">> = [
      ...(interaction?.imageIds ?? []),
      ...history.flatMap((message) => message.imageIds ?? []),
      ...args.imageIds,
    ];
    const seen = new Set<string>();
    const uniqueImageIds = orderedImageIds.filter((imageId) => {
      if (seen.has(imageId)) return false;
      seen.add(imageId);
      return true;
    });
    // Keep the source pages and the most recent conversation photos.
    const sourceCount = interaction?.imageIds.length ?? 0;
    const keptSource = uniqueImageIds.slice(0, sourceCount).slice(0, MAX_ATTACHED_IMAGES);
    const room = MAX_ATTACHED_IMAGES - keptSource.length;
    const keptConversation = room > 0 ? uniqueImageIds.slice(sourceCount).slice(-room) : [];
    const keptImageIds = [...keptSource, ...keptConversation];

    const loadedImages = await Promise.all(keptImageIds.map((imageId) => ctx.db.get(imageId)));
    const images = loadedImages.filter(
      (image): image is NonNullable<typeof image> =>
        image !== null && image.userId === args.userId
    );

    for (const imageId of args.imageIds) {
      const image = await ctx.db.get(imageId);
      if (!image || image.userId !== args.userId) {
        throw new Error("One of the attached photos could not be found. Please add it again.");
      }
    }

    return {
      defaultModel: interaction?.model ?? null,
      history: history.map((message) => ({
        id: message._id,
        role: message.role,
        content: message.content,
        imageCount: message.imageIds?.length ?? 0,
      })),
      images: images.map((image) => ({
        storageId: image.storageId,
        mimeType: image.mimeType,
        filename: image.filename,
      })),
    };
  },
});

export const appendTurn = internalMutation({
  args: {
    userId: v.string(),
    setId: v.id("flashcardSets"),
    userMessage: v.string(),
    userImageIds: v.array(v.id("images")),
    assistantMessage: v.string(),
    toolActions: toolActionValidator,
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("chatMessages", {
      userId: args.userId,
      setId: args.setId,
      role: "user",
      content: args.userMessage,
      imageIds: args.userImageIds.length > 0 ? args.userImageIds : undefined,
      createdAt: now,
    });
    await ctx.db.insert("chatMessages", {
      userId: args.userId,
      setId: args.setId,
      role: "assistant",
      content: args.assistantMessage,
      toolActions: args.toolActions.length > 0 ? args.toolActions : undefined,
      createdAt: now + 1,
    });
  },
});

// Function references avoid importing `api`/`internal` from within Convex
// functions, which produces circular types (same pattern as generation.ts).
const getEncryptedOpenRouterKeyRef = makeFunctionReference<
  "query",
  { userId: string },
  string | null
>("settings:getEncryptedOpenRouterKey");

const getPreferredModelRef = makeFunctionReference<
  "query",
  { userId: string },
  string | null
>("settings:getPreferredModel");

const getChatContextRef = makeFunctionReference<
  "query",
  { userId: string; setId: Id<"flashcardSets">; imageIds: Array<Id<"images">> },
  {
    defaultModel: string | null;
    history: Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      imageCount: number;
    }>;
    images: Array<{ storageId: Id<"_storage">; mimeType: string; filename: string }>;
  }
>("chat:getChatContext");

const appendTurnRef = makeFunctionReference<
  "mutation",
  {
    userId: string;
    setId: Id<"flashcardSets">;
    userMessage: string;
    userImageIds: Array<Id<"images">>;
    assistantMessage: string;
    toolActions: Array<{ tool: string; summary: string }>;
  },
  void
>("chat:appendTurn");

const getFlashcardSetRef = makeFunctionReference<
  "query",
  { setId: Id<"flashcardSets"> },
  {
    title: string;
    description?: string;
    flashcards: Array<{ _id: Id<"flashcards">; question: string; answer: string }>;
  } | null
>("flashcards:getFlashcardSet");

const updateFlashcardRef = makeFunctionReference<
  "mutation",
  { flashcardId: Id<"flashcards">; question: string; answer: string },
  unknown
>("flashcards:updateFlashcard");

const createFlashcardRef = makeFunctionReference<
  "mutation",
  { setId: Id<"flashcardSets">; question: string; answer: string },
  unknown
>("flashcards:createFlashcard");

const deleteFlashcardRef = makeFunctionReference<
  "mutation",
  { flashcardId: Id<"flashcards"> },
  void
>("flashcards:deleteFlashcard");

const updateFlashcardSetRef = makeFunctionReference<
  "mutation",
  {
    setId: Id<"flashcardSets">;
    title?: string;
    description?: string | null;
    frontLanguage?: string | null;
    backLanguage?: string | null;
    speakFront?: boolean;
    speakBack?: boolean;
  },
  unknown
>("flashcards:updateFlashcardSet");

const generateFlashcardsRef = makeFunctionReference<
  "action",
  { imageIds: Array<Id<"images">>; model: string; customInstructions?: string },
  {
    flashcardSet: { _id: Id<"flashcardSets">; title: string } | null;
    flashcards: Array<{ _id: Id<"flashcards"> }>;
  }
>("generation:generateFlashcards");

const DEFAULT_GENERATE_MESSAGE = "Make flashcards from these photos.";

/**
 * First turn of a chat: creates a set from the attached photos and/or the
 * student's description, then records the exchange so the conversation can
 * continue on that set.
 */
export const generateSet = action({
  args: {
    imageIds: v.array(v.id("images")),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const message = args.message.trim();
    if (args.imageIds.length === 0 && message === "") {
      throw new Error("Add a photo or describe what the flashcards should be about.");
    }
    const model = (await ctx.runQuery(getPreferredModelRef, { userId })) ?? DEFAULT_CHAT_MODEL;

    const result = await ctx.runAction(generateFlashcardsRef, {
      imageIds: args.imageIds,
      model,
      customInstructions: message === "" ? undefined : message,
    });
    if (!result.flashcardSet) {
      throw new Error("The flashcard set could not be created.");
    }

    const count = result.flashcards.length;
    const reply = `I made the set "${result.flashcardSet.title}" with ${count} flashcard${
      count === 1 ? "" : "s"
    }. Have a look below. Tell me what to change, or ${
      args.imageIds.length > 0 ? "add more photos" : "describe more topics"
    } to make more cards.`;

    await ctx.runMutation(appendTurnRef, {
      userId,
      setId: result.flashcardSet._id,
      userMessage: message === "" ? DEFAULT_GENERATE_MESSAGE : message,
      userImageIds: args.imageIds,
      assistantMessage: reply,
      toolActions: [],
    });

    return { setId: result.flashcardSet._id, title: result.flashcardSet.title, count };
  },
});

export const sendMessage = action({
  args: {
    setId: v.id("flashcardSets"),
    message: v.string(),
    imageIds: v.optional(v.array(v.id("images"))),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const attachedImageIds = args.imageIds ?? [];
    const message =
      args.message.trim() !== ""
        ? args.message.trim()
        : attachedImageIds.length > 0
          ? "Have a look at these photos."
          : "";
    if (message === "") {
      throw new Error("Type a message or add a photo first.");
    }

    const encryptedKey = await ctx.runQuery(getEncryptedOpenRouterKeyRef, { userId });
    if (!encryptedKey) {
      throw new Error("Add your OpenRouter API key in Settings before chatting.");
    }
    const apiKey = await decryptSecret(encryptedKey);
    const preferredModel = await ctx.runQuery(getPreferredModelRef, { userId });

    const context = await ctx.runQuery(getChatContextRef, {
      userId,
      setId: args.setId,
      imageIds: attachedImageIds,
    });

    // The public flashcard mutations check ownership through the auth context,
    // which Convex propagates from this action.
    const getSet = async (): Promise<ChatSet> => {
      const set = await ctx.runQuery(getFlashcardSetRef, { setId: args.setId });
      if (!set) {
        throw new Error("Flashcard set not found.");
      }
      return {
        title: set.title,
        description: set.description,
        flashcards: set.flashcards.map((card) => ({
          id: card._id,
          question: card.question,
          answer: card.answer,
        })),
      };
    };

    const store: FlashcardChatStore = {
      getSet,
      updateCard: async (id, question, answer) => {
        await ctx.runMutation(updateFlashcardRef, {
          flashcardId: id as Id<"flashcards">,
          question,
          answer,
        });
      },
      addCard: async (question, answer) => {
        await ctx.runMutation(createFlashcardRef, { setId: args.setId, question, answer });
      },
      deleteCard: async (id) => {
        await ctx.runMutation(deleteFlashcardRef, { flashcardId: id as Id<"flashcards"> });
      },
      updateSet: async (patch) => {
        await ctx.runMutation(updateFlashcardSetRef, { setId: args.setId, ...patch });
      },
    };

    const images: Array<ChatImage> = [];
    for (const image of context.images) {
      const blob = await ctx.storage.get(image.storageId);
      if (!blob) continue;
      images.push({
        mediaType: image.mimeType,
        fileName: image.filename,
        data: new Uint8Array(await blob.arrayBuffer()),
      });
    }

    const result = await runFlashcardChat({
      apiKey,
      model: preferredModel ?? context.defaultModel ?? DEFAULT_CHAT_MODEL,
      set: await getSet(),
      history: context.history,
      images,
      newImageCount: attachedImageIds.length,
      message,
      store,
    });

    await ctx.runMutation(appendTurnRef, {
      userId,
      setId: args.setId,
      userMessage: message,
      userImageIds: attachedImageIds,
      assistantMessage: result.reply,
      toolActions: [...result.toolActions],
    });

    return result;
  },
});
