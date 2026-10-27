import { describe, expect, it } from 'vitest';
import { normalizeAnswer } from './answer.js';
import {
  GrammarFormatError,
  isAcceptedAnswer,
  parseBlocks,
  parseGrammarDocument,
} from './grammar-document.js';

const topic = (body: string, exercises: string) => `---
slug: present-simple
title: Present Simple
level: A1
summary: Habits and facts.
author: Tester
provenance: human
license: CC-BY-4.0
exercises:
${exercises}
---
${body}`;

const choice = `  - type: choice
    prompt: She ___ coffee every day.
    options: [drink, drinks, drinking]
    answer: drinks
    explanation: Add -s for he, she, it.`;

describe('parseBlocks', () => {
  it('understands headings, lists, examples, paragraphs and bold', () => {
    const blocks = parseBlocks(
      '## Form\n\nWe use it for **habits** and facts.\n\n- I **work**\n- she **works**\n\n> I live in Paris.\n> She lives in Rome.',
    );
    expect(blocks).toEqual([
      { type: 'heading', text: 'Form' },
      {
        type: 'paragraph',
        spans: [
          { text: 'We use it for ', strong: false },
          { text: 'habits', strong: true },
          { text: ' and facts.', strong: false },
        ],
      },
      {
        type: 'list',
        items: [
          [
            { text: 'I ', strong: false },
            { text: 'work', strong: true },
          ],
          [
            { text: 'she ', strong: false },
            { text: 'works', strong: true },
          ],
        ],
      },
      { type: 'example', spans: [{ text: 'I live in Paris.', strong: false }] },
      { type: 'example', spans: [{ text: 'She lives in Rome.', strong: false }] },
    ]);
  });
});

describe('parseGrammarDocument', () => {
  it('parses choice and gap exercises', () => {
    const parsed = parseGrammarDocument(
      topic(
        'Rule.',
        `${choice}\n  - type: gap\n    prompt: He ___ (not / like) tea.\n    answers: ["doesn't like", "does not like"]`,
      ),
      't.md',
    );
    expect(parsed.exercises).toEqual([
      expect.objectContaining({
        kind: 'choice',
        answers: ['drinks'],
        options: ['drink', 'drinks', 'drinking'],
      }),
      expect.objectContaining({
        kind: 'gap',
        answers: ["doesn't like", 'does not like'],
        options: [],
      }),
    ]);
  });

  it('rejects invalid exercises, HTML and AI content with an attribution licence', () => {
    expect(() =>
      parseGrammarDocument(
        topic('Rule.', choice.replace('answer: drinks', 'answer: drank')),
        't.md',
      ),
    ).toThrow(/answer must be one of the options/);
    expect(() =>
      parseGrammarDocument(topic('Rule.', choice.replace('She ___ coffee', 'She coffee')), 't.md'),
    ).toThrow(/___/);
    expect(() => parseGrammarDocument(topic('<b>Rule</b>', choice), 't.md')).toThrow(
      GrammarFormatError,
    );
    expect(() =>
      parseGrammarDocument(
        topic('Rule.', choice).replace('provenance: human', 'provenance: ai-generated'),
        't.md',
      ),
    ).toThrow(/CC0-1.0/);
  });
});

describe('answer checking', () => {
  it.each([
    ['  Drinks. ', ['drinks'], true],
    ['doesn’t like', ["doesn't like", 'does not like'], true],
    ['does  not like', ["doesn't like", 'does not like'], true],
    ['drink', ['drinks'], false],
  ])('%s against %j -> %s', (answer, accepted, expected) => {
    expect(isAcceptedAnswer(answer, accepted)).toBe(expected);
  });

  it('normalizes case, apostrophes and punctuation', () => {
    expect(normalizeAnswer(' I’M  Here! ')).toBe("i'm here");
  });
});
