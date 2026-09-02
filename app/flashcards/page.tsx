'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { authClient } from '@/lib/auth-client';
import AuthCard from '@/components/AuthCard';

type ViewMode = 'cards' | 'list';
type SortMode = 'newest' | 'studied' | 'title';

const VIEW_KEY = 'flashcard-sets-view';
const SORT_KEY = 'flashcard-sets-sort';

function formatRelativeDay(timestamp: number | undefined) {
  if (!timestamp) return 'Never studied';
  const days = Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Studied today';
  if (days === 1) return 'Studied yesterday';
  if (days < 30) return `Studied ${days} days ago`;
  return `Studied ${new Date(timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`;
}

export default function FlashcardsPage() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();

  const rawSets = useQuery(api.flashcards.listFlashcardSets, session ? {} : 'skip');
  const settings = useQuery(api.settings.getUserSettings, session ? {} : 'skip');
  const canGenerate = settings?.hasOpenRouterKey === true;
  const createSet = useMutation(api.flashcards.createFlashcardSet);

  const [isCreatingSet, setIsCreatingSet] = useState(false);
  const [newSetTitle, setNewSetTitle] = useState('');
  const [newSetDescription, setNewSetDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingSet, setCreatingSet] = useState(false);

  const sets = useMemo(() => rawSets ?? [], [rawSets]);

  const [view, setView] = useState<ViewMode>('cards');
  const [sort, setSort] = useState<SortMode>('newest');
  const [search, setSearch] = useState('');

  useEffect(() => {
    try {
      const storedView = window.localStorage.getItem(VIEW_KEY);
      if (storedView === 'cards' || storedView === 'list') setView(storedView);
      const storedSort = window.localStorage.getItem(SORT_KEY);
      if (storedSort === 'newest' || storedSort === 'studied' || storedSort === 'title') {
        setSort(storedSort);
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  const changeView = (next: ViewMode) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const changeSort = (next: SortMode) => {
    setSort(next);
    try {
      window.localStorage.setItem(SORT_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const visibleSets = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? sets.filter(
          (set) =>
            set.title.toLowerCase().includes(needle) ||
            (set.description ?? '').toLowerCase().includes(needle)
        )
      : sets;
    const sorted = [...filtered];
    if (sort === 'newest') {
      sorted.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sort === 'studied') {
      sorted.sort(
        (a, b) => (b.lastStudiedAt ?? b.createdAt) - (a.lastStudiedAt ?? a.createdAt)
      );
    } else {
      sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    }
    return sorted;
  }, [sets, search, sort]);

  const loading = sessionPending || (session ? rawSets === undefined : false);

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
      router.push(`/flashcards/${createdSet._id}/study`);
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
          {canGenerate && (
            <Link
              href="/flashcards/generate"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Generate flashcards with AI
            </Link>
          )}
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
            {canGenerate && (
              <Link
                href="/flashcards/generate"
                className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md transition-colors"
              >
                Generate flashcards with AI
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search sets..."
              className="w-full sm:max-w-xs px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex items-center gap-3 sm:ml-auto">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                Sort
                <select
                  value={sort}
                  onChange={(event) => changeSort(event.target.value as SortMode)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="newest">Newest first</option>
                  <option value="studied">Last studied</option>
                  <option value="title">Title</option>
                </select>
              </label>
              <div
                role="group"
                aria-label="View"
                className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden"
              >
                <ViewButton
                  active={view === 'cards'}
                  onClick={() => changeView('cards')}
                  label="Cards"
                  icon="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                />
                <ViewButton
                  active={view === 'list'}
                  onClick={() => changeView('list')}
                  label="List"
                  icon="M4 6h16M4 12h16M4 18h16"
                />
              </div>
            </div>
          </div>

          {visibleSets.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">
              No sets match &ldquo;{search.trim()}&rdquo;.
            </p>
          ) : view === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleSets.map((set) => (
                <div
                  key={set._id}
                  className="flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
                >
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                    {set.title}
                  </h3>
                  {set.description && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                      {set.description}
                    </p>
                  )}
                  <div className="text-sm text-gray-500 dark:text-gray-500 mt-auto pt-2 mb-4">
                    <div>{set.flashcards.length} cards</div>
                    <div>
                      {sort === 'studied'
                        ? formatRelativeDay(set.lastStudiedAt)
                        : formatDate(set.createdAt)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/flashcards/${set._id}/study`}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-center"
                    >
                      Study
                    </Link>
                    <Link
                      href={`/flashcards/${set._id}/settings`}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      title="Set settings"
                    >
                      ⚙️
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md divide-y divide-gray-200 dark:divide-gray-700">
              {visibleSets.map((set) => (
                <div
                  key={set._id}
                  className="flex items-center gap-4 px-4 py-3 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/flashcards/${set._id}/study`}
                      className="block font-semibold text-gray-900 dark:text-white truncate hover:underline"
                    >
                      {set.title}
                    </Link>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {set.flashcards.length} cards
                      {set.description ? ` · ${set.description}` : ''}
                    </div>
                  </div>
                  <div className="hidden sm:block w-44 shrink-0 text-right text-sm text-gray-500 dark:text-gray-400">
                    {sort === 'studied'
                      ? formatRelativeDay(set.lastStudiedAt)
                      : formatDate(set.createdAt)}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={`/flashcards/${set._id}/study`}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-center"
                    >
                      Study
                    </Link>
                    <Link
                      href={`/flashcards/${set._id}/settings`}
                      className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      title="Set settings"
                    >
                      ⚙️
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface ViewButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
}

function ViewButton({ active, onClick, label, icon }: ViewButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={`px-3 py-2 transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
      </svg>
      <span className="sr-only">{label}</span>
    </button>
  );
}
