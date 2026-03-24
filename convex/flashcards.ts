import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./lib";
import type { Id } from "./_generated/dataModel";

async function requireOwnedSet(
  ctx: MutationCtx | QueryCtx,
  userId: string,
  setId: Id<"flashcardSets">
) {
  const set = await ctx.db.get(setId);
  if (!set || set.userId !== userId) {
    throw new Error("Flashcard set not found.");
  }
  return set;
}

async function requireOwnedCard(
  ctx: MutationCtx,
  userId: string,
  flashcardId: Id<"flashcards">
) {
  const flashcard = await ctx.db.get(flashcardId);
  if (!flashcard || flashcard.userId !== userId) {
    throw new Error("Flashcard not found.");
  }
  return flashcard;
}

export const listFlashcardSets = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const sets = await ctx.db
      .query("flashcardSets")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return Promise.all(
      sets.map(async (set) => {
        const flashcards = await ctx.db
          .query("flashcards")
          .withIndex("by_setId_orderIndex", (q) => q.eq("setId", set._id))
          .collect();

        return {
          ...set,
          flashcards: flashcards.filter((card) => card.deletedAt === undefined),
        };
      })
    );
  },
});

export const getFlashcardSet = query({
  args: {
    setId: v.id("flashcardSets"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const set = await ctx.db.get(args.setId);
    if (!set || set.userId !== userId) {
      return null;
    }
    const flashcards = await ctx.db
      .query("flashcards")
      .withIndex("by_setId_orderIndex", (q) => q.eq("setId", args.setId))
      .collect();

    return {
      ...set,
      flashcards: flashcards.filter((card) => card.deletedAt === undefined),
    };
  },
});

export const getRecentInstructions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const interactions = await ctx.db
      .query("llmInteractions")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);

    const deduped: string[] = [];
    for (const interaction of interactions) {
      if (
        interaction.customInstructions &&
        !deduped.includes(interaction.customInstructions)
      ) {
        deduped.push(interaction.customInstructions);
      }
      if (deduped.length === 3) {
        break;
      }
    }
    return deduped;
  },
});

export const updateFlashcardSet = mutation({
  args: {
    setId: v.id("flashcardSets"),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    flipMode: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await requireOwnedSet(ctx, userId, args.setId);

    const patch: Record<string, unknown> = {};
    if (args.title !== undefined) patch.title = args.title;
    if (args.description !== undefined) patch.description = args.description ?? undefined;
    if (args.flipMode !== undefined) patch.flipMode = args.flipMode;

    await ctx.db.patch(args.setId, patch);
    return ctx.db.get(args.setId);
  },
});

export const createFlashcardSet = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const title = args.title.trim();
    if (!title) {
      throw new Error("Title is required.");
    }

    const setId = await ctx.db.insert("flashcardSets", {
      userId,
      title,
      description: args.description?.trim() || undefined,
      flipMode: false,
      createdAt: Date.now(),
    });

    return ctx.db.get(setId);
  },
});

export const deleteFlashcardSet = mutation({
  args: {
    setId: v.id("flashcardSets"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await requireOwnedSet(ctx, userId, args.setId);

    const flashcards = await ctx.db
      .query("flashcards")
      .withIndex("by_setId_orderIndex", (q) => q.eq("setId", args.setId))
      .collect();
    const progress = await ctx.db
      .query("studyProgress")
      .withIndex("by_userId_setId", (q) => q.eq("userId", userId).eq("setId", args.setId))
      .collect();
    const sharedSets = await ctx.db
      .query("sharedFlashcardSets")
      .withIndex("by_sourceSetId_createdAt", (q) => q.eq("sourceSetId", args.setId))
      .collect();
    const sharedCards = await Promise.all(
      sharedSets.map((sharedSet) =>
        ctx.db
          .query("sharedFlashcards")
          .withIndex("by_sharedSetId_orderIndex", (q) => q.eq("sharedSetId", sharedSet._id))
          .collect()
      )
    );

    await Promise.all(flashcards.map((card) => ctx.db.delete(card._id)));
    await Promise.all(progress.map((item) => ctx.db.delete(item._id)));
    await Promise.all(sharedCards.flat().map((card) => ctx.db.delete(card._id)));
    await Promise.all(sharedSets.map((sharedSet) => ctx.db.delete(sharedSet._id)));
    await ctx.db.delete(args.setId);
  },
});

export const createFlashcard = mutation({
  args: {
    setId: v.id("flashcardSets"),
    question: v.string(),
    answer: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await requireOwnedSet(ctx, userId, args.setId);
    const existing = await ctx.db
      .query("flashcards")
      .withIndex("by_setId_orderIndex", (q) => q.eq("setId", args.setId))
      .collect();

    const flashcardId = await ctx.db.insert("flashcards", {
      userId,
      setId: args.setId,
      question: args.question,
      answer: args.answer,
      orderIndex: existing.filter((card) => card.deletedAt === undefined).length,
      createdAt: Date.now(),
    });

    return ctx.db.get(flashcardId);
  },
});

export const updateFlashcard = mutation({
  args: {
    flashcardId: v.id("flashcards"),
    question: v.string(),
    answer: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await requireOwnedCard(ctx, userId, args.flashcardId);
    await ctx.db.patch(args.flashcardId, {
      question: args.question,
      answer: args.answer,
    });
    return ctx.db.get(args.flashcardId);
  },
});

export const deleteFlashcard = mutation({
  args: {
    flashcardId: v.id("flashcards"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const flashcard = await requireOwnedCard(ctx, userId, args.flashcardId);
    await ctx.db.patch(args.flashcardId, {
      deletedAt: Date.now(),
    });

    const progress = await ctx.db
      .query("studyProgress")
      .withIndex("by_userId_setId_flashcardId", (q) =>
        q.eq("userId", userId).eq("setId", flashcard.setId).eq("flashcardId", args.flashcardId)
      )
      .unique();

    if (progress) {
      await ctx.db.delete(progress._id);
    }
  },
});

export const getStudyProgress = query({
  args: {
    setId: v.id("flashcardSets"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await requireOwnedSet(ctx, userId, args.setId);
    return ctx.db
      .query("studyProgress")
      .withIndex("by_userId_setId", (q) => q.eq("userId", userId).eq("setId", args.setId))
      .collect();
  },
});

export const markStudyProgress = mutation({
  args: {
    setId: v.id("flashcardSets"),
    flashcardId: v.id("flashcards"),
    dontKnow: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await requireOwnedSet(ctx, userId, args.setId);
    await requireOwnedCard(ctx, userId, args.flashcardId);

    const existing = await ctx.db
      .query("studyProgress")
      .withIndex("by_userId_setId_flashcardId", (q) =>
        q.eq("userId", userId).eq("setId", args.setId).eq("flashcardId", args.flashcardId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        dontKnow: args.dontKnow,
        markedAt: Date.now(),
      });
      return ctx.db.get(existing._id);
    }

    const progressId = await ctx.db.insert("studyProgress", {
      userId,
      setId: args.setId,
      flashcardId: args.flashcardId,
      dontKnow: args.dontKnow,
      markedAt: Date.now(),
    });

    return ctx.db.get(progressId);
  },
});

export const resetStudyProgress = mutation({
  args: {
    setId: v.id("flashcardSets"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await requireOwnedSet(ctx, userId, args.setId);

    const progress = await ctx.db
      .query("studyProgress")
      .withIndex("by_userId_setId", (q) => q.eq("userId", userId).eq("setId", args.setId))
      .collect();

    await Promise.all(progress.map((item) => ctx.db.delete(item._id)));
  },
});

export const createGeneratedFlashcards = internalMutation({
  args: {
    userId: v.string(),
    model: v.string(),
    prompt: v.string(),
    response: v.string(),
    imageIds: v.array(v.id("images")),
    tokensUsed: v.optional(v.number()),
    customInstructions: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    flashcards: v.array(
      v.object({
        question: v.string(),
        answer: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const createdAt = Date.now();
    const interactionId = await ctx.db.insert("llmInteractions", {
      userId: args.userId,
      model: args.model,
      prompt: args.prompt,
      response: args.response,
      imageIds: args.imageIds,
      tokensUsed: args.tokensUsed,
      customInstructions: args.customInstructions,
      createdAt,
    });

    const setId = await ctx.db.insert("flashcardSets", {
      userId: args.userId,
      title: args.title,
      description: args.description,
      llmInteractionId: interactionId,
      flipMode: false,
      createdAt,
    });

    const flashcardIds = await Promise.all(
      args.flashcards.map((card, index) =>
        ctx.db.insert("flashcards", {
          userId: args.userId,
          setId,
          question: card.question,
          answer: card.answer,
          orderIndex: index,
          createdAt,
        })
      )
    );

    const flashcards = await Promise.all(flashcardIds.map((id) => ctx.db.get(id)));
    const flashcardSet = await ctx.db.get(setId);

    return {
      flashcardSet,
      flashcards: flashcards.filter((card) => card !== null),
    };
  },
});
