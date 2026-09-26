'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { isBlankCorrect, keepWordChars, letterCount, segmentAnswer } from '@/lib/writeAnswer';

interface WriteAnswerProps {
  /** The text the student has to reproduce. */
  answer: string;
  /** Styles for the always-dark fullscreen view. */
  onDarkBackground: boolean;
  /** Called once the typed answer has been checked. */
  onCheck: (correct: boolean) => void;
  /** Called when the student moves on after checking. */
  onContinue: (correct: boolean) => void;
}

// Each letter sits in its own slot: a slot is SLOT_CH wide, the letter itself
// is 1ch, and letter-spacing makes up the rest so typed letters line up.
const SLOT_CH = 1.6;
const LETTER_GAP_CH = SLOT_CH - 1;

/**
 * Shows the answer as fill-in blanks: punctuation and spaces are printed,
 * every word gets one slot per letter. Key it per card so each card starts
 * empty.
 */
export default function WriteAnswer({ answer, onDarkBackground, onCheck, onContinue }: WriteAnswerProps) {
  const segments = useMemo(() => segmentAnswer(answer), [answer]);
  const blanks = useMemo(
    () =>
      segments
        .filter((segment) => segment.kind === 'blank')
        .map((segment) => ({ text: segment.text, length: letterCount(segment.text) })),
    [segments]
  );
  const [values, setValues] = useState<string[]>(() => blanks.map(() => ''));
  const [results, setResults] = useState<boolean[] | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const shakersRef = useRef<(HTMLSpanElement | null)[]>([]);
  const rejectTimersRef = useRef<number[]>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus({ preventScroll: true });
    const timers = rejectTimersRef.current;
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  if (blanks.length === 0) return null;

  const allCorrect = results?.every(Boolean) ?? false;

  const focusBlank = (index: number) => {
    const input = inputsRef.current[index];
    if (!input) return;
    input.focus();
    input.select();
  };

  /** Shakes a blank and flashes it red; toggled on the element so repeats restart it. */
  const rejectLetter = (index: number) => {
    const shaker = shakersRef.current[index];
    if (!shaker) return;
    shaker.classList.remove('blank-reject');
    void shaker.offsetWidth;
    shaker.classList.add('blank-reject');
    window.clearTimeout(rejectTimersRef.current[index]);
    rejectTimersRef.current[index] = window.setTimeout(() => shaker.classList.remove('blank-reject'), 400);
  };

  const check = () => {
    const nextResults = blanks.map((blank, index) => isBlankCorrect(blank.text, values[index]));
    setResults(nextResults);
    onCheck(nextResults.every(Boolean));
  };

  const setValue = (index: number, value: string) => {
    setValues((previous) => previous.map((item, itemIndex) => (itemIndex === index ? value : item)));
  };

  const applyInput = (index: number, raw: string) => {
    const letters = keepWordChars(raw);
    const expectedLength = blanks[index].length;
    if (letterCount(letters) > expectedLength) {
      // The word has no room for more letters; keep what was there.
      rejectLetter(index);
      return;
    }
    // Only letters are kept, so a space typed after an auto-advance is dropped.
    setValue(index, letters);
    // Filling the word, or typing a space or punctuation after it, jumps to the next blank.
    const typedSeparator = letters.length > 0 && keepWordChars(raw.slice(-1)) === '';
    if (typedSeparator || letterCount(letters) === expectedLength) {
      focusBlank(index + 1);
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    if (event.key === 'Enter') {
      event.preventDefault();
      if (results) {
        onContinue(allCorrect);
      } else {
        check();
      }
    } else if (event.key === 'Backspace' && input.value === '' && index > 0) {
      event.preventDefault();
      focusBlank(index - 1);
    } else if (event.key === 'ArrowLeft' && input.selectionStart === 0 && input.selectionEnd === 0 && index > 0) {
      event.preventDefault();
      focusBlank(index - 1);
    } else if (event.key === 'ArrowRight' && input.selectionStart === input.value.length && index < blanks.length - 1) {
      event.preventDefault();
      focusBlank(index + 1);
    }
  };

  const textClass = onDarkBackground ? 'text-white' : 'text-gray-900 dark:text-white';
  const hintClass = onDarkBackground ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400';

  const slotClass = (blankIndex: number, slotIndex: number) => {
    if (results) {
      return results[blankIndex] ? 'border-green-500' : 'border-red-500';
    }
    const filled = slotIndex < letterCount(values[blankIndex]);
    const isCaretSlot = focusedIndex === blankIndex && slotIndex === Math.min(letterCount(values[blankIndex]), blanks[blankIndex].length - 1);
    if (isCaretSlot) {
      return onDarkBackground ? 'border-blue-400' : 'border-blue-500 dark:border-blue-400';
    }
    if (filled) {
      return onDarkBackground ? 'border-gray-300' : 'border-gray-600 dark:border-gray-300';
    }
    return onDarkBackground ? 'border-gray-600' : 'border-gray-300 dark:border-gray-600';
  };

  let blankIndex = 0;

  return (
    <div className="flex w-full flex-shrink-0 flex-col items-center gap-3">
      <div className={`flex flex-wrap items-start justify-center gap-y-3 font-mono text-xl sm:text-2xl ${textClass}`}>
        {segments.map((segment, segmentIndex) => {
          if (segment.kind === 'literal') {
            // Line breaks in the answer become row breaks in the blanks.
            return segment.text.split('\n').map((part, partIndex) => (
              <Fragment key={`${segmentIndex}-${partIndex}`}>
                {partIndex > 0 && <span className="h-0 basis-full" />}
                {part && <span className="whitespace-pre py-1">{part}</span>}
              </Fragment>
            ));
          }

          const index = blankIndex++;
          const { text: expected, length } = blanks[index];
          return (
            <span key={segmentIndex} className="inline-flex flex-col items-center">
              <span
                ref={(element) => {
                  shakersRef.current[index] = element;
                }}
                className="relative inline-flex"
              >
                <span className="flex" aria-hidden="true">
                  {Array.from({ length }, (_, slotIndex) => (
                    <span
                      key={slotIndex}
                      style={{ width: `${SLOT_CH - 0.3}ch`, marginInline: '0.15ch' }}
                      className={`blank-slot h-[1.5em] border-b-[3px] transition-colors ${slotClass(index, slotIndex)}`}
                    />
                  ))}
                </span>
                <input
                  ref={(element) => {
                    inputsRef.current[index] = element;
                  }}
                  value={values[index]}
                  onChange={(event) => {
                    // Dead-key accents (e.g. ¨ then u) are left alone until they compose.
                    if ((event.nativeEvent as InputEvent).isComposing) {
                      setValue(index, event.target.value);
                    } else {
                      applyInput(index, event.target.value);
                    }
                  }}
                  onCompositionEnd={(event) => applyInput(index, event.currentTarget.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  onFocus={() => setFocusedIndex(index)}
                  onBlur={() => setFocusedIndex((current) => (current === index ? null : current))}
                  readOnly={results !== null}
                  aria-label={`Word ${index + 1} of ${blanks.length}, ${length} letters`}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint={results ? 'next' : 'done'}
                  style={{
                    width: `${length * SLOT_CH + LETTER_GAP_CH}ch`,
                    paddingLeft: `${LETTER_GAP_CH / 2}ch`,
                    letterSpacing: `${LETTER_GAP_CH}ch`,
                  }}
                  className={`absolute inset-y-0 left-0 bg-transparent p-0 outline-none ${
                    results ? (results[index] ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400') : ''
                  }`}
                />
              </span>
              {results && !results[index] && (
                <span className="mt-1 text-sm text-green-600 dark:text-green-400">{expected}</span>
              )}
            </span>
          );
        })}
      </div>

      {results ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className={`text-sm font-medium ${allCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {allCorrect ? 'Correct!' : 'Not quite, this card goes to review.'}
          </span>
          <button
            type="button"
            onClick={() => onContinue(allCorrect)}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Continue
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className={`text-sm ${hintClass}`}>Type the letters only, then press Enter</span>
          <button
            type="button"
            onClick={check}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Check
          </button>
        </div>
      )}
    </div>
  );
}
