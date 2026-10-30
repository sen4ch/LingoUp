import { describe, expect, it } from 'vitest';
import { studyDay, studyWeek, splitStudyInterval } from './study-calendar.js';

describe('Kyiv study calendar', () => {
  it('uses local Monday boundaries instead of the host timezone or UTC weekday', () => {
    const lateSunday = new Date('2026-10-25T22:30:00Z');
    expect(studyDay(lateSunday)).toBe('2026-10-26');
    expect(studyWeek(lateSunday)).toMatchObject({
      start: '2026-10-26',
      end: '2026-11-01',
      until: '2026-11-02',
    });
    expect(studyWeek(lateSunday, 1).start).toBe('2026-10-19');
  });
  it('splits time at local midnight and preserves milliseconds through daylight-saving changes', () => {
    const start = Date.parse('2026-10-25T21:59:59.500Z');
    expect(splitStudyInterval(start, start + 1500)).toEqual([
      { day: '2026-10-25', milliseconds: 500 },
      { day: '2026-10-26', milliseconds: 1000 },
    ]);
    const from = Date.parse('2026-10-24T21:00:00Z');
    const to = Date.parse('2026-10-25T22:00:00Z');
    expect(splitStudyInterval(from, to)).toEqual([
      { day: '2026-10-25', milliseconds: 25 * 3600_000 },
    ]);
    expect(splitStudyInterval(to, to)).toEqual([]);
  });
});
