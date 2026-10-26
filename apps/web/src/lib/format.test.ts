import { describe, expect, it } from 'vitest';
import { formatInterval } from './format';

const base = new Date('2026-10-26T10:00:00.000Z');
const after = (ms: number) => new Date(base.getTime() + ms);

describe('formatInterval', () => {
  it.each([
    [10_000, '<1 мин'],
    [10 * 60_000, '10 мин'],
    [5 * 3_600_000, '5 ч'],
    [3 * 86_400_000, '3 дн'],
    [60 * 86_400_000, '2 мес'],
  ])('%i ms -> %s', (ms, expected) => {
    expect(formatInterval(base, after(ms))).toBe(expected);
  });

  it('never returns negative intervals', () => {
    expect(formatInterval(base, after(-5000))).toBe('<1 мин');
  });
});
