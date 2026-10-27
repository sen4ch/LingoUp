import { describe, expect, it } from 'vitest';
import {
  blankOut,
  buildOptions,
  isUsableGeneratedSentence,
  itemsFromContext,
  type PracticeWord,
} from './practice.js';

const word = (term: string, contextSentence: string | null = null): PracticeWord => ({
  wordId: `id-${term}`,
  term,
  definition: `meaning of ${term}`,
  translation: null,
  contextSentence,
});

const fixedRandom = () => 0.3;

describe('blankOut', () => {
  it('replaces whole words and phrases only, case-insensitively', () => {
    expect(blankOut('Twice I nearly Gave Up.', 'gave up')).toBe('Twice I nearly ___.');
    expect(blankOut('A crowded market.', 'crowd')).toBeNull();
  });
});

describe('isUsableGeneratedSentence', () => {
  it('requires exactly one gap and no leaked answer', () => {
    expect(isUsableGeneratedSentence('The shop was ___ on Saturday.', 'crowded')).toBe(true);
    expect(isUsableGeneratedSentence('The ___ shop was crowded.', 'crowded')).toBe(false);
    expect(isUsableGeneratedSentence('___ and ___', 'crowded')).toBe(false);
    expect(isUsableGeneratedSentence('No gap here.', 'crowded')).toBe(false);
  });
});

describe('practice items', () => {
  const words = [
    word('bargain', 'What a bargain!'),
    word('crowded', 'The market is always crowded.'),
    word('fresh', null),
    word('stall', 'The fruit stall sells apples.'),
  ];

  it('builds options from other words, always including the answer', () => {
    const options = buildOptions(words[0]!, words, fixedRandom);
    expect(options).toContain('bargain');
    expect(new Set(options).size).toBe(options.length);
    expect(options.length).toBe(4);
  });

  it('uses saved context sentences and skips words without one', () => {
    const items = itemsFromContext(words, fixedRandom);
    expect(items.map((item) => item.term)).toEqual(['bargain', 'crowded', 'stall']);
    expect(items[0]!.sentence).toBe('What a ___!');
  });
});
