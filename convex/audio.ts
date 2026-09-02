import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { decryptSecret, requireUser } from "./lib";

// OpenRouter text-to-speech: POST /audio/speech returns raw audio bytes.
// See https://openrouter.ai/docs/guides/overview/multimodal/tts
const TTS_URL = "https://openrouter.ai/api/v1/audio/speech";
// Multilingual and cheap; users can pick another speech model in Settings.
export const DEFAULT_TTS_MODEL = "google/gemini-3.1-flash-tts-preview";
export const DEFAULT_TTS_VOICE = "Kore";
const MAX_TTS_CHARACTERS = 1500;

const sideValidator = v.union(v.literal("question"), v.literal("answer"));
type Side = "question" | "answer";

const LANGUAGE_NAMES: Record<string, string> = {
  ar: "Arabic",
  de: "German",
  el: "Greek",
  en: "English",
  es: "Spanish",
  fr: "French",
  fy: "Frisian",
  hi: "Hindi",
  id: "Indonesian",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  la: "Latin",
  nl: "Dutch",
  pl: "Polish",
  pt: "Portuguese",
  ru: "Russian",
  sv: "Swedish",
  tr: "Turkish",
  zh: "Chinese",
};

export function describeLanguage(code: string | undefined) {
  if (!code) return null;
  const base = code.split("-")[0].toLowerCase();
  const name = LANGUAGE_NAMES[base];
  return name ? `${name} (${code})` : code;
}

export function buildInstructions(language: string | undefined) {
  const described = describeLanguage(language);
  return described
    ? `Read the text aloud in ${described} exactly as written, the way a clear native speaker would, at a calm pace suited to a language learner. Do not translate, explain, add, or omit anything.`
    : "Read the text aloud exactly as written, clearly and at a calm pace suited to a language learner. Detect the language from the text. Do not translate, explain, add, or omit anything.";
}

/** Parses `audio/pcm;rate=24000;channels=1` into its parameters. */
export function parsePcmContentType(contentType: string | null) {
  const params = new Map<string, string>();
  for (const part of (contentType ?? "").split(";").slice(1)) {
    const [key, value] = part.split("=").map((piece) => piece.trim().toLowerCase());
    if (key && value) params.set(key, value);
  }
  return {
    sampleRate: Number(params.get("rate")) || 24000,
    channels: Number(params.get("channels")) || 1,
  };
}

/** Wraps 16-bit little-endian PCM samples in a WAV container. */
export function pcmToWav(pcm: Uint8Array, sampleRate: number, channels: number) {
  const bitsPerSample = 16;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, "data");
  view.setUint32(40, pcm.byteLength, true);

  const wav = new Uint8Array(44 + pcm.byteLength);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcm, 44);
  return wav;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export const getSpeakContext = internalQuery({
  args: {
    userId: v.string(),
    flashcardId: v.id("flashcards"),
    side: sideValidator,
  },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.flashcardId);
    if (!card || card.userId !== args.userId || card.deletedAt !== undefined) {
      throw new Error("Flashcard not found.");
    }
    const set = await ctx.db.get(card.setId);
    if (!set || set.userId !== args.userId) {
      throw new Error("Flashcard set not found.");
    }

    const enabled = args.side === "question" ? set.speakFront === true : set.speakBack === true;
    if (!enabled) {
      throw new Error("Pronunciation is turned off for this side of the cards.");
    }

    const existing = await ctx.db
      .query("cardAudio")
      .withIndex("by_flashcardId_side", (q) =>
        q.eq("flashcardId", args.flashcardId).eq("side", args.side)
      )
      .collect();

    return {
      text: args.side === "question" ? card.question : card.answer,
      language: args.side === "question" ? set.frontLanguage : set.backLanguage,
      cached: await Promise.all(
        existing.map(async (entry) => ({
          textHash: entry.textHash,
          url: await ctx.storage.getUrl(entry.storageId),
        }))
      ),
    };
  },
});

export const saveCardAudio = internalMutation({
  args: {
    userId: v.string(),
    flashcardId: v.id("flashcards"),
    side: sideValidator,
    textHash: v.string(),
    storageId: v.id("_storage"),
    model: v.string(),
    voice: v.string(),
  },
  handler: async (ctx, args) => {
    // Replace stale clips for this side, e.g. after the card text changed.
    const stale = await ctx.db
      .query("cardAudio")
      .withIndex("by_flashcardId_side", (q) =>
        q.eq("flashcardId", args.flashcardId).eq("side", args.side)
      )
      .collect();
    await Promise.all(
      stale.map(async (entry) => {
        await ctx.storage.delete(entry.storageId);
        await ctx.db.delete(entry._id);
      })
    );

    await ctx.db.insert("cardAudio", {
      userId: args.userId,
      flashcardId: args.flashcardId,
      side: args.side,
      textHash: args.textHash,
      storageId: args.storageId,
      model: args.model,
      voice: args.voice,
      createdAt: Date.now(),
    });

    return ctx.storage.getUrl(args.storageId);
  },
});

const getEncryptedOpenRouterKeyRef = makeFunctionReference<
  "query",
  { userId: string },
  string | null
>("settings:getEncryptedOpenRouterKey");

const getTtsSettingsRef = makeFunctionReference<
  "query",
  { userId: string },
  { model: string | null; voice: string | null }
>("settings:getTtsSettings");

const getSpeakContextRef = makeFunctionReference<
  "query",
  { userId: string; flashcardId: Id<"flashcards">; side: Side },
  {
    text: string;
    language: string | undefined;
    cached: Array<{ textHash: string; url: string | null }>;
  }
>("audio:getSpeakContext");

const saveCardAudioRef = makeFunctionReference<
  "mutation",
  {
    userId: string;
    flashcardId: Id<"flashcards">;
    side: Side;
    textHash: string;
    storageId: Id<"_storage">;
    model: string;
    voice: string;
  },
  string | null
>("audio:saveCardAudio");

/**
 * Returns a playable URL for one side of a card, generating the audio with
 * OpenRouter text-to-speech on first use and caching it in file storage.
 */
export const speak = action({
  args: {
    flashcardId: v.id("flashcards"),
    side: sideValidator,
  },
  handler: async (ctx, args): Promise<{ url: string; cached: boolean }> => {
    const userId = await requireUser(ctx);
    const context = await ctx.runQuery(getSpeakContextRef, {
      userId,
      flashcardId: args.flashcardId,
      side: args.side,
    });

    const text = context.text.trim();
    if (text === "") {
      throw new Error("There is no text to read on this side.");
    }
    if (text.length > MAX_TTS_CHARACTERS) {
      throw new Error("This card is too long to read aloud.");
    }

    const ttsSettings = await ctx.runQuery(getTtsSettingsRef, { userId });
    const model = ttsSettings.model ?? DEFAULT_TTS_MODEL;
    // A stored model without a stored voice means the model has no voice list.
    const voice = ttsSettings.model ? ttsSettings.voice ?? undefined : DEFAULT_TTS_VOICE;

    const textHash = await sha256([model, voice ?? "", context.language ?? "", text].join(" "));
    const hit = context.cached.find((entry) => entry.textHash === textHash && entry.url);
    if (hit?.url) {
      return { url: hit.url, cached: true };
    }

    const encryptedKey = await ctx.runQuery(getEncryptedOpenRouterKeyRef, { userId });
    if (!encryptedKey) {
      throw new Error("Add your OpenRouter API key in Settings to hear pronunciations.");
    }
    const apiKey = await decryptSecret(encryptedKey);

    const response = await fetch(TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.SITE_URL ?? "http://localhost:3000",
        "X-Title": "Tutor App",
      },
      body: JSON.stringify({
        model,
        input: text,
        ...(voice ? { voice } : {}),
        // PCM is the one format every provider supports (Gemini accepts nothing
        // else); it is wrapped in a WAV container below.
        response_format: "pcm",
        // Reading instructions are an OpenAI-only passthrough option.
        ...(model.startsWith("openai/")
          ? {
              provider: {
                options: {
                  openai: { instructions: buildInstructions(context.language) },
                },
              },
            }
          : {}),
      }),
    });

    if (!response.ok) {
      // Error bodies are JSON; audio bodies are not.
      let message = `Text-to-speech failed (HTTP ${response.status}).`;
      try {
        const payload = (await response.json()) as { error?: { message?: string } };
        if (payload.error?.message) message = payload.error.message;
      } catch {
        /* keep the generic message */
      }
      throw new Error(message);
    }

    const contentType = response.headers.get("content-type");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let blob: Blob;
    if (contentType?.includes("audio/pcm")) {
      const { sampleRate, channels } = parsePcmContentType(contentType);
      blob = new Blob([pcmToWav(bytes, sampleRate, channels)], { type: "audio/wav" });
    } else {
      // Some providers ignore the format and return an encoded stream anyway.
      blob = new Blob([bytes], { type: contentType?.split(";")[0] || "audio/mpeg" });
    }
    const storageId = await ctx.storage.store(blob);

    const url = await ctx.runMutation(saveCardAudioRef, {
      userId,
      flashcardId: args.flashcardId,
      side: args.side,
      textHash,
      storageId,
      model,
      voice: voice ?? "",
    });
    if (!url) {
      throw new Error("The audio could not be stored.");
    }
    return { url, cached: false };
  },
});
