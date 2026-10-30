import { expect, it } from 'vitest';
import { WritingTurnRequestSchema, WritingIssueSchema } from './writing.js';

it('preserves teaching metadata and alternative meanings', () => {
  const issue = {
    quote: 'I wont go',
    occurrence: 0,
    category: 'suggestion',
    errorType: 'ambiguity',
    replacement: 'I wont go',
    explanation: 'Which meaning do you intend?',
    example: null,
    alternatives: [
      { replacement: 'I want to go', meaning: 'Desire' },
      { replacement: "I won't go", meaning: 'Not attending' },
    ],
  };
  expect(WritingIssueSchema.parse(issue)).toEqual(issue);
  expect(WritingIssueSchema.safeParse({ ...issue, errorType: 'invented_type' }).success).toBe(
    false,
  );
});

it('accepts starting an exchange and alternating replies', () => {
  expect(WritingTurnRequestSchema.safeParse({ messages: [] }).success).toBe(true);
  expect(
    WritingTurnRequestSchema.safeParse({
      messages: [
        { role: 'assistant', content: 'Hi!' },
        { role: 'user', content: 'Hello!' },
      ],
    }).success,
  ).toBe(true);
});

it('rejects invalid role order, an unfinished pair and oversized context', () => {
  for (const messages of [
    [{ role: 'user', content: 'Hello' }],
    [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ],
    Array.from({ length: 4 }, (_, i) => ({
      role: i % 2 ? 'user' : 'assistant',
      content: 'a'.repeat(4000),
    })),
  ])
    expect(WritingTurnRequestSchema.safeParse({ messages }).success).toBe(false);
});
