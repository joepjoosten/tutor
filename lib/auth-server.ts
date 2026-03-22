import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import {
  getConvexSiteUrl,
  getConvexUnavailableMessage,
  getConvexUrl,
  getMissingConvexUrlMessage,
  isConnectionRefusedError,
} from "@/lib/convex-config";

const convexUrl = getConvexUrl();
const convexSiteUrl = getConvexSiteUrl();

const auth = convexUrl
  ? convexBetterAuthNextJs({
      convexUrl,
      convexSiteUrl: convexSiteUrl ?? convexUrl,
    })
  : null;

export function getAuthRouteHandlers() {
  return auth?.handler ?? null;
}

export function getAuthUnavailableMessage() {
  if (!convexUrl) {
    return getMissingConvexUrlMessage();
  }

  return getConvexUnavailableMessage(convexUrl);
}

export async function getToken() {
  if (!auth) {
    return null;
  }

  const configuredConvexUrl = convexUrl ?? convexSiteUrl;

  try {
    return await auth.getToken();
  } catch (error) {
    if (configuredConvexUrl && isConnectionRefusedError(error)) {
      console.error(getConvexUnavailableMessage(configuredConvexUrl), error);
      return null;
    }

    throw error;
  }
}
