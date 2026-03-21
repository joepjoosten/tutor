"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function SettingsPanel() {
  const settings = useQuery(api.settings.getUserSettings);
  const setOpenRouterKey = useMutation(api.settings.setOpenRouterKey);
  const clearOpenRouterKey = useMutation(api.settings.clearOpenRouterKey);

  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await setOpenRouterKey({ apiKey });
      setApiKey("");
      setMessage("OpenRouter key saved.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to save key."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await clearOpenRouterKey({});
      setMessage("OpenRouter key removed.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to remove key."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          AI Settings
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Your OpenRouter key is encrypted before it is stored and is only used
          when you generate flashcards.
        </p>
      </div>

      <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          Current key:
        </div>
        <div className="mt-1 font-medium text-gray-900 dark:text-white">
          {settings === undefined
            ? "Loading..."
            : settings.hasOpenRouterKey
              ? `Stored ending in ${settings.openRouterKeyLast4}`
              : "No key saved yet"}
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleSave}>
        <div>
          <label className="block text-sm font-medium mb-2">
            OpenRouter API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="sk-or-v1-..."
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Paste a new key to save or replace the current one.
          </p>
        </div>

        {message && (
          <div className="p-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg text-sm">
            {message}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={saving || apiKey.trim().length === 0}
            className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save key"}
          </button>
          <button
            type="button"
            disabled={saving || !settings?.hasOpenRouterKey}
            onClick={() => void handleClear()}
            className="px-5 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Remove key
          </button>
        </div>
      </form>
    </div>
  );
}
