import { tokenize } from '@lingoup/learning-engine';
import { describe, expect, it } from 'vitest';
import { focusTokenIndices, snapToWords, toLookup, type TokenizedParagraph } from './selection';

const paragraph = (text: string): TokenizedParagraph => {
  const tokens = tokenize(text);
  return { text, tokens, words: tokens.flatMap((token, index) => (token.isWord ? [index] : [])) };
};

const paragraphs = [
  paragraph("I'm looking forward to it. It was a bargain!"),
  paragraph('Second paragraph here.'),
];

describe('snapToWords', () => {
  it('drops leading and trailing punctuation/space tokens', () => {
    // tokens: 0 I'm, 1 ' ', 2 looking, 3 ' ', 4 forward ...
    const range = snapToWords(paragraphs, { paragraph: 0, token: 1 }, { paragraph: 0, token: 5 });
    expect(range).toEqual({ paragraph: 0, from: 2, to: 4 });
  });

  it('clamps a selection that crosses paragraphs to the first paragraph', () => {
    const range = snapToWords(paragraphs, { paragraph: 0, token: 14 }, { paragraph: 1, token: 2 });
    expect(range?.paragraph).toBe(0);
    expect(range?.to).toBe(paragraphs[0]!.words.at(-1));
  });

  it('returns null when only punctuation is selected', () => {
    expect(
      snapToWords(paragraphs, { paragraph: 0, token: 1 }, { paragraph: 0, token: 1 }),
    ).toBeNull();
  });
});

describe('toLookup', () => {
  it('uses the exact source text and its sentence as context', () => {
    const lookup = toLookup(paragraphs, { paragraph: 0, from: 2, to: 6 });
    expect(lookup).toMatchObject({
      term: 'looking forward to',
      context: "I'm looking forward to it.",
    });
  });

  it('rejects phrases longer than the contract allows', () => {
    const long = paragraph('one two three four five six seven');
    expect(toLookup([long], { paragraph: 0, from: 0, to: 12 })).toEqual({ error: 'too_long' });
  });
});

describe('focusTokenIndices', () => {
  it('marks single words and phrases case-insensitively', () => {
    const p = paragraph('I look Forward to the market. A bargain!');
    const marked = focusTokenIndices(p, ['look forward to', 'bargain', 'missing']);
    const markedText = [...marked]
      .sort((a, b) => a - b)
      .map((i) => p.tokens[i]!.text)
      .join('');
    expect(markedText).toBe('look Forward tobargain');
  });

  it('marks regular inflections', () => {
    const p = paragraph('She improved a lot and found bargains.');
    const marked = [...focusTokenIndices(p, ['improve', 'bargain'])].map((i) => p.tokens[i]!.text);
    expect(marked).toEqual(['improved', 'bargains']);
  });
});
