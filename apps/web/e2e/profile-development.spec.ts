import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('builds and saves a 90-minute plan and displays server-earned skill levels', async ({
  page,
}) => {
  const userId = randomUUID();
  let dailyGoalMinutes = 30;
  let saved = 0;
  const user = () => ({
    id: userId,
    email: 'learner@example.test',
    displayName: 'Learner',
    createdAt: new Date().toISOString(),
    settings: { nativeLanguage: 'ru', targetLevel: 'B1', dailyGoalMinutes, aiDataSharing: false },
  });
  await page.route('**/api/v1/me', (route) => route.fulfill({ json: user() }));
  await page.route('**/api/v1/me/settings', (route) => {
    const patch = route.request().postDataJSON();
    expect(patch).toEqual({ dailyGoalMinutes: 90 });
    saved++;
    dailyGoalMinutes = patch.dailyGoalMinutes;
    return route.fulfill({ json: user().settings });
  });
  await page.route('**/api/v1/vocabulary/reviews/due?*', (route) =>
    route.fulfill({ json: { cards: [], totalDue: 0 } }),
  );
  await page.route('**/api/v1/progress/summary', (route) =>
    route.fulfill({
      json: {
        generatedAt: new Date().toISOString(),
        vocabulary: {
          total: 3,
          dueNow: 0,
          totalReviews: 0,
          byState: { new: 3, learning: 0, review: 0, relearning: 0 },
        },
        activity: [],
        textsCompleted: 9,
        exercisesDone: 20,
        streakDays: 1,
        activityUpdatedAt: null,
      },
    }),
  );
  const skills = ['reading', 'listening', 'speaking', 'writing', 'grammar', 'vocabulary'];
  const xp = [9, 12, 0, 5, 20, 3];
  await page.route('**/api/v1/progress/development', (route) =>
    route.fulfill({
      json: {
        generatedAt: new Date().toISOString(),
        day: '2026-10-30',
        overall: { xp: 49, level: 2, levelXp: 29, nextLevelXp: 40 },
        skills: skills.map((skill, index) => ({
          skill,
          xp: xp[index],
          level: xp[index]! >= 10 ? 2 : 1,
          levelXp: xp[index]! >= 10 ? xp[index]! - 10 : xp[index],
          nextLevelXp: xp[index]! >= 10 ? 20 : 10,
          todayXp: skill === 'reading' ? 1 : 0,
        })),
        plan: {
          dailyMinutes: dailyGoalMinutes,
          cefrLevel: 'B1',
          activities: (dailyGoalMinutes === 90 ? skills : skills.slice(0, 3)).map(
            (skill, index) => ({
              skill,
              title: `Practise ${skill}`,
              instruction: 'Complete an activity at your level.',
              href: `/${skill === 'reading' ? 'library' : skill === 'grammar' ? 'grammar' : skill === 'vocabulary' ? 'review' : skill}`,
              minutes: dailyGoalMinutes === 90 ? [20, 20, 10, 15, 15, 10][index] : 10,
              target: 2,
              completed: skill === 'reading' ? 1 : 0,
            }),
          ),
        },
      },
    }),
  );
  await page.clock.install();
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Your daily learning plan' })).toBeVisible();
  await expect(page.getByText('Player level 2', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('progressbar', { name: 'Reading level progress', exact: true }),
  ).toHaveAttribute('value', '9');
  await expect(page.getByText('English practice · 49 total XP', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '1 h 30 min', exact: true }).click();
  await expect(page.getByLabel('Daily study time (minutes)')).toHaveValue('90');
  await page.getByRole('button', { name: 'Build my plan' }).click();
  await expect(page.getByRole('heading', { name: /plan · 90 minutes/ })).toBeVisible();
  await expect(page.getByRole('timer', { name: 'Reading time remaining' })).toHaveText('20:00');
  await expect(page.getByRole('timer')).toHaveCount(6);
  await expect(page.getByRole('link', { name: 'Start practice', exact: true })).toHaveCount(6);
  expect(saved).toBe(1);
  await page.reload();
  await expect(page.getByLabel('Daily study time (minutes)')).toHaveValue('90');
  await expect(page.getByRole('heading', { name: /plan · 90 minutes/ })).toBeVisible();
  const grammar = page.getByRole('listitem').filter({ hasText: 'Practise grammar' });
  await grammar.getByRole('link', { name: 'Start practice', exact: true }).click();
  await expect(page).toHaveURL(/\/grammar$/);
  await expect(page.getByRole('button', { name: 'Pause timer', exact: true })).toBeVisible();
  await expect(page.getByRole('timer', { name: 'Grammar time remaining' })).not.toHaveText('15:00');
  await page.goto('/profile');
  const grammarTimer = page.getByRole('timer', { name: 'Grammar time remaining' });
  await expect(grammarTimer).toBeVisible();
  const paused = await grammarTimer.textContent();
  await page.clock.fastForward(30_000);
  await expect(grammarTimer).toHaveText(paused!);
  await expect(page.getByRole('timer', { name: 'Writing time remaining' })).toHaveText('15:00');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  for (const [path, name, time] of [
    ['/listening', 'Listening', '20:00'],
    ['/writing', 'Writing', '15:00'],
    ['/speaking', 'Speaking', '10:00'],
    ['/review', 'Vocabulary', '10:00'],
    ['/vocabulary/practice', 'Vocabulary', '10:00'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('timer', { name: `${name} time remaining` })).toHaveText(time);
  }
});
