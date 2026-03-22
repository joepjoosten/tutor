const LOCAL_CONVEX_URL = "http://127.0.0.1:3210";

function normalizeEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getConvexUrl() {
  return normalizeEnv(process.env.NEXT_PUBLIC_CONVEX_URL)
    ?? (process.env.NODE_ENV === "development" ? LOCAL_CONVEX_URL : null);
}

export function getConvexSiteUrl() {
  return normalizeEnv(process.env.NEXT_PUBLIC_CONVEX_SITE_URL) ?? getConvexUrl();
}

export function getMissingConvexUrlMessage() {
  return "NEXT_PUBLIC_CONVEX_URL is not configured. Set it in your environment, or run `npm run dev:backend` locally to generate `.env.local`.";
}

export function getConvexUnavailableMessage(convexUrl: string) {
  if (process.env.NODE_ENV === "development") {
    return `Convex is unreachable at ${convexUrl}. Start it with \`npm run dev:backend\`.`;
  }

  return `Convex is unreachable at ${convexUrl}. Check NEXT_PUBLIC_CONVEX_URL and your Convex deployment.`;
}

export function isConnectionRefusedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause && typeof cause === "object" && "code" in cause) {
    return (cause as { code?: unknown }).code === "ECONNREFUSED";
  }

  return error.message.includes("ECONNREFUSED");
}
