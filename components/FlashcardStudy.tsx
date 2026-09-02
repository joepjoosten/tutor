'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
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
  /** Flip and slide animations; defaults to on. */
  animations?: boolean;
  emptyStateDescription?: string;
  onUpdate?: () => void;
}

interface OwnerFlashcardStudyProps extends BaseFlashcardStudyProps {
  mode: 'owner';
  setId: Id<'flashcardSets'>;
  /** Offer read-aloud audio for the question side. */
  speakQuestion?: boolean;
  /** Offer read-aloud audio for the answer side. */
  speakAnswer?: boolean;
}

interface SharedFlashcardStudyProps extends BaseFlashcardStudyProps {
  mode: 'shared';
  progressStorageKey: string;
}

type FlashcardStudyProps =
  | OwnerFlashcardStudyProps
  | SharedFlashcardStudyProps;

function shuffleIds(ids: string[]) {
  const shuffled = [...ids];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function arraysEqual<T>(first: T[], second: T[]) {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

export default function FlashcardStudy(props: FlashcardStudyProps) {
  const {
    flashcards: initialFlashcards,
    flipMode,
    emptyStateDescription,
  } = props;
  const animations = props.animations ?? true;
  const ownerSetId = props.mode === 'owner' ? props.setId : undefined;
  const speakQuestion = props.mode === 'owner' && props.speakQuestion === true;
  const speakAnswer = props.mode === 'owner' && props.speakAnswer === true;
  const progressStorageKey =
    props.mode === 'shared' ? props.progressStorageKey : undefined;

  const studyProgress = useQuery(
    api.flashcards.getStudyProgress,
    ownerSetId ? { setId: ownerSetId } : 'skip'
  );
  const markStudyProgress = useMutation(api.flashcards.markStudyProgress);
  const resetStudyProgress = useMutation(api.flashcards.resetStudyProgress);

  const [flashcards, setFlashcards] = useState(initialFlashcards);
  const [displayOrder, setDisplayOrder] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [dontKnowCards, setDontKnowCards] = useState<SharedStudyProgress>({});
  const [randomize, setRandomize] = useState(false);
  const [localFlipMode, setLocalFlipMode] = useState(flipMode);
  // Which way the next card slides in; set by the navigation handlers.
  const slideDirectionRef = useRef<'next' | 'prev'>('next');
  // The card that is sliding out while the new one slides in.
  const [outgoing, setOutgoing] = useState<{
    card: FlashcardStudyCard;
    flipped: boolean;
    direction: 'next' | 'prev';
  } | null>(null);
  const [showDontKnowOnly, setShowDontKnowOnly] = useState(false);
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

  const visibleCards = useMemo(
    () =>
      showDontKnowOnly
        ? flashcards.filter((card) => dontKnowCards[card.id])
        : flashcards,
    [dontKnowCards, flashcards, showDontKnowOnly]
  );
  const visibleCardIds = useMemo(
    () => visibleCards.map((card) => card.id),
    [visibleCards]
  );
  const visibleCardIdKey = visibleCardIds.join('\u0000');
  const visibleCardsById = useMemo(
    () => new Map(visibleCards.map((card) => [card.id, card])),
    [visibleCards]
  );
  const visibleCardIdSet = useMemo(
    () => new Set(visibleCardIds),
    [visibleCardIds]
  );
  const activeDisplayOrder = useMemo(
    () => displayOrder.filter((cardId) => visibleCardIdSet.has(cardId)),
    [displayOrder, visibleCardIdSet]
  );

  useEffect(() => {
    setDisplayOrder((previousOrder) => {
      if (!randomize) {
        return arraysEqual(previousOrder, visibleCardIds) ? previousOrder : visibleCardIds;
      }

      const previousVisibleOrder = previousOrder.filter((cardId) => visibleCardIdSet.has(cardId));
      const missingIds = visibleCardIds.filter((cardId) => !previousVisibleOrder.includes(cardId));
      const nextOrder = [...previousVisibleOrder, ...missingIds];

      return arraysEqual(previousOrder, nextOrder) ? previousOrder : nextOrder;
    });

    if (visibleCardIds.length > 0) {
      setCurrentIndex((previousIndex) =>
        Math.min(previousIndex, visibleCardIds.length - 1)
      );
    }
  }, [randomize, visibleCardIdKey, visibleCardIdSet, visibleCardIds]);

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

  const currentCardId = activeDisplayOrder[currentIndex] ?? visibleCardIds[currentIndex] ?? visibleCardIds[0];
  const currentCard = currentCardId ? visibleCardsById.get(currentCardId) : undefined;

  if (!currentCard) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading...
      </div>
    );
  }

  /** Remembers the current card so it can slide out while the next slides in. */
  const beginSlide = (direction: 'next' | 'prev') => {
    slideDirectionRef.current = direction;
    if (animations && currentCard) {
      setOutgoing({ card: currentCard, flipped: showAnswer, direction });
    }
  };

  const nextCard = () => {
    beginSlide('next');
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev + 1) % visibleCards.length);
  };

  const prevCard = () => {
    beginSlide('prev');
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

  const dontKnowCount = Object.values(dontKnowCards).filter((value) => value).length;

  const faces = {
    front: {
      label: localFlipMode ? 'ANSWER' : 'QUESTION',
      side: (localFlipMode ? 'answer' : 'question') as 'question' | 'answer',
    },
    back: {
      label: localFlipMode ? 'QUESTION' : 'ANSWER',
      side: (localFlipMode ? 'question' : 'answer') as 'question' | 'answer',
    },
  };

  const faceTexts = (card: FlashcardStudyCard) => ({
    front: localFlipMode ? card.answer : card.question,
    back: localFlipMode ? card.question : card.answer,
  });

  /** The current card plus, while sliding, the previous card on its way out. */
  const renderCards = (size: 'sm' | 'lg') => (
    <>
      {outgoing && outgoing.card.id !== currentCard.id && (
        <FlipCard
          key={`out-${outgoing.card.id}`}
          flipped={outgoing.flipped}
          onToggle={() => {}}
          size={size}
          enterClass={`card-exit-${outgoing.direction} pointer-events-none`}
          animate={false}
          needsReview={Boolean(dontKnowCards[outgoing.card.id])}
          front={{ ...faces.front, text: faceTexts(outgoing.card).front }}
          back={{ ...faces.back, text: faceTexts(outgoing.card).back }}
          flashcardId={outgoing.card.id as Id<'flashcards'>}
          speakQuestion={false}
          speakAnswer={false}
          onAnimationEnd={() => setOutgoing(null)}
        />
      )}
      <FlipCard
        key={currentCard.id}
        flipped={showAnswer}
        onToggle={toggleAnswer}
        size={size}
        enterClass={animations ? `card-enter-${slideDirectionRef.current}` : ''}
        animate={animations}
        needsReview={Boolean(dontKnowCards[currentCard.id])}
        front={{ ...faces.front, text: faceTexts(currentCard).front }}
        back={{ ...faces.back, text: faceTexts(currentCard).back }}
        flashcardId={currentCard.id as Id<'flashcards'>}
        speakQuestion={speakQuestion}
        speakAnswer={speakAnswer}
      />
    </>
  );

  if (isFullscreen) {
    return (
      <div className={`${isNativeFullscreen ? 'fixed inset-0' : 'fixed left-0 top-0'} bg-gray-900 flex flex-col items-center gap-4 p-4 sm:p-8 z-50 overflow-x-clip`} style={{
        ...(!isNativeFullscreen ? { width: '100dvw', height: '100dvh' } : {}),
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}>
        <div className="w-full flex justify-between items-center flex-shrink-0">
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

        <div className="grid flex-1 min-h-0 max-w-4xl w-full">{renderCards('lg')}</div>

        <div className="flex items-center w-full gap-3 flex-shrink-0">
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
              setDisplayOrder(newRandomize ? shuffleIds(visibleCardIds) : visibleCardIds);
              setCurrentIndex(0);
              setShowAnswer(false);
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

      {/* Clip the slide-in overshoot so no page scrollbar flashes; the padding keeps room for the shadow. */}
      {/* Clip the slide overshoot so no page scrollbar flashes; the padding keeps room for the shadow. */}
      <div className="overflow-x-clip -mx-4 px-4">
        <div className="grid">{renderCards('sm')}</div>
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
        {activeDisplayOrder.map((cardId, idx) => {
          const card = visibleCardsById.get(cardId);
          if (!card) return null;
          return (
            <button
              key={card.id}
              onClick={() => {
                beginSlide(idx > currentIndex ? 'next' : 'prev');
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

interface SpeakButtonProps {
  flashcardId: Id<'flashcards'>;
  side: 'question' | 'answer';
  size: 'sm' | 'lg';
}

/** Plays the pronunciation for one side of a card, generating it on first use. */
function SpeakButton({ flashcardId, side, size }: SpeakButtonProps) {
  const speak = useAction(api.audio.speak);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setState('idle');
    setError(null);
    audioRef.current?.pause();
    audioRef.current = null;
  }, [flashcardId, side]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const play = async () => {
    if (state === 'loading') return;
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      void audioRef.current.play();
      setState('playing');
      return;
    }

    setState('loading');
    setError(null);
    try {
      const { url } = await speak({ flashcardId, side });
      const audio = new Audio(url);
      audio.onended = () => setState('idle');
      audio.onerror = () => {
        setState('error');
        setError('Could not play the audio.');
      };
      audioRef.current = audio;
      await audio.play();
      setState('playing');
    } catch (caughtError) {
      setState('error');
      setError(caughtError instanceof Error ? caughtError.message : 'Could not read this card aloud.');
    }
  };

  const iconSize = size === 'lg' ? 'h-7 w-7' : 'h-5 w-5';

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void play();
        }}
        disabled={state === 'loading'}
        title={error ?? 'Read aloud'}
        aria-label="Read aloud"
        className={`inline-flex items-center justify-center rounded-full p-1.5 transition-colors ${
          state === 'error'
            ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40'
            : 'text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/40'
        } disabled:cursor-wait`}
      >
        {state === 'loading' ? (
          <span
            className={`${iconSize} inline-block animate-spin rounded-full border-2 border-current border-t-transparent`}
          />
        ) : (
          <svg
            className={`${iconSize} ${state === 'playing' ? 'animate-pulse' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"
            />
          </svg>
        )}
      </button>
    </span>
  );
}

interface FlipFace {
  label: string;
  text: string;
  side: 'question' | 'answer';
}

interface FlipCardProps {
  flipped: boolean;
  onToggle: () => void;
  size: 'sm' | 'lg';
  /** Entrance animation class for card changes; empty for none. */
  enterClass: string;
  /** Animate the flip; when false the faces swap instantly. */
  animate: boolean;
  needsReview: boolean;
  front: FlipFace;
  back: FlipFace;
  flashcardId: Id<'flashcards'>;
  speakQuestion: boolean;
  speakAnswer: boolean;
  onAnimationEnd?: () => void;
}

/**
 * The whole card rotates around its vertical centre line. Each face is a
 * complete card (background, shadow, padding, badge, hint), stacked in one
 * grid cell; the back face is pre-rotated so it reads correctly once flipped.
 * Key it per card so switching cards does not animate the flip.
 */
function FlipCard({
  flipped,
  onToggle,
  size,
  enterClass,
  animate,
  needsReview,
  front,
  back,
  flashcardId,
  speakQuestion,
  speakAnswer,
  onAnimationEnd,
}: FlipCardProps) {
  const large = size === 'lg';
  const faceClass = large
    ? 'relative flex flex-col justify-center items-center h-full overflow-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 sm:p-16'
    : 'relative flex flex-col justify-center items-center min-h-[400px] bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12';
  const labelClass = large
    ? 'flex items-center gap-3 text-base font-medium text-blue-600 dark:text-blue-400 mb-4 sm:mb-8'
    : 'flex items-center gap-3 text-sm font-medium text-blue-600 dark:text-blue-400 mb-6';
  const textClass = large
    ? 'text-3xl sm:text-4xl md:text-5xl text-center leading-relaxed font-serif'
    : 'text-3xl md:text-4xl text-center leading-relaxed font-serif';
  const badgeClass = large
    ? 'absolute top-4 right-4 sm:top-6 sm:right-6 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-full'
    : 'absolute top-4 right-4 px-3 py-1 bg-red-600 text-white text-xs font-medium rounded-full';
  const hintClass = large
    ? 'absolute bottom-4 right-4 sm:bottom-6 sm:right-6 text-sm text-gray-400'
    : 'absolute bottom-4 right-4 text-xs text-gray-400';

  const renderFace = (face: FlipFace, isBack: boolean) => {
    const canSpeak = face.side === 'question' ? speakQuestion : speakAnswer;
    return (
      <div
        className={`[grid-area:1/1] [backface-visibility:hidden] ${faceClass} ${
          isBack ? '[transform:rotateY(180deg)]' : ''
        }`}
        aria-hidden={isBack !== flipped}
      >
        {needsReview && <div className={badgeClass}>Need to review</div>}
        <div className={labelClass}>
          {face.label}
          {canSpeak && <SpeakButton flashcardId={flashcardId} side={face.side} size={size} />}
        </div>
        <div className={textClass}>
          <div className="whitespace-pre-wrap">{face.text}</div>
        </div>
        <div className={hintClass}>Click to flip</div>
      </div>
    );
  };

  return (
    <div
      className={`[grid-area:1/1] ${
        large ? 'min-h-0 h-full' : ''
      } [perspective:1200px] transform transition-transform hover:scale-102 ${enterClass}`}
      onAnimationEnd={onAnimationEnd}
    >
      <div
        className={`grid h-full cursor-pointer [transform-style:preserve-3d] ${
          animate ? 'transition-transform duration-[300ms] ease-out' : ''
        } ${flipped ? '[transform:rotateY(180deg)]' : ''}`}
        onClick={onToggle}
      >
        {renderFace(front, false)}
        {renderFace(back, true)}
      </div>
    </div>
  );
}
