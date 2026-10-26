import type { DailyActivity } from '@lingoup/contracts';

const DAY_MS = 86_400_000;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** Fills missing days with zeros so the UI can draw a continuous calendar (UTC days). */
export function fillActivityWindow(
  rows: DailyActivity[],
  today: Date,
  days: number,
): DailyActivity[] {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const result: DailyActivity[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = isoDay(new Date(today.getTime() - offset * DAY_MS));
    result.push(byDay.get(day) ?? { day, wordsSaved: 0, reviewsDone: 0, textsCompleted: 0 });
  }
  return result;
}

const isActive = (row: DailyActivity) => row.wordsSaved + row.reviewsDone + row.textsCompleted > 0;

/**
 * Consecutive active days ending today. If today has no activity yet, the streak that
 * ended yesterday still counts (the learner has the rest of the day to continue it).
 */
export function currentStreak(window: DailyActivity[]): number {
  let index = window.length - 1;
  if (index >= 0 && !isActive(window[index]!)) index--;
  let streak = 0;
  while (index >= 0 && isActive(window[index]!)) {
    streak++;
    index--;
  }
  return streak;
}
