/**
 * Text utilities shared by the reader UI and the backend, so a term selected in the
 * browser normalizes exactly like the one stored in the database.
 */

export interface Token {
  text: string;
  /** True for words (letters, digits, inner apostrophes and hyphens). */
  isWord: boolean;
  /** Offset in the source string. */
  start: number;
}

// Letters/digits, optionally joined by an apostrophe or hyphen: "don't", "well-known".
const TOKEN_PATTERN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*|[^\p{L}\p{N}]+/gu;
const WORD_PATTERN = /^[\p{L}\p{N}]/u;

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    tokens.push({ text: match[0], isWord: WORD_PATTERN.test(match[0]), start: match.index });
  }
  return tokens;
}

/**
 * Canonical form used for de-duplication and lookups: lowercase, typographic
 * apostrophes unified, surrounding punctuation stripped, inner whitespace collapsed.
 */
export function normalizeTerm(term: string): string {
  return term
    .normalize('NFC')
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .replace(/\s+/g, ' ');
}

export function countWords(text: string): number {
  return tokenize(text).filter((token) => token.isWord).length;
}

const SENTENCE_END = /[.!?…]["”’)]?\s+/g;

/** Returns the sentence of `paragraph` that contains the character at `offset`. */
export function sentenceAt(paragraph: string, offset: number): string {
  let start = 0;
  for (const match of paragraph.matchAll(SENTENCE_END)) {
    const end = match.index + match[0].length;
    if (end > offset) {
      return paragraph.slice(start, end).trim();
    }
    start = end;
  }
  return paragraph.slice(start).trim();
}

/** Reading time at ~180 words per minute for learners, rounded up, at least one minute. */
export function estimateReadingMinutes(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 180));
}

/** Shorter words are matched exactly, so "to" does not match "toes". */
const MIN_INFLECTED_LENGTH = 3;
const SUFFIXES = ['s', 'es', 'd', 'ed', 'ing', 'er', 'est'];

/**
 * True when `word` is `base` or a regular English inflection of it: improve → improved,
 * improving; bargain → bargains; study → studied; stop → stopped. Both are normalized
 * single words. Irregular forms (buy → bought) are not recognized.
 */
export function isWordForm(word: string, base: string): boolean {
  if (word === base) return true;
  if (base.length < MIN_INFLECTED_LENGTH) return false;
  return SUFFIXES.some((suffix) => {
    if (!word.endsWith(suffix)) return false;
    const stem = word.slice(0, -suffix.length);
    return (
      stem === base ||
      `${stem}e` === base ||
      (stem.endsWith('i') && `${stem.slice(0, -1)}y` === base) ||
      (stem.length > 2 && stem.at(-1) === stem.at(-2) && stem.slice(0, -1) === base)
    );
  });
}

/**
 * Start indices in `words` (normalized words of a text) where `term` occurs, allowing a
 * regular inflection of every word of a phrase: "looked forward to" matches "look forward to".
 */
export function findTermOccurrences(words: readonly string[], term: string): number[] {
  const parts = normalizeTerm(term).split(' ').filter(Boolean);
  const starts: number[] = [];
  if (parts.length === 0) return starts;
  for (let start = 0; start + parts.length <= words.length; start++) {
    if (parts.every((part, offset) => isWordForm(words[start + offset]!, part))) starts.push(start);
  }
  return starts;
}
