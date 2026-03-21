"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function AppHeader() {
  const { data: session, isPending } = authClient.useSession();

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
              <Link
                href="/settings"
                className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Settings
              </Link>
            </div>

            <div className="flex items-center gap-3">
              {isPending ? (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Loading session...
                </span>
              ) : session ? (
                <>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {session.user.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => void authClient.signOut()}
                    className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Sign out
                  </button>
                </>
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
