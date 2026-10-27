import type { DailyActivity } from '@lingoup/contracts';
import { t } from '@/i18n';
import { formatDate } from '@/lib/format';

/** 30-day bar chart; the same data is available as a table for screen readers. */
export function ActivityChart({ activity }: { activity: DailyActivity[] }) {
  const totals = activity.map(
    (day) => day.wordsSaved + day.reviewsDone + day.textsCompleted + day.exercisesDone,
  );
  const max = Math.max(1, ...totals);
  return (
    <>
      <div aria-hidden className="flex h-28 items-end gap-[3px]">
        {activity.map((day, index) => (
          <div
            key={day.day}
            title={`${formatDate(day.day)}: ${totals[index]}`}
            className="flex-1 rounded-t-sm bg-primary/80"
            style={{
              height: `${Math.max(totals[index]! > 0 ? 6 : 2, (totals[index]! / max) * 100)}%`,
              opacity: totals[index] ? 1 : 0.25,
            }}
          />
        ))}
      </div>
      <table className="sr-only">
        <caption>{t.profile.activity}</caption>
        <thead>
          <tr>
            <th scope="col">{t.profile.table.day}</th>
            <th scope="col">{t.profile.table.words}</th>
            <th scope="col">{t.profile.table.reviews}</th>
            <th scope="col">{t.profile.table.texts}</th>
            <th scope="col">{t.profile.table.exercises}</th>
          </tr>
        </thead>
        <tbody>
          {activity
            .filter((_, index) => totals[index]! > 0)
            .map((day) => (
              <tr key={day.day}>
                <th scope="row">{formatDate(day.day)}</th>
                <td>{day.wordsSaved}</td>
                <td>{day.reviewsDone}</td>
                <td>{day.textsCompleted}</td>
                <td>{day.exercisesDone}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </>
  );
}
