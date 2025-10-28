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
  setId: number;
  onUpdate: () => void;
}

export default function FlashcardViewer({ flashcards: initialFlashcards, setId, onUpdate }: FlashcardViewerProps) {
  const [flashcards, setFlashcards] = useState(initialFlashcards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuestion, setEditedQuestion] = useState('');
  const [editedAnswer, setEditedAnswer] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');

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

  const startEditing = () => {
    setEditedQuestion(currentCard.question);
    setEditedAnswer(currentCard.answer);
    setIsEditing(true);
    setShowAnswer(false);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedQuestion('');
    setEditedAnswer('');
  };

  const saveEdit = async () => {
    try {
      const response = await fetch(`/api/flashcards/${currentCard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: editedQuestion,
          answer: editedAnswer,
        }),
      });

      if (response.ok) {
        const updatedCard = await response.json();
        setFlashcards(prev => prev.map(card =>
          card.id === updatedCard.id ? updatedCard : card
        ));
        setIsEditing(false);
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to update flashcard:', error);
      alert('Failed to update flashcard');
    }
  };

  const deleteCard = async () => {
    if (!confirm('Are you sure you want to delete this flashcard?')) return;

    try {
      const response = await fetch(`/api/flashcards/${currentCard.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const newFlashcards = flashcards.filter(card => card.id !== currentCard.id);
        setFlashcards(newFlashcards);
        if (currentIndex >= newFlashcards.length) {
          setCurrentIndex(Math.max(0, newFlashcards.length - 1));
        }
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to delete flashcard:', error);
      alert('Failed to delete flashcard');
    }
  };

  const startAdding = () => {
    setIsAdding(true);
    setNewQuestion('');
    setNewAnswer('');
  };

  const cancelAdding = () => {
    setIsAdding(false);
    setNewQuestion('');
    setNewAnswer('');
  };

  const saveNew = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) {
      alert('Please fill in both question and answer');
      return;
    }

    try {
      const response = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          set_id: setId,
          question: newQuestion,
          answer: newAnswer,
        }),
      });

      if (response.ok) {
        const newCard = await response.json();
        setFlashcards(prev => [...prev, newCard]);
        setIsAdding(false);
        setCurrentIndex(flashcards.length); // Jump to new card
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to create flashcard:', error);
      alert('Failed to create flashcard');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Card {currentIndex + 1} of {flashcards.length}
        </div>
        <button
          onClick={() => {
            setEditMode(!editMode);
            setIsEditing(false);
            setIsAdding(false);
          }}
          className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
            editMode
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          {editMode ? 'Study Mode' : 'Edit Mode'}
        </button>
      </div>

      {isEditing ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Edit Flashcard</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Question
              </label>
              <textarea
                value={editedQuestion}
                onChange={(e) => setEditedQuestion(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[100px] resize-y"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Answer
              </label>
              <textarea
                value={editedAnswer}
                onChange={(e) => setEditedAnswer(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[100px] resize-y"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelEditing}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      ) : isAdding ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Add New Flashcard</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Question
              </label>
              <textarea
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="Enter the question..."
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[100px] resize-y"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Answer
              </label>
              <textarea
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="Enter the answer..."
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[100px] resize-y"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelAdding}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveNew}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Add Flashcard
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="relative bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 min-h-[400px] cursor-pointer transform transition-transform hover:scale-102"
          onClick={toggleAnswer}
        >
          <div className="flex flex-col justify-center items-center h-full">
            <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-6">
              {showAnswer ? 'ANSWER' : 'QUESTION'}
            </div>
            <div className="text-3xl md:text-4xl text-center leading-relaxed font-serif">
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
      )}

      {!isEditing && !isAdding && (
        <>
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

          {editMode && (
            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={startEditing}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
              >
                Edit Card
              </button>
              <button
                onClick={deleteCard}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Delete Card
              </button>
              <button
                onClick={startAdding}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                Add New Card
              </button>
            </div>
          )}
        </>
      )}

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
