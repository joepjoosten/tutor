'use client';

import { authClient } from '@/lib/auth-client';
import AuthCard from '@/components/AuthCard';
import SettingsPanel from '@/components/SettingsPanel';

export default function SettingsPage() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-600 dark:text-gray-300">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Settings
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Manage the API key used for flashcard generation.
        </p>
      </div>

      {session ? <SettingsPanel /> : <AuthCard />}
    </div>
  );
}
