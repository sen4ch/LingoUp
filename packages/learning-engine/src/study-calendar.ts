export const STUDY_TIME_ZONE = 'Europe/Kyiv';
const calendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: STUDY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function studyDay(time: number | Date = new Date()): string {
  const parts = calendar.formatToParts(time);
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join('-');
}
export function shiftStudyDay(day: string, days: number) {
  return new Date(Date.parse(`${day}T12:00:00Z`) + days * 86400_000).toISOString().slice(0, 10);
}
export function studyWeek(now = new Date(), offset = 0) {
  const today = studyDay(now);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const start = shiftStudyDay(today, -((weekday + 6) % 7) - offset * 7);
  return {
    start,
    end: shiftStudyDay(start, 6),
    until: shiftStudyDay(start, 7),
    days: Array.from({ length: 7 }, (_, index) => shiftStudyDay(start, index)),
  };
}
/** Split at civil midnight, including 23/25-hour daylight-saving days. */
export function splitStudyInterval(
  from: number,
  to: number,
): { day: string; milliseconds: number }[] {
  const result: { day: string; milliseconds: number }[] = [];
  while (from < to) {
    const day = studyDay(from);
    let end = to;
    if (studyDay(to - 1) !== day) {
      let low = from + 1;
      let high = to;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (studyDay(middle) === day) low = middle + 1;
        else high = middle;
      }
      end = low;
    }
    result.push({ day, milliseconds: end - from });
    from = end;
  }
  return result;
}
