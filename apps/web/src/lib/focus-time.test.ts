import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from './api-client';
import { flushFocusTime, focusSyncFailed, recordFocusInterval } from './focus-time';

vi.mock('./api-client', () => ({ api: vi.fn() }));
let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.mocked(api).mockReset();
});
afterEach(() => vi.unstubAllGlobals());
function saved(user: string) {
  return JSON.parse(storage.get(`lingoup:focus-time:${user}`)!) as {
    id: string;
    milliseconds: number;
    acknowledged: number;
  }[];
}

it('retries cumulative totals after a network failure without adding the same time twice', async () => {
  const user = randomUUID();
  const from = Date.now();
  recordFocusInterval(user, 'reading', from, from + 1500);
  const id = saved(user)[0]!.id;
  vi.mocked(api).mockRejectedValueOnce(new Error('Offline'));
  expect(await flushFocusTime(user)).toBe(false);
  expect(focusSyncFailed(user)).toBe(true);
  vi.mocked(api).mockResolvedValueOnce({ accepted: [id] });
  expect(await flushFocusTime(user)).toBe(true);
  expect(focusSyncFailed(user)).toBe(false);
  expect(saved(user)[0]).toMatchObject({ milliseconds: 1500, acknowledged: 1500 });
  expect(vi.mocked(api).mock.calls[1]![1]?.body).toMatchObject({
    accountId: user,
    entries: [{ id, skill: 'reading', milliseconds: 1500 }],
  });
  expect(await flushFocusTime(user)).toBe(false);
  expect(api).toHaveBeenCalledTimes(2);
});

it('keeps time accumulated while a request is in flight for the next synchronization', async () => {
  const user = randomUUID();
  const from = Date.now();
  recordFocusInterval(user, 'writing', from, from + 1000);
  const id = saved(user)[0]!.id;
  let finish!: (value: unknown) => void;
  vi.mocked(api).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const request = flushFocusTime(user);
  recordFocusInterval(user, 'writing', from + 1000, from + 2200);
  finish({ accepted: [id] });
  await request;
  expect(saved(user)[0]).toMatchObject({ milliseconds: 2200, acknowledged: 1000 });
  vi.mocked(api).mockResolvedValueOnce({ accepted: [id] });
  await flushFocusTime(user);
  expect(vi.mocked(api).mock.calls[1]![1]?.body).toMatchObject({
    entries: [{ milliseconds: 2200 }],
  });
});
