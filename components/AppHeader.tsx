"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function AppHeader() {
  const { data: session, isPending } = authClient.useSession();
  const email = session?.user.email ?? "";
  const initials = email.slice(0, 1).toUpperCase() || "U";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            <span className="text-lg sm:text-2xl">📚</span>
            <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">
              Tutor App
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/flashcards"
              className="text-sm sm:text-base text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              My Flashcards
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              {isPending ? (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Loading session...
                </span>
              ) : session ? (
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex h-9 w-9 sm:h-11 sm:w-11 cursor-pointer items-center justify-center rounded-full border border-gray-300 bg-gray-100 text-xs sm:text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                  >
                    {initials}
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-12 sm:top-14 z-10 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
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
                          onClick={() => setMenuOpen(false)}
                          className="flex w-full items-center rounded-xl px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          Settings
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            void authClient.signOut();
                          }}
                          className="flex w-full items-center rounded-xl px-3 py-2 text-sm text-left text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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
