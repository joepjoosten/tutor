'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import { authClient } from '@/lib/auth-client';
import AuthCard from '@/components/AuthCard';
import { useState } from 'react';

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildShareUrl(slug: string) {
  if (typeof window === 'undefined') {
    return `/shared/${slug}`;
  }
  return `${window.location.origin}/shared/${slug}`;
}

export default function FlashcardSetSharingPage() {
  const params = useParams<{ setId: string }>();
  const setId = params.setId as Id<'flashcardSets'>;
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const flashcardSet = useQuery(api.flashcards.getFlashcardSet, session ? { setId } : 'skip');
  const activeShare = useQuery(
    api.shares.getActiveShareForSet,
    session && flashcardSet ? { setId } : 'skip'
  );
  const createOrGetShareLink = useMutation(api.shares.createOrGetShareLink);
  const revokeShareLink = useMutation(api.shares.revokeShareLink);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const loading =
    sessionPending ||
    (session ? flashcardSet === undefined || (flashcardSet ? activeShare === undefined : false) : false);

  const handleCreateOrRefreshShare = async () => {
    try {
      setShareBusy(true);
      setShareMessage(null);
      await createOrGetShareLink({ setId });
      setShareMessage(activeShare ? 'Shared snapshot refreshed.' : 'Share link created.');
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
    try {
      setShareBusy(true);
      setShareMessage(null);
      await revokeShareLink({ setId });
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
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="py-12 text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading sharing settings...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-3xl font-bold text-gray-900 dark:text-white">
            Sign in to manage sharing
          </h2>
          <p className="mx-auto max-w-2xl text-gray-600 dark:text-gray-400">
            Sharing settings are private to the owner of the flashcard set.
          </p>
        </div>
        <AuthCard />
      </div>
    );
  }

  if (!flashcardSet) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/flashcards"
          className="text-blue-600 transition-colors hover:underline dark:text-blue-400"
        >
          ← Back to all sets
        </Link>
        <div className="mt-6 rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Set not found</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            This flashcard set does not exist or you do not have access to it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href={`/flashcards/${flashcardSet._id}/study`}
          className="text-blue-600 transition-colors hover:underline dark:text-blue-400"
        >
          ← Back to set
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
        <div className="flex flex-col gap-6 border-b border-gray-200 pb-6 dark:border-gray-700 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Sharing
            </p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {flashcardSet.title}
            </h2>
            {flashcardSet.description ? (
              <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
                {flashcardSet.description}
              </p>
            ) : (
              <p className="mt-2 max-w-2xl italic text-gray-400 dark:text-gray-500">
                No description
              </p>
            )}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <div>{flashcardSet.flashcards.length} cards</div>
            <div>Created {formatDate(flashcardSet.createdAt)}</div>
          </div>
        </div>

        <div className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Shared link
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Shared links stay public until you revoke them. Other users only get their own editable copy if they explicitly import.
              </p>
            </div>
            <button
              onClick={() => void handleCreateOrRefreshShare()}
              disabled={shareBusy}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {shareBusy ? 'Working...' : activeShare ? 'Refresh Shared Snapshot' : 'Create Share Link'}
            </button>
          </div>

          {activeShare ? (
            <>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  Public URL
                </div>
                <input
                  type="text"
                  readOnly
                  value={buildShareUrl(activeShare.slug)}
                  className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => void handleCopyShareLink()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                >
                  Copy Link
                </button>
                <Link
                  href={`/shared/${activeShare.slug}`}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-center text-gray-800 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                >
                  Open Shared Page
                </Link>
                <button
                  onClick={() => void handleRevokeShareLink()}
                  disabled={shareBusy}
                  className="rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  Revoke Link
                </button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Revoking stops access through the shared URL. Anyone who already imported the set keeps their private copy.
              </p>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              No public link exists for this set yet.
            </div>
          )}

          {shareMessage && (
            <p className="text-sm text-gray-600 dark:text-gray-300">{shareMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}
