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
