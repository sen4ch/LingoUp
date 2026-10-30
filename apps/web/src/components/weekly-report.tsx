'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WeeklyReportSchema } from '@lingoup/contracts';
import { Alert, Button, Card, Skeleton } from '@lingoup/ui';
import { api } from '@/lib/api-client';
import { describeError } from '@/lib/errors';
import { PRACTICE_NAMES } from '@/lib/practice-sections';
import { focusRevision, focusSyncFailed, subscribeFocus } from '@/lib/focus-time';

const minutes = (seconds: number) =>
  seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60}s` : ''}`;
export function WeeklyReport({ userId }: { userId: string }) {
  const [offset, setOffset] = useState(0);
  useSyncExternalStore(subscribeFocus, focusRevision, () => 0);
  const report = useQuery({
    queryKey: ['progress', 'weekly', userId, offset],
    queryFn: () => api(`/v1/progress/weekly?offset=${offset}`, { schema: WeeklyReportSchema }),
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const data = report.data;
  return (
    <section aria-labelledby="weekly-report-title" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="weekly-report-title" className="text-2xl font-semibold">
            Weekly summary
          </h2>
          <p className="text-sm text-muted">
            {offset === 0 ? 'This week so far' : offset === 1 ? 'Last week' : `${offset} weeks ago`}{' '}
            · Monday–Sunday · Kyiv time
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={offset === 52}
            onClick={() => setOffset((value) => value + 1)}
          >
            Previous week
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={offset === 0}
            onClick={() => setOffset((value) => value - 1)}
          >
            Next week
          </Button>
        </div>
      </header>
      {focusSyncFailed(userId) ? (
        <Alert tone="warning">
          Your latest timer time is waiting to sync. It will retry automatically when you are
          online.
        </Alert>
      ) : null}
      {report.isPending ? (
        <Skeleton className="h-64" />
      ) : report.isError ? (
        <Alert tone="danger">
          {describeError(report.error)}{' '}
          <Button variant="secondary" onClick={() => void report.refetch()}>
            Retry weekly summary
          </Button>
        </Alert>
      ) : data ? (
        <>
          <p className="text-sm text-muted">
            {data.period.start} – {data.period.end}
          </p>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [
                'Practice XP',
                `+${data.totals.xp}`,
                `${data.totals.xp - data.totals.previousXp >= 0 ? '+' : ''}${data.totals.xp - data.totals.previousXp} vs previous week`,
              ],
              [
                'Timer-recorded time',
                minutes(data.totals.seconds),
                `${minutes(data.totals.previousSeconds)} in previous week`,
              ],
              ['Active days', `${data.totals.activeDays}/7`, 'Practice XP or recorded timer time'],
              [
                'Player level',
                data.player.startLevel === data.player.endLevel
                  ? `${data.player.endLevel}`
                  : `${data.player.startLevel} → ${data.player.endLevel}`,
                'Game level, independent of CEFR',
              ],
            ].map(([label, value, note]) => (
              <Card key={label} className="space-y-1 p-4">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="text-2xl font-semibold">{value}</dd>
                <p className="text-xs text-muted">{note}</p>
              </Card>
            ))}
          </dl>
          <Card className="space-y-3">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <h3 className="font-semibold">Time against your current goal</h3>
              <span>
                {minutes(data.totals.seconds)} / {data.currentWeeklyGoalMinutes} min
              </span>
            </div>
            <progress
              aria-label="Weekly timer time goal"
              max={data.currentWeeklyGoalMinutes * 60}
              value={Math.min(data.totals.seconds, data.currentWeeklyGoalMinutes * 60)}
              className="h-2 w-full accent-primary"
            />
            <p className="text-xs text-muted">
              Uses your current daily goal × 7, including when viewing earlier weeks. Time is
              recorded only while a practice timer runs in a visible section. Earlier unrecorded
              time is unavailable.
            </p>
          </Card>
          <Card className="space-y-3">
            <h3 className="font-semibold">Your week, day by day</h3>
            <div className="grid grid-cols-7 gap-1 sm:gap-3">
              {data.days.map((day) => (
                <div
                  key={day.day}
                  className={`min-w-0 rounded-lg p-1 text-center sm:p-3 ${day.xp || day.seconds ? 'bg-primary/10' : 'bg-surface-muted'}`}
                >
                  <p className="text-xs font-semibold">
                    {new Intl.DateTimeFormat('en', {
                      weekday: 'short',
                      timeZone: data.timeZone,
                    }).format(new Date(`${day.day}T12:00:00Z`))}
                  </p>
                  <p className="mt-2 text-sm font-bold text-primary">+{day.xp}</p>
                  <p className="text-[10px] text-muted sm:text-xs">
                    {Math.floor(day.seconds / 60)}m
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted">
              Each day shows practice XP and timer minutes. Untimed qualifying activities still earn
              XP.
            </p>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="space-y-3">
              <h3 className="font-semibold">Practice by skill</h3>
              <ul className="space-y-3">
                {data.skills.map((skill) => (
                  <li key={skill.skill} className="space-y-1">
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="font-medium">{PRACTICE_NAMES[skill.skill]}</span>
                      <span>
                        +{skill.xp} XP · {minutes(skill.seconds)} · Lv {skill.startLevel}
                        {skill.endLevel !== skill.startLevel ? ` → ${skill.endLevel}` : ''}
                      </span>
                    </div>
                    <progress
                      aria-label={`${PRACTICE_NAMES[skill.skill]} weekly XP`}
                      max={Math.max(1, ...data.skills.map((row) => row.xp))}
                      value={skill.xp}
                      className="h-1.5 w-full accent-primary"
                    />
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">
                {data.totals.textsRead} texts marked as read · {data.totals.wordsAdded} words added
                · {data.totals.grammarSolved} newly solved grammar exercises. Activity counts follow
                earned XP and can take a few seconds to appear.
              </p>
            </Card>
            <Card className="space-y-3">
              <h3 className="font-semibold">Mistakes to learn from</h3>
              <p className="text-sm">
                {data.totals.newMistakes} new error corrections · {data.totals.openMistakes} still
                to review
              </p>
              {data.commonErrors.length ? (
                <ul className="space-y-2 text-sm">
                  {data.commonErrors.map((error) => (
                    <li key={error.type} className="flex justify-between gap-2">
                      <span className="capitalize">{error.type.replaceAll('_', ' ')}</span>
                      <span>{error.count} saved</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">
                  No error corrections were saved in this period. Optional style suggestions are
                  counted separately in your journal.
                </p>
              )}
              <p className="text-xs text-muted">
                Shows saved corrections from this week. Review status reflects the journal now.
              </p>
              <Link
                href="/mistakes"
                className="inline-block text-sm font-semibold text-primary underline"
              >
                Open mistake journal
              </Link>
            </Card>
          </div>
          <Card className="space-y-3 border-primary/30">
            <h3 className="text-lg font-semibold">
              {offset === 0 ? 'A goal for next week' : 'A goal based on this week'}
            </h3>
            <p className="font-medium">{data.nextGoal.title}</p>
            <p className="text-sm text-muted">{data.nextGoal.reason}</p>
            <Link
              href={data.nextGoal.href}
              className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              {data.nextGoal.action}
            </Link>
          </Card>
        </>
      ) : null}
    </section>
  );
}
