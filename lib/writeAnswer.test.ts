import { describe, expect, it } from "vitest";

import { isBlankCorrect, keepWordChars, letterCount, segmentAnswer } from "./writeAnswer";

describe("writeAnswer", () => {
  it("splits words from punctuation and spaces", () => {
    expect(segmentAnswer("(keine) Ahnung")).toEqual([
      { kind: "literal", text: "(" },
      { kind: "blank", text: "keine" },
      { kind: "literal", text: ") " },
      { kind: "blank", text: "Ahnung" },
    ]);
  });

  it("keeps umlauts, accents and digits inside words", () => {
    expect(segmentAnswer("die Tür, 2 Cafés!")).toEqual([
      { kind: "blank", text: "die" },
      { kind: "literal", text: " " },
      { kind: "blank", text: "Tür" },
      { kind: "literal", text: ", " },
      { kind: "blank", text: "2" },
      { kind: "literal", text: " " },
      { kind: "blank", text: "Cafés" },
      { kind: "literal", text: "!" },
    ]);
  });

  it("treats decomposed accents as part of the word", () => {
    expect(segmentAnswer("Café")).toEqual([{ kind: "blank", text: "Café" }]);
  });

  it("trims surrounding whitespace", () => {
    expect(segmentAnswer("  Hund \n")).toEqual([{ kind: "blank", text: "Hund" }]);
  });

  it("returns no blanks for answers without letters or digits", () => {
    expect(segmentAnswer("—?")).toEqual([{ kind: "literal", text: "—?" }]);
    expect(segmentAnswer("")).toEqual([]);
  });

  it("strips punctuation and spaces from typed input", () => {
    expect(keepWordChars(" kei-ne. ")).toBe("keine");
  });

  it("counts letters the way they are displayed", () => {
    expect(letterCount("Tür")).toBe(3);
    expect(letterCount("Tu\u0308r")).toBe(3);
    expect(letterCount("Straße")).toBe(6);
  });

  it("checks words with exact capitals and accents", () => {
    expect(isBlankCorrect("Ahnung", "Ahnung")).toBe(true);
    expect(isBlankCorrect("Ahnung", "ahnung")).toBe(false);
    expect(isBlankCorrect("Tür", "TÜR")).toBe(false);
    expect(isBlankCorrect("Tür", "Tur")).toBe(false);
    expect(isBlankCorrect("Tür", "Tu\u0308r")).toBe(true);
    expect(isBlankCorrect("keine", "kein")).toBe(false);
  });
});
