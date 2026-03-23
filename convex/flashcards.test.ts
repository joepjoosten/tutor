import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireUser } = vi.hoisted(() => ({
  mockRequireUser: vi.fn(),
}));

vi.mock("./lib", () => ({
  requireUser: mockRequireUser,
}));

import {
  createFlashcard,
  createFlashcardSet,
  createGeneratedFlashcards,
  deleteFlashcard,
  deleteFlashcardSet,
  getRecentInstructions,
  getStudyProgress,
  listFlashcardSets,
  markStudyProgress,
  resetStudyProgress,
  updateFlashcard,
  updateFlashcardSet,
} from "./flashcards";

function createIndexedQueryPlan<T>(options?: {
  collect?: T[];
  unique?: T | null;
  take?: T[];
}) {
  const collect = vi.fn().mockResolvedValue(options?.collect ?? []);
  const unique = vi.fn().mockResolvedValue(options?.unique ?? null);
  const take = vi.fn().mockResolvedValue(options?.take ?? []);
  const ordered = { collect, take };
  const chain = {
    collect,
    unique,
    take,
    order: vi.fn().mockReturnValue(ordered),
  };
  const withIndex = vi.fn().mockImplementation((_, callback?: (q: { eq: typeof vi.fn }) => unknown) => {
    const builder = {
      eq: vi.fn().mockReturnThis(),
    };
    callback?.(builder);
    return chain;
  });

  return { withIndex, chain, collect, unique, take };
}

function createFlashcardsCtx(options?: {
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
      : vi.fn(async (_table: string) => `${_table}-id`);
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
    query,
  };
}

describe("flashcards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    mockRequireUser.mockResolvedValue("user-123");
  });

  it("lists flashcard sets with deleted flashcards filtered out", async () => {
    const setsPlan = createIndexedQueryPlan({
      collect: [
        { _id: "set-1", userId: "user-123", title: "Set 1" },
        { _id: "set-2", userId: "user-123", title: "Set 2" },
      ],
    });
    const flashcardsPlan1 = createIndexedQueryPlan({
      collect: [
        { _id: "card-1", question: "Q1" },
        { _id: "card-2", question: "Q2", deletedAt: 123 },
      ],
    });
    const flashcardsPlan2 = createIndexedQueryPlan({
      collect: [{ _id: "card-3", question: "Q3" }],
    });
    const { ctx } = createFlashcardsCtx({
      queryPlans: {
        flashcardSets: [setsPlan],
        flashcards: [flashcardsPlan1, flashcardsPlan2],
      },
    });

    await expect(listFlashcardSets._handler(ctx as never, {} as never)).resolves.toEqual([
      {
        _id: "set-1",
        userId: "user-123",
        title: "Set 1",
        flashcards: [{ _id: "card-1", question: "Q1" }],
      },
      {
        _id: "set-2",
        userId: "user-123",
        title: "Set 2",
        flashcards: [{ _id: "card-3", question: "Q3" }],
      },
    ]);
  });

  it("returns up to three unique recent custom instructions", async () => {
    const interactionsPlan = createIndexedQueryPlan({
      take: [
        { customInstructions: "Focus on definitions" },
        { customInstructions: "Focus on definitions" },
        { customInstructions: "Add examples" },
        { customInstructions: undefined },
        { customInstructions: "Use harder questions" },
        { customInstructions: "Ignored after cap" },
      ],
    });
    const { ctx } = createFlashcardsCtx({
      queryPlans: {
        llmInteractions: [interactionsPlan],
      },
    });

    await expect(
      getRecentInstructions._handler(ctx as never, {} as never)
    ).resolves.toEqual([
      "Focus on definitions",
      "Add examples",
      "Use harder questions",
    ]);
  });

  it("updates a flashcard set with only the provided fields", async () => {
    const { ctx, patch } = createFlashcardsCtx({
      getById: {
        "set-1": {
          _id: "set-1",
          userId: "user-123",
          title: "Old title",
        },
      },
    });
    const get = vi
      .spyOn(ctx.db, "get")
      .mockResolvedValueOnce({
        _id: "set-1",
        userId: "user-123",
        title: "Old title",
      } as never)
      .mockResolvedValueOnce({
        _id: "set-1",
        userId: "user-123",
        title: "New title",
        flipMode: true,
      } as never);

    await expect(
      updateFlashcardSet._handler(ctx as never, {
        setId: "set-1" as never,
        title: "New title",
        description: null,
        flipMode: true,
      })
    ).resolves.toEqual({
      _id: "set-1",
      userId: "user-123",
      title: "New title",
      flipMode: true,
    });

    expect(get).toHaveBeenCalledTimes(2);
    expect(patch).toHaveBeenCalledWith("set-1", {
      title: "New title",
      description: undefined,
      flipMode: true,
    });
  });

  it("creates a trimmed flashcard set and rejects blank titles", async () => {
    const { ctx, insert } = createFlashcardsCtx({
      getById: {
        "flashcardSets-id": {
          _id: "flashcardSets-id",
          userId: "user-123",
          title: "Biology",
          description: "Chapter 1",
          flipMode: false,
          createdAt: 1_700_000_000_000,
        },
      },
    });

    await expect(
      createFlashcardSet._handler(ctx as never, {
        title: "  Biology  ",
        description: "  Chapter 1  ",
      })
    ).resolves.toEqual({
      _id: "flashcardSets-id",
      userId: "user-123",
      title: "Biology",
      description: "Chapter 1",
      flipMode: false,
      createdAt: 1_700_000_000_000,
    });

    expect(insert).toHaveBeenCalledWith("flashcardSets", {
      userId: "user-123",
      title: "Biology",
      description: "Chapter 1",
      flipMode: false,
      createdAt: 1_700_000_000_000,
    });

    await expect(
      createFlashcardSet._handler(ctx as never, {
        title: "   ",
      } as never)
    ).rejects.toThrow("Title is required.");
  });

  it("deletes a flashcard set and its related flashcards and study progress", async () => {
    const flashcardsPlan = createIndexedQueryPlan({
      collect: [{ _id: "card-1" }, { _id: "card-2" }],
    });
    const progressPlan = createIndexedQueryPlan({
      collect: [{ _id: "progress-1" }],
    });
    const { ctx, delete: deleteDoc } = createFlashcardsCtx({
      getById: {
        "set-1": { _id: "set-1", userId: "user-123" },
      },
      queryPlans: {
        flashcards: [flashcardsPlan],
        studyProgress: [progressPlan],
      },
    });

    await deleteFlashcardSet._handler(ctx as never, { setId: "set-1" as never });

    expect(deleteDoc).toHaveBeenCalledWith("card-1");
    expect(deleteDoc).toHaveBeenCalledWith("card-2");
    expect(deleteDoc).toHaveBeenCalledWith("progress-1");
    expect(deleteDoc).toHaveBeenCalledWith("set-1");
  });

  it("creates a flashcard using the next non-deleted order index", async () => {
    const existingPlan = createIndexedQueryPlan({
      collect: [
        { _id: "card-1" },
        { _id: "card-2", deletedAt: 123 },
        { _id: "card-3" },
      ],
    });
    const { ctx, insert } = createFlashcardsCtx({
      getById: {
        "set-1": { _id: "set-1", userId: "user-123" },
        "flashcards-id": {
          _id: "flashcards-id",
          question: "New question",
          answer: "New answer",
          orderIndex: 2,
        },
      },
      queryPlans: {
        flashcards: [existingPlan],
      },
    });

    await expect(
      createFlashcard._handler(ctx as never, {
        setId: "set-1" as never,
        question: "New question",
        answer: "New answer",
      })
    ).resolves.toEqual({
      _id: "flashcards-id",
      question: "New question",
      answer: "New answer",
      orderIndex: 2,
    });

    expect(insert).toHaveBeenCalledWith("flashcards", {
      userId: "user-123",
      setId: "set-1",
      question: "New question",
      answer: "New answer",
      orderIndex: 2,
      createdAt: 1_700_000_000_000,
    });
  });

  it("updates an owned flashcard", async () => {
    const { ctx, patch } = createFlashcardsCtx();
    const get = vi
      .spyOn(ctx.db, "get")
      .mockResolvedValueOnce({
        _id: "card-1",
        userId: "user-123",
      } as never)
      .mockResolvedValueOnce({
        _id: "card-1",
        question: "Updated question",
        answer: "Updated answer",
      } as never);

    await expect(
      updateFlashcard._handler(ctx as never, {
        flashcardId: "card-1" as never,
        question: "Updated question",
        answer: "Updated answer",
      })
    ).resolves.toEqual({
      _id: "card-1",
      question: "Updated question",
      answer: "Updated answer",
    });

    expect(get).toHaveBeenCalledTimes(2);
    expect(patch).toHaveBeenCalledWith("card-1", {
      question: "Updated question",
      answer: "Updated answer",
    });
  });

  it("soft-deletes a flashcard and removes matching study progress", async () => {
    const progressPlan = createIndexedQueryPlan({
      unique: { _id: "progress-1" },
    });
    const { ctx, patch, delete: deleteDoc } = createFlashcardsCtx({
      getById: {
        "card-1": {
          _id: "card-1",
          userId: "user-123",
          setId: "set-1",
        },
      },
      queryPlans: {
        studyProgress: [progressPlan],
      },
    });

    await deleteFlashcard._handler(ctx as never, {
      flashcardId: "card-1" as never,
    });

    expect(patch).toHaveBeenCalledWith("card-1", {
      deletedAt: 1_700_000_000_000,
    });
    expect(deleteDoc).toHaveBeenCalledWith("progress-1");
  });

  it("returns study progress for an owned set", async () => {
    const progressPlan = createIndexedQueryPlan({
      collect: [{ _id: "progress-1", dontKnow: true }],
    });
    const { ctx } = createFlashcardsCtx({
      getById: {
        "set-1": { _id: "set-1", userId: "user-123" },
      },
      queryPlans: {
        studyProgress: [progressPlan],
      },
    });

    await expect(
      getStudyProgress._handler(ctx as never, { setId: "set-1" as never })
    ).resolves.toEqual([{ _id: "progress-1", dontKnow: true }]);
  });

  it("updates existing study progress when present", async () => {
    const progressPlan = createIndexedQueryPlan({
      unique: { _id: "progress-1" },
    });
    const { ctx, patch, insert } = createFlashcardsCtx({
      getById: {
        "set-1": { _id: "set-1", userId: "user-123" },
        "card-1": { _id: "card-1", userId: "user-123" },
        "progress-1": { _id: "progress-1", dontKnow: false },
      },
      queryPlans: {
        studyProgress: [progressPlan],
      },
    });

    await expect(
      markStudyProgress._handler(ctx as never, {
        setId: "set-1" as never,
        flashcardId: "card-1" as never,
        dontKnow: false,
      })
    ).resolves.toEqual({ _id: "progress-1", dontKnow: false });

    expect(patch).toHaveBeenCalledWith("progress-1", {
      dontKnow: false,
      markedAt: 1_700_000_000_000,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts new study progress when no record exists", async () => {
    const progressPlan = createIndexedQueryPlan({
      unique: null,
    });
    const { ctx, insert } = createFlashcardsCtx({
      getById: {
        "set-1": { _id: "set-1", userId: "user-123" },
        "card-1": { _id: "card-1", userId: "user-123" },
        "studyProgress-id": { _id: "studyProgress-id", dontKnow: true },
      },
      queryPlans: {
        studyProgress: [progressPlan],
      },
    });

    await expect(
      markStudyProgress._handler(ctx as never, {
        setId: "set-1" as never,
        flashcardId: "card-1" as never,
        dontKnow: true,
      })
    ).resolves.toEqual({ _id: "studyProgress-id", dontKnow: true });

    expect(insert).toHaveBeenCalledWith("studyProgress", {
      userId: "user-123",
      setId: "set-1",
      flashcardId: "card-1",
      dontKnow: true,
      markedAt: 1_700_000_000_000,
    });
  });

  it("resets study progress for an owned set", async () => {
    const progressPlan = createIndexedQueryPlan({
      collect: [{ _id: "progress-1" }, { _id: "progress-2" }],
    });
    const { ctx, delete: deleteDoc } = createFlashcardsCtx({
      getById: {
        "set-1": { _id: "set-1", userId: "user-123" },
      },
      queryPlans: {
        studyProgress: [progressPlan],
      },
    });

    await resetStudyProgress._handler(ctx as never, {
      setId: "set-1" as never,
    });

    expect(deleteDoc).toHaveBeenCalledWith("progress-1");
    expect(deleteDoc).toHaveBeenCalledWith("progress-2");
  });

  it("creates generated flashcards along with the linked interaction and set", async () => {
    const inserted: Array<{ table: string; value: unknown }> = [];
    const { ctx, insert } = createFlashcardsCtx({
      getById: {
        "set-1": {
          _id: "set-1",
          userId: "user-123",
          title: "Biology",
          createdAt: 1_700_000_000_000,
        },
        "card-1": {
          _id: "card-1",
          question: "Q1",
          answer: "A1",
          orderIndex: 0,
        },
        "card-2": {
          _id: "card-2",
          question: "Q2",
          answer: "A2",
          orderIndex: 1,
        },
      },
      insertImpl: async (table, value) => {
        inserted.push({ table, value });
        if (table === "llmInteractions") return "interaction-1";
        if (table === "flashcardSets") return "set-1";
        return inserted.filter((item) => item.table === "flashcards").length === 1
          ? "card-1"
          : "card-2";
      },
    });

    await expect(
      createGeneratedFlashcards._handler(ctx as never, {
        userId: "user-123",
        model: "openai/gpt-4o-mini",
        prompt: "prompt",
        response: "response",
        imageIds: ["image-1"] as never,
        tokensUsed: 321,
        customInstructions: "Focus on definitions",
        title: "Biology",
        description: "Chapter 1",
        flashcards: [
          { question: "Q1", answer: "A1" },
          { question: "Q2", answer: "A2" },
        ],
      })
    ).resolves.toEqual({
      flashcardSet: {
        _id: "set-1",
        userId: "user-123",
        title: "Biology",
        createdAt: 1_700_000_000_000,
      },
      flashcards: [
        { _id: "card-1", question: "Q1", answer: "A1", orderIndex: 0 },
        { _id: "card-2", question: "Q2", answer: "A2", orderIndex: 1 },
      ],
    });

    expect(insert).toHaveBeenCalledTimes(4);
    expect(inserted[0]).toEqual({
      table: "llmInteractions",
      value: {
        userId: "user-123",
        model: "openai/gpt-4o-mini",
        prompt: "prompt",
        response: "response",
        imageIds: ["image-1"],
        tokensUsed: 321,
        customInstructions: "Focus on definitions",
        createdAt: 1_700_000_000_000,
      },
    });
    expect(inserted[1]).toEqual({
      table: "flashcardSets",
      value: {
        userId: "user-123",
        title: "Biology",
        description: "Chapter 1",
        llmInteractionId: "interaction-1",
        flipMode: false,
        createdAt: 1_700_000_000_000,
      },
    });
  });
});
