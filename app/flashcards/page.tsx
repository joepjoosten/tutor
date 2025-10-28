'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import FlashcardViewer from '@/components/FlashcardViewer';

interface Flashcard {
  id: number;
  question: string;
  answer: string;
  order_index: number;
}

interface FlashcardSet {
  id: number;
  title: string;
  description: string | null;
  flip_mode: number;
  created_at: string;
  flashcards: Flashcard[];
}

export default function FlashcardsPage() {
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<FlashcardSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');

  useEffect(() => {
    loadFlashcardSets();
  }, []);

  const loadFlashcardSets = async () => {
    try {
      const response = await fetch('/api/flashcard-sets');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load flashcard sets');
      }

      setSets(data.sets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flashcard sets');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSet = async (id: number) => {
    if (!confirm('Are you sure you want to delete this flashcard set?')) {
      return;
    }

    try {
      const response = await fetch(`/api/flashcard-sets?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete flashcard set');
      }

      // Remove from local state
      setSets(sets.filter((set) => set.id !== id));
      if (selectedSet?.id === id) {
        setSelectedSet(null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete flashcard set');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
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
      const response = await fetch(`/api/flashcard-sets/${selectedSet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editedTitle, description: selectedSet.description }),
      });

      if (response.ok) {
        const updatedSet = await response.json();
        setSelectedSet({ ...selectedSet, title: updatedSet.title });
        setSets(prev => prev.map(s => s.id === updatedSet.id ? { ...s, title: updatedSet.title } : s));
        setIsEditingTitle(false);
      }
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
      const response = await fetch(`/api/flashcard-sets/${selectedSet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: selectedSet.title, description: editedDescription.trim() || undefined }),
      });

      if (response.ok) {
        const updatedSet = await response.json();
        setSelectedSet({ ...selectedSet, description: updatedSet.description });
        setSets(prev => prev.map(s => s.id === updatedSet.id ? { ...s, description: updatedSet.description } : s));
        setIsEditingDescription(false);
      }
    } catch (error) {
      console.error('Failed to update set description:', error);
      alert('Failed to update set description');
    }
  };

  const toggleFlipMode = async () => {
    if (!selectedSet) return;

    try {
      const newFlipMode = selectedSet.flip_mode === 1 ? 0 : 1;
      const response = await fetch(`/api/flashcard-sets/${selectedSet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flip_mode: newFlipMode }),
      });

      if (response.ok) {
        const updatedSet = await response.json();
        setSelectedSet({ ...selectedSet, flip_mode: updatedSet.flip_mode });
        setSets(prev => prev.map(s => s.id === updatedSet.id ? { ...s, flip_mode: updatedSet.flip_mode } : s));
      }
    } catch (error) {
      console.error('Failed to toggle flip mode:', error);
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

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <div className="text-red-600 dark:text-red-400">Error: {error}</div>
        </div>
      </div>
    );
  }

  if (selectedSet) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => setSelectedSet(null)}
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
                    onClick={saveTitle}
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
                    onClick={saveDescription}
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
                  checked={selectedSet.flip_mode === 1}
                  onChange={toggleFlipMode}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Flip Questions & Answers (show answers as questions)
                </span>
              </label>
            </div>
          </div>
        </div>

        <FlashcardViewer
          flashcards={selectedSet.flashcards}
          setId={selectedSet.id}
          flipMode={selectedSet.flip_mode === 1}
          onUpdate={loadFlashcardSets}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          My Flashcard Sets
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Review and manage your flashcard collections
        </p>
      </div>

      {sets.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No flashcard sets yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Upload homework images to generate your first flashcard set
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md transition-colors"
          >
            Create Flashcards
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sets.map((set) => (
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
                    onClick={() => setSelectedSet(set)}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Study
                  </button>
                  <button
                    onClick={() => handleDeleteSet(set.id)}
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
