import { describe, expect, it } from "vitest";
import { buildInstructions, describeLanguage, parsePcmContentType, pcmToWav } from "./audio";

describe("describeLanguage", () => {
  it("names common languages and keeps the code", () => {
    expect(describeLanguage("fr")).toBe("French (fr)");
    expect(describeLanguage("pt-BR")).toBe("Portuguese (pt-BR)");
  });

  it("falls back to the raw code for unknown languages", () => {
    expect(describeLanguage("eu")).toBe("eu");
    expect(describeLanguage(undefined)).toBeNull();
  });
});

describe("buildInstructions", () => {
  it("asks for a native reading in the given language", () => {
    const instructions = buildInstructions("de");
    expect(instructions).toContain("in German (de)");
    expect(instructions).toContain("Do not translate");
  });

  it("asks the model to detect the language when none is set", () => {
    expect(buildInstructions(undefined)).toContain("Detect the language from the text");
  });
});

describe("parsePcmContentType", () => {
  it("reads the sample rate and channel count", () => {
    expect(parsePcmContentType("audio/pcm;rate=44100;channels=2")).toEqual({
      sampleRate: 44100,
      channels: 2,
    });
  });

  it("falls back to 24 kHz mono", () => {
    expect(parsePcmContentType("audio/pcm")).toEqual({ sampleRate: 24000, channels: 1 });
    expect(parsePcmContentType(null)).toEqual({ sampleRate: 24000, channels: 1 });
  });
});

describe("pcmToWav", () => {
  it("writes a valid 44-byte header in front of the samples", () => {
    const pcm = new Uint8Array([1, 0, 2, 0, 3, 0, 4, 0]);
    const wav = pcmToWav(pcm, 24000, 1);
    const view = new DataView(wav.buffer);
    const ascii = (offset: number, length: number) =>
      String.fromCharCode(...wav.slice(offset, offset + length));

    expect(wav.byteLength).toBe(44 + pcm.byteLength);
    expect(ascii(0, 4)).toBe("RIFF");
    expect(ascii(8, 4)).toBe("WAVE");
    expect(view.getUint32(4, true)).toBe(36 + pcm.byteLength);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(24000);
    expect(view.getUint32(28, true)).toBe(48000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(ascii(36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(pcm.byteLength);
    expect(Array.from(wav.slice(44))).toEqual(Array.from(pcm));
  });
});
