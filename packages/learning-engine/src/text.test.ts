import { describe, expect, it } from 'vitest';
import { countWords, estimateReadingMinutes, normalizeTerm, sentenceAt, tokenize } from './text.js';

describe('tokenize', () => {
  it('keeps contractions and hyphenated words as single tokens', () => {
    const words = tokenize("I don't like well-known places.").filter((t) => t.isWord);
    expect(words.map((t) => t.text)).toEqual(['I', "don't", 'like', 'well-known', 'places']);
  });

  it('preserves offsets so the source can be reconstructed', () => {
    const text = 'Hello, world! «Quotes» too.';
    const tokens = tokenize(text);
    expect(tokens.map((t) => t.text).join('')).toBe(text);
    for (const token of tokens) {
      expect(text.slice(token.start, token.start + token.text.length)).toBe(token.text);
    }
  });
});

describe('normalizeTerm', () => {
  it.each([
    ['Running', 'running'],
    ['  "Take off!"  ', 'take off'],
    ['Don’t', "don't"],
    ['look   up', 'look up'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeTerm(input)).toBe(expected);
  });
});

describe('sentenceAt', () => {
  const paragraph = 'Anna wakes up early. She makes coffee! Then she reads the news?';

  it('returns the sentence that contains the offset', () => {
    expect(sentenceAt(paragraph, paragraph.indexOf('coffee'))).toBe('She makes coffee!');
    expect(sentenceAt(paragraph, 0)).toBe('Anna wakes up early.');
    expect(sentenceAt(paragraph, paragraph.length - 2)).toBe('Then she reads the news?');
  });
});

describe('reading helpers', () => {
  it('counts words and estimates minutes', () => {
    expect(countWords('One, two — three.')).toBe(3);
    expect(estimateReadingMinutes(0)).toBe(1);
    expect(estimateReadingMinutes(400)).toBe(3);
  });
});
