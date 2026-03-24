'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { authClient } from '@/lib/auth-client';
import { getSharedStudyProgressStorageKey } from '@/lib/sharedStudyProgress';
import SharedFlashcardViewer from '@/components/SharedFlashcardViewer';

interface SharedFlashcardPageProps {
  slug: string;
}

export default function SharedFlashcardPage({ slug }: SharedFlashcardPageProps) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const sharedSet = useQuery(api.shares.getSharedSetBySlug, { slug });
  const importSharedSet = useMutation(api.shares.importSharedSet);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  if (sharedSet === undefined || sessionPending) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center text-gray-600 dark:text-gray-300">
        Loading shared flashcards...
      </div>
    );
  }

  if (!sharedSet) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            This shared set is not available
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            The link may have been revoked, expired, or entered incorrectly.
          </p>
        </div>
      </div>
    );
  }

  const flashcards = sharedSet.flashcards.map((card) => ({
    id: card._id,
    question: card.question,
    answer: card.answer,
    order_index: card.orderIndex,
  }));

  const handleImport = async () => {
    try {
      setIsImporting(true);
      setImportError(null);
      const importedSet = await importSharedSet({ slug });

      if (!importedSet) {
        throw new Error('Failed to import shared set');
      }

      router.push(`/flashcards/${importedSet._id}/study`);
    } catch (caughtError) {
      setImportError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to import shared set'
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
          Shared Flashcards
        </p>
        <h2 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
          {sharedSet.title}
        </h2>
        {sharedSet.description ? (
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            {sharedSet.description}
          </p>
        ) : (
          <p className="mt-3 text-gray-400 dark:text-gray-500 italic">
            No description
          </p>
        )}
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
          {flashcards.length} flashcard{flashcards.length !== 1 ? 's' : ''}. Progress for this link is stored only on this device until you explicitly import it.
        </p>
      </div>

      <div className="mb-8 bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6">
        {session ? (
          <>
            <button
              onClick={() => void handleImport()}
              disabled={isImporting}
              className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              {isImporting ? 'Importing...' : 'Import This Set'}
            </button>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Import creates a private copy in your library. Until you do that, this page behaves like an anonymous shared set.
            </p>
          </>
        ) : (
          <>
            <Link
              href="/"
              className="block w-full px-4 py-3 text-center bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
            >
              Sign In to Import
            </Link>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              You can study this shared set without signing in. Sign in only if you want to save your own editable copy.
            </p>
          </>
        )}

        {importError && (
          <div className="mt-3 p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg text-sm">
            {importError}
          </div>
        )}
      </div>

      <SharedFlashcardViewer
        flashcards={flashcards}
        flipMode={sharedSet.flipMode}
        progressStorageKey={getSharedStudyProgressStorageKey(slug)}
      />
    </div>
  );
}
