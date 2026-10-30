import { describe, expect, it } from 'vitest';
import { dailyPlan, gameLevel, learningDevelopment } from './development.js';

describe('daily study plans', () => {
  it('allocates exactly the requested time for every supported minute budget', () => {
    for (let minutes = 5; minutes <= 240; minutes++) {
      const plan = dailyPlan(minutes, 'A1', '2026-10-30');
      expect(plan.activities.reduce((total, activity) => total + activity.minutes, 0)).toBe(
        minutes,
      );
      expect(plan.activities.every((activity) => activity.minutes >= 5)).toBe(true);
      expect(new Set(plan.activities.map((activity) => activity.skill)).size).toBe(
        plan.activities.length,
      );
    }
  });
  it('creates a balanced 90-minute plan and reports actual earned activity completion', () => {
    const plan = dailyPlan(90, 'B1', '2026-10-30', { reading: 1, writing: 1 });
    expect(plan.activities.map((activity) => activity.minutes)).toEqual([20, 10, 15, 20, 15, 10]);
    expect(plan.activities.find((activity) => activity.skill === 'reading')).toMatchObject({
      target: 2,
      completed: 1,
    });
    expect(plan.activities.find((activity) => activity.skill === 'writing')).toMatchObject({
      target: 1,
      completed: 1,
    });
  });
  it('rotates short plans without dropping minutes and keeps CEFR separate from game levels', () => {
    expect(dailyPlan(15, 'A2', '2026-10-30').activities[0]?.skill).not.toBe(
      dailyPlan(15, 'A2', '2026-10-31').activities[0]?.skill,
    );
    const profile = learningDevelopment(
      90,
      'C1',
      { reading: 30 },
      {},
      new Date('2026-10-30T10:00:00Z'),
    );
    expect(profile.plan.cefrLevel).toBe('C1');
    expect(profile.skills.find((skill) => skill.skill === 'reading')).toMatchObject({
      xp: 30,
      level: 3,
      levelXp: 0,
      nextLevelXp: 30,
    });
    expect(profile.overall).toMatchObject({ xp: 30, level: 2, levelXp: 10, nextLevelXp: 40 });
    expect(gameLevel(0)).toMatchObject({ level: 1, levelXp: 0, nextLevelXp: 10 });
  });
});
