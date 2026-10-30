'use client';

import { useState, type SyntheticEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LearningDevelopmentSchema,
  UserSettingsSchema,
  type UserSettings,
} from '@lingoup/contracts';
import { Alert, Button, Card, Skeleton, TextField } from '@lingoup/ui';
import { api } from '@/lib/api-client';
import { ME_QUERY_KEY } from '@/lib/auth';
import { describeError } from '@/lib/errors';
import { PracticeTimer, StartPracticeLink } from '@/components/practice-timer';

const SKILL_NAMES = {
  reading: 'Reading',
  listening: 'Listening',
  speaking: 'Speaking',
  writing: 'Writing',
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
};
const SKILL_ICONS = {
  reading: '↗',
  listening: '♫',
  speaking: '◎',
  writing: '✎',
  grammar: 'Aa',
  vocabulary: 'W',
};

export function LearningDashboard({
  settings,
  userId,
}: {
  settings: UserSettings;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState(String(settings.dailyGoalMinutes));
  const growth = useQuery({
    queryKey: ['progress', 'development', userId, settings.dailyGoalMinutes, settings.targetLevel],
    queryFn: () => api('/v1/progress/development', { schema: LearningDevelopmentSchema }),
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const save = useMutation({
    mutationFn: (dailyGoalMinutes: number) =>
      api('/v1/me/settings', {
        method: 'PATCH',
        body: { dailyGoalMinutes },
        schema: UserSettingsSchema,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ['progress', 'development'] });
    },
  });
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(minutes);
    if (Number.isInteger(amount) && amount >= 5 && amount <= 240) save.mutate(amount);
  }
  const data = growth.data;
  return (
    <>
      <section aria-labelledby="learning-plan-title" className="space-y-4">
        <div>
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">
            Make room for your English
          </p>
          <h2 id="learning-plan-title" className="mt-1 text-2xl font-bold">
            Your daily learning plan
          </h2>
        </div>
        <Card className="space-y-5">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
              <TextField
                label="Daily study time (minutes)"
                type="number"
                required
                min={5}
                max={240}
                step={1}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
              />
              <Button type="submit" loading={save.isPending}>
                Build my plan
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {[15, 30, 60, 90, 120, 180].map((amount) => (
                <Button
                  key={amount}
                  size="sm"
                  variant={Number(minutes) === amount ? 'primary' : 'secondary'}
                  disabled={save.isPending}
                  onClick={() => setMinutes(String(amount))}
                >
                  {amount === 90
                    ? '1 h 30 min'
                    : amount >= 60
                      ? `${amount / 60} h`
                      : `${amount} min`}
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted">
              Choose 5–240 minutes. We divide your time between skills for your{' '}
              {settings.targetLevel} level. For shorter days, activities rotate so every skill gets
              practice.
            </p>
            {save.isError ? <Alert tone="danger">{describeError(save.error)}</Alert> : null}
            {save.isSuccess ? (
              <p role="status" className="text-sm text-success">
                Your study time and plan are saved.
              </p>
            ) : null}
          </form>
          {growth.isPending ? (
            <Skeleton className="h-48" />
          ) : growth.isError ? (
            <Alert tone="danger">
              {describeError(growth.error)}{' '}
              <Button variant="secondary" onClick={() => void growth.refetch()}>
                Retry
              </Button>
            </Alert>
          ) : data ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-4">
                <h3 className="text-xl font-semibold">
                  Today’s plan · {data.plan.dailyMinutes} minutes
                </h3>
                <p className="text-sm text-muted">
                  {data.plan.cefrLevel} ·{' '}
                  {
                    data.plan.activities.filter((activity) => activity.completed >= activity.target)
                      .length
                  }
                  /{data.plan.activities.length} activities complete
                </p>
              </div>
              <ol className="space-y-3">
                {data.plan.activities.map((activity, index) => (
                  <li
                    key={activity.skill}
                    className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted font-semibold text-primary"
                      >
                        {activity.completed >= activity.target ? '✓' : index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold">
                          {activity.title}{' '}
                          <span className="ml-1 text-sm font-normal text-muted">
                            {activity.minutes} min
                          </span>
                        </h4>
                        <p className="mt-1 text-sm text-muted">{activity.instruction}</p>
                        <p className="mt-2 text-xs font-medium">
                          {Math.min(activity.completed, activity.target)}/{activity.target}{' '}
                          completed · +1 skill XP per qualifying activity
                        </p>
                        <PracticeTimer skill={activity.skill} compact />
                      </div>
                    </div>
                    <StartPracticeLink
                      skill={activity.skill}
                      href={activity.href}
                      className="shrink-0 rounded-lg bg-primary px-4 py-2 text-center text-sm font-semibold text-white"
                    >
                      {activity.completed >= activity.target ? 'Practise more' : 'Start practice'}
                    </StartPracticeLink>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-muted">
                Each timer counts focused time in its practice section in this tab. Completion comes
                from earned skill XP today (UTC). New results can take a few seconds to appear.
              </p>
            </>
          ) : null}
        </Card>
      </section>
      <section aria-labelledby="skill-levels-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">
              Your character sheet
            </p>
            <h2 id="skill-levels-title" className="mt-1 text-2xl font-bold">
              Skills & levels
            </h2>
          </div>
          {data ? (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-4 py-2 font-semibold text-primary">
              Player level {data.overall.level}
            </span>
          ) : null}
        </div>
        {data ? (
          <>
            <Card className="space-y-3">
              <div className="flex justify-between gap-3">
                <span className="font-semibold">English practice · {data.overall.xp} total XP</span>
                <span className="text-sm text-muted">
                  {data.overall.levelXp}/{data.overall.nextLevelXp} XP to next level
                </span>
              </div>
              <progress
                aria-label="Player level progress"
                value={data.overall.levelXp}
                max={data.overall.nextLevelXp}
                className="h-3 w-full accent-primary"
              />
              <p className="text-xs text-muted">
                Game levels reward practice. They do not replace your {settings.targetLevel} CEFR
                level.
              </p>
            </Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.skills.map((skill) => (
                <Card key={skill.skill} className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary"
                      >
                        {SKILL_ICONS[skill.skill]}
                      </span>
                      <h3 className="font-semibold">{SKILL_NAMES[skill.skill]}</h3>
                    </div>
                    <span className="rounded-full bg-surface-muted px-3 py-1 text-sm font-semibold">
                      Level {skill.level}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{skill.xp} XP</span>
                    <span className="text-muted">+{skill.todayXp} today</span>
                  </div>
                  <progress
                    aria-label={`${SKILL_NAMES[skill.skill]} level progress`}
                    value={skill.levelXp}
                    max={skill.nextLevelXp}
                    className="h-2 w-full accent-primary"
                  />
                  <p className="text-xs text-muted">
                    {skill.levelXp}/{skill.nextLevelXp} XP to next level
                  </p>
                </Card>
              ))}
            </div>
            <details className="rounded-xl border border-border p-4 text-sm">
              <summary className="cursor-pointer font-semibold">How do I earn XP?</summary>
              <ul className="mt-3 space-y-2 text-muted">
                <li>Reading: +1 for each new text marked as read.</li>
                <li>Grammar: +1 the first time you solve an exercise correctly.</li>
                <li>
                  Vocabulary: +1 for a saved word; +1 for a successful review of a card, once per
                  UTC day.
                </li>
                <li>Listening: +1 for passing a lesson quiz with at least 60% correct.</li>
                <li>
                  Writing: +1 for an assessed reply of at least 20 characters, once per identical
                  exchange per UTC day.
                </li>
                <li>
                  Speaking: +1 for a conversation with at least three learner turns, once per
                  conversation per UTC day.
                </li>
                <li>
                  Exams: +1 for each qualifying section (60% Reading/Listening, estimate 5+
                  Writing/Speaking).
                </li>
                <li>
                  AI demo output does not earn practice XP. Each skill level needs 10 more XP than
                  the previous level; player levels start at 20 XP and increase by 20.
                </li>
                <li>
                  Existing reading, grammar and vocabulary records are included. Other skill XP
                  starts with this update.
                </li>
              </ul>
            </details>
          </>
        ) : growth.isError ? (
          <Alert tone="danger">Your skills could not be loaded.</Alert>
        ) : (
          <Skeleton className="h-48" />
        )}
      </section>
    </>
  );
}
