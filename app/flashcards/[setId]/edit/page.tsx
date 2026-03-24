'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import { authClient } from '@/lib/auth-client';
import AuthCard from '@/components/AuthCard';
import FlashcardEditor from '@/components/FlashcardEditor';

export default function FlashcardEditPage() {
  const params = useParams<{ setId: string }>();
  const setId = params.setId as Id<'flashcardSets'>;
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const flashcardSet = useQuery(api.flashcards.getFlashcardSet, session ? { setId } : 'skip');

  const loading =
    sessionPending || (session ? flashcardSet === undefined : false);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading flashcards...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Sign in to edit flashcards
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            You must be the owner of a flashcard set to edit it.
          </p>
        </div>
        <AuthCard />
      </div>
    );
  }

  if (!flashcardSet) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/flashcards"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          &larr; Back to all sets
        </Link>
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Set not found</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            This flashcard set does not exist or you do not have access to it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
        <div>
          <Link
            href={`/flashcards/${setId}/study`}
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            &larr; Back to study
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            Edit: {flashcardSet.title}
          </h2>
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
    </div>
  );
}
