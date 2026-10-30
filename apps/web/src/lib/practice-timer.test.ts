import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPracticeTimer, formatPracticeTime } from './practice-timer';

afterEach(() => vi.useRealTimers());

describe('practice timer', () => {
  it('reports only consumed time, checkpoints on reset, and caps delayed ticks at completion', () => {
    vi.useFakeTimers();
    let now = 0;
    const intervals: number[][] = [];
    const timer = createPracticeTimer(
      60_000,
      undefined,
      undefined,
      () => now,
      (from, to) => {
        intervals.push([from, to]);
      },
    );
    timer.setActive(true);
    timer.start();
    now = 1200;
    timer.reset();
    expect(intervals).toEqual([[0, 1200]]);
    timer.start();
    now = 90_000;
    timer.flush();
    expect(intervals).toEqual([
      [0, 1200],
      [1200, 61200],
    ]);
    expect(timer.getSnapshot().remainingMs).toBe(0);
  });
  it('uses actual elapsed time and excludes pauses, other pages and hidden tabs', () => {
    vi.useFakeTimers();
    let now = 0;
    const timer = createPracticeTimer(1_200_000, undefined, undefined, () => now);
    timer.start();
    now += 60_000;
    timer.setActive(true);
    expect(timer.getSnapshot().remainingMs).toBe(1_200_000);
    now += 12_345;
    timer.flush();
    expect(timer.getSnapshot().remainingMs).toBe(1_187_655);
    timer.setActive(false);
    now += 300_000;
    timer.setActive(true);
    now += 7_655;
    timer.pause();
    expect(timer.getSnapshot()).toMatchObject({
      remainingMs: 1_180_000,
      wanted: false,
      running: false,
    });
    now += 60_000;
    timer.flush();
    expect(timer.getSnapshot().remainingMs).toBe(1_180_000);
  });

  it('restores remaining time without counting time away and preserves work when the plan changes', () => {
    vi.useFakeTimers();
    let now = 0;
    let saved: unknown;
    const timer = createPracticeTimer(
      1_200_000,
      (value) => {
        saved = value;
      },
      undefined,
      () => now,
    );
    timer.setActive(true);
    timer.start();
    now = 120_000;
    timer.setActive(false);
    const restored = createPracticeTimer(600_000, undefined, saved, () => now);
    now += 3_600_000;
    expect(restored.getSnapshot()).toMatchObject({
      remainingMs: 1_080_000,
      wanted: true,
      running: false,
    });
    restored.setDuration(900_000);
    expect(restored.getSnapshot().remainingMs).toBe(780_000);
    restored.reset();
    expect(restored.getSnapshot()).toMatchObject({ remainingMs: 900_000, wanted: false });
  });

  it('finishes at zero, stops its interval, and can restart', () => {
    vi.useFakeTimers();
    const timer = createPracticeTimer(60_000);
    timer.setActive(true);
    timer.start();
    vi.advanceTimersByTime(90_000);
    expect(timer.getSnapshot()).toMatchObject({ remainingMs: 0, wanted: false, running: false });
    expect(vi.getTimerCount()).toBe(0);
    timer.start();
    expect(timer.getSnapshot()).toMatchObject({ remainingMs: 60_000, running: true });
    timer.pause();
  });

  it('ignores invalid saved data and tolerates blocked browser storage', () => {
    const timer = createPracticeTimer(
      600_000,
      () => {
        throw new Error('Storage blocked');
      },
      { durationMs: 60_000, remainingMs: 90_000, wanted: true },
    );
    expect(() => timer.start()).not.toThrow();
    expect(timer.getSnapshot().remainingMs).toBe(600_000);
    timer.pause();
    expect(formatPracticeTime(1_199_001)).toBe('20:00');
    expect(formatPracticeTime(0)).toBe('00:00');
  });
});
