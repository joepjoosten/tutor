/**
 * Helpers for the "write answer" study mode: the answer is split into words
 * the student types and the punctuation, spaces and symbols between them,
 * which are shown as-is. Only the typed words are checked.
 */

export type AnswerSegment =
  | { kind: 'blank'; text: string }
  | { kind: 'literal'; text: string };

const WORD_CHARS = '\\p{L}\\p{M}\\p{N}';
const SEGMENT_PATTERN = new RegExp(`[${WORD_CHARS}]+|[^${WORD_CHARS}]+`, 'gu');
const NON_WORD_CHARS = new RegExp(`[^${WORD_CHARS}]`, 'gu');
const STARTS_WITH_WORD_CHAR = new RegExp(`^[${WORD_CHARS}]`, 'u');

/** Splits "(keine) Ahnung" into "(", [keine], ") ", [Ahnung]. */
export function segmentAnswer(answer: string): AnswerSegment[] {
  const normalized = answer.normalize('NFC').trim();
  return (normalized.match(SEGMENT_PATTERN) ?? []).map((text) => ({
    kind: STARTS_WITH_WORD_CHAR.test(text) ? 'blank' : 'literal',
    text,
  }));
}

/** Drops everything a student should not have to type: punctuation, spaces, symbols. */
export function keepWordChars(value: string): string {
  return value.normalize('NFC').replace(NON_WORD_CHARS, '');
}

/** Number of characters as the student sees them, so "ü" or "😀" counts as one. */
export function letterCount(value: string): number {
  return Array.from(value.normalize('NFC')).length;
}

/** Exact comparison of one typed word: capitals matter (German nouns), as do accents and umlauts. */
export function isBlankCorrect(expected: string, typed: string): boolean {
  return keepWordChars(typed) === keepWordChars(expected);
}
