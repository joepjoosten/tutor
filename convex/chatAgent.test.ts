import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import {
  buildPrompt,
  buildSystemPrompt,
  flashcardToolkit,
  makeHandlers,
  type ChatCard,
  type FlashcardChatStore,
  type ToolAction,
} from "./chatAgent";

function makeFakeStore(initial: Array<ChatCard>) {
  let cards = [...initial];
  let title = "Biology chapter 3";
  let description: string | undefined = "Cells";
  let nextId = 100;

  const store: FlashcardChatStore = {
    getSet: async () => ({ title, description, flashcards: cards }),
    updateCard: async (id, question, answer) => {
      cards = cards.map((card) => (card.id === id ? { ...card, question, answer } : card));
    },
    addCard: async (question, answer) => {
      cards = [...cards, { id: `card${nextId++}`, question, answer }];
    },
    deleteCard: async (id) => {
      cards = cards.filter((card) => card.id !== id);
    },
    updateSet: async (patch) => {
      if (patch.title !== undefined) title = patch.title;
      if (patch.description !== undefined) description = patch.description ?? undefined;
    },
  };

  return {
    store,
    get cards() {
      return cards;
    },
    get title() {
      return title;
    },
  };
}

async function callTool(
  store: FlashcardChatStore,
  actions: Array<ToolAction>,
  name: keyof typeof flashcardToolkit.tools,
  params: Record<string, unknown>
) {
  const program = Effect.gen(function* () {
    const tools = yield* flashcardToolkit.pipe(Effect.provide(makeHandlers(store, actions)));
    const stream = yield* tools.handle(name, params as never);
    const results = yield* Stream.runCollect(stream);
    return results;
  });
  const results = await Effect.runPromise(program);
  const last = [...results].at(-1) as { result: unknown } | undefined;
  return last?.result as string;
}

const cards: Array<ChatCard> = [
  { id: "a", question: "What is a cell?", answer: "The basic unit of life." },
  { id: "b", question: "What does the nucleus do?", answer: "Stores DNA." },
];

describe("buildSystemPrompt", () => {
  it("lists the cards with 1-based numbers", () => {
    const prompt = buildSystemPrompt({ title: "Bio", flashcards: cards }, true);
    expect(prompt).toContain("#1\nQ: What is a cell?");
    expect(prompt).toContain("#2\nQ: What does the nucleus do?");
    expect(prompt).toContain("photos of the study material are attached");
  });
});

describe("buildPrompt", () => {
  it("gives historical assistant turns an item id and attaches images to the new message", () => {
    const messages = buildPrompt({
      set: { title: "Bio", flashcards: cards },
      history: [
        { id: "m1", role: "user", content: "hi" },
        { id: "k1:2-3", role: "assistant", content: "hello" },
      ],
      images: [{ mediaType: "image/jpeg", fileName: "p.jpg", data: new Uint8Array([1]) }],
      message: "Fix card 2",
    });

    expect(messages[0]).toMatchObject({ role: "system" });
    expect(messages[1]).toEqual({ role: "user", content: "hi" });
    expect(messages[2]).toMatchObject({
      role: "assistant",
      content: [{ type: "text", text: "hello", options: { openai: { itemId: "msg_k123" } } }],
    });
    expect(messages[3]).toMatchObject({
      role: "user",
      content: [
        { type: "text", text: "Fix card 2" },
        { type: "file", mediaType: "image/jpeg", fileName: "p.jpg" },
      ],
    });
  });
});

describe("flashcard tools", () => {
  it("updates only the given field of a card by number", async () => {
    const fake = makeFakeStore(cards);
    const actions: Array<ToolAction> = [];

    const result = await callTool(fake.store, actions, "update_flashcard", {
      cardNumber: 2,
      answer: "Stores DNA and controls the cell.",
    });

    expect(result).toBe("Updated flashcard #2.");
    expect(fake.cards[1]).toEqual({
      id: "b",
      question: "What does the nucleus do?",
      answer: "Stores DNA and controls the cell.",
    });
    expect(actions).toEqual([
      { tool: "update_flashcard", summary: "Updated card #2: What does the nucleus do?" },
    ]);
  });

  it("adds and deletes cards and reports the new numbering", async () => {
    const fake = makeFakeStore(cards);
    const actions: Array<ToolAction> = [];

    await callTool(fake.store, actions, "add_flashcard", {
      question: "What is mitosis?",
      answer: "Cell division.",
    });
    expect(fake.cards).toHaveLength(3);

    const result = await callTool(fake.store, actions, "delete_flashcard", { cardNumber: 1 });
    expect(result).toContain("Deleted flashcard #1.");
    expect(result).toContain("#1\nQ: What does the nucleus do?");
    expect(fake.cards.map((card) => card.id)).toEqual(["b", "card100"]);
    expect(actions.map((action) => action.tool)).toEqual(["add_flashcard", "delete_flashcard"]);
  });

  it("reports a missing card as text instead of failing", async () => {
    const fake = makeFakeStore(cards);
    const actions: Array<ToolAction> = [];

    const result = await callTool(fake.store, actions, "delete_flashcard", { cardNumber: 7 });

    expect(result).toContain("Error: There is no flashcard #7");
    expect(fake.cards).toHaveLength(2);
    expect(actions).toEqual([]);
  });

  it("renames the set", async () => {
    const fake = makeFakeStore(cards);
    const actions: Array<ToolAction> = [];

    await callTool(fake.store, actions, "update_set", { title: "Cells" });

    expect(fake.title).toBe("Cells");
    expect(actions).toEqual([{ tool: "update_set", summary: 'Changed set title to "Cells"' }]);
  });
});
