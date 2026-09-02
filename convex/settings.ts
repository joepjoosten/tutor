import { mutation, query, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { encryptSecret, requireUser } from "./lib";

async function getSettingsDocId(ctx: QueryCtx | MutationCtx, userId: string) {
  const existing = await ctx.db
    .query("userSettings")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  return existing?._id ?? null;
}

export const getUserSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    return {
      hasOpenRouterKey: Boolean(settings?.openRouterKeyCiphertext),
      openRouterKeyLast4: settings?.openRouterKeyLast4 ?? null,
      preferredModel: settings?.preferredModel ?? null,
      ttsModel: settings?.ttsModel ?? null,
      ttsVoice: settings?.ttsVoice ?? null,
      animationsEnabled: settings?.animationsEnabled ?? true,
    };
  },
});

export const setAnimationsEnabled = mutation({
  args: {
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const now = Date.now();
    const docId = await getSettingsDocId(ctx, userId);

    if (docId) {
      await ctx.db.patch(docId, { animationsEnabled: args.enabled, updatedAt: now });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        animationsEnabled: args.enabled,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const setTtsSettings = mutation({
  args: {
    model: v.string(),
    voice: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const model = args.model.trim();
    if (model === "") {
      throw new Error("Choose a speech model.");
    }
    const voice = args.voice?.trim() || undefined;
    const now = Date.now();
    const docId = await getSettingsDocId(ctx, userId);

    if (docId) {
      await ctx.db.patch(docId, { ttsModel: model, ttsVoice: voice, updatedAt: now });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        ttsModel: model,
        ttsVoice: voice,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const getTtsSettings = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    return {
      model: settings?.ttsModel ?? null,
      voice: settings?.ttsVoice ?? null,
    };
  },
});

export const setPreferredModel = mutation({
  args: {
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const model = args.model.trim();
    if (model === "") {
      throw new Error("Choose a model.");
    }
    const now = Date.now();
    const docId = await getSettingsDocId(ctx, userId);

    if (docId) {
      await ctx.db.patch(docId, { preferredModel: model, updatedAt: now });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        preferredModel: model,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const getPreferredModel = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    return settings?.preferredModel ?? null;
  },
});

export const setOpenRouterKey = mutation({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const now = Date.now();
    const ciphertext = await encryptSecret(args.apiKey.trim());
    const docId = await getSettingsDocId(ctx, userId);

    if (docId) {
      await ctx.db.patch(docId, {
        openRouterKeyCiphertext: ciphertext,
        openRouterKeyLast4: args.apiKey.trim().slice(-4),
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        openRouterKeyCiphertext: ciphertext,
        openRouterKeyLast4: args.apiKey.trim().slice(-4),
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const clearOpenRouterKey = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const docId = await getSettingsDocId(ctx, userId);

    if (!docId) {
      return;
    }

    await ctx.db.patch(docId, {
      openRouterKeyCiphertext: undefined,
      openRouterKeyLast4: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const getEncryptedOpenRouterKey = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    return settings?.openRouterKeyCiphertext ?? null;
  },
});
