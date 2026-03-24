import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./lib";
import type { Doc, Id } from "./_generated/dataModel";

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

async function getActiveSourceCards(
  ctx: MutationCtx | QueryCtx,
  setId: Id<"flashcardSets">
) {
  const flashcards = await ctx.db
    .query("flashcards")
    .withIndex("by_setId_orderIndex", (q) => q.eq("setId", setId))
    .collect();

  return flashcards.filter((card) => card.deletedAt === undefined);
}

async function getActiveShareBySetId(
  ctx: MutationCtx | QueryCtx,
  setId: Id<"flashcardSets">
) {
  const shares = await ctx.db
    .query("sharedFlashcardSets")
    .withIndex("by_sourceSetId_createdAt", (q) => q.eq("sourceSetId", setId))
    .order("desc")
    .collect();

  return shares.find((share) => share.revokedAt === undefined) ?? null;
}

async function replaceSharedSnapshot(
  ctx: MutationCtx,
  shareId: Id<"sharedFlashcardSets">,
  cards: Array<Doc<"flashcards">>,
  createdAt: number
) {
  const existingCards = await ctx.db
    .query("sharedFlashcards")
    .withIndex("by_sharedSetId_orderIndex", (q) => q.eq("sharedSetId", shareId))
    .collect();

  await Promise.all(existingCards.map((card) => ctx.db.delete(card._id)));
  await Promise.all(
    cards.map((card, index) =>
      ctx.db.insert("sharedFlashcards", {
        sharedSetId: shareId,
        question: card.question,
        answer: card.answer,
        orderIndex: index,
        createdAt,
      })
    )
  );
}

function createShareSlug() {
  return crypto.randomUUID().replace(/-/g, "");
}

export const getActiveShareForSet = query({
  args: {
    setId: v.id("flashcardSets"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await requireOwnedSet(ctx, userId, args.setId);
    return getActiveShareBySetId(ctx, args.setId);
  },
});

export const createOrGetShareLink = mutation({
  args: {
    setId: v.id("flashcardSets"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const set = await requireOwnedSet(ctx, userId, args.setId);
    const cards = await getActiveSourceCards(ctx, args.setId);
    const timestamp = Date.now();
    const activeShare = await getActiveShareBySetId(ctx, args.setId);

    if (activeShare) {
      await ctx.db.patch(activeShare._id, {
        title: set.title,
        description: set.description,
        flipMode: set.flipMode,
        updatedAt: timestamp,
      });
      await replaceSharedSnapshot(ctx, activeShare._id, cards, timestamp);
      return ctx.db.get(activeShare._id);
    }

    const shareId = await ctx.db.insert("sharedFlashcardSets", {
      ownerUserId: userId,
      sourceSetId: args.setId,
      slug: createShareSlug(),
      title: set.title,
      description: set.description,
      flipMode: set.flipMode,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await replaceSharedSnapshot(ctx, shareId, cards, timestamp);
    return ctx.db.get(shareId);
  },
});

export const revokeShareLink = mutation({
  args: {
    setId: v.id("flashcardSets"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await requireOwnedSet(ctx, userId, args.setId);
    const activeShare = await getActiveShareBySetId(ctx, args.setId);

    if (!activeShare) {
      return null;
    }

    await ctx.db.patch(activeShare._id, {
      revokedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return ctx.db.get(activeShare._id);
  },
});

export const getSharedSetBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const sharedSet = await ctx.db
      .query("sharedFlashcardSets")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!sharedSet || sharedSet.revokedAt !== undefined) {
      return null;
    }

    const flashcards = await ctx.db
      .query("sharedFlashcards")
      .withIndex("by_sharedSetId_orderIndex", (q) => q.eq("sharedSetId", sharedSet._id))
      .collect();

    return {
      ...sharedSet,
      flashcards,
    };
  },
});

export const importSharedSet = mutation({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const sharedSet = await ctx.db
      .query("sharedFlashcardSets")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!sharedSet || sharedSet.revokedAt !== undefined) {
      throw new Error("Shared flashcard set not found.");
    }

    const sharedCards = await ctx.db
      .query("sharedFlashcards")
      .withIndex("by_sharedSetId_orderIndex", (q) => q.eq("sharedSetId", sharedSet._id))
      .collect();

    const timestamp = Date.now();
    const setId = await ctx.db.insert("flashcardSets", {
      userId,
      title: sharedSet.title,
      description: sharedSet.description,
      flipMode: sharedSet.flipMode,
      createdAt: timestamp,
    });

    await Promise.all(
      sharedCards.map((card, index) =>
        ctx.db.insert("flashcards", {
          userId,
          setId,
          question: card.question,
          answer: card.answer,
          orderIndex: index,
          createdAt: timestamp,
        })
      )
    );

    return ctx.db.get(setId);
  },
});
