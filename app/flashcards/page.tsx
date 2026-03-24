'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import { authClient } from '@/lib/auth-client';
import AuthCard from '@/components/AuthCard';
import FlashcardViewer from '@/components/FlashcardViewer';

interface Flashcard {
  id: Id<'flashcards'>;
  question: string;
  answer: string;
  order_index: number;
}

interface FlashcardSet {
  id: Id<'flashcardSets'>;
  title: string;
  description: string | null;
  flip_mode: boolean;
  created_at: number;
  flashcards: Flashcard[];
}

function mapSet(set: {
  _id: Id<'flashcardSets'>;
  title: string;
  description?: string;
  flipMode: boolean;
  createdAt: number;
  flashcards: Array<{
    _id: Id<'flashcards'>;
    question: string;
    answer: string;
    orderIndex: number;
  }>;
}): FlashcardSet {
  return {
    id: set._id,
    title: set.title,
    description: set.description ?? null,
    flip_mode: set.flipMode,
    created_at: set.createdAt,
    flashcards: set.flashcards.map((card) => ({
      id: card._id,
      question: card.question,
      answer: card.answer,
      order_index: card.orderIndex,
    })),
  };
}

export default function FlashcardsPage() {
  const searchParams = useSearchParams();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const requestedSetId = searchParams.get('setId') as Id<'flashcardSets'> | null;
  const rawSets = useQuery(api.flashcards.listFlashcardSets, session ? {} : 'skip');
  const createSet = useMutation(api.flashcards.createFlashcardSet);
  const deleteSet = useMutation(api.flashcards.deleteFlashcardSet);
  const updateSet = useMutation(api.flashcards.updateFlashcardSet);
  const createOrGetShareLink = useMutation(api.shares.createOrGetShareLink);
  const revokeShareLink = useMutation(api.shares.revokeShareLink);

  const [selectedSetId, setSelectedSetId] = useState<Id<'flashcardSets'> | null>(requestedSetId);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [isCreatingSet, setIsCreatingSet] = useState(false);
  const [newSetTitle, setNewSetTitle] = useState('');
  const [newSetDescription, setNewSetDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingSet, setCreatingSet] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const sets = useMemo(() => (rawSets ?? []).map(mapSet), [rawSets]);
  const selectedSet = useMemo(
    () => sets.find((set: FlashcardSet) => set.id === selectedSetId) ?? null,
    [selectedSetId, sets]
  );
  const activeShare = useQuery(
    api.shares.getActiveShareForSet,
    session && selectedSet ? { setId: selectedSet.id } : 'skip'
  );

  useEffect(() => {
    if (requestedSetId) {
      setSelectedSetId(requestedSetId);
    }
  }, [requestedSetId]);

  const loading = sessionPending || (session ? rawSets === undefined : false);

  const buildShareUrl = (slug: string) => {
    if (typeof window === 'undefined') {
      return `/shared/${slug}`;
    }
    return `${window.location.origin}/shared/${slug}`;
  };

  const handleDeleteSet = async (id: Id<'flashcardSets'>) => {
    if (!confirm('Are you sure you want to delete this flashcard set?')) {
      return;
    }

    try {
      await deleteSet({ setId: id });
      if (selectedSetId === id) {
        setSelectedSetId(null);
      }
    } catch (caughtError) {
      alert(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to delete flashcard set'
      );
    }
  };

  const openCreateSet = () => {
    setIsCreatingSet(true);
    setCreateError(null);
  };

  const closeCreateSet = () => {
    setIsCreatingSet(false);
    setNewSetTitle('');
    setNewSetDescription('');
    setCreateError(null);
  };

  const handleCreateSet = async () => {
    if (!newSetTitle.trim()) {
      setCreateError('Title is required.');
      return;
    }

    try {
      setCreatingSet(true);
      setCreateError(null);
      const createdSet = await createSet({
        title: newSetTitle,
        description: newSetDescription.trim() || null,
      });

      if (!createdSet) {
        throw new Error('Failed to create flashcard set');
      }

      closeCreateSet();
      setSelectedSetId(createdSet._id);
    } catch (caughtError) {
      setCreateError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to create flashcard set'
      );
    } finally {
      setCreatingSet(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const startEditingTitle = () => {
    if (selectedSet) {
      setEditedTitle(selectedSet.title);
      setIsEditingTitle(true);
    }
  };

  const cancelEditingTitle = () => {
    setIsEditingTitle(false);
    setEditedTitle('');
  };

  const saveTitle = async () => {
    if (!selectedSet || !editedTitle.trim()) return;

    try {
      await updateSet({
        setId: selectedSet.id,
        title: editedTitle.trim(),
      });
      setIsEditingTitle(false);
    } catch (error) {
      console.error('Failed to update set title:', error);
      alert('Failed to update set title');
    }
  };

  const startEditingDescription = () => {
    if (selectedSet) {
      setEditedDescription(selectedSet.description || '');
      setIsEditingDescription(true);
    }
  };

  const cancelEditingDescription = () => {
    setIsEditingDescription(false);
    setEditedDescription('');
  };

  const saveDescription = async () => {
    if (!selectedSet) return;

    try {
      await updateSet({
        setId: selectedSet.id,
        description: editedDescription.trim() || null,
      });
      setIsEditingDescription(false);
    } catch (error) {
      console.error('Failed to update set description:', error);
      alert('Failed to update set description');
    }
  };

  const toggleFlipMode = async () => {
    if (!selectedSet) return;

    try {
      await updateSet({
        setId: selectedSet.id,
        flipMode: !selectedSet.flip_mode,
      });
    } catch (error) {
      console.error('Failed to toggle flip mode:', error);
    }
  };

  const handleCreateOrRefreshShare = async () => {
    if (!selectedSet) return;

    try {
      setShareBusy(true);
      setShareMessage(null);
      await createOrGetShareLink({ setId: selectedSet.id });
      setShareMessage(
        activeShare ? 'Shared snapshot refreshed.' : 'Share link created.'
      );
    } catch (error) {
      console.error('Failed to create share link:', error);
      setShareMessage('Failed to create share link.');
    } finally {
      setShareBusy(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!activeShare) return;

    try {
      await navigator.clipboard.writeText(buildShareUrl(activeShare.slug));
      setShareMessage('Share link copied.');
    } catch (error) {
      console.error('Failed to copy share link:', error);
      setShareMessage('Failed to copy share link.');
    }
  };

  const handleRevokeShareLink = async () => {
    if (!selectedSet) return;

    try {
      setShareBusy(true);
      setShareMessage(null);
      await revokeShareLink({ setId: selectedSet.id });
      setShareMessage('Share link revoked.');
    } catch (error) {
      console.error('Failed to revoke share link:', error);
      setShareMessage('Failed to revoke share link.');
    } finally {
      setShareBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
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
            Sign in to see your flashcards
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Your sets and study progress are private to your account.
          </p>
        </div>
        <AuthCard />
      </div>
    );
  }

  if (selectedSet) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => setSelectedSetId(null)}
            className="text-blue-600 dark:text-blue-400 hover:underline mb-4"
          >
            ← Back to all sets
          </button>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
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
                  {selectedSet.title}
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
                {selectedSet.description ? (
                  <p className="text-gray-600 dark:text-gray-400 flex-1">
                    {selectedSet.description}
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
                  {selectedSet.description ? 'Edit' : 'Add'}
                </button>
              </div>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Created: {formatDate(selectedSet.created_at)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {selectedSet.flashcards.length} flashcard{selectedSet.flashcards.length !== 1 ? 's' : ''}
            </p>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSet.flip_mode}
                  onChange={() => void toggleFlipMode()}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Flip Questions & Answers (show answers as questions)
                </span>
              </label>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Share This Set
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Shared links stay public until you revoke them. Other users only get their own editable copy if they explicitly import.
                  </p>
                </div>
                <button
                  onClick={() => void handleCreateOrRefreshShare()}
                  disabled={shareBusy}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {shareBusy
                    ? 'Working...'
                    : activeShare
                    ? 'Refresh Shared Snapshot'
                    : 'Create Share Link'}
                </button>
              </div>

              {activeShare && (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      readOnly
                      value={buildShareUrl(activeShare.slug)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                    <button
                      onClick={() => void handleCopyShareLink()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Copy Link
                    </button>
                    <Link
                      href={`/shared/${activeShare.slug}`}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-center text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Open
                    </Link>
                    <button
                      onClick={() => void handleRevokeShareLink()}
                      disabled={shareBusy}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Revoking stops access through the shared URL. Anyone who already imported the set keeps their private copy.
                  </p>
                </>
              )}

              {shareMessage && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {shareMessage}
                </p>
              )}
            </div>
          </div>
        </div>

        <FlashcardViewer
          flashcards={selectedSet.flashcards}
          setId={selectedSet.id}
          flipMode={selectedSet.flip_mode}
          onUpdate={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            My Flashcard Sets
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Review, manage, or create flashcard collections
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={openCreateSet}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            New Empty Set
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Generate from Images
          </Link>
        </div>
      </div>

      {isCreatingSet && (
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Create Empty Flashcard Set
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title
              </label>
              <input
                type="text"
                value={newSetTitle}
                onChange={(e) => setNewSetTitle(e.target.value)}
                placeholder="E.g. Biology Chapter 4"
                disabled={creatingSet}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={newSetDescription}
                onChange={(e) => setNewSetDescription(e.target.value)}
                placeholder="Add context for this set"
                disabled={creatingSet}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[96px] resize-y"
              />
            </div>
            {createError && (
              <div className="p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg text-sm">
                {createError}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeCreateSet}
                disabled={creatingSet}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreateSet()}
                disabled={creatingSet}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {creatingSet ? 'Creating...' : 'Create Set'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sets.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No flashcard sets yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Generate a set from images or start an empty set and add cards yourself
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <button
              onClick={openCreateSet}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-md transition-colors"
            >
              New Empty Set
            </button>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md transition-colors"
            >
              Generate Flashcards
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sets.map((set: FlashcardSet) => (
            <div
              key={set.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
            >
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                  {set.title}
                </h3>
                {set.description && (
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                    {set.description}
                  </p>
                )}
                <div className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                  <div>{set.flashcards.length} cards</div>
                  <div>{formatDate(set.created_at)}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedSetId(set.id)}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Study
                  </button>
                  <button
                    onClick={() => void handleDeleteSet(set.id)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    title="Delete set"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
