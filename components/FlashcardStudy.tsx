'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import {
  parseSharedStudyProgress,
  serializeSharedStudyProgress,
} from '@/lib/sharedStudyProgress';

export interface FlashcardStudyCard {
  id: string;
  question: string;
  answer: string;
  order_index: number;
}

interface SharedStudyProgress {
  [flashcardId: string]: boolean;
}

interface BaseFlashcardStudyProps {
  flashcards: FlashcardStudyCard[];
  flipMode: boolean;
  emptyStateDescription?: string;
  onUpdate?: () => void;
}

interface OwnerFlashcardStudyProps extends BaseFlashcardStudyProps {
  mode: 'owner';
  setId: Id<'flashcardSets'>;
}

interface SharedFlashcardStudyProps extends BaseFlashcardStudyProps {
  mode: 'shared';
  progressStorageKey: string;
}

type FlashcardStudyProps =
  | OwnerFlashcardStudyProps
  | SharedFlashcardStudyProps;

export default function FlashcardStudy(props: FlashcardStudyProps) {
  const {
    flashcards: initialFlashcards,
    flipMode,
    emptyStateDescription,
    onUpdate,
  } = props;
  const ownerSetId = props.mode === 'owner' ? props.setId : undefined;
  const progressStorageKey =
    props.mode === 'shared' ? props.progressStorageKey : undefined;
  const canEdit = props.mode === 'owner';

  const studyProgress = useQuery(
    api.flashcards.getStudyProgress,
    ownerSetId ? { setId: ownerSetId } : 'skip'
  );
  const markStudyProgress = useMutation(api.flashcards.markStudyProgress);
  const resetStudyProgress = useMutation(api.flashcards.resetStudyProgress);
  const updateFlashcard = useMutation(api.flashcards.updateFlashcard);
  const deleteFlashcard = useMutation(api.flashcards.deleteFlashcard);
  const createFlashcard = useMutation(api.flashcards.createFlashcard);

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
  const [dontKnowCards, setDontKnowCards] = useState<SharedStudyProgress>({});
  const [randomize, setRandomize] = useState(false);
  const [localFlipMode, setLocalFlipMode] = useState(flipMode);
  const [showDontKnowOnly, setShowDontKnowOnly] = useState(false);
  const [randomSeed, setRandomSeed] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sharedProgressLoaded, setSharedProgressLoaded] = useState(
    props.mode === 'owner'
  );

  const notifyUpdate = onUpdate ?? (() => {});

  const isIOS = () => {
    if (typeof window === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  };

  const isPWA = () => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as { standalone?: boolean }).standalone === true;
  };

  useEffect(() => {
    setFlashcards(initialFlashcards);
  }, [initialFlashcards]);

  useEffect(() => {
    setLocalFlipMode(flipMode);
  }, [flipMode]);

  useEffect(() => {
    if (props.mode !== 'owner') {
      return;
    }

    const progressMap: SharedStudyProgress = {};
    studyProgress?.forEach((item: { flashcardId: Id<'flashcards'>; dontKnow: boolean }) => {
      if (item.dontKnow) {
        progressMap[item.flashcardId] = true;
      }
    });
    setDontKnowCards(progressMap);
  }, [props.mode, studyProgress]);

  useEffect(() => {
    if (props.mode !== 'shared' || !progressStorageKey || typeof window === 'undefined') {
      return;
    }

    setSharedProgressLoaded(false);
    setDontKnowCards(
      parseSharedStudyProgress(window.localStorage.getItem(progressStorageKey))
    );
    setSharedProgressLoaded(true);
  }, [props.mode, progressStorageKey]);

  useEffect(() => {
    if (
      props.mode !== 'shared' ||
      !progressStorageKey ||
      !sharedProgressLoaded ||
      typeof window === 'undefined'
    ) {
      return;
    }

    window.localStorage.setItem(
      progressStorageKey,
      serializeSharedStudyProgress(dontKnowCards)
    );
  }, [dontKnowCards, progressStorageKey, props.mode, sharedProgressLoaded]);

  useEffect(() => {
    let cardsToShow = flashcards;

    if (showDontKnowOnly) {
      cardsToShow = flashcards.filter((card) => dontKnowCards[card.id]);
    }

    let order = cardsToShow.map((_, idx) => idx);

    if (randomize) {
      order = [...order].sort(() => Math.random() - 0.5);
    }

    setDisplayOrder(order);

    if (cardsToShow.length > 0 && currentIndex >= cardsToShow.length) {
      setCurrentIndex(Math.max(0, cardsToShow.length - 1));
    }
  }, [currentIndex, dontKnowCards, flashcards, randomize, randomSeed, showDontKnowOnly]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!isIOS() || !isPWA()) {
        setIsFullscreen(!!document.fullscreenElement);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const getVisibleCards = () => {
    if (showDontKnowOnly) {
      return flashcards.filter((card) => dontKnowCards[card.id]);
    }
    return flashcards;
  };

  const visibleCards = getVisibleCards();

  if (visibleCards.length === 0) {
    const defaultEmptyDescription = canEdit
      ? 'Create the first flashcard in this set without uploading any images.'
      : 'This shared set does not have any flashcards.';

    return (
      <div className="w-full max-w-4xl mx-auto">
        {isAdding && canEdit ? (
          <AddFlashcardForm
            newQuestion={newQuestion}
            newAnswer={newAnswer}
            onQuestionChange={setNewQuestion}
            onAnswerChange={setNewAnswer}
            onCancel={() => {
              setIsAdding(false);
              setNewQuestion('');
              setNewAnswer('');
            }}
            onSave={async () => {
              if (!newQuestion.trim() || !newAnswer.trim() || !ownerSetId) {
                alert('Please fill in both question and answer');
                return;
              }

              try {
                const newCard = await createFlashcard({
                  setId: ownerSetId,
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
            }}
          />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-10 text-center">
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
              {showDontKnowOnly ? 'No cards marked for review' : 'This set is empty'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {showDontKnowOnly
                ? 'Switch back to all cards to continue studying.'
                : emptyStateDescription ?? defaultEmptyDescription}
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              {showDontKnowOnly && flashcards.length > 0 && (
                <button
                  onClick={() => setShowDontKnowOnly(false)}
                  className="px-5 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Show All Cards
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => {
                    setIsAdding(true);
                    setNewQuestion('');
                    setNewAnswer('');
                  }}
                  className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  {flashcards.length === 0 ? 'Add First Flashcard' : 'Add Flashcard'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const currentCard = visibleCards[displayOrder[currentIndex] || 0];

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
    const nextProgressMap = { ...dontKnowCards };

    if (newState) {
      nextProgressMap[currentCard.id] = true;
    } else {
      delete nextProgressMap[currentCard.id];
    }

    try {
      if (ownerSetId) {
        await markStudyProgress({
          setId: ownerSetId,
          flashcardId: currentCard.id as Id<'flashcards'>,
          dontKnow: newState,
        });
      }

      setDontKnowCards(nextProgressMap);

      if (showDontKnowOnly && isNowKnown) {
        const remainingCards = visibleCards.filter((card) =>
          card.id === currentCard.id ? false : nextProgressMap[card.id]
        );

        if (remainingCards.length === 0) {
          setCurrentIndex(0);
        } else if (currentIndex >= remainingCards.length) {
          setCurrentIndex(remainingCards.length - 1);
        }
      } else {
        nextCard();
      }
    } catch (error) {
      console.error('Failed to update study progress:', error);
    }
  };

  const resetProgress = async () => {
    if (!confirm('Are you sure you want to reset all study progress?')) return;

    try {
      if (ownerSetId) {
        await resetStudyProgress({ setId: ownerSetId });
      } else if (progressStorageKey && typeof window !== 'undefined') {
        window.localStorage.removeItem(progressStorageKey);
      }
      setDontKnowCards({});
    } catch (error) {
      console.error('Failed to reset progress:', error);
      alert('Failed to reset progress');
    }
  };

  const enterFullscreen = async () => {
    if (isIOS() && isPWA()) {
      setIsFullscreen(true);
      return;
    }

    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
      setIsFullscreen(true);
    }
  };

  const exitFullscreen = async () => {
    if (isIOS() && isPWA()) {
      setIsFullscreen(false);
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      setIsFullscreen(false);
    } catch (error) {
      console.error('Failed to exit fullscreen:', error);
      setIsFullscreen(false);
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
      const updatedCard = await updateFlashcard({
        flashcardId: currentCard.id as Id<'flashcards'>,
        question: editedQuestion,
        answer: editedAnswer,
      });
      if (!updatedCard) {
        throw new Error('Card update failed');
      }
      setFlashcards((prev) => prev.map((card) =>
        card.id === updatedCard._id
          ? {
              id: updatedCard._id,
              question: updatedCard.question,
              answer: updatedCard.answer,
              order_index: updatedCard.orderIndex,
            }
          : card
      ));
      setIsEditing(false);
      notifyUpdate();
    } catch (error) {
      console.error('Failed to update flashcard:', error);
      alert('Failed to update flashcard');
    }
  };

  const deleteCard = async () => {
    if (!confirm('Are you sure you want to delete this flashcard?')) return;

    try {
      await deleteFlashcard({ flashcardId: currentCard.id as Id<'flashcards'> });
      const newFlashcards = flashcards.filter((card) => card.id !== currentCard.id);
      setFlashcards(newFlashcards);
      if (currentIndex >= newFlashcards.length) {
        setCurrentIndex(Math.max(0, newFlashcards.length - 1));
      }
      notifyUpdate();
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
    if (!newQuestion.trim() || !newAnswer.trim() || !ownerSetId) {
      alert('Please fill in both question and answer');
      return;
    }

    try {
      const newCard = await createFlashcard({
        setId: ownerSetId,
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

  const getDisplayQuestion = () => localFlipMode ? currentCard.answer : currentCard.question;
  const getDisplayAnswer = () => localFlipMode ? currentCard.question : currentCard.answer;
  const dontKnowCount = Object.values(dontKnowCards).filter((value) => value).length;

  const addFlashcardForm = canEdit ? (
    <AddFlashcardForm
      newQuestion={newQuestion}
      newAnswer={newAnswer}
      onQuestionChange={setNewQuestion}
      onAnswerChange={setNewAnswer}
      onCancel={cancelAdding}
      onSave={saveNew}
    />
  ) : null;

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-between p-8 z-50" style={{
        paddingTop: 'max(2rem, env(safe-area-inset-top))',
        paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(2rem, env(safe-area-inset-left))',
        paddingRight: 'max(2rem, env(safe-area-inset-right))',
      }}>
        <div className="w-full flex justify-between items-center">
          <div className="text-white text-lg font-medium">
            Card {currentIndex + 1} of {visibleCards.length}
            {dontKnowCount > 0 && (
              <span className="ml-3 text-red-400">
                ({dontKnowCount} to review)
              </span>
            )}
          </div>
          <button
            onClick={exitFullscreen}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            title="Exit fullscreen"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div
          className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-16 max-w-4xl w-full cursor-pointer transform transition-transform hover:scale-102"
          onClick={toggleAnswer}
        >
          {dontKnowCards[currentCard.id] && (
            <div className="absolute top-6 right-6 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-full">
              Need to review
            </div>
          )}

          <div className="flex flex-col justify-center items-center h-full min-h-[400px]">
            <div className="text-base font-medium text-blue-600 dark:text-blue-400 mb-8">
              {localFlipMode ? (
                showAnswer ? 'QUESTION' : 'ANSWER'
              ) : (
                showAnswer ? 'ANSWER' : 'QUESTION'
              )}
            </div>
            <div className="text-4xl md:text-5xl text-center leading-relaxed font-serif">
              {showAnswer ? (
                <div className="whitespace-pre-wrap">{getDisplayAnswer()}</div>
              ) : (
                <div className="whitespace-pre-wrap">{getDisplayQuestion()}</div>
              )}
            </div>
          </div>

          <div className="absolute bottom-6 right-6 text-sm text-gray-400">
            Click to flip
          </div>
        </div>

        <div className="flex items-center w-full gap-3">
          <IconNavButton
            onClick={prevCard}
            disabled={visibleCards.length <= 1}
            title="Previous card"
            direction="prev"
          />
          <div className="ml-auto flex gap-3">
            <IconKnowButton
              onClick={() => void toggleDontKnow()}
              isMarked={!!dontKnowCards[currentCard.id]}
            />
            <IconNavButton
              onClick={nextCard}
              disabled={visibleCards.length <= 1}
              title="Correct"
              direction="next"
              variant="correct"
            />
          </div>
        </div>
      </div>
    );
  }

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
              if (newRandomize) {
                setRandomSeed((prev) => prev + 1);
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
            onClick={() => setLocalFlipMode((prev) => !prev)}
            className={`px-3 py-1 rounded-lg transition-colors text-sm ${
              localFlipMode
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            🔄 Flip
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
            onClick={() => void resetProgress()}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
            disabled={dontKnowCount === 0}
          >
            Reset Progress
          </button>
          {canEdit && (
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
          )}
          <button
            onClick={() => void enterFullscreen()}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
            title="Fullscreen mode"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          </button>
        </div>
      </div>

      {isEditing && canEdit ? (
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
                onClick={() => void saveEdit()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      ) : isAdding && canEdit ? (
        addFlashcardForm
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
              {localFlipMode ? (
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
          <div className="flex items-center mt-6 gap-2">
            <button
              onClick={prevCard}
              disabled={visibleCards.length <= 1}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mr-auto"
            >
              Previous
            </button>

            <button
              onClick={() => void toggleDontKnow()}
              className={`px-4 py-2 rounded-lg transition-colors ${
                dontKnowCards[currentCard.id]
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {dontKnowCards[currentCard.id] ? '✓ Know' : "✗ Don't Know"}
            </button>

            <button
              onClick={nextCard}
              disabled={visibleCards.length <= 1}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Correct
            </button>
          </div>

          {editMode && canEdit && (
            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={startEditing}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
              >
                Edit Card
              </button>
              <button
                onClick={() => void deleteCard()}
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

function AddFlashcardForm({
  newQuestion,
  newAnswer,
  onQuestionChange,
  onAnswerChange,
  onCancel,
  onSave,
}: {
  newQuestion: string;
  newAnswer: string;
  onQuestionChange: (value: string) => void;
  onAnswerChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void | Promise<void>;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
      <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Add New Flashcard</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Question
          </label>
          <textarea
            value={newQuestion}
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
            value={newAnswer}
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
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Add Flashcard
          </button>
        </div>
      </div>
    </div>
  );
}

function IconNavButton({
  onClick,
  disabled,
  title,
  direction,
  variant,
}: {
  onClick: () => void;
  disabled: boolean;
  title: string;
  direction: 'prev' | 'next';
  variant?: 'correct';
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-4 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-lg ${
        variant === 'correct'
          ? 'bg-green-600 text-white hover:bg-green-700'
          : 'bg-gray-700 text-white hover:bg-gray-600'
      }`}
      title={title}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-7 w-7"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        {direction === 'prev' ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M15 19l-7-7 7-7"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M9 5l7 7-7 7"
          />
        )}
      </svg>
    </button>
  );
}

function IconKnowButton({
  onClick,
  isMarked,
}: {
  onClick: () => void;
  isMarked: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-full transition-colors shadow-lg ${
        isMarked
          ? 'bg-green-600 text-white hover:bg-green-700'
          : 'bg-red-600 text-white hover:bg-red-700'
      }`}
      title={isMarked ? 'Mark as known' : "Mark as don't know"}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-7 w-7"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        {isMarked ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 13l4 4L19 7"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M6 18L18 6M6 6l12 12"
          />
        )}
      </svg>
    </button>
  );
}
