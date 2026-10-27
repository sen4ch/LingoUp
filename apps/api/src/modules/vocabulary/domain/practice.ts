import type { PracticeItem } from '@lingoup/contracts';
import { normalizeTerm } from '@lingoup/learning-engine';

export const GAP = '___';
export const MIN_PRACTICE_WORDS = 3;

export interface PracticeWord {
  wordId: string;
  term: string;
  definition: string | null;
  translation: string | null;
  contextSentence: string | null;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Replaces the first whole-word occurrence of `term` with the gap; null if it is absent. */
export function blankOut(sentence: string, term: string): string | null {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, 'iu');
  return pattern.test(sentence) ? sentence.replace(pattern, GAP) : null;
}

/** A generated sentence is usable only if it has exactly one gap and does not leak the answer. */
export function isUsableGeneratedSentence(sentence: string, term: string): boolean {
  if (sentence.split(GAP).length !== 2) return false;
  return blankOut(sentence.replace(GAP, ' '), term) === null;
}

/** Up to three distractors taken from the learner's other words, in a stable shuffled order. */
export function buildOptions(
  answer: PracticeWord,
  all: readonly PracticeWord[],
  random: () => number,
): string[] {
  const distractors = all
    .filter((word) => normalizeTerm(word.term) !== normalizeTerm(answer.term))
    .map((word) => word.term)
    .sort(() => random() - 0.5)
    .slice(0, 3);
  return [answer.term, ...distractors].sort(() => random() - 0.5);
}

/** Fallback without AI: the learner's own saved context sentences. */
export function itemsFromContext(
  words: readonly PracticeWord[],
  random: () => number,
): PracticeItem[] {
  const items: PracticeItem[] = [];
  for (const word of words) {
    const sentence = word.contextSentence ? blankOut(word.contextSentence, word.term) : null;
    if (!sentence) continue;
    items.push({
      wordId: word.wordId,
      term: word.term,
      sentence,
      hint: word.translation ?? word.definition,
      options: buildOptions(word, words, random),
      answer: word.term,
    });
  }
  return items;
}
