import type { LearningSkill } from '@lingoup/contracts';

export const PRACTICE_NAMES: Record<LearningSkill, string> = {
  reading: 'Reading',
  listening: 'Listening',
  speaking: 'Speaking',
  writing: 'Writing',
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
};

export function practiceSkillForPath(pathname: string): LearningSkill | null {
  if (pathname.startsWith('/read/')) return 'reading';
  if (
    pathname === '/review' ||
    pathname.startsWith('/review/') ||
    pathname === '/vocabulary' ||
    pathname.startsWith('/vocabulary/')
  )
    return 'vocabulary';
  for (const skill of ['grammar', 'listening', 'speaking', 'writing'] as const) {
    if (pathname === `/${skill}` || pathname.startsWith(`/${skill}/`)) return skill;
  }
  return null;
}
