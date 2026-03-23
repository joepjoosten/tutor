import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireUser, mockEncryptSecret } = vi.hoisted(() => ({
  mockRequireUser: vi.fn(),
  mockEncryptSecret: vi.fn(),
}));

vi.mock("./lib", () => ({
  requireUser: mockRequireUser,
  encryptSecret: mockEncryptSecret,
}));

import { setOpenRouterKey } from "./settings";
import {
  clearOpenRouterKey,
  getEncryptedOpenRouterKey,
  getUserSettings,
} from "./settings";

function createIndexedQueryResult<T>(options?: { unique?: T | null }) {
  const unique = vi.fn().mockResolvedValue(options?.unique ?? null);
  const chain = { unique };
  const withIndex = vi.fn().mockImplementation((_, callback?: (q: { eq: typeof vi.fn }) => unknown) => {
    const builder = {
      eq: vi.fn().mockReturnThis(),
    };
    callback?.(builder);
    return chain;
  });
  return { chain, unique, withIndex };
}

function createSettingsCtx(existingDoc: { _id: string } | null = null) {
  const queryResult = createIndexedQueryResult({ unique: existingDoc });
  const query = vi.fn().mockReturnValue({ withIndex: queryResult.withIndex });
  const insert = vi.fn().mockResolvedValue("new-settings-id");
  const patch = vi.fn().mockResolvedValue(undefined);

  return {
    ctx: {
      auth: {},
      db: {
        query,
        insert,
        patch,
      },
    },
    query,
    withIndex: queryResult.withIndex,
    unique: queryResult.unique,
    insert,
    patch,
  };
}

describe("settings:setOpenRouterKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    mockRequireUser.mockResolvedValue("user-123");
    mockEncryptSecret.mockResolvedValue("encrypted-value");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a settings document with trimmed key data when none exists", async () => {
    const { ctx, insert, patch } = createSettingsCtx();

    await setOpenRouterKey._handler(ctx as never, {
      apiKey: "  sk-or-key-1234  ",
    });

    expect(mockRequireUser).toHaveBeenCalledWith(ctx);
    expect(mockEncryptSecret).toHaveBeenCalledWith("sk-or-key-1234");
    expect(insert).toHaveBeenCalledWith("userSettings", {
      userId: "user-123",
      openRouterKeyCiphertext: "encrypted-value",
      openRouterKeyLast4: "1234",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    });
    expect(patch).not.toHaveBeenCalled();
  });

  it("updates the existing settings document instead of inserting a new one", async () => {
    const { ctx, insert, patch } = createSettingsCtx({
      _id: "settings-doc-id",
    });

    await setOpenRouterKey._handler(ctx as never, {
      apiKey: "sk-or-key-9876",
    });

    expect(mockEncryptSecret).toHaveBeenCalledWith("sk-or-key-9876");
    expect(patch).toHaveBeenCalledWith("settings-doc-id", {
      openRouterKeyCiphertext: "encrypted-value",
      openRouterKeyLast4: "9876",
      updatedAt: 1_700_000_000_000,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns the current user settings summary", async () => {
    const { ctx } = createSettingsCtx({
      _id: "settings-doc-id",
      openRouterKeyCiphertext: "encrypted-value",
      openRouterKeyLast4: "9876",
    } as never);

    await expect(getUserSettings._handler(ctx as never, {} as never)).resolves.toEqual({
      hasOpenRouterKey: true,
      openRouterKeyLast4: "9876",
    });
  });

  it("clears the stored key fields when a settings document exists", async () => {
    const { ctx, patch } = createSettingsCtx({
      _id: "settings-doc-id",
    });

    await clearOpenRouterKey._handler(ctx as never, {} as never);

    expect(patch).toHaveBeenCalledWith("settings-doc-id", {
      openRouterKeyCiphertext: undefined,
      openRouterKeyLast4: undefined,
      updatedAt: 1_700_000_000_000,
    });
  });

  it("does nothing when clearing a key for a user without settings", async () => {
    const { ctx, patch } = createSettingsCtx();

    await clearOpenRouterKey._handler(ctx as never, {} as never);

    expect(patch).not.toHaveBeenCalled();
  });

  it("returns the encrypted key for internal consumers", async () => {
    const queryResult = createIndexedQueryResult({
      unique: {
        _id: "settings-doc-id",
        openRouterKeyCiphertext: "encrypted-value",
      },
    });
    const ctx = {
      db: {
        query: vi.fn().mockReturnValue({ withIndex: queryResult.withIndex }),
      },
    };

    await expect(
      getEncryptedOpenRouterKey._handler(ctx as never, {
        userId: "user-123",
      })
    ).resolves.toBe("encrypted-value");
  });

  it("returns null when no encrypted key exists", async () => {
    const queryResult = createIndexedQueryResult();
    const ctx = {
      db: {
        query: vi.fn().mockReturnValue({ withIndex: queryResult.withIndex }),
      },
    };

    await expect(
      getEncryptedOpenRouterKey._handler(ctx as never, {
        userId: "user-123",
      })
    ).resolves.toBeNull();
  });
});
