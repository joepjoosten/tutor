import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getSharedStudyProgressStorageKey,
  parseSharedStudyProgress,
  serializeSharedStudyProgress,
} from "./sharedStudyProgress";

describe("sharedStudyProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
  });

  it("builds a stable local storage key for a shared slug", () => {
    expect(getSharedStudyProgressStorageKey("share-slug")).toBe(
      "shared-study-progress:share-slug"
    );
  });

  it("serializes only cards marked for review", () => {
    expect(
      serializeSharedStudyProgress({
        "card-1": true,
        "card-2": false,
        "card-3": true,
      })
    ).toBe(
      JSON.stringify({
        version: 1,
        dontKnowCardIds: ["card-1", "card-3"],
        updatedAt: 1_700_000_000_000,
      })
    );
  });

  it("parses stored progress into a lookup map", () => {
    expect(
      parseSharedStudyProgress(
        JSON.stringify({
          version: 1,
          dontKnowCardIds: ["card-1", "card-2"],
          updatedAt: 1_700_000_000_000,
        })
      )
    ).toEqual({
      "card-1": true,
      "card-2": true,
    });
  });

  it("returns an empty map for invalid payloads", () => {
    expect(parseSharedStudyProgress(null)).toEqual({});
    expect(parseSharedStudyProgress("not-json")).toEqual({});
    expect(
      parseSharedStudyProgress(
        JSON.stringify({
          version: 2,
          dontKnowCardIds: ["card-1"],
        })
      )
    ).toEqual({});
    expect(
      parseSharedStudyProgress(
        JSON.stringify({
          version: 1,
          dontKnowCardIds: [123],
        })
      )
    ).toEqual({});
  });
});
