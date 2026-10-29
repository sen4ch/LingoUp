import { locale } from '@/i18n';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact interval for review buttons: "<1 min", "10 min", "5 hr", "3 d", "2 mo", "1.5 yr". */
export function formatInterval(from: Date, to: Date): string {
  const ms = Math.max(0, to.getTime() - from.getTime());
  if (ms < MINUTE) return '<1 min';
  if (ms < HOUR) return `${Math.round(ms / MINUTE)} min`;
  if (ms < DAY) return `${Math.round(ms / HOUR)} hr`;
  if (ms < 30 * DAY) return `${Math.round(ms / DAY)} d`;
  if (ms < 365 * DAY) return `${Math.round(ms / (30 * DAY))} mo`;
  return `${(ms / (365 * DAY)).toLocaleString(locale, { maximumFractionDigits: 1 })} yr`;
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
