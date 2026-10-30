import {
  LEARNING_SKILLS,
  type CefrLevel,
  type LearningDevelopment,
  type LearningSkill,
} from '@lingoup/contracts';

export function gameLevel(xp: number, base = 10) {
  let level = 1;
  let levelXp = xp;
  while (levelXp >= base * level) {
    levelXp -= base * level;
    level++;
  }
  return { xp, level, levelXp, nextLevelXp: base * level };
}

const ACTIVITIES = [
  {
    skill: 'reading',
    title: 'Read and understand',
    href: '/library',
    weight: 20,
    unit: 10,
    instruction: 'Read level-appropriate texts and mark them as read.',
  },
  {
    skill: 'vocabulary',
    title: 'Review your vocabulary',
    href: '/review',
    weight: 10,
    unit: 0.5,
    instruction: 'Save useful words or recall due cards successfully.',
  },
  {
    skill: 'grammar',
    title: 'Practise grammar',
    href: '/grammar',
    weight: 15,
    unit: 5,
    instruction: 'Work through exercises and answer them correctly.',
  },
  {
    skill: 'listening',
    title: 'Listen and answer',
    href: '/listening',
    weight: 20,
    unit: 10,
    instruction: 'Complete listening quizzes with at least 60% correct.',
  },
  {
    skill: 'writing',
    title: 'Write an email',
    href: '/writing',
    weight: 15,
    unit: 15,
    instruction: 'Send an English reply of at least 20 characters and read the AI feedback.',
  },
  {
    skill: 'speaking',
    title: 'Have a conversation',
    href: '/speaking',
    weight: 10,
    unit: 10,
    instruction: 'Practise a conversation with at least three learner turns.',
  },
] as const;

/** Largest remainders allocate every minute exactly, including custom budgets like 91. */
export function dailyPlan(
  minutes: number,
  level: CefrLevel,
  day: string,
  today: Partial<Record<LearningSkill, number>> = {},
) {
  const count = Math.min(ACTIVITIES.length, Math.max(1, Math.floor(minutes / 10)));
  const offset =
    count < ACTIVITIES.length ? Math.floor(Date.parse(day) / 86400_000) % ACTIVITIES.length : 0;
  const activities = [...ACTIVITIES.slice(offset), ...ACTIVITIES.slice(0, offset)].slice(0, count);
  const totalWeight = activities.reduce((total, activity) => total + activity.weight, 0);
  const parts = activities.map((activity) => ({
    activity,
    exact: (minutes * activity.weight) / totalWeight,
    minutes: Math.floor((minutes * activity.weight) / totalWeight),
  }));
  let remaining = minutes - parts.reduce((total, part) => total + part.minutes, 0);
  for (const part of [...parts].sort((a, b) => b.exact - b.minutes - (a.exact - a.minutes))) {
    if (remaining-- <= 0) break;
    part.minutes++;
  }
  return {
    dailyMinutes: minutes,
    cefrLevel: level,
    activities: parts.map(({ activity, minutes: allocated }) => ({
      skill: activity.skill,
      title: activity.title,
      href: activity.href,
      minutes: allocated,
      instruction: `${level} · ${activity.instruction}`,
      target: Math.max(1, Math.ceil(allocated / activity.unit)),
      completed: today[activity.skill] ?? 0,
    })),
  };
}

export function learningDevelopment(
  minutes: number,
  level: CefrLevel,
  totals: Partial<Record<LearningSkill, number>>,
  today: Partial<Record<LearningSkill, number>>,
  now: Date,
): LearningDevelopment {
  const day = now.toISOString().slice(0, 10);
  const skills = LEARNING_SKILLS.map((skill) => ({
    skill,
    ...gameLevel(totals[skill] ?? 0),
    todayXp: today[skill] ?? 0,
  }));
  return {
    generatedAt: now.toISOString(),
    day,
    overall: gameLevel(
      skills.reduce((total, skill) => total + skill.xp, 0),
      20,
    ),
    skills,
    plan: dailyPlan(minutes, level, day, today),
  };
}
