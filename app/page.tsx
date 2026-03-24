'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import AuthCard from '@/components/AuthCard';

export default function Home() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    if (!sessionPending && session) {
      router.replace('/flashcards');
    }
  }, [session, sessionPending, router]);

  if (sessionPending || session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-600 dark:text-gray-300">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
          Bring your own AI key. Keep your own study library.
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Sign in to store your flashcard sets, study progress, and your own
          encrypted OpenRouter key.
        </p>
      </div>
      <AuthCard />
    </div>
  );
}
