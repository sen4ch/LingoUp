'use client';

import { useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NextPracticeSchema, type NextPractice } from '@lingoup/contracts';
import { Alert, Button, Card, Skeleton } from '@lingoup/ui';
import { api } from '@/lib/api-client';
import { ME_QUERY_KEY, useCurrentUser } from '@/lib/auth';
import { useHydrated } from '@/lib/use-hydrated';
import { describeError } from '@/lib/errors';
import { practiceTimerFor } from '@/lib/practice-timer';
import { PRACTICE_NAMES } from '@/lib/practice-sections';

export function ContinueLearning() {
  const hydrated = useHydrated();
  const { data: user } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const client = useQueryClient();
  const navigating = useRef(false);
  const key = [
    'learning',
    'next-practice',
    user?.id,
    user?.settings.dailyGoalMinutes,
    user?.settings.targetLevel,
  ];
  const next = useQuery({
    queryKey: key,
    queryFn: () => api('/v1/learning/next-practice', { schema: NextPracticeSchema }),
    enabled: hydrated && Boolean(user),
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const go = useMutation({
    mutationFn: () => api('/v1/learning/next-practice', { schema: NextPracticeSchema }),
    onSuccess: async (step: NextPractice) => {
      if (
        !user ||
        step.accountId !== user.id ||
        client.getQueryData<{ id: string } | null>(ME_QUERY_KEY)?.id !== user.id
      ) {
        await client.invalidateQueries({ queryKey: ME_QUERY_KEY });
        throw new Error('Your account changed. Reload the page to continue.');
      }
      client.setQueryData(key, step);
      if (step.state === 'complete') return;
      if (step.state === 'ready' && step.activity) {
        const timer = practiceTimerFor(
          `${user.id}:${new Date().toISOString().slice(0, 10)}`,
          step.activity.minutes * 60_000,
          step.activity.skill,
          user.id,
        );
        timer.setDuration(step.activity.minutes * 60_000);
        // Finishing the timer does not finish an activity; begin another timed session if needed.
        timer.start();
      }
      router.push(
        step.activity?.skill === 'reading' && step.href === pathname
          ? `${step.href}#comprehension-${step.href.slice('/read/'.length)}`
          : step.href,
      );
    },
    onSettled: () => {
      navigating.current = false;
    },
  });
  if (!hydrated || !user) return null;
  const step = next.data;
  return (
    <section aria-label="Continue learning">
      <Card className="space-y-3 border-primary/30 bg-primary/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {step?.state === 'complete' ? 'Your daily plan' : 'Your next practice'}
            </h2>
            {step?.activity ? (
              <p className="mt-1 text-xs font-medium text-muted">
                {step.level} · {PRACTICE_NAMES[step.activity.skill]} · {step.activity.minutes} min ·{' '}
                {Math.min(step.activity.completed, step.activity.target)}/{step.activity.target}{' '}
                completed
              </p>
            ) : null}
          </div>
          <Button
            loading={go.isPending}
            disabled={next.isPending || next.isError || step?.state === 'complete'}
            onClick={() => {
              if (!navigating.current) {
                navigating.current = true;
                go.mutate();
              }
            }}
          >
            {step?.state === 'complete'
              ? 'Daily plan complete'
              : step?.state === 'setup'
                ? 'Add practice material'
                : 'Continue learning'}
          </Button>
        </div>
        {next.isPending ? (
          <Skeleton className="h-12" />
        ) : next.isError ? (
          <Alert tone="danger">
            {describeError(next.error)}{' '}
            <Button variant="secondary" onClick={() => void next.refetch()}>
              Retry next practice
            </Button>
          </Alert>
        ) : step ? (
          <>
            <p className="font-medium">{step.title}</p>
            <p className="text-sm text-muted">{step.message}</p>
            {step.notes.length ? (
              <details className="text-xs text-muted">
                <summary className="cursor-pointer">Why earlier activities were skipped</summary>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {step.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        ) : null}
        {go.isError ? <Alert tone="danger">{describeError(go.error)}</Alert> : null}
      </Card>
    </section>
  );
}
