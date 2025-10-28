'use client';

import { useState } from 'react';

interface Flashcard {
  id: number;
  question: string;
  answer: string;
  order_index: number;
}

interface FlashcardViewerProps {
  flashcards: Flashcard[];
}

export default function FlashcardViewer({ flashcards }: FlashcardViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  if (flashcards.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No flashcards available
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];

  const nextCard = () => {
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev + 1) % flashcards.length);
  };

  const prevCard = () => {
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
  };

  const toggleAnswer = () => {
    setShowAnswer(!showAnswer);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-4 text-center text-sm text-gray-600 dark:text-gray-400">
        Card {currentIndex + 1} of {flashcards.length}
      </div>

      <div
        className="relative bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 min-h-[300px] cursor-pointer transform transition-transform hover:scale-102"
        onClick={toggleAnswer}
      >
        <div className="flex flex-col justify-center items-center h-full">
          <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-4">
            {showAnswer ? 'ANSWER' : 'QUESTION'}
          </div>
          <div className="text-lg text-center">
            {showAnswer ? (
              <div className="whitespace-pre-wrap">{currentCard.answer}</div>
            ) : (
              <div className="whitespace-pre-wrap">{currentCard.question}</div>
            )}
          </div>
        </div>

        <div className="absolute bottom-4 right-4 text-xs text-gray-400">
          Click to flip
        </div>
      </div>

      <div className="flex justify-between items-center mt-6">
        <button
          onClick={prevCard}
          disabled={flashcards.length <= 1}
          className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>

        <button
          onClick={toggleAnswer}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showAnswer ? 'Show Question' : 'Show Answer'}
        </button>

        <button
          onClick={nextCard}
          disabled={flashcards.length <= 1}
          className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>

      <div className="mt-4 flex gap-2 justify-center flex-wrap">
        {flashcards.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              setCurrentIndex(idx);
              setShowAnswer(false);
            }}
            className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
              idx === currentIndex
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {idx + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
