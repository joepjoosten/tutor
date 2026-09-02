import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { decryptSecret, requireUser } from "./lib";
import {
  DEFAULT_CHAT_MODEL,
  runFlashcardChat,
  type ChatImage,
  type ChatSet,
  type FlashcardChatStore,
} from "./chatAgent";

const MAX_HISTORY_MESSAGES = 40;

const toolActionValidator = v.array(
  v.object({
    tool: v.string(),
    summary: v.string(),
  })
);

export const listMessages = query({
  args: { setId: v.id("flashcardSets") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const set = await ctx.db.get(args.setId);
    if (!set || set.userId !== userId) {
      return [];
    }
    return ctx.db
      .query("chatMessages")
      .withIndex("by_setId_createdAt", (q) => q.eq("setId", args.setId))
      .collect();
  },
});

export const clearMessages = mutation({
  args: { setId: v.id("flashcardSets") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const set = await ctx.db.get(args.setId);
    if (!set || set.userId !== userId) {
      throw new Error("Flashcard set not found.");
    }
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_setId_createdAt", (q) => q.eq("setId", args.setId))
      .collect();
    await Promise.all(messages.map((message) => ctx.db.delete(message._id)));
  },
});

export const getChatContext = internalQuery({
  args: { userId: v.string(), setId: v.id("flashcardSets") },
  handler: async (ctx, args) => {
    const set = await ctx.db.get(args.setId);
    if (!set || set.userId !== args.userId) {
      throw new Error("Flashcard set not found.");
    }

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_setId_createdAt", (q) => q.eq("setId", args.setId))
      .collect();

    const interaction = set.llmInteractionId
      ? await ctx.db.get(set.llmInteractionId)
      : null;
    const loadedImages = interaction
      ? await Promise.all(interaction.imageIds.map((imageId) => ctx.db.get(imageId)))
      : [];
    const images = loadedImages.filter(
      (image): image is NonNullable<typeof image> =>
        image !== null && image.userId === args.userId
    );

    return {
      defaultModel: interaction?.model ?? null,
      history: messages.slice(-MAX_HISTORY_MESSAGES).map((message) => ({
        id: message._id,
        role: message.role,
        content: message.content,
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

const getChatContextRef = makeFunctionReference<
  "query",
  { userId: string; setId: Id<"flashcardSets"> },
  {
    defaultModel: string | null;
    history: Array<{ id: string; role: "user" | "assistant"; content: string }>;
    images: Array<{ storageId: Id<"_storage">; mimeType: string; filename: string }>;
  }
>("chat:getChatContext");

const appendTurnRef = makeFunctionReference<
  "mutation",
  {
    userId: string;
    setId: Id<"flashcardSets">;
    userMessage: string;
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
  { setId: Id<"flashcardSets">; title?: string; description?: string | null },
  unknown
>("flashcards:updateFlashcardSet");

export const sendMessage = action({
  args: {
    setId: v.id("flashcardSets"),
    message: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const message = args.message.trim();
    if (message === "") {
      throw new Error("Type a message first.");
    }

    const encryptedKey = await ctx.runQuery(getEncryptedOpenRouterKeyRef, { userId });
    if (!encryptedKey) {
      throw new Error("Add your OpenRouter API key in Settings before chatting.");
    }
    const apiKey = await decryptSecret(encryptedKey);

    const context = await ctx.runQuery(getChatContextRef, { userId, setId: args.setId });

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
      model: args.model ?? context.defaultModel ?? DEFAULT_CHAT_MODEL,
      set: await getSet(),
      history: context.history,
      images,
      message,
      store,
    });

    await ctx.runMutation(appendTurnRef, {
      userId,
      setId: args.setId,
      userMessage: message,
      assistantMessage: result.reply,
      toolActions: [...result.toolActions],
    });

    return result;
  },
});
