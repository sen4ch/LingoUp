import { describe, expect, it } from 'vitest';
import { currentStreak, fillActivityWindow } from './activity.js';

const today = new Date('2026-10-26T12:00:00.000Z');
const active = (day: string) => ({
  day,
  wordsSaved: 1,
  reviewsDone: 0,
  textsCompleted: 0,
  exercisesDone: 0,
});

describe('fillActivityWindow', () => {
  it('returns a continuous window, oldest first, with zeros for missing days', () => {
    const window = fillActivityWindow([active('2026-10-25')], today, 3);
    expect(window.map((d) => d.day)).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
    expect(window[0]).toEqual({
      day: '2026-10-24',
      wordsSaved: 0,
      reviewsDone: 0,
      textsCompleted: 0,
      exercisesDone: 0,
    });
    expect(window[1]!.wordsSaved).toBe(1);
  });
});

describe('currentStreak', () => {
  it('counts consecutive active days ending today', () => {
    const window = fillActivityWindow(
      [active('2026-10-24'), active('2026-10-25'), active('2026-10-26')],
      today,
      5,
    );
    expect(currentStreak(window)).toBe(3);
  });

  it('keeps yesterday’s streak alive while today is still empty', () => {
    const window = fillActivityWindow([active('2026-10-24'), active('2026-10-25')], today, 5);
    expect(currentStreak(window)).toBe(2);
  });

  it('is zero after a missed day', () => {
    const window = fillActivityWindow([active('2026-10-23')], today, 5);
    expect(currentStreak(window)).toBe(0);
  });
});
