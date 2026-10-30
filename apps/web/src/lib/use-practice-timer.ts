'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { LearningDevelopmentSchema, type LearningSkill } from '@lingoup/contracts';
import { api } from './api-client';
import { useCurrentUser } from './auth';
import { useHydrated } from './use-hydrated';
import { practiceTimerFor, type PracticeTimerSnapshot } from './practice-timer';
import { practiceSkillForPath } from './practice-sections';

const SERVER_SNAPSHOT: PracticeTimerSnapshot = {
  durationMs: 600_000,
  remainingMs: 600_000,
  wanted: false,
  running: false,
};
const today = () => new Date().toISOString().slice(0, 10);
const subscribeDay = (notify: () => void) => {
  const interval = setInterval(notify, 30_000);
  return () => clearInterval(interval);
};

export function usePracticeTimer(skill: LearningSkill) {
  const { data: user, isPending } = useCurrentUser();
  const hydrated = useHydrated();
  const pathname = usePathname();
  const day = useSyncExternalStore(subscribeDay, today, () => '');
  const inScope =
    pathname === '/profile' || pathname === '/library' || practiceSkillForPath(pathname) !== null;
  const development = useQuery({
    queryKey: [
      'progress',
      'development',
      user?.id,
      user?.settings.dailyGoalMinutes,
      user?.settings.targetLevel,
    ],
    queryFn: () => api('/v1/progress/development', { schema: LearningDevelopmentSchema }),
    enabled: Boolean(user) && inScope,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const minutes =
    development.data?.plan.activities.find((activity) => activity.skill === skill)?.minutes ?? 10;
  const identity = user?.id ?? 'guest';
  const userId = user?.id;
  const store = useMemo(
    () => practiceTimerFor(`${identity}:${day}`, minutes * 60_000, skill, userId),
    [identity, day, minutes, skill, userId],
  );
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, () => SERVER_SNAPSHOT);
  const loading = !hydrated || isPending || Boolean(user && inScope && development.isPending);
  return {
    store,
    state,
    loading,
    minutes,
    canConfigure: !isPending && (user === null || Boolean(development.data)),
    pathname,
  };
}
