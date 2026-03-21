const DEV_BETTER_AUTH_SECRET =
  "tutor-local-dev-better-auth-secret-not-for-production-use";
const DEV_AI_KEY_ENCRYPTION_SECRET =
  "tutor-local-dev-ai-key-encryption-secret-not-for-production-use";

function normalizeSecret(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.startsWith("replace_with_")) {
    return null;
  }
  return trimmed;
}

function isLocalEnvironment() {
  const candidateUrls = [
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.CONVEX_SITE_URL,
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
    process.env.NEXT_PUBLIC_CONVEX_URL,
  ];

  return candidateUrls.some(
    (value) => value?.includes("localhost") || value?.includes("127.0.0.1")
  );
}

export function getBetterAuthSecret(): string {
  const secret = normalizeSecret(process.env.BETTER_AUTH_SECRET);
  if (secret) {
    return secret;
  }

  if (isLocalEnvironment()) {
    return DEV_BETTER_AUTH_SECRET;
  }

  throw new Error(
    "BETTER_AUTH_SECRET is not configured. Set a real value before running in production."
  );
}

export function getEncryptionSecret(): string {
  const secret = normalizeSecret(process.env.AI_KEY_ENCRYPTION_SECRET);
  if (secret) {
    return secret;
  }

  if (isLocalEnvironment()) {
    return DEV_AI_KEY_ENCRYPTION_SECRET;
  }

  throw new Error(
    "AI_KEY_ENCRYPTION_SECRET is not configured. Set a real value before running in production."
  );
}
