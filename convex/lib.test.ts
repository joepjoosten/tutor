import { afterEach, describe, expect, it, vi } from "vitest";
import { blobToBase64, decryptSecret, encryptSecret } from "./lib";

describe("convex/lib", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips encrypted secrets with the configured key", async () => {
    vi.stubEnv("AI_KEY_ENCRYPTION_SECRET", "test-encryption-secret");

    const ciphertext = await encryptSecret("sk-test-secret");
    const decrypted = await decryptSecret(ciphertext);

    expect(ciphertext).not.toBe("sk-test-secret");
    expect(ciphertext.split(".")).toHaveLength(2);
    expect(decrypted).toBe("sk-test-secret");
  });

  it("rejects malformed stored secret payloads", async () => {
    vi.stubEnv("AI_KEY_ENCRYPTION_SECRET", "test-encryption-secret");

    await expect(decryptSecret("not-a-valid-payload")).rejects.toThrow(
      "Stored secret payload is invalid."
    );
  });

  it("converts blobs to base64", async () => {
    const blob = new Blob([Uint8Array.from([0, 1, 2, 253, 254, 255])]);

    await expect(blobToBase64(blob)).resolves.toBe("AAEC/f7/");
  });
});
