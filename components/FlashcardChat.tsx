'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import NextImage from 'next/image';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useImageAttachments, type AttachedImage } from '@/hooks/useImageAttachments';

interface FlashcardChatProps {
  /** The set to talk about. `null` starts a new set from the first message. */
  setId: Id<'flashcardSets'> | null;
  /** Called when the first message has created a set. */
  onGenerated?: (setId: Id<'flashcardSets'>) => void;
  /** Fill the available height instead of a fixed transcript height. */
  tall?: boolean;
}

interface LocalTurn {
  message: string;
  images: AttachedImage[];
}

const SUGGESTIONS = [
  'Check the answers against the photos and fix any mistakes.',
  'Make the questions shorter and more specific.',
  'Add a few cards about the parts that are not covered yet.',
];

const GENERATE_GREETING =
  'Add photos of your homework or study material with the + button, tell me what you want, and I will make flashcards from them.';

export default function FlashcardChat({ setId, onGenerated, tall }: FlashcardChatProps) {
  const settings = useQuery(api.settings.getUserSettings);
  const messages = useQuery(api.chat.listMessages, setId ? { setId } : 'skip');
  const sendMessage = useAction(api.chat.sendMessage);
  const generateFromImages = useAction(api.chat.generateFromImages);
  const clearMessages = useMutation(api.chat.clearMessages);
  const attachments = useImageAttachments();

  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<LocalTurn | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const generateMode = setId === null;
  const messageCount = messages?.length ?? 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messageCount, pending]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const busy = pending !== null;
  const canSend =
    !busy &&
    !attachments.uploading &&
    attachments.queued === 0 &&
    (generateMode ? attachments.images.length > 0 : draft.trim() !== '' || attachments.images.length > 0);

  const submit = async (text: string) => {
    if (!canSend) return;
    const message = text.trim();
    const images = attachments.take();

    setPending({ message, images });
    setError(null);
    setDraft('');
    try {
      if (generateMode) {
        const result = await generateFromImages({
          imageIds: images.map((image) => image.id),
          message,
        });
        onGenerated?.(result.setId);
      } else {
        await sendMessage({
          setId,
          message,
          imageIds: images.map((image) => image.id),
        });
      }
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
    if (busy || !setId) return;
    setError(null);
    try {
      await clearMessages({ setId });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Clearing failed.');
    }
  };

  // The chat needs the user's OpenRouter key; stay hidden until it is set.
  if (settings?.hasOpenRouterKey !== true) {
    return null;
  }

  const showSuggestions = !generateMode && messageCount === 0 && !busy;
  const visibleError = error ?? attachments.error;

  return (
    <section
      className={`flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-md ${
        tall ? 'min-h-[60vh]' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700 sm:px-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {generateMode ? 'Generate flashcards with AI' : 'Chat about these flashcards'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {generateMode
              ? 'Add photos, then describe what you want. You can keep chatting afterwards.'
              : 'Ask questions, ask for changes, or add photos for more cards.'}
          </p>
        </div>
        {messageCount > 0 && (
          <button
            type="button"
            onClick={() => void handleClear()}
            disabled={busy}
            className="shrink-0 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear
          </button>
        )}
      </div>

      <div
        className={`flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6 ${
          tall ? '' : 'max-h-[28rem]'
        }`}
      >
        {generateMode && <ChatBubble role="assistant" content={GENERATE_GREETING} />}

        {showSuggestions && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setDraft(suggestion);
                    inputRef.current?.focus();
                  }}
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
            imageUrls={message.images.map((image) => image.url).filter((url) => url !== null)}
          />
        ))}

        {pending && (
          <>
            <ChatBubble
              role="user"
              content={pending.message || (generateMode ? 'Make flashcards from these photos.' : 'Have a look at these photos.')}
              imageUrls={pending.images.map((image) => image.preview)}
            />
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2 text-sm text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                <span className="inline-block animate-pulse">
                  {generateMode ? 'Reading the photos and making flashcards…' : 'Thinking…'}
                </span>
              </div>
            </div>
          </>
        )}

        <div ref={bottomRef} />
      </div>

      {visibleError && (
        <div className="mx-4 mb-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-900 dark:text-red-200 sm:mx-6">
          {visibleError}
        </div>
      )}

      {(attachments.images.length > 0 || attachments.uploading || attachments.queued > 0) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 px-4 pt-3 dark:border-gray-700 sm:px-6">
          {attachments.images.map((image, index) => (
            <div
              key={image.id}
              className="relative h-16 w-16 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700"
            >
              <NextImage src={image.preview} alt="" fill unoptimized className="object-cover" />
              <button
                type="button"
                onClick={() => void attachments.remove(index)}
                disabled={busy}
                title="Remove photo"
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 px-1 text-xs leading-4 text-white hover:bg-black/80"
              >
                ✕
              </button>
            </div>
          ))}
          {(attachments.uploading || attachments.queued > 0) && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {attachments.uploading ? 'Uploading…' : `${attachments.queued} to crop`}
            </span>
          )}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 px-4 py-3 sm:px-6"
      >
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            disabled={busy}
            title="Add photos"
            aria-label="Add photos"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 text-2xl leading-none text-gray-700 transition-colors hover:border-blue-500 hover:text-blue-600 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:border-blue-400"
          >
            +
          </button>
          {menuOpen && (
            <div className="absolute bottom-full left-0 z-10 mb-2 w-48 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  attachments.choosePhotos();
                }}
                className="block w-full px-4 py-2 text-left text-sm text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
              >
                📎 Choose photos
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  attachments.takePhoto();
                }}
                className="block w-full px-4 py-2 text-left text-sm text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
              >
                📷 Take a photo
              </button>
            </div>
          )}
          {attachments.inputs}
        </div>

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
          placeholder={
            generateMode
              ? 'Optional: what should the cards focus on?'
              : 'For example: the answer to card 3 is wrong, check the photo'
          }
          rows={2}
          disabled={busy}
          className="min-h-[2.75rem] flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {generateMode ? 'Generate flashcards' : 'Send'}
        </button>
      </form>

      {attachments.modals}
    </section>
  );
}

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  toolActions?: Array<{ tool: string; summary: string }>;
  imageUrls?: string[];
}

function ChatBubble({ role, content, toolActions, imageUrls }: ChatBubbleProps) {
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
        {imageUrls && imageUrls.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {imageUrls.map((url, index) => (
              <a
                key={`${url}-${index}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="relative block h-20 w-20 overflow-hidden rounded-lg bg-black/10"
              >
                <NextImage src={url} alt="" fill unoptimized className="object-cover" />
              </a>
            ))}
          </div>
        )}
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
