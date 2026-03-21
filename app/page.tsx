'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import { authClient } from '@/lib/auth-client';
import AuthCard from '@/components/AuthCard';
import ImageUpload from '@/components/ImageUpload';
import ModelSelector from '@/components/ModelSelector';
import FlashcardViewer from '@/components/FlashcardViewer';

interface UploadedImage {
  id: Id<'images'>;
  url: string | null;
  preview: string;
}

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
}

function mapFlashcard(card: {
  _id: Id<'flashcards'>;
  question: string;
  answer: string;
  orderIndex: number;
}) {
  return {
    id: card._id,
    question: card.question,
    answer: card.answer,
    order_index: card.orderIndex,
  };
}

export default function Home() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const recentInstructions = useQuery(
    api.flashcards.getRecentInstructions,
    session ? {} : 'skip'
  );
  const settings = useQuery(api.settings.getUserSettings, session ? {} : 'skip');
  const generateFlashcards = useAction(api.generation.generateFlashcards);

  const [images, setImages] = useState<UploadedImage[]>([]);
  const [selectedModel, setSelectedModel] = useState('google/gemini-flash-1.5');
  const [customInstructions, setCustomInstructions] = useState('');
  const [generating, setGenerating] = useState(false);
  const [flashcardSet, setFlashcardSet] = useState<FlashcardSet | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleImagesChange = (newImages: UploadedImage[]) => {
    setImages(newImages);
    setError(null);
  };

  const handleGenerateFlashcards = async () => {
    if (images.length === 0) {
      setError('Please upload at least one image');
      return;
    }

    if (!settings?.hasOpenRouterKey) {
      setError('Add your OpenRouter API key in Settings before generating flashcards.');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const data = await generateFlashcards({
        imageIds: images.map((image) => image.id),
        model: selectedModel,
        customInstructions: customInstructions.trim() || undefined,
      });

      if (!data.flashcardSet) {
        throw new Error('Failed to generate flashcards');
      }

      setFlashcardSet({
        id: data.flashcardSet._id,
        title: data.flashcardSet.title,
        description: data.flashcardSet.description ?? null,
      });
      setFlashcards(data.flashcards.map(mapFlashcard));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to generate flashcards'
      );
    } finally {
      setGenerating(false);
    }
  };

  const resetUpload = () => {
    setImages([]);
    setCustomInstructions('');
    setFlashcardSet(null);
    setFlashcards([]);
    setError(null);
  };

  if (sessionPending) {
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
            Bring your own AI key. Keep your own study library.
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Sign in to store your flashcard sets, study progress, and your own
            encrypted OpenRouter key.
          </p>
        </div>
        <AuthCard />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Generate Flashcards from Homework
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Upload pictures of homework or study material, and AI will create flashcards to help you learn
        </p>
      </div>

      {!settings?.hasOpenRouterKey && (
        <div className="mb-6 p-4 bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-100 rounded-xl">
          <div className="font-medium">Add your OpenRouter key before generating.</div>
          <div className="mt-1 text-sm">
            This app uses your own key, encrypted per user.
          </div>
          <Link
            href="/settings"
            className="inline-block mt-3 text-sm font-medium underline underline-offset-2"
          >
            Open Settings
          </Link>
        </div>
      )}

      {!flashcardSet ? (
        <div className="space-y-6">
          <ImageUpload onImagesChange={handleImagesChange} />

          {images.length > 0 && (
            <>
              <ModelSelector
                value={selectedModel}
                onChange={setSelectedModel}
                disabled={generating}
              />

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <label className="block text-sm font-medium mb-2">
                  Additional Instructions (Optional)
                </label>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  disabled={generating}
                  placeholder="E.g., 'Focus on vocabulary words', 'Include step-by-step math solutions', 'Make questions for a 5th grader', etc."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Provide specific guidance for the AI on what kind of flashcards to create
                </p>

                {(recentInstructions?.length ?? 0) > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                      Recent instructions:
                    </p>
                    <div className="space-y-2">
                      {recentInstructions?.map((instruction: string) => (
                        <button
                          key={instruction}
                          type="button"
                          onClick={() => setCustomInstructions(instruction)}
                          disabled={generating}
                          className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                        >
                          {instruction}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => void handleGenerateFlashcards()}
                disabled={generating || !settings?.hasOpenRouterKey}
                className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Generating Flashcards...
                  </span>
                ) : (
                  `Generate Flashcards from ${images.length} Image${images.length > 1 ? 's' : ''}`
                )}
              </button>
            </>
          )}

          {error && (
            <div className="p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start mb-4">
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
                onClick={resetUpload}
                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Create New Set
              </button>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400">
              {flashcards.length} flashcard{flashcards.length !== 1 ? 's' : ''} generated
            </div>
          </div>

          <FlashcardViewer
            flashcards={flashcards}
            setId={flashcardSet.id}
            flipMode={false}
            onUpdate={() => {}}
          />

          <div className="text-center">
            <Link
              href="/flashcards"
              className="inline-block px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-md transition-colors"
            >
              View All My Flashcards
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
