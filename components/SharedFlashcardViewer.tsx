'use client';

import FlashcardStudy, { type FlashcardStudyCard } from '@/components/FlashcardStudy';

interface SharedFlashcardViewerProps {
  flashcards: FlashcardStudyCard[];
  flipMode: boolean;
  progressStorageKey: string;
}

export default function SharedFlashcardViewer({
  flashcards,
  flipMode,
  progressStorageKey,
}: SharedFlashcardViewerProps) {
  return (
    <FlashcardStudy
      mode="shared"
      flashcards={flashcards}
      flipMode={flipMode}
      progressStorageKey={progressStorageKey}
      emptyStateDescription="This shared set does not have any flashcards."
    />
  );
}
