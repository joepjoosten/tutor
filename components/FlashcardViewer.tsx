'use client';

import type { Id } from '@/convex/_generated/dataModel';
import FlashcardStudy, { type FlashcardStudyCard } from '@/components/FlashcardStudy';

interface FlashcardViewerProps {
  flashcards: FlashcardStudyCard[];
  setId: Id<'flashcardSets'>;
  flipMode: boolean;
  onUpdate?: () => void;
}

export default function FlashcardViewer({
  flashcards,
  setId,
  flipMode,
  onUpdate,
}: FlashcardViewerProps) {
  return (
    <FlashcardStudy
      mode="owner"
      flashcards={flashcards}
      setId={setId}
      flipMode={flipMode}
      onUpdate={onUpdate}
    />
  );
}
