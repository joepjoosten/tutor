"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function AppHeader() {
  const { data: session, isPending } = authClient.useSession();
  const email = session?.user.email ?? "";
  const initials = email.slice(0, 1).toUpperCase() || "U";

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">📚</span>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Tutor App
            </h1>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                New Flashcards
              </Link>
              <Link
                href="/flashcards"
                className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                My Flashcards
              </Link>
            </div>

            <div className="flex items-center gap-3">
              {isPending ? (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Loading session...
                </span>
              ) : session ? (
                <details className="relative">
                  <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full border border-gray-300 bg-gray-100 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 [&::-webkit-details-marker]:hidden">
                    <span>{initials}</span>
                  </summary>

                  <div className="absolute right-0 top-14 z-10 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                        Account
                      </p>
                      <p className="mt-1 truncate text-sm text-gray-700 dark:text-gray-200">
                        {email}
                      </p>
                    </div>

                    <div className="p-2">
                      <Link
                        href="/settings"
                        className="flex w-full items-center rounded-xl px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        Settings
                      </Link>
                      <button
                        type="button"
                        onClick={() => void authClient.signOut()}
                        className="flex w-full items-center rounded-xl px-3 py-2 text-sm text-left text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                </details>
              ) : (
                <Link
                  href="/"
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
