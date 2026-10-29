import { describe, expect, it } from 'vitest';
import { formatInterval } from './format';

const base = new Date('2026-10-26T10:00:00.000Z');
const after = (ms: number) => new Date(base.getTime() + ms);

describe('formatInterval', () => {
  it.each([
    [10_000, '<1 min'],
    [10 * 60_000, '10 min'],
    [5 * 3_600_000, '5 hr'],
    [3 * 86_400_000, '3 d'],
    [60 * 86_400_000, '2 mo'],
  ])('%i ms -> %s', (ms, expected) => {
    expect(formatInterval(base, after(ms))).toBe(expected);
  });

  it('never returns negative intervals', () => {
    expect(formatInterval(base, after(-5000))).toBe('<1 min');
  });
});
