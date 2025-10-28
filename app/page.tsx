'use client';

import { useState } from 'react';
import ImageUpload from '@/components/ImageUpload';
import ModelSelector from '@/components/ModelSelector';
import FlashcardViewer from '@/components/FlashcardViewer';

interface UploadedImage {
  id: number;
  filepath: string;
  preview: string;
}

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
}

export default function Home() {
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

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-flashcards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageIds: images.map(img => img.id),
          model: selectedModel,
          customInstructions: customInstructions.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate flashcards');
      }

      setFlashcardSet(data.flashcardSet);
      setFlashcards(data.flashcards);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate flashcards');
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
              </div>

              <button
                onClick={handleGenerateFlashcards}
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

          <FlashcardViewer flashcards={flashcards} />

          <div className="text-center">
            <a
              href="/flashcards"
              className="inline-block px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-md transition-colors"
            >
              View All My Flashcards
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
