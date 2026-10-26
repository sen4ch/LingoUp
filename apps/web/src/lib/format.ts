import { locale } from '@/i18n';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact interval for review buttons: "<1 мин", "10 мин", "5 ч", "3 дн", "2 мес", "1,5 г". */
export function formatInterval(from: Date, to: Date): string {
  const ms = Math.max(0, to.getTime() - from.getTime());
  if (ms < MINUTE) return '<1 мин';
  if (ms < HOUR) return `${Math.round(ms / MINUTE)} мин`;
  if (ms < DAY) return `${Math.round(ms / HOUR)} ч`;
  if (ms < 30 * DAY) return `${Math.round(ms / DAY)} дн`;
  if (ms < 365 * DAY) return `${Math.round(ms / (30 * DAY))} мес`;
  return `${(ms / (365 * DAY)).toLocaleString(locale, { maximumFractionDigits: 1 })} г`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
