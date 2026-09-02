'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import FlashcardStudy, { type FlashcardStudyCard } from '@/components/FlashcardStudy';

interface FlashcardViewerProps {
  flashcards: FlashcardStudyCard[];
  setId: Id<'flashcardSets'>;
  flipMode: boolean;
  speakQuestion?: boolean;
  speakAnswer?: boolean;
  onUpdate?: () => void;
}

export default function FlashcardViewer({
  flashcards,
  setId,
  flipMode,
  speakQuestion,
  speakAnswer,
  onUpdate,
}: FlashcardViewerProps) {
  const settings = useQuery(api.settings.getUserSettings);
  return (
    <FlashcardStudy
      mode="owner"
      flashcards={flashcards}
      setId={setId}
      flipMode={flipMode}
      speakQuestion={speakQuestion}
      speakAnswer={speakAnswer}
      animations={settings?.animationsEnabled ?? true}
      onUpdate={onUpdate}
    />
  );
}
