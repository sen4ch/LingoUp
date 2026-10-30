import { z } from 'zod';
import { FocusTimeAckSchema, FocusTimeBatchSchema, type LearningSkill } from '@lingoup/contracts';
import { shiftStudyDay, splitStudyInterval, studyDay } from '@lingoup/learning-engine';
import { api } from './api-client';

const SavedEntries = z
  .array(
    FocusTimeBatchSchema.shape.entries.element.extend({
      acknowledged: z.number().int().nonnegative(),
    }),
  )
  .max(600);
type Entry = z.infer<typeof SavedEntries>[number];
const accounts = new Map<string, Entry[]>();
const failed = new Set<string>();
const pending = new Map<string, Promise<boolean>>();
const listeners = new Set<() => void>();
let revision = 0;
export const focusRevision = () => revision;
export const subscribeFocus = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
function notify() {
  revision++;
  for (const listener of listeners) listener();
}
function entriesFor(userId: string) {
  let entries = accounts.get(userId);
  if (!entries) {
    try {
      entries = SavedEntries.parse(
        JSON.parse(sessionStorage.getItem(`lingoup:focus-time:${userId}`) ?? '[]'),
      );
    } catch {
      entries = [];
    }
    accounts.set(userId, entries);
  }
  const cutoff = shiftStudyDay(studyDay(), -90);
  entries = entries.filter((entry) => entry.day >= cutoff);
  accounts.set(userId, entries);
  return entries;
}
function persist(userId: string) {
  try {
    sessionStorage.setItem(
      `lingoup:focus-time:${userId}`,
      JSON.stringify(accounts.get(userId) ?? []),
    );
  } catch {
    /* Reporting still works while this page remains open. */
  }
}
export function recordFocusInterval(
  userId: string,
  skill: LearningSkill,
  from: number,
  to: number,
) {
  const entries = entriesFor(userId);
  for (const part of splitStudyInterval(from, to)) {
    let entry = entries.find((row) => row.skill === skill && row.day === part.day);
    if (!entry) {
      entry = { id: crypto.randomUUID(), skill, day: part.day, milliseconds: 0, acknowledged: 0 };
      entries.push(entry);
    }
    entry.milliseconds = Math.min(86_400_000, entry.milliseconds + part.milliseconds);
  }
  persist(userId);
  notify();
}
export function focusSyncFailed(userId: string) {
  return failed.has(userId);
}
/** Send absolute cumulative totals: retries, reloads and out-of-order delivery cannot add time twice. */
export function flushFocusTime(userId: string): Promise<boolean> {
  const inFlight = pending.get(userId);
  if (inFlight) return inFlight;
  const batch = entriesFor(userId)
    .filter((entry) => entry.milliseconds > entry.acknowledged)
    .slice(0, 20)
    .map(({ acknowledged: _acknowledged, ...entry }) => ({ ...entry }));
  if (!batch.length) return Promise.resolve(false);
  const request = (async () => {
    try {
      const response = await api('/v1/progress/focus-time', {
        method: 'POST',
        body: { accountId: userId, entries: batch },
        schema: FocusTimeAckSchema,
        keepalive: true,
      });
      for (const sent of batch) {
        const current = entriesFor(userId).find((entry) => entry.id === sent.id);
        if (current && response.accepted.includes(sent.id))
          current.acknowledged = Math.max(current.acknowledged, sent.milliseconds);
      }
      failed.delete(userId);
      persist(userId);
      notify();
      return true;
    } catch {
      failed.add(userId);
      notify();
      return false;
    } finally {
      pending.delete(userId);
    }
  })();
  pending.set(userId, request);
  return request;
}
