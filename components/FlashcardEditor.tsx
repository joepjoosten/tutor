'use client';

import { useEffect, useState } from 'react';
import { useMutation } from 'convex/react';
import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import type { FlashcardStudyCard } from '@/components/FlashcardStudy';

interface FlashcardEditorProps {
  flashcards: FlashcardStudyCard[];
  setId: Id<'flashcardSets'>;
  onUpdate?: () => void;
}

export default function FlashcardEditor({
  flashcards: initialFlashcards,
  setId,
  onUpdate,
}: FlashcardEditorProps) {
  const updateFlashcard = useMutation(api.flashcards.updateFlashcard);
  const deleteFlashcard = useMutation(api.flashcards.deleteFlashcard);
  const createFlashcard = useMutation(api.flashcards.createFlashcard);

  const [flashcards, setFlashcards] = useState(initialFlashcards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuestion, setEditedQuestion] = useState('');
  const [editedAnswer, setEditedAnswer] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');

  const notifyUpdate = onUpdate ?? (() => {});

  useEffect(() => {
    setFlashcards(initialFlashcards);
  }, [initialFlashcards]);

  // Empty state
  if (flashcards.length === 0 && !isAdding) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-10 text-center">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
            This set is empty
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Add the first flashcard to get started.
          </p>
          <button
            onClick={() => {
              setIsAdding(true);
              setNewQuestion('');
              setNewAnswer('');
            }}
            className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Add First Flashcard
          </button>
        </div>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];

  const nextCard = () => {
    setCurrentIndex((prev) => (prev + 1) % flashcards.length);
    setIsEditing(false);
  };

  const prevCard = () => {
    setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
    setIsEditing(false);
  };

  const startEditing = () => {
    if (!currentCard) return;
    setEditedQuestion(currentCard.question);
    setEditedAnswer(currentCard.answer);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedQuestion('');
    setEditedAnswer('');
  };

  const saveEdit = async () => {
    if (!currentCard) return;
    try {
      const updatedCard = await updateFlashcard({
        flashcardId: currentCard.id as Id<'flashcards'>,
        question: editedQuestion,
        answer: editedAnswer,
      });
      if (!updatedCard) {
        throw new Error('Card update failed');
      }
      setFlashcards((prev) =>
        prev.map((card) =>
          card.id === updatedCard._id
            ? {
                id: updatedCard._id,
                question: updatedCard.question,
                answer: updatedCard.answer,
                order_index: updatedCard.orderIndex,
              }
            : card
        )
      );
      setIsEditing(false);
      notifyUpdate();
    } catch (error) {
      console.error('Failed to update flashcard:', error);
      alert('Failed to update flashcard');
    }
  };

  const deleteCard = async () => {
    if (!currentCard) return;
    if (!confirm('Are you sure you want to delete this flashcard?')) return;

    try {
      await deleteFlashcard({ flashcardId: currentCard.id as Id<'flashcards'> });
      const newFlashcards = flashcards.filter((card) => card.id !== currentCard.id);
      setFlashcards(newFlashcards);
      if (currentIndex >= newFlashcards.length) {
        setCurrentIndex(Math.max(0, newFlashcards.length - 1));
      }
      setIsEditing(false);
      notifyUpdate();
    } catch (error) {
      console.error('Failed to delete flashcard:', error);
      alert('Failed to delete flashcard');
    }
  };

  const startAdding = () => {
    setIsAdding(true);
    setIsEditing(false);
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
      const newCard = await createFlashcard({
        setId,
        question: newQuestion,
        answer: newAnswer,
      });
      if (!newCard) {
        throw new Error('Card creation failed');
      }
      setFlashcards((prev) => [
        ...prev,
        {
          id: newCard._id,
          question: newCard.question,
          answer: newCard.answer,
          order_index: newCard.orderIndex,
        },
      ]);
      setIsAdding(false);
      setCurrentIndex(flashcards.length);
      notifyUpdate();
    } catch (error) {
      console.error('Failed to create flashcard:', error);
      alert('Failed to create flashcard');
    }
  };

  if (isAdding) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <CardForm
          title="Add New Flashcard"
          question={newQuestion}
          answer={newAnswer}
          onQuestionChange={setNewQuestion}
          onAnswerChange={setNewAnswer}
          onCancel={cancelAdding}
          onSave={saveNew}
          saveLabel="Add Flashcard"
        />
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading...
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="mb-4 text-sm font-medium text-gray-600 dark:text-gray-400">
          Editing card {currentIndex + 1} of {flashcards.length}
        </div>
        <CardForm
          title="Edit Flashcard"
          question={editedQuestion}
          answer={editedAnswer}
          onQuestionChange={setEditedQuestion}
          onAnswerChange={setEditedAnswer}
          onCancel={cancelEditing}
          onSave={saveEdit}
          saveLabel="Save Changes"
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-4 text-sm font-medium text-gray-600 dark:text-gray-400">
        Card {currentIndex + 1} of {flashcards.length}
      </div>

      {/* Card display - shows both question and answer */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <div className="mb-6">
          <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-2">
            Question
          </div>
          <div className="text-2xl md:text-3xl leading-relaxed font-serif whitespace-pre-wrap">
            {currentCard.question}
          </div>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide mb-2">
            Answer
          </div>
          <div className="text-2xl md:text-3xl leading-relaxed font-serif whitespace-pre-wrap">
            {currentCard.answer}
          </div>
        </div>
      </div>

      {/* Navigation + action buttons */}
      <div className="flex items-center mt-6 gap-2">
        <button
          onClick={prevCard}
          disabled={flashcards.length <= 1}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex gap-2 mx-auto">
          <button
            onClick={startEditing}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="hidden sm:inline">Edit</span>
          </button>
          <button
            onClick={() => void deleteCard()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="hidden sm:inline">Delete</span>
          </button>
          <button
            onClick={startAdding}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Add New</span>
          </button>
        </div>

        <button
          onClick={nextCard}
          disabled={flashcards.length <= 1}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Card dots */}
      <div className="mt-4 flex gap-2 justify-center flex-wrap">
        {flashcards.map((card, idx) => (
          <button
            key={card.id}
            onClick={() => {
              setCurrentIndex(idx);
              setIsEditing(false);
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

function CardForm({
  title,
  question,
  answer,
  onQuestionChange,
  onAnswerChange,
  onCancel,
  onSave,
  saveLabel,
}: {
  title: string;
  question: string;
  answer: string;
  onQuestionChange: (value: string) => void;
  onAnswerChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void | Promise<void>;
  saveLabel: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
      <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{title}</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Question
          </label>
          <textarea
            value={question}
            onChange={(e) => onQuestionChange(e.target.value)}
            placeholder="Enter the question..."
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[100px] resize-y"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Answer
          </label>
          <textarea
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Enter the answer..."
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[100px] resize-y"
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void onSave()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
