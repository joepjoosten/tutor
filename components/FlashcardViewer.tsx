'use client';

import { useState, useEffect } from 'react';

interface Flashcard {
  id: number;
  question: string;
  answer: string;
  order_index: number;
}

interface FlashcardViewerProps {
  flashcards: Flashcard[];
  setId: number;
  flipMode: boolean;
  onUpdate: () => void;
}

interface StudyProgress {
  [flashcardId: number]: boolean;
}

export default function FlashcardViewer({ flashcards: initialFlashcards, setId, flipMode, onUpdate }: FlashcardViewerProps) {
  const [flashcards, setFlashcards] = useState(initialFlashcards);
  const [displayOrder, setDisplayOrder] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuestion, setEditedQuestion] = useState('');
  const [editedAnswer, setEditedAnswer] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [dontKnowCards, setDontKnowCards] = useState<StudyProgress>({});
  const [randomize, setRandomize] = useState(false);
  const [showDontKnowOnly, setShowDontKnowOnly] = useState(false);
  const [randomSeed, setRandomSeed] = useState(0);

  // Load study progress
  useEffect(() => {
    loadStudyProgress();
  }, [setId]);

  // Initialize display order when flashcards or filters change
  useEffect(() => {
    let cardsToShow = flashcards;

    if (showDontKnowOnly) {
      cardsToShow = flashcards.filter(card => dontKnowCards[card.id]);
    }

    let order = cardsToShow.map((_, idx) => idx);

    if (randomize) {
      order = [...order].sort(() => Math.random() - 0.5);
    }

    setDisplayOrder(order);

    // Only reset to first card if current index is out of bounds and we have cards
    if (cardsToShow.length > 0 && currentIndex >= cardsToShow.length) {
      setCurrentIndex(Math.max(0, cardsToShow.length - 1));
    }
  }, [flashcards, randomize, showDontKnowOnly, randomSeed]);

  const loadStudyProgress = async () => {
    try {
      const response = await fetch(`/api/study-progress?setId=${setId}`);
      if (response.ok) {
        const data = await response.json();
        const progressMap: StudyProgress = {};
        data.progress.forEach((p: any) => {
          if (p.dont_know === 1) {
            progressMap[p.flashcard_id] = true;
          }
        });
        setDontKnowCards(progressMap);
      }
    } catch (error) {
      console.error('Failed to load study progress:', error);
    }
  };

  const getVisibleCards = () => {
    if (showDontKnowOnly) {
      return flashcards.filter(card => dontKnowCards[card.id]);
    }
    return flashcards;
  };

  const visibleCards = getVisibleCards();

  if (visibleCards.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {showDontKnowOnly ? 'No cards marked as "don\'t know"' : 'No flashcards available'}
      </div>
    );
  }

  const currentCard = visibleCards[displayOrder[currentIndex] || 0];

  // Safety check - if currentCard is undefined, return loading state
  if (!currentCard) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading...
      </div>
    );
  }

  const nextCard = () => {
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev + 1) % visibleCards.length);
  };

  const prevCard = () => {
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev - 1 + visibleCards.length) % visibleCards.length);
  };

  const toggleAnswer = () => {
    setShowAnswer(!showAnswer);
  };

  const toggleDontKnow = async () => {
    const newState = !dontKnowCards[currentCard.id];
    const wasMarked = dontKnowCards[currentCard.id];
    const isNowKnown = wasMarked && !newState;

    try {
      const response = await fetch('/api/study-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setId,
          flashcardId: currentCard.id,
          dontKnow: newState,
        }),
      });

      if (response.ok) {
        // Update the state
        setDontKnowCards(prev => ({
          ...prev,
          [currentCard.id]: newState,
        }));

        // If in review mode and marking as "know", handle navigation carefully
        if (showDontKnowOnly && isNowKnown) {
          const remainingCards = visibleCards.filter(card =>
            card.id === currentCard.id ? false : dontKnowCards[card.id]
          );

          if (remainingCards.length === 0) {
            // No more cards to review - stay on current (will show "no cards" message)
            setCurrentIndex(0);
          } else if (currentIndex >= remainingCards.length) {
            // Current index will be out of bounds, go to last card
            setCurrentIndex(remainingCards.length - 1);
          }
          // else: stay at current index (will show next card in the list)
        } else {
          // Normal mode: just go to next card
          nextCard();
        }
      }
    } catch (error) {
      console.error('Failed to update study progress:', error);
    }
  };

  const resetProgress = async () => {
    if (!confirm('Are you sure you want to reset all study progress?')) return;

    try {
      const response = await fetch(`/api/study-progress?setId=${setId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDontKnowCards({});
      }
    } catch (error) {
      console.error('Failed to reset progress:', error);
      alert('Failed to reset progress');
    }
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

  const getDisplayQuestion = () => flipMode ? currentCard.answer : currentCard.question;
  const getDisplayAnswer = () => flipMode ? currentCard.question : currentCard.answer;

  const dontKnowCount = Object.values(dontKnowCards).filter(v => v).length;

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-6 flex justify-between items-center flex-wrap gap-2">
        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Card {currentIndex + 1} of {visibleCards.length}
          {dontKnowCount > 0 && (
            <span className="ml-2 text-red-600 dark:text-red-400">
              ({dontKnowCount} to review)
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const newRandomize = !randomize;
              setRandomize(newRandomize);
              // When turning ON random, increment seed to trigger new shuffle
              if (newRandomize) {
                setRandomSeed(prev => prev + 1);
              }
            }}
            className={`px-3 py-1 rounded-lg transition-colors text-sm ${
              randomize
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            🔀 Random
          </button>
          <button
            onClick={() => setShowDontKnowOnly(!showDontKnowOnly)}
            className={`px-3 py-1 rounded-lg transition-colors text-sm ${
              showDontKnowOnly
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            disabled={dontKnowCount === 0}
          >
            Review Only
          </button>
          <button
            onClick={resetProgress}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
            disabled={dontKnowCount === 0}
          >
            Reset Progress
          </button>
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
          {dontKnowCards[currentCard.id] && (
            <div className="absolute top-4 right-4 px-3 py-1 bg-red-600 text-white text-xs font-medium rounded-full">
              Need to review
            </div>
          )}

          <div className="flex flex-col justify-center items-center h-full">
            <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-6">
              {flipMode ? (
                showAnswer ? 'QUESTION' : 'ANSWER'
              ) : (
                showAnswer ? 'ANSWER' : 'QUESTION'
              )}
            </div>
            <div className="text-3xl md:text-4xl text-center leading-relaxed font-serif">
              {showAnswer ? (
                <div className="whitespace-pre-wrap">{getDisplayAnswer()}</div>
              ) : (
                <div className="whitespace-pre-wrap">{getDisplayQuestion()}</div>
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
          <div className="flex justify-between items-center mt-6 gap-2">
            <button
              onClick={prevCard}
              disabled={visibleCards.length <= 1}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>

            <div className="flex gap-2">
              <button
                onClick={toggleAnswer}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {showAnswer ? 'Show Question' : 'Show Answer'}
              </button>
              <button
                onClick={toggleDontKnow}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  dontKnowCards[currentCard.id]
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {dontKnowCards[currentCard.id] ? '✓ Know' : "✗ Don't Know"}
              </button>
            </div>

            <button
              onClick={nextCard}
              disabled={visibleCards.length <= 1}
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
        {displayOrder.map((orderIdx, idx) => {
          const card = visibleCards[orderIdx];
          if (!card) return null;
          return (
            <button
              key={card.id}
              onClick={() => {
                setCurrentIndex(idx);
                setShowAnswer(false);
              }}
              className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                idx === currentIndex
                  ? 'bg-blue-600 text-white'
                  : dontKnowCards[card.id]
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
