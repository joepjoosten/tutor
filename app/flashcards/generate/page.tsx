'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { authClient } from '@/lib/auth-client';
import AuthCard from '@/components/AuthCard';
import FlashcardChat from '@/components/FlashcardChat';
import FlashcardEditor from '@/components/FlashcardEditor';

export default function GenerateFromImagesPage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const router = useRouter();
  const settings = useQuery(api.settings.getUserSettings, session ? {} : 'skip');

  const [setId, setSetId] = useState<Id<'flashcardSets'> | null>(null);

  const flashcardSet = useQuery(api.flashcards.getFlashcardSet, setId ? { setId } : 'skip');

  if (sessionPending || (session && settings === undefined)) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-600 dark:text-gray-300">
        Loading...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Sign in to generate flashcards
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Your sets and study progress are private to your account.
          </p>
        </div>
        <AuthCard />
      </div>
    );
  }

  if (!settings?.hasOpenRouterKey) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Add an AI key to generate flashcards
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Generating flashcards from photos uses your own OpenRouter API key.
          </p>
          <Link
            href="/settings"
            className="mt-6 inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md transition-colors"
          >
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Generate flashcards with AI
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Add photos of homework or study material, chat with the AI, and refine the cards together
        </p>
      </div>

      <div className="space-y-6">
        <FlashcardChat
          setId={setId}
          onGenerated={setSetId}
          tall={setId === null}
        />

        {setId && flashcardSet && (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start gap-4 mb-2">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {flashcardSet.title}
                  </h3>
                  {flashcardSet.description && (
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {flashcardSet.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSetId(null)}
                  className="shrink-0 px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Start a new set
                </button>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {flashcardSet.flashcards.length} flashcard
                {flashcardSet.flashcards.length !== 1 ? 's' : ''}
              </div>
            </div>

            <FlashcardEditor
              flashcards={flashcardSet.flashcards.map((card) => ({
                id: card._id,
                question: card.question,
                answer: card.answer,
                order_index: card.orderIndex,
              }))}
              setId={flashcardSet._id}
              onUpdate={() => {}}
            />

            <div className="flex justify-center gap-3 flex-wrap">
              <button
                onClick={() => router.push(`/flashcards/${setId}/study`)}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-md transition-colors"
              >
                Study this set
              </button>
              <button
                onClick={() => router.push('/flashcards')}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium rounded-lg shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                All flashcard sets
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
