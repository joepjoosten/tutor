import type { Metadata } from 'next';
import SharedFlashcardPage from '@/components/SharedFlashcardPage';

export const metadata: Metadata = {
  title: 'Shared Flashcards',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SharedSetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <SharedFlashcardPage slug={slug} />;
}
