'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

interface FlashcardChatProps {
  setId: Id<'flashcardSets'>;
}

const SUGGESTIONS = [
  'Check the answers against the photos and fix any mistakes.',
  'Make the questions shorter and more specific.',
  'Add a few cards about the parts that are not covered yet.',
];

export default function FlashcardChat({ setId }: FlashcardChatProps) {
  const settings = useQuery(api.settings.getUserSettings);
  const messages = useQuery(api.chat.listMessages, { setId });
  const sendMessage = useAction(api.chat.sendMessage);
  const clearMessages = useMutation(api.chat.clearMessages);

  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const messageCount = messages?.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messageCount, pending]);

  const submit = async (text: string) => {
    const message = text.trim();
    if (message === '' || pending !== null) return;

    setPending(message);
    setError(null);
    setDraft('');
    try {
      await sendMessage({ setId, message });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Sending failed.');
      setDraft(message);
    } finally {
      setPending(null);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit(draft);
  };

  const handleClear = async () => {
    if (pending !== null) return;
    setError(null);
    try {
      await clearMessages({ setId });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Clearing failed.');
    }
  };

  const hasMessages = messageCount > 0 || pending !== null;

  // The chat needs the user's OpenRouter key; stay hidden until it is set.
  if (settings?.hasOpenRouterKey !== true) {
    return null;
  }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700 sm:px-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Chat about these flashcards
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ask questions or ask for changes. The assistant can edit, add, and remove cards.
          </p>
        </div>
        {messageCount > 0 && (
          <button
            type="button"
            onClick={() => void handleClear()}
            disabled={pending !== null}
            className="shrink-0 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear
          </button>
        )}
      </div>

      <div className="max-h-[28rem] space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
        {!hasMessages && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void submit(suggestion)}
                  className="rounded-full border border-gray-300 px-3 py-1.5 text-left text-sm text-gray-700 transition-colors hover:border-blue-500 hover:text-blue-600 dark:border-gray-600 dark:text-gray-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages?.map((message) => (
          <ChatBubble
            key={message._id}
            role={message.role}
            content={message.content}
            toolActions={message.toolActions}
          />
        ))}

        {pending !== null && (
          <>
            <ChatBubble role="user" content={pending} />
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2 text-sm text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                <span className="inline-block animate-pulse">Thinking…</span>
              </div>
            </div>
          </>
        )}

        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="mx-4 mb-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-900 dark:text-red-200 sm:mx-6">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700 sm:px-6"
      >
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit(draft);
            }
          }}
          placeholder="For example: the answer to card 3 is wrong, check the photo"
          rows={2}
          disabled={pending !== null}
          className="min-h-[2.75rem] flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
        <button
          type="submit"
          disabled={pending !== null || draft.trim() === ''}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          Send
        </button>
      </form>
    </section>
  );
}

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  toolActions?: Array<{ tool: string; summary: string }>;
}

function ChatBubble({ role, content, toolActions }: ChatBubbleProps) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
          isUser
            ? 'rounded-br-sm bg-blue-600 text-white'
            : 'rounded-bl-sm bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
        }`}
      >
        {toolActions && toolActions.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {toolActions.map((action, index) => (
              <li
                key={`${action.tool}-${index}`}
                className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900 dark:text-green-200"
              >
                {action.summary}
              </li>
            ))}
          </ul>
        )}
        {content}
      </div>
    </div>
  );
}
