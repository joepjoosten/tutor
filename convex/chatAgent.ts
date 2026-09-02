import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { Chat, Tool, Toolkit } from "effect/unstable/ai";
import type { Prompt } from "effect/unstable/ai";
import { FetchHttpClient } from "effect/unstable/http";

export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_CHAT_MODEL = "openai/gpt-5.6-terra";
const MAX_TOOL_ROUNDS = 4;

export interface ChatCard {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

export interface ChatSet {
  readonly title: string;
  readonly description?: string;
  readonly flashcards: ReadonlyArray<ChatCard>;
}

export interface ChatHistoryMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  /** Number of photos the student attached to this message. */
  readonly imageCount?: number;
}

export interface ChatImage {
  readonly mediaType: string;
  readonly fileName: string;
  readonly data: Uint8Array;
}

export interface ToolAction {
  readonly tool: string;
  readonly summary: string;
}

/**
 * The persistence the chat tools operate on. Implemented by the Convex action
 * with `ctx.runQuery` / `ctx.runMutation`, and by a fake in tests.
 */
export interface FlashcardChatStore {
  readonly getSet: () => Promise<ChatSet>;
  readonly updateCard: (id: string, question: string, answer: string) => Promise<void>;
  readonly addCard: (question: string, answer: string) => Promise<void>;
  readonly deleteCard: (id: string) => Promise<void>;
  readonly updateSet: (patch: {
    title?: string;
    description?: string | null;
    frontLanguage?: string | null;
    backLanguage?: string | null;
    speakFront?: boolean;
    speakBack?: boolean;
  }) => Promise<void>;
}

export interface RunChatOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly apiUrl?: string;
  readonly set: ChatSet;
  readonly history: ReadonlyArray<ChatHistoryMessage>;
  /** Photos to attach: the set's source pages and recent conversation photos. */
  readonly images: ReadonlyArray<ChatImage>;
  /** How many of those photos the student attached to this very message. */
  readonly newImageCount?: number;
  readonly message: string;
  readonly store: FlashcardChatStore;
}

export interface ChatResult {
  readonly reply: string;
  readonly toolActions: ReadonlyArray<ToolAction>;
}

export function formatCards(cards: ReadonlyArray<ChatCard>) {
  if (cards.length === 0) {
    return "(no flashcards yet)";
  }
  return cards
    .map(
      (card, index) =>
        `#${index + 1}\nQ: ${card.question}\nA: ${card.answer}`
    )
    .join("\n\n");
}

export function buildSystemPrompt(set: ChatSet, hasImages: boolean, newImageCount = 0) {
  const lines = [
    "You are a friendly study assistant helping a student refine a set of flashcards that were generated from photos of their study material.",
    "",
    `Set title: ${set.title}`,
    set.description ? `Set description: ${set.description}` : "Set description: (none)",
    "",
    `Current flashcards (${set.flashcards.length}), numbered in order:`,
    formatCards(set.flashcards),
    "",
    "Rules:",
    "- Use the tools to change flashcards or the set. Never claim to have changed something without calling a tool.",
    "- Refer to flashcards by their number (#1, #2, ...). Numbers refer to the current list above; after you delete a card the remaining cards renumber, and the tool result tells you the new state.",
    "- When the student asks to fix, improve, add, merge, split, or remove cards, do it with tools, then summarise briefly what changed.",
    "- When the student asks a question about the material, answer it directly and offer to add a card if that would help.",
    "- Card style: for vocabulary, phrases, and translations put only the word or sentence on the front and only the translation on the back, never a wrapper question such as \"How do you say ... in French:\". The same goes for terms and definitions: the term on the front, the definition on the back. Phrase the front as a question only when the material really is a question, such as a maths problem. When the student asks you to fix this, rewrite every affected card.",
    "- Reply in the student's language. Keep replies short; use plain text, no markdown tables.",
    hasImages
      ? "- Photos of the study material are attached to the student's message: the pages the set was made from, followed by any photos added later in the conversation. Check them when judging whether a question or answer is correct or complete."
      : "- No photos are available in this conversation; rely on the flashcards and the student's input.",
    newImageCount > 0
      ? `- The last ${newImageCount === 1 ? "photo is" : `${newImageCount} photos are`} new: the student attached ${newImageCount === 1 ? "it" : "them"} to this message. If they want flashcards from new photos, add them with add_flashcard, one call per card, covering the important content.`
      : null,
  ].filter((line): line is string => line !== null);
  return lines.join("\n");
}

function historyToPrompt(history: ReadonlyArray<ChatHistoryMessage>): Array<Prompt.MessageEncoded> {
  // Historical assistant turns need an item id: the OpenAI encoder emits
  // `id: null` otherwise, which OpenRouter's Responses validator rejects.
  return history.map((message) =>
    message.role === "assistant"
      ? {
          role: "assistant" as const,
          content: [
            {
              type: "text" as const,
              text: message.content,
              options: { openai: { itemId: `msg_${message.id.replace(/[^a-zA-Z0-9]/g, "")}` } },
            },
          ],
        }
      : {
          role: "user" as const,
          content:
            message.imageCount && message.imageCount > 0
              ? `${message.content}\n[attached ${message.imageCount} photo${message.imageCount === 1 ? "" : "s"}]`
              : message.content,
        }
  );
}

export function buildPrompt(options: {
  set: ChatSet;
  history: ReadonlyArray<ChatHistoryMessage>;
  images: ReadonlyArray<ChatImage>;
  newImageCount?: number;
  message: string;
}): Array<Prompt.MessageEncoded> {
  const { set, history, images, message, newImageCount = 0 } = options;
  const userMessage: Prompt.MessageEncoded =
    images.length === 0
      ? { role: "user", content: message }
      : {
          role: "user",
          content: [
            { type: "text", text: message },
            ...images.map((image) => ({
              type: "file" as const,
              mediaType: image.mediaType,
              fileName: image.fileName,
              data: image.data,
            })),
          ],
        };

  return [
    { role: "system", content: buildSystemPrompt(set, images.length > 0, newImageCount) },
    ...historyToPrompt(history),
    userMessage,
  ];
}

const CardNumber = Schema.Number.annotate({
  description: "1-based number of the flashcard in the current list",
});

export const flashcardToolkit = Toolkit.make(
  Tool.make("list_flashcards", {
    description: "Returns the current flashcards with their numbers, questions and answers.",
    success: Schema.String,
  }),
  Tool.make("update_flashcard", {
    description:
      "Changes the question and/or answer of an existing flashcard. Omit a field to keep it unchanged.",
    parameters: Schema.Struct({
      cardNumber: CardNumber,
      question: Schema.optional(Schema.String),
      answer: Schema.optional(Schema.String),
    }),
    success: Schema.String,
  }),
  Tool.make("add_flashcard", {
    description: "Adds a new flashcard to the end of the set.",
    parameters: Schema.Struct({
      question: Schema.String,
      answer: Schema.String,
    }),
    success: Schema.String,
  }),
  Tool.make("delete_flashcard", {
    description: "Deletes a flashcard from the set.",
    parameters: Schema.Struct({ cardNumber: CardNumber }),
    success: Schema.String,
  }),
  Tool.make("update_set", {
    description:
      "Changes the title, description, or pronunciation settings of the flashcard set. Languages are BCP-47 codes such as fr or pt-BR; speakFront/speakBack turn the read-aloud button on or off for the question/answer side.",
    parameters: Schema.Struct({
      title: Schema.optional(Schema.String),
      description: Schema.optional(Schema.String),
      frontLanguage: Schema.optional(Schema.String),
      backLanguage: Schema.optional(Schema.String),
      speakFront: Schema.optional(Schema.Boolean),
      speakBack: Schema.optional(Schema.Boolean),
    }),
    success: Schema.String,
  })
);

function truncate(value: string, max = 60) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** Wraps a store call so failures are reported back to the model as text. */
const attempt = (run: () => Promise<string>) =>
  Effect.promise(async () => {
    try {
      return await run();
    } catch (error) {
      return `Error: ${truncate(errorMessage(error), 200)}`;
    }
  });

export function makeHandlers(store: FlashcardChatStore, actions: Array<ToolAction>) {
  const cardAt = async (cardNumber: number) => {
    const set = await store.getSet();
    const card = set.flashcards[cardNumber - 1];
    if (!card) {
      throw new Error(
        `There is no flashcard #${cardNumber}. The set has ${set.flashcards.length} cards.`
      );
    }
    return card;
  };

  const currentList = async () => {
    const set = await store.getSet();
    return `Current flashcards (${set.flashcards.length}):\n${formatCards(set.flashcards)}`;
  };

  return flashcardToolkit.toLayer({
    list_flashcards: () => attempt(currentList),
    update_flashcard: ({ cardNumber, question, answer }) =>
      attempt(async () => {
        if (question === undefined && answer === undefined) {
          return "Error: provide a new question and/or answer.";
        }
        const card = await cardAt(cardNumber);
        await store.updateCard(card.id, question ?? card.question, answer ?? card.answer);
        actions.push({
          tool: "update_flashcard",
          summary: `Updated card #${cardNumber}: ${truncate(question ?? card.question)}`,
        });
        return `Updated flashcard #${cardNumber}.`;
      }),
    add_flashcard: ({ question, answer }) =>
      attempt(async () => {
        await store.addCard(question, answer);
        const set = await store.getSet();
        actions.push({
          tool: "add_flashcard",
          summary: `Added card #${set.flashcards.length}: ${truncate(question)}`,
        });
        return `Added flashcard #${set.flashcards.length}.`;
      }),
    delete_flashcard: ({ cardNumber }) =>
      attempt(async () => {
        const card = await cardAt(cardNumber);
        await store.deleteCard(card.id);
        actions.push({
          tool: "delete_flashcard",
          summary: `Deleted card #${cardNumber}: ${truncate(card.question)}`,
        });
        return `Deleted flashcard #${cardNumber}. ${await currentList()}`;
      }),
    update_set: ({ title, description, frontLanguage, backLanguage, speakFront, speakBack }) =>
      attempt(async () => {
        const patch = { title, description, frontLanguage, backLanguage, speakFront, speakBack };
        if (Object.values(patch).every((value) => value === undefined)) {
          return "Error: provide at least one field to change.";
        }
        await store.updateSet(patch);
        const parts = [
          title !== undefined ? `title to "${truncate(title)}"` : null,
          description !== undefined ? "description" : null,
          frontLanguage !== undefined ? `front language to ${frontLanguage}` : null,
          backLanguage !== undefined ? `back language to ${backLanguage}` : null,
          speakFront !== undefined ? `read-aloud on the front ${speakFront ? "on" : "off"}` : null,
          speakBack !== undefined ? `read-aloud on the back ${speakBack ? "on" : "off"}` : null,
        ].filter((part): part is string => part !== null);
        actions.push({ tool: "update_set", summary: `Changed set ${parts.join(" and ")}` });
        return "Updated the set.";
      }),
  });
}

function providerLayer(apiKey: string, model: string, apiUrl: string) {
  return OpenAiLanguageModel.model(model).pipe(
    Layer.provide(
      OpenAiClient.layer({
        apiKey: Redacted.make(apiKey),
        apiUrl,
      }).pipe(Layer.provide(FetchHttpClient.layer))
    )
  );
}

/**
 * Runs one chat turn: sends the history plus the new message to the model,
 * lets it call flashcard tools, and returns the final reply together with a
 * summary of the changes it made.
 */
export function runFlashcardChat(options: RunChatOptions): Promise<ChatResult> {
  const actions: Array<ToolAction> = [];

  const program = Effect.gen(function* () {
    const session = yield* Chat.fromPrompt(
      buildPrompt({
        set: options.set,
        history: options.history,
        images: options.images,
        newImageCount: options.newImageCount,
        message: options.message,
      })
    );
    const tools = yield* flashcardToolkit.pipe(
      Effect.provide(makeHandlers(options.store, actions))
    );

    let response = yield* session.generateText({ prompt: [], toolkit: tools });
    // After tool calls the model may need another round for its final answer.
    for (let round = 0; round < MAX_TOOL_ROUNDS && response.text.trim() === ""; round++) {
      response = yield* session.generateText({ prompt: [], toolkit: tools });
    }

    const reply = response.text.trim();
    return {
      reply:
        reply !== ""
          ? reply
          : actions.length > 0
            ? `Done: ${actions.map((action) => action.summary).join("; ")}.`
            : "I could not produce a reply. Please try again.",
      toolActions: actions,
    } satisfies ChatResult;
  });

  return Effect.runPromise(
    program.pipe(
      Effect.provide(providerLayer(options.apiKey, options.model, options.apiUrl ?? OPENROUTER_API_URL)),
      Effect.mapError((error) => new Error(`Chat failed: ${errorMessage(error)}`))
    )
  );
}
