import { describe, expect, it } from 'vitest';
import { lookupText } from './text-lookup';

describe('site text lookup', () => {
  it('looks up a word within its sentence instead of a whole page', () => {
    const text = 'Read every day. A verb expresses an action or state.';
    expect(lookupText(text, text.indexOf('verb') + 2)).toMatchObject({
      term: 'verb',
      context: 'A verb expresses an action or state.',
    });
  });
  it('expands partial selections and retains apostrophes and hyphens', () => {
    const text = "We don't forget a well-known phrase.";
    expect(lookupText(text, 4, 6)?.term).toBe("don't");
    expect(lookupText(text, text.indexOf('known') + 1)?.term).toBe('well-known');
  });
  it('limits phrase length and ignores whitespace and pure numbers', () => {
    expect(lookupText('one two three four five six seven', 0, 33)).toEqual({ error: 'too_long' });
    expect(lookupText('1234', 1)).toBeNull();
    expect(lookupText('one   two', 5)).toBeNull();
  });
  it('keeps a selected word within a bounded context in very long sentences', () => {
    const text = `${'Something '.repeat(180)}important ${'happens '.repeat(100)}`;
    const result = lookupText(text, text.indexOf('important') + 2);
    expect(result && !('error' in result) && result.context).toContain('important');
    expect(result && !('error' in result) && result.context.length).toBeLessThanOrEqual(600);
  });
});
