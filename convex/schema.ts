import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  images: defineTable({
    userId: v.string(),
    filename: v.string(),
    mimeType: v.string(),
    size: v.number(),
    storageId: v.id("_storage"),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

  llmInteractions: defineTable({
    userId: v.string(),
    model: v.string(),
    prompt: v.string(),
    response: v.string(),
    imageIds: v.array(v.id("images")),
    tokensUsed: v.optional(v.number()),
    customInstructions: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_userId_createdAt", ["userId", "createdAt"]),

  flashcardSets: defineTable({
    userId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    llmInteractionId: v.optional(v.id("llmInteractions")),
    flipMode: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

  flashcards: defineTable({
    userId: v.string(),
    setId: v.id("flashcardSets"),
    question: v.string(),
    answer: v.string(),
    orderIndex: v.number(),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_setId_orderIndex", ["setId", "orderIndex"])
    .index("by_userId_setId", ["userId", "setId"]),

  sharedFlashcardSets: defineTable({
    ownerUserId: v.string(),
    sourceSetId: v.id("flashcardSets"),
    slug: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    flipMode: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_ownerUserId_createdAt", ["ownerUserId", "createdAt"])
    .index("by_sourceSetId_createdAt", ["sourceSetId", "createdAt"])
    .index("by_slug", ["slug"]),

  sharedFlashcards: defineTable({
    sharedSetId: v.id("sharedFlashcardSets"),
    question: v.string(),
    answer: v.string(),
    orderIndex: v.number(),
    createdAt: v.number(),
  }).index("by_sharedSetId_orderIndex", ["sharedSetId", "orderIndex"]),

  studyProgress: defineTable({
    userId: v.string(),
    setId: v.id("flashcardSets"),
    flashcardId: v.id("flashcards"),
    dontKnow: v.boolean(),
    markedAt: v.number(),
  })
    .index("by_userId_setId", ["userId", "setId"])
    .index("by_userId_setId_flashcardId", ["userId", "setId", "flashcardId"]),

  userSettings: defineTable({
    userId: v.string(),
    openRouterKeyCiphertext: v.optional(v.string()),
    openRouterKeyLast4: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
});
