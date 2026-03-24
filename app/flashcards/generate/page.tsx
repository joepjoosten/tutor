'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
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

interface GeneratedResult {
  flashcardSet: {
    _id: Id<'flashcardSets'>;
    title: string;
    description?: string;
    flipMode: boolean;
    createdAt: number;
  } | null;
  flashcards: Array<{
    _id: Id<'flashcards'>;
    question: string;
    answer: string;
    orderIndex: number;
  }>;
}

export default function GenerateFromImagesPage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const router = useRouter();
  const generateFlashcards = useAction(api.generation.generateFlashcards);

  const [images, setImages] = useState<UploadedImage[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImagesChange = (newImages: UploadedImage[]) => {
    setImages(newImages);
    setError(null);
  };

  const handleGenerate = async () => {
    if (images.length === 0) {
      setError('Please upload at least one image');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const generated = await generateFlashcards({
        imageIds: images.map((img) => img.id),
        model: selectedModel,
        customInstructions: customInstructions.trim() || undefined,
      });

      setResult(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate flashcards');
    } finally {
      setGenerating(false);
    }
  };

  const resetUpload = () => {
    setImages([]);
    setCustomInstructions('');
    setResult(null);
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

  if (result?.flashcardSet) {
    const setId = result.flashcardSet._id;
    const mappedCards = result.flashcards.map((card) => ({
      id: card._id,
      question: card.question,
      answer: card.answer,
      order_index: card.orderIndex,
    }));

    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {result.flashcardSet.title}
                </h3>
                {result.flashcardSet.description && (
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {result.flashcardSet.description}
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
              {result.flashcards.length} flashcard{result.flashcards.length !== 1 ? 's' : ''} generated
            </div>
          </div>

          <FlashcardViewer
            flashcards={mappedCards}
            setId={setId}
            flipMode={result.flashcardSet.flipMode}
            onUpdate={() => {}}
          />

          <div className="flex justify-center gap-3 flex-wrap">
            <button
              onClick={() => router.push(`/flashcards?setId=${setId}`)}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-md transition-colors"
            >
              View in My Flashcards
            </button>
            <button
              onClick={() => router.push('/flashcards')}
              className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium rounded-lg shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              All Flashcard Sets
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Generate Flashcards from Images
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Upload pictures of homework or study material, and AI will create flashcards to help you learn
        </p>
      </div>

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
            </div>

            <button
              onClick={() => void handleGenerate()}
              disabled={generating}
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
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
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
    </div>
  );
}
