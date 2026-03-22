"use client";

import { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "@/lib/auth-client";
import { getConvexUrl, getMissingConvexUrlMessage } from "@/lib/convex-config";

const convexUrl = getConvexUrl();
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function ConvexClientProvider({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken?: string | null;
}) {
  if (!convex) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-16 text-center text-gray-900">
        <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="text-2xl font-semibold">Convex backend not configured</h1>
          <p className="mt-3 text-sm text-gray-600">
            {getMissingConvexUrlMessage()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ConvexBetterAuthProvider
      client={convex}
      authClient={authClient}
      initialToken={initialToken}
    >
      {children}
    </ConvexBetterAuthProvider>
  );
}
