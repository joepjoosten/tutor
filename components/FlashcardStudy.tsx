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
  } = props;
  const ownerSetId = props.mode === 'owner' ? props.setId : undefined;
  const progressStorageKey =
    props.mode === 'shared' ? props.progressStorageKey : undefined;

  const studyProgress = useQuery(
    api.flashcards.getStudyProgress,
    ownerSetId ? { setId: ownerSetId } : 'skip'
  );
  const markStudyProgress = useMutation(api.flashcards.markStudyProgress);
  const resetStudyProgress = useMutation(api.flashcards.resetStudyProgress);

  const [flashcards, setFlashcards] = useState(initialFlashcards);
  const [displayOrder, setDisplayOrder] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [dontKnowCards, setDontKnowCards] = useState<SharedStudyProgress>({});
  const [randomize, setRandomize] = useState(false);
  const [localFlipMode, setLocalFlipMode] = useState(flipMode);
  const [showDontKnowOnly, setShowDontKnowOnly] = useState(false);
  const [randomSeed, setRandomSeed] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [sharedProgressLoaded, setSharedProgressLoaded] = useState(
    props.mode === 'owner'
  );

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
        const inFullscreen = !!document.fullscreenElement;
        setIsFullscreen(inFullscreen);
        setIsNativeFullscreen(inFullscreen);
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
    const defaultEmptyDescription =
      'This set does not have any flashcards yet.';

    return (
      <div className="w-full max-w-4xl mx-auto">
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
          </div>
        </div>
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

  const markDontKnow = async () => {
    if (dontKnowCards[currentCard.id]) {
      nextCard();
      return;
    }

    const nextProgressMap = { ...dontKnowCards, [currentCard.id]: true };

    try {
      if (ownerSetId) {
        await markStudyProgress({
          setId: ownerSetId,
          flashcardId: currentCard.id as Id<'flashcards'>,
          dontKnow: true,
        });
      }

      setDontKnowCards(nextProgressMap);
      nextCard();
    } catch (error) {
      console.error('Failed to update study progress:', error);
    }
  };

  const markCorrect = async () => {
    const wasMarked = dontKnowCards[currentCard.id];

    if (wasMarked) {
      const nextProgressMap = { ...dontKnowCards };
      delete nextProgressMap[currentCard.id];

      try {
        if (ownerSetId) {
          await markStudyProgress({
            setId: ownerSetId,
            flashcardId: currentCard.id as Id<'flashcards'>,
            dontKnow: false,
          });
        }

        setDontKnowCards(nextProgressMap);

        if (showDontKnowOnly) {
          const remainingCards = visibleCards.filter((card) =>
            card.id === currentCard.id ? false : nextProgressMap[card.id]
          );

          if (remainingCards.length === 0) {
            setCurrentIndex(0);
          } else if (currentIndex >= remainingCards.length) {
            setCurrentIndex(remainingCards.length - 1);
          }
          return;
        }
      } catch (error) {
        console.error('Failed to update study progress:', error);
      }
    }

    nextCard();
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
      setIsNativeFullscreen(false);
      setIsFullscreen(true);
      return;
    }

    try {
      await document.documentElement.requestFullscreen();
      setIsNativeFullscreen(true);
      setIsFullscreen(true);
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
      setIsNativeFullscreen(false);
      setIsFullscreen(true);
    }
  };

  const exitFullscreen = async () => {
    if (isIOS() && isPWA()) {
      setIsFullscreen(false);
      setIsNativeFullscreen(false);
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      setIsFullscreen(false);
      setIsNativeFullscreen(false);
    } catch (error) {
      console.error('Failed to exit fullscreen:', error);
      setIsFullscreen(false);
      setIsNativeFullscreen(false);
    }
  };

  const getDisplayQuestion = () => localFlipMode ? currentCard.answer : currentCard.question;
  const getDisplayAnswer = () => localFlipMode ? currentCard.question : currentCard.answer;
  const dontKnowCount = Object.values(dontKnowCards).filter((value) => value).length;

  if (isFullscreen) {
    return (
      <div className={`${isNativeFullscreen ? 'fixed inset-0' : 'fixed left-0 top-0'} bg-gray-900 flex flex-col items-center justify-between p-8 z-50`} style={{
        ...(!isNativeFullscreen ? { width: '100dvw', height: '100dvh' } : {}),
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
              onClick={() => void markDontKnow()}
            />
            <IconNavButton
              onClick={() => void markCorrect()}
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
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              const newRandomize = !randomize;
              setRandomize(newRandomize);
              if (newRandomize) {
                setRandomSeed((prev) => prev + 1);
              }
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors text-sm flex items-center gap-1.5 ${
              randomize
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            title="Random order"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h3l2 5h0M20 4h-3l-2 5h0M4 20h3l2-5h0M20 20h-3l-2-5h0M7 9l3 3-3 3M17 9l-3 3 3 3" />
            </svg>
            <span className="hidden sm:inline">Random</span>
          </button>
          <button
            onClick={() => setLocalFlipMode((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg transition-colors text-sm flex items-center gap-1.5 ${
              localFlipMode
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            title="Flip Q&A"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            <span className="hidden sm:inline">Flip</span>
          </button>
          <button
            onClick={() => setShowDontKnowOnly(!showDontKnowOnly)}
            className={`px-3 py-1.5 rounded-lg transition-colors text-sm flex items-center gap-1.5 ${
              showDontKnowOnly
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            disabled={dontKnowCount === 0}
            title="Review only"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="hidden sm:inline">Review Only</span>
          </button>
          <button
            onClick={() => void resetProgress()}
            className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm flex items-center gap-1.5"
            disabled={dontKnowCount === 0}
            title="Reset progress"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Reset</span>
          </button>
          <button
            onClick={() => void enterFullscreen()}
            className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
            title="Fullscreen mode"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
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

      <div className="mt-6 flex items-center gap-2">
        <button
          onClick={prevCard}
          disabled={visibleCards.length <= 1}
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-200 text-gray-800 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 sm:mr-auto sm:h-auto sm:w-auto sm:gap-2 sm:px-6 sm:py-2"
          title="Previous"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span className="hidden sm:inline">Previous</span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => void markDontKnow()}
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-600 text-white transition-colors hover:bg-red-700 sm:h-auto sm:w-auto sm:gap-2 sm:px-4 sm:py-2"
            title="Don't know"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <span className="hidden sm:inline">Don&apos;t Know</span>
          </button>

          <button
            onClick={() => void markCorrect()}
            disabled={visibleCards.length <= 1}
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-600 text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:h-auto sm:w-auto sm:gap-2 sm:px-6 sm:py-2"
            title="Correct"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="hidden sm:inline">Correct</span>
          </button>
        </div>
      </div>

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
}: {
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="p-4 rounded-full transition-colors shadow-lg bg-red-600 text-white hover:bg-red-700"
      title="Mark as don't know"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-7 w-7"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  );
}
