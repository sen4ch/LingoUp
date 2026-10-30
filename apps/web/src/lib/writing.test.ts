import { describe, expect, it } from 'vitest';
import type { WritingIssue, WritingMessage } from '@lingoup/contracts';
import {
  locateWritingIssues,
  writingContext,
  writingSegments,
  writingIssueLabel,
  WRITING_CORRECTION_LIMITS,
  prioritizeWritingIssues,
} from './writing';

const issue = (quote: string, occurrence = 0): WritingIssue => ({
  quote,
  occurrence,
  category: 'grammar',
  replacement: 'I am',
  explanation: 'Use am with I.',
});

describe('writing corrections', () => {
  it.each([
    ['A1', 3],
    ['A2', 4],
    ['B1', 5],
    ['B2', 6],
    ['C1', 10],
    ['C2', 10],
  ] as const)('limits explanations for %s without dropping full corrections', (level, visible) => {
    const issues = Array.from({ length: 10 }, (_, index) => issue(`error${index}`));
    const ranked = prioritizeWritingIssues(issues, level);
    expect(ranked).toHaveLength(10);
    expect(ranked.slice(0, WRITING_CORRECTION_LIMITS[level])).toHaveLength(visible);
  });
  it('prioritizes missing verbs over spelling for A1 and uses precise validated positions', () => {
    const spelling = {
      ...issue('this'),
      category: 'word' as const,
      errorType: 'spelling' as const,
      replacement: 'this',
    };
    expect(locateWritingIssues('this', [spelling])).toEqual([]);
    const missing = {
      ...issue('This amazing'),
      errorType: 'sentence_structure' as const,
      replacement: 'This is amazing.',
    };
    const typo = { ...issue('speling'), category: 'word' as const, errorType: 'spelling' as const };
    expect(prioritizeWritingIssues([typo, missing], 'A1')[0]).toEqual(missing);
    expect(locateWritingIssues('This amazing', [{ ...missing, start: 2, end: 4 }])[0]?.start).toBe(
      0,
    );
  });
  it('labels sentence rules separately from spelling and optional phrasing', () => {
    expect(
      writingIssueLabel({ ...issue('this email nice'), errorType: 'sentence_structure' }),
    ).toBe('Sentence structure');
    expect(
      writingIssueLabel({ ...issue('wont'), category: 'suggestion', errorType: 'ambiguity' }),
    ).toBe('Clarify meaning');
  });
  it('keeps optional suggestions below grammar errors when ranges overlap', () => {
    const text = 'I is happy';
    const issues = locateWritingIssues(text, [
      { ...issue(text), category: 'suggestion' },
      issue(text),
    ]);
    expect(writingSegments(text, issues)[0]?.correction?.issue.category).toBe('grammar');
  });
  it('locates a specific repeated phrase without altering the original text', () => {
    expect(locateWritingIssues('I is happy. I is ready.', [issue('I is', 1)])).toEqual([
      { ...issue('I is', 1), start: 12, end: 16 },
    ]);
  });
  it('omits missing and out-of-range quotes while keeping overlapping corrections', () => {
    expect(
      locateWritingIssues('I is ready.', [
        issue('missing'),
        issue('I is', 8),
        issue('I is'),
        issue('is ready'),
      ]),
    ).toEqual([
      { ...issue('I is'), start: 0, end: 4 },
      { ...issue('is ready'), start: 2, end: 10 },
    ]);
  });
  it('matches grammar across line breaks, repeated spaces and smart apostrophes', () => {
    const text = 'I’m studying\n  in master degree';
    const corrections = locateWritingIssues(text, [issue("I'm studying in master degree")]);
    expect(corrections).toEqual([{ ...issue(text), start: 0, end: text.length }]);
  });
  it('keeps grammar yellow around a red misspelling in the same phrase', () => {
    const text = 'this amaizing, I have a questions';
    const corrections = locateWritingIssues(text, [
      { ...issue('amaizing'), category: 'word' },
      issue(text),
    ]);
    const segments = writingSegments(text, corrections);
    expect(segments.map((segment) => segment.text).join('')).toBe(text);
    expect(segments.map((segment) => [segment.text, segment.correction?.issue.category])).toEqual([
      ['this ', 'grammar'],
      ['amaizing', 'word'],
      [', I have a questions', 'grammar'],
    ]);
    expect(corrections).toHaveLength(2);
  });
  it('does not match a corrected phrase against a differently worded original', () => {
    expect(locateWritingIssues('I have a questions.', [issue('I have a question')])).toEqual([]);
    expect(locateWritingIssues('I has questions.', [issue('I have questions')])).toEqual([]);
  });
  it('handles line breaks and unicode using exact string positions', () => {
    expect(locateWritingIssues('Hi 👋\nI is ready.', [issue('I is')])[0]?.start).toBe(6);
  });
  it('keeps recent complete email pairs within the context limit', () => {
    const history: WritingMessage[] = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 ? 'user' : 'assistant',
      content: String(index).padEnd(4000, '.'),
    }));
    const result = writingContext(history);
    expect(result).toEqual(history.slice(-2));
    expect(result[0]?.role).toBe('assistant');
    expect(result.at(-1)?.role).toBe('user');
  });
});
