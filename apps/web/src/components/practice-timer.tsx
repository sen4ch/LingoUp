'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LEARNING_SKILLS, type LearningSkill } from '@lingoup/contracts';
import { Button, Skeleton } from '@lingoup/ui';
import { formatPracticeTime } from '@/lib/practice-timer';
import { usePracticeTimer } from '@/lib/use-practice-timer';
import { practiceSkillForPath, PRACTICE_NAMES } from '@/lib/practice-sections';
import { useCurrentUser } from '@/lib/auth';
import { FocusTimeSync } from '@/components/focus-time-sync';

/** One controller survives navigation; all timer displays subscribe to the same session. */
export function PracticeTimerRuntime() {
  return (
    <>
      {LEARNING_SKILLS.map((skill) => (
        <TimerController key={skill} skill={skill} />
      ))}
      <FocusTimeSync />
    </>
  );
}

function TimerController({ skill }: { skill: LearningSkill }) {
  const { store, loading, minutes, canConfigure, pathname } = usePracticeTimer(skill);
  useEffect(() => {
    if (canConfigure) store.setDuration(minutes * 60_000);
  }, [store, minutes, canConfigure]);
  useEffect(() => {
    const update = () =>
      store.setActive(
        !loading &&
          practiceSkillForPath(pathname) === skill &&
          document.visibilityState === 'visible',
      );
    const leave = () => store.setActive(false);
    update();
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pagehide', leave);
    window.addEventListener('pageshow', update);
    return () => {
      leave();
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('pageshow', update);
    };
  }, [store, loading, pathname, skill]);
  return null;
}

export function PracticeTimer({
  skill,
  compact = false,
}: {
  skill: LearningSkill;
  compact?: boolean;
}) {
  const { store, state, loading } = usePracticeTimer(skill);
  const name = PRACTICE_NAMES[skill];
  if (loading) return <Skeleton className={compact ? 'mt-3 h-12' : 'h-28'} />;
  const completed = state.remainingMs === 0;
  const untouched = state.remainingMs === state.durationMs;
  const label = completed
    ? 'Restart timer'
    : state.wanted
      ? 'Pause timer'
      : untouched
        ? 'Start timer'
        : 'Resume timer';
  return (
    <section
      aria-label={`${name} focus timer`}
      className={
        compact
          ? 'mt-3 space-y-2'
          : 'space-y-3 rounded-xl border border-border bg-surface p-4 sm:p-5'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className={compact ? 'text-sm font-medium' : 'font-semibold'}>{name} timer</h2>
          <span
            role="timer"
            aria-label={`${name} time remaining`}
            className="font-mono text-2xl font-bold text-primary tabular-nums"
          >
            {formatPracticeTime(state.remainingMs)}
          </span>
          <span className="text-xs text-muted">of {Math.round(state.durationMs / 60_000)} min</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => (state.wanted ? store.pause() : store.start())}>
            {label}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={untouched && !state.wanted}
            onClick={() => store.reset()}
          >
            Reset timer
          </Button>
        </div>
      </div>
      {!compact ? (
        <progress
          aria-label={`${name} time completed`}
          value={state.durationMs - state.remainingMs}
          max={state.durationMs}
          className="h-2 w-full accent-primary"
        />
      ) : null}
      <p role="status" className="text-xs text-muted">
        {completed
          ? skill === 'reading'
            ? 'Reading session complete! Mark the texts you finished as read to earn XP.'
            : `${name} session complete! Complete practice activities to earn XP.`
          : state.running
            ? `Counting your ${name.toLowerCase()} time. Pauses automatically when you leave this section or hide this tab.`
            : state.wanted
              ? skill === 'reading'
                ? 'Ready to continue. Open a text to start counting.'
                : `Ready to continue. Open ${name.toLowerCase()} practice to start counting.`
              : 'Start when you are ready. Your remaining time is saved in this tab for today.'}
      </p>
    </section>
  );
}

/** The reader places its timer below its heading; other sections share this placement. */
export function PracticeSectionTimer() {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  const skill = practiceSkillForPath(pathname);
  if (!skill || skill === 'reading' || (!user && skill !== 'grammar')) return null;
  return (
    <div className="mb-6">
      <PracticeTimer skill={skill} />
    </div>
  );
}

export function StartPracticeLink({
  skill,
  href,
  className,
  children,
}: {
  skill: LearningSkill;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const { store, loading } = usePracticeTimer(skill);
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        if (!loading) store.start();
      }}
    >
      {children}
    </Link>
  );
}
