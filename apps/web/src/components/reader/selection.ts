import { MAX_TERM_WORDS } from '@lingoup/contracts';
import { sentenceAt, type Token } from '@lingoup/learning-engine';

/** Selected run of word tokens inside one paragraph (token indices, inclusive). */
export interface WordRange {
  paragraph: number;
  from: number;
  to: number;
}

export interface Lookup {
  term: string;
  context: string;
  range: WordRange;
}

export type TokenizedParagraph = { text: string; tokens: Token[]; words: number[] };

/** Builds the lookup request for a range: exact source substring plus its sentence. */
export function toLookup(
  paragraphs: TokenizedParagraph[],
  range: WordRange,
): Lookup | { error: 'too_long' } {
  const paragraph = paragraphs[range.paragraph]!;
  const first = paragraph.tokens[range.from]!;
  const last = paragraph.tokens[range.to]!;
  const wordCount = paragraph.words.filter(
    (index) => index >= range.from && index <= range.to,
  ).length;
  if (wordCount > MAX_TERM_WORDS) return { error: 'too_long' };
  const term = paragraph.text.slice(first.start, last.start + last.text.length);
  return { term, context: sentenceAt(paragraph.text, first.start).slice(0, 600), range };
}

/** Normalizes a raw DOM selection to whole words within the first paragraph it touches. */
export function snapToWords(
  paragraphs: TokenizedParagraph[],
  start: { paragraph: number; token: number },
  end: { paragraph: number; token: number },
): WordRange | null {
  const paragraph = paragraphs[start.paragraph];
  if (!paragraph) return null;
  const endToken = end.paragraph === start.paragraph ? end.token : paragraph.tokens.length - 1;
  const words = paragraph.words.filter((index) => index >= start.token && index <= endToken);
  if (words.length === 0) return null;
  return { paragraph: start.paragraph, from: words[0]!, to: words.at(-1)! };
}
