'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import { authClient } from '@/lib/auth-client';
import AuthCard from '@/components/AuthCard';

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FlashcardSetSettingsPage() {
  const params = useParams<{ setId: string }>();
  const router = useRouter();
  const setId = params.setId as Id<'flashcardSets'>;
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const flashcardSet = useQuery(api.flashcards.getFlashcardSet, session ? { setId } : 'skip');
  const updateSet = useMutation(api.flashcards.updateFlashcardSet);
  const deleteSet = useMutation(api.flashcards.deleteFlashcardSet);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');

  const loading =
    sessionPending || (session ? flashcardSet === undefined : false);

  const startEditingTitle = () => {
    if (flashcardSet) {
      setEditedTitle(flashcardSet.title);
      setIsEditingTitle(true);
    }
  };

  const cancelEditingTitle = () => {
    setIsEditingTitle(false);
    setEditedTitle('');
  };

  const saveTitle = async () => {
    if (!flashcardSet || !editedTitle.trim()) return;
    try {
      await updateSet({ setId, title: editedTitle.trim() });
      setIsEditingTitle(false);
    } catch (error) {
      console.error('Failed to update set title:', error);
      alert('Failed to update set title');
    }
  };

  const startEditingDescription = () => {
    if (flashcardSet) {
      setEditedDescription(flashcardSet.description || '');
      setIsEditingDescription(true);
    }
  };

  const cancelEditingDescription = () => {
    setIsEditingDescription(false);
    setEditedDescription('');
  };

  const saveDescription = async () => {
    if (!flashcardSet) return;
    try {
      await updateSet({ setId, description: editedDescription.trim() || null });
      setIsEditingDescription(false);
    } catch (error) {
      console.error('Failed to update set description:', error);
      alert('Failed to update set description');
    }
  };

  const handleDeleteSet = async () => {
    if (!confirm('Are you sure you want to delete this flashcard set?')) return;
    try {
      await deleteSet({ setId });
      router.push('/flashcards');
    } catch (caughtError) {
      alert(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to delete flashcard set'
      );
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Sign in to manage settings
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Settings are private to the owner of the flashcard set.
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
          ← Back to all sets
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
      <div className="mb-6">
        <Link
          href={`/flashcards/${setId}/study`}
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to set
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Set Settings</h3>
        {isEditingTitle ? (
          <div className="mb-4">
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xl font-bold"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => void saveTitle()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Save
              </button>
              <button
                onClick={cancelEditingTitle}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {flashcardSet.title}
            </h2>
            <button
              onClick={startEditingTitle}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Edit Title
            </button>
          </div>
        )}
        {isEditingDescription ? (
          <div className="mb-4">
            <textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              placeholder="Add a description (optional)"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[80px] resize-y"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => void saveDescription()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Save
              </button>
              <button
                onClick={cancelEditingDescription}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-start mb-2">
            {flashcardSet.description ? (
              <p className="text-gray-600 dark:text-gray-400 flex-1">
                {flashcardSet.description}
              </p>
            ) : (
              <p className="text-gray-400 dark:text-gray-500 italic flex-1">
                No description
              </p>
            )}
            <button
              onClick={startEditingDescription}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 ml-2"
            >
              {flashcardSet.description ? 'Edit' : 'Add'}
            </button>
          </div>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          Created: {formatDate(flashcardSet.createdAt)}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          {flashcardSet.flashcards.length} flashcard{flashcardSet.flashcards.length !== 1 ? 's' : ''}
        </p>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-3">
          <Link
            href={`/flashcards/${setId}/edit`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Cards
          </Link>
          <Link
            href={`/flashcards/${setId}/sharing`}
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Manage Sharing
          </Link>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => void handleDeleteSet()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
          >
            Delete Set
          </button>
        </div>
      </div>
    </div>
  );
}
