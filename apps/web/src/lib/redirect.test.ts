import { describe, expect, it } from 'vitest';
import { safeNextPath } from './redirect';

describe('safeNextPath', () => {
  it.each([
    ['/vocabulary', '/vocabulary'],
    ['/read/a1-morning-routine?x=1#p2', '/read/a1-morning-routine?x=1#p2'],
  ])('keeps same-origin path %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    null,
    '',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    'javascript:alert(1)',
    '/%2F%2Fevil.example',
  ])('rejects %s', (input) => {
    const result = safeNextPath(input);
    expect(new URL(result, 'http://app.test').origin).toBe('http://app.test');
    expect(result.startsWith('//')).toBe(false);
  });
});
