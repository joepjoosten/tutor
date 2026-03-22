import {
  getAuthRouteHandlers,
  getAuthUnavailableMessage,
} from "@/lib/auth-server";
import { isConnectionRefusedError } from "@/lib/convex-config";

const handler = getAuthRouteHandlers();

function unavailableResponse() {
  return Response.json(
    { error: getAuthUnavailableMessage() },
    { status: 503 }
  );
}

export async function GET(request: Request) {
  if (!handler) {
    return unavailableResponse();
  }

  try {
    return await handler.GET(request);
  } catch (error) {
    if (isConnectionRefusedError(error)) {
      return unavailableResponse();
    }

    throw error;
  }
}

export async function POST(request: Request) {
  if (!handler) {
    return unavailableResponse();
  }

  try {
    return await handler.POST(request);
  } catch (error) {
    if (isConnectionRefusedError(error)) {
      return unavailableResponse();
    }

    throw error;
  }
}
