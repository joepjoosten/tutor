import { beforeEach, describe, expect, it, vi } from "vitest";

import { handlerOf } from "./testHelpers";

const { mockRequireUser } = vi.hoisted(() => ({
  mockRequireUser: vi.fn(),
}));

vi.mock("./lib", () => ({
  requireUser: mockRequireUser,
}));

import {
  createOrGetShareLink,
  getActiveShareForSet,
  getSharedSetBySlug,
  importSharedSet,
  revokeShareLink,
} from "./shares";

function createIndexedQueryPlan<T>(options?: {
  collect?: T[];
  unique?: T | null;
}) {
  const collect = vi.fn().mockResolvedValue(options?.collect ?? []);
  const unique = vi.fn().mockResolvedValue(options?.unique ?? null);
  const ordered = { collect };
  const chain = {
    collect,
    unique,
    order: vi.fn().mockReturnValue(ordered),
  };
  const withIndex = vi.fn().mockImplementation((_indexName: string, callback?: (q: { eq: typeof vi.fn }) => unknown) => {
    const builder = {
      eq: vi.fn().mockReturnThis(),
    };
    callback?.(builder);
    return chain;
  });

  return { withIndex, collect, unique };
}

function createSharesCtx(options?: {
  getById?: Record<string, unknown>;
  queryPlans?: Record<string, Array<ReturnType<typeof createIndexedQueryPlan>>>;
  insertImpl?: (table: string, value: unknown) => Promise<string>;
}) {
  const queryPlans = Object.fromEntries(
    Object.entries(options?.queryPlans ?? {}).map(([table, plans]) => [table, [...plans]])
  ) as Record<string, Array<ReturnType<typeof createIndexedQueryPlan>>>;
  const get = vi.fn(async (id: string) => options?.getById?.[id] ?? null);
  const insert =
    options?.insertImpl
      ? vi.fn(options.insertImpl)
      : vi.fn(async (table: string) => `${table}-id`);
  const patch = vi.fn().mockResolvedValue(undefined);
  const del = vi.fn().mockResolvedValue(undefined);
  const query = vi.fn((table: string) => {
    const nextPlan = queryPlans[table]?.shift() ?? createIndexedQueryPlan();
    return { withIndex: nextPlan.withIndex };
  });

  return {
    ctx: {
      auth: {},
      db: {
        get,
        insert,
        patch,
        delete: del,
        query,
      },
    },
    get,
    insert,
    patch,
    delete: del,
  };
}

describe("shares", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "1234-5678-90ab-cdef-1234567890ab"
    );
    mockRequireUser.mockResolvedValue("user-123");
  });

  it("returns the active share for an owned set", async () => {
    const sharesPlan = createIndexedQueryPlan({
      collect: [
        { _id: "share-revoked", revokedAt: 1_600_000_000_000 },
        { _id: "share-active", revokedAt: undefined },
      ],
    });
    const { ctx } = createSharesCtx({
      getById: {
        "set-1": { _id: "set-1", userId: "user-123" },
      },
      queryPlans: {
        sharedFlashcardSets: [sharesPlan],
      },
    });

    await expect(
      handlerOf(getActiveShareForSet)(ctx as never, {
        setId: "set-1" as never,
      })
    ).resolves.toEqual({ _id: "share-active", revokedAt: undefined });
  });

  it("creates a new share snapshot from the current non-deleted cards", async () => {
    const flashcardsPlan = createIndexedQueryPlan({
      collect: [
        { _id: "card-1", question: "Q1", answer: "A1" },
        { _id: "card-2", question: "Q2", answer: "A2", deletedAt: 123 },
        { _id: "card-3", question: "Q3", answer: "A3" },
      ],
    });
    const existingSharesPlan = createIndexedQueryPlan({ collect: [] });
    const inserted: Array<{ table: string; value: unknown }> = [];
    const { ctx, insert } = createSharesCtx({
      getById: {
        "set-1": {
          _id: "set-1",
          userId: "user-123",
          title: "Biology",
          description: "Chapter 1",
          flipMode: true,
        },
        "share-1": {
          _id: "share-1",
          slug: "1234567890abcdef1234567890ab",
          title: "Biology",
        },
      },
      queryPlans: {
        flashcards: [flashcardsPlan],
        sharedFlashcardSets: [existingSharesPlan],
      },
      insertImpl: async (table, value) => {
        inserted.push({ table, value });
        if (table === "sharedFlashcardSets") return "share-1";
        return `${table}-${inserted.length}`;
      },
    });

    await expect(
      handlerOf(createOrGetShareLink)(ctx as never, {
        setId: "set-1" as never,
      })
    ).resolves.toEqual({
      _id: "share-1",
      slug: "1234567890abcdef1234567890ab",
      title: "Biology",
    });

    expect(insert).toHaveBeenCalledWith(
      "sharedFlashcardSets",
      expect.objectContaining({
        ownerUserId: "user-123",
        sourceSetId: "set-1",
        slug: "1234567890abcdef1234567890ab",
        title: "Biology",
        description: "Chapter 1",
        flipMode: true,
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      })
    );
    expect(insert).toHaveBeenCalledWith("sharedFlashcards", {
      sharedSetId: "share-1",
      question: "Q1",
      answer: "A1",
      orderIndex: 0,
      createdAt: 1_700_000_000_000,
    });
    expect(insert).toHaveBeenCalledWith("sharedFlashcards", {
      sharedSetId: "share-1",
      question: "Q3",
      answer: "A3",
      orderIndex: 1,
      createdAt: 1_700_000_000_000,
    });
  });

  it("refreshes the cards for an existing active share", async () => {
    const flashcardsPlan = createIndexedQueryPlan({
      collect: [{ _id: "card-1", question: "Q1", answer: "A1" }],
    });
    const existingSharesPlan = createIndexedQueryPlan({
      collect: [{ _id: "share-1", slug: "share-slug", revokedAt: undefined }],
    });
    const existingSharedCardsPlan = createIndexedQueryPlan({
      collect: [{ _id: "shared-card-1" }],
    });
    const { ctx, patch, delete: deleteDoc, insert } = createSharesCtx({
      getById: {
        "set-1": {
          _id: "set-1",
          userId: "user-123",
          title: "Updated title",
          description: "Updated description",
          flipMode: false,
        },
        "share-1": {
          _id: "share-1",
          slug: "share-slug",
          title: "Updated title",
        },
      },
      queryPlans: {
        flashcards: [flashcardsPlan],
        sharedFlashcardSets: [existingSharesPlan],
        sharedFlashcards: [existingSharedCardsPlan],
      },
    });

    await handlerOf(createOrGetShareLink)(ctx as never, {
      setId: "set-1" as never,
    });

    expect(patch).toHaveBeenCalledWith("share-1", {
      title: "Updated title",
      description: "Updated description",
      flipMode: false,
      updatedAt: 1_700_000_000_000,
    });
    expect(deleteDoc).toHaveBeenCalledWith("shared-card-1");
    expect(insert).toHaveBeenCalledWith("sharedFlashcards", {
      sharedSetId: "share-1",
      question: "Q1",
      answer: "A1",
      orderIndex: 0,
      createdAt: 1_700_000_000_000,
    });
  });

  it("revokes the active share link for an owned set", async () => {
    const sharesPlan = createIndexedQueryPlan({
      collect: [{ _id: "share-1", revokedAt: undefined }],
    });
    const { ctx, patch, get } = createSharesCtx({
      getById: {
        "set-1": { _id: "set-1", userId: "user-123" },
      },
      queryPlans: {
        sharedFlashcardSets: [sharesPlan],
      },
    });

    get.mockResolvedValueOnce({ _id: "set-1", userId: "user-123" } as never)
      .mockResolvedValueOnce({
        _id: "share-1",
        revokedAt: 1_700_000_000_000,
      } as never);

    await expect(
      handlerOf(revokeShareLink)(ctx as never, {
        setId: "set-1" as never,
      })
    ).resolves.toEqual({
      _id: "share-1",
      revokedAt: 1_700_000_000_000,
    });

    expect(patch).toHaveBeenCalledWith("share-1", {
      revokedAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    });
  });

  it("returns a public shared set by slug when active", async () => {
    const sharedSetPlan = createIndexedQueryPlan({
      unique: {
        _id: "share-1",
        slug: "share-slug",
        title: "Biology",
        flipMode: false,
      },
    });
    const sharedCardsPlan = createIndexedQueryPlan({
      collect: [{ _id: "shared-card-1", question: "Q1", answer: "A1", orderIndex: 0 }],
    });
    const { ctx } = createSharesCtx({
      queryPlans: {
        sharedFlashcardSets: [sharedSetPlan],
        sharedFlashcards: [sharedCardsPlan],
      },
    });

    await expect(
      handlerOf(getSharedSetBySlug)(ctx as never, { slug: "share-slug" })
    ).resolves.toEqual({
      _id: "share-1",
      slug: "share-slug",
      title: "Biology",
      flipMode: false,
      flashcards: [{ _id: "shared-card-1", question: "Q1", answer: "A1", orderIndex: 0 }],
    });
  });

  it("returns null for a revoked shared link", async () => {
    const sharedSetPlan = createIndexedQueryPlan({
      unique: { _id: "share-1", revokedAt: 1_700_000_000_000 },
    });
    const { ctx } = createSharesCtx({
      queryPlans: {
        sharedFlashcardSets: [sharedSetPlan],
      },
    });

    await expect(
      handlerOf(getSharedSetBySlug)(ctx as never, { slug: "share-slug" })
    ).resolves.toBeNull();
  });

  it("imports an active shared set into the signed-in user's private library", async () => {
    const sharedSetPlan = createIndexedQueryPlan({
      unique: {
        _id: "share-1",
        title: "Biology",
        description: "Chapter 1",
        flipMode: true,
      },
    });
    const sharedCardsPlan = createIndexedQueryPlan({
      collect: [
        { _id: "shared-card-1", question: "Q1", answer: "A1", orderIndex: 0 },
        { _id: "shared-card-2", question: "Q2", answer: "A2", orderIndex: 1 },
      ],
    });
    const inserted: Array<{ table: string; value: unknown }> = [];
    const { ctx, insert } = createSharesCtx({
      getById: {
        "set-1": {
          _id: "set-1",
          userId: "user-123",
          title: "Biology",
          description: "Chapter 1",
          flipMode: true,
          createdAt: 1_700_000_000_000,
        },
      },
      queryPlans: {
        sharedFlashcardSets: [sharedSetPlan],
        sharedFlashcards: [sharedCardsPlan],
      },
      insertImpl: async (table, value) => {
        inserted.push({ table, value });
        if (table === "flashcardSets") return "set-1";
        return `${table}-${inserted.length}`;
      },
    });

    await expect(
      handlerOf(importSharedSet)(ctx as never, { slug: "share-slug" })
    ).resolves.toEqual({
      _id: "set-1",
      userId: "user-123",
      title: "Biology",
      description: "Chapter 1",
      flipMode: true,
      createdAt: 1_700_000_000_000,
    });

    expect(insert).toHaveBeenCalledWith("flashcardSets", {
      userId: "user-123",
      title: "Biology",
      description: "Chapter 1",
      flipMode: true,
      createdAt: 1_700_000_000_000,
    });
    expect(insert).toHaveBeenCalledWith("flashcards", {
      userId: "user-123",
      setId: "set-1",
      question: "Q1",
      answer: "A1",
      orderIndex: 0,
      createdAt: 1_700_000_000_000,
    });
    expect(insert).toHaveBeenCalledWith("flashcards", {
      userId: "user-123",
      setId: "set-1",
      question: "Q2",
      answer: "A2",
      orderIndex: 1,
      createdAt: 1_700_000_000_000,
    });
  });

  it("rejects importing a revoked shared set", async () => {
    const sharedSetPlan = createIndexedQueryPlan({
      unique: { _id: "share-1", revokedAt: 1_700_000_000_000 },
    });
    const { ctx } = createSharesCtx({
      queryPlans: {
        sharedFlashcardSets: [sharedSetPlan],
      },
    });

    await expect(
      handlerOf(importSharedSet)(ctx as never, { slug: "share-slug" })
    ).rejects.toThrow("Shared flashcard set not found.");
  });
});
