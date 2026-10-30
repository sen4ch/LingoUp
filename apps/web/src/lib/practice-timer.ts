import { z } from 'zod';
import type { LearningSkill } from '@lingoup/contracts';
import { recordFocusInterval } from './focus-time';

const SavedTimerSchema = z
  .object({
    durationMs: z
      .number()
      .int()
      .min(60_000)
      .max(240 * 60_000),
    remainingMs: z.number().min(0),
    wanted: z.boolean(),
  })
  .refine((value) => value.remainingMs <= value.durationMs);
export interface PracticeTimerSnapshot {
  durationMs: number;
  remainingMs: number;
  wanted: boolean;
  running: boolean;
}

/** Time is measured from timestamps, not interval ticks. Inactive pages never consume it. */
export function createPracticeTimer(
  durationMs: number,
  persist: (saved: unknown) => void = () => undefined,
  restored?: unknown,
  now: () => number = Date.now,
  onElapsed: (from: number, to: number) => void = () => undefined,
) {
  const parsed = SavedTimerSchema.safeParse(restored);
  let duration = parsed.success ? parsed.data.durationMs : durationMs;
  let remaining = parsed.success ? parsed.data.remainingMs : duration;
  let wanted = parsed.success && parsed.data.wanted && remaining > 0;
  let active = false;
  let startedAt: number | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<() => void>();
  let snapshot: PracticeTimerSnapshot = {
    durationMs: duration,
    remainingMs: remaining,
    wanted,
    running: false,
  };

  function publish() {
    snapshot = {
      durationMs: duration,
      remainingMs: remaining,
      wanted,
      running: startedAt !== null,
    };
    try {
      persist({ durationMs: duration, remainingMs: remaining, wanted });
    } catch {
      /* Timer works when browser storage is unavailable. */
    }
    for (const listener of listeners) listener();
  }
  function sync() {
    if (active && wanted && remaining > 0) {
      startedAt = now();
      interval ??= setInterval(tick, 1000);
    } else {
      startedAt = null;
      if (interval !== null) clearInterval(interval);
      interval = null;
    }
  }
  function checkpoint() {
    if (startedAt !== null) {
      const elapsed = Math.min(remaining, Math.max(0, now() - startedAt));
      remaining -= elapsed;
      if (elapsed > 0) {
        try {
          onElapsed(startedAt, startedAt + elapsed);
        } catch {
          /* Reporting must not interrupt the timer. */
        }
      }
    }
    if (remaining === 0) wanted = false;
  }
  function tick() {
    checkpoint();
    sync();
    publish();
  }
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    start() {
      checkpoint();
      if (remaining === 0) remaining = duration;
      wanted = true;
      sync();
      publish();
    },
    pause() {
      checkpoint();
      wanted = false;
      sync();
      publish();
    },
    reset() {
      checkpoint();
      wanted = false;
      remaining = duration;
      sync();
      publish();
    },
    setActive(value: boolean) {
      if (value === active) return;
      checkpoint();
      active = value;
      sync();
      publish();
    },
    setDuration(value: number) {
      if (value === duration) return;
      checkpoint();
      const spent = duration - remaining;
      duration = value;
      remaining = Math.max(0, duration - spent);
      if (remaining === 0) wanted = false;
      sync();
      publish();
    },
    flush: tick,
  };
}

export function formatPracticeTime(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

const timers = new Map<string, ReturnType<typeof createPracticeTimer>>();
export function practiceTimerFor(
  key: string,
  durationMs: number,
  skill: LearningSkill,
  userId?: string,
) {
  const scopedKey = `${skill}:${key}`;
  let timer = timers.get(scopedKey);
  if (timer) return timer;
  // Keep existing reading sessions when extending timers to the other skills.
  const storageKey =
    skill === 'reading' ? `lingoup:reading-timer:${key}` : `lingoup:practice-timer:${scopedKey}`;
  let restored: unknown;
  try {
    if (typeof window !== 'undefined')
      restored = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
  } catch {
    /* Start a fresh session if saved data is invalid. */
  }
  timer = createPracticeTimer(
    durationMs,
    (saved) => {
      if (typeof window !== 'undefined') sessionStorage.setItem(storageKey, JSON.stringify(saved));
    },
    restored,
    Date.now,
    (from, to) => {
      if (userId) recordFocusInterval(userId, skill, from, to);
    },
  );
  timers.set(scopedKey, timer);
  return timer;
}
