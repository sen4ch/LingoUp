import { randomUUID } from 'node:crypto';
import { studyDay } from '@lingoup/learning-engine';
import { expect, test } from '@playwright/test';

test('continues the next task, preserves timer time and rechecks the plan before navigation', async ({
  page,
}) => {
  const password = 'continue-learning-e2e-password-12345';
  const registered = await page.request.post('/api/v1/auth/register', {
    headers: { origin: 'http://localhost:3000' },
    data: {
      email: `continue-${randomUUID()}@example.test`,
      password,
      displayName: 'Continuing learner',
    },
  });
  expect(registered.status()).toBe(201);
  try {
    expect(
      (
        await page.request.patch('/api/v1/me/settings', {
          headers: { origin: 'http://localhost:3000' },
          data: { dailyGoalMinutes: 90, targetLevel: 'A1' },
        })
      ).status(),
    ).toBe(200);
    await page.clock.install({ time: new Date(`${studyDay()}T10:00:00Z`) });
    await page.goto('/profile');
    const region = page.getByRole('region', { name: 'Continue learning', exact: true });
    const button = region.getByRole('button', { name: 'Continue learning', exact: true });
    await expect(button).toBeEnabled();
    await expect(region.getByText('My Morning Routine', { exact: true })).toBeVisible();
    await button.click();
    await expect(page).toHaveURL(/\/read\/a1-morning-routine$/);
    await expect(page.getByRole('button', { name: 'Pause timer', exact: true })).toBeVisible();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    await page.clock.fastForward(5000);
    await page.getByRole('button', { name: 'Pause timer', exact: true }).click();
    const timer = page.getByRole('timer', { name: 'Reading time remaining', exact: true });
    const saved = await timer.textContent();
    expect(saved).not.toBe('20:00');
    await page.clock.resume();
    await page.goto('/profile');
    await expect(
      page.getByRole('timer', { name: 'Reading time remaining', exact: true }),
    ).toHaveText(saved!);
    await button.click();
    await expect(page).toHaveURL(/\/read\/a1-morning-routine$/);
    await expect(page.getByRole('button', { name: 'Pause timer', exact: true })).toBeVisible();
    expect(await timer.textContent()).not.toBe('20:00');
    await page.getByRole('button', { name: 'Pause timer', exact: true }).click();
    await page.goto('/profile');
    await expect(region.getByText('My Morning Routine', { exact: true })).toBeVisible();
    const current = await (await page.request.get('/api/v1/learning/next-practice')).json();
    let finished = false;
    await page.route('**/api/v1/learning/next-practice', (route) =>
      route.fulfill({
        json: finished
          ? {
              ...current,
              state: 'complete',
              title: 'Today’s plan is complete',
              message: 'All activities are complete.',
              href: '/profile',
              activity: null,
            }
          : {
              ...current,
              title: 'Present simple',
              href: '/grammar/a1-present-simple#exercises',
              activity: {
                skill: 'grammar',
                title: 'Practise grammar',
                minutes: 15,
                completed: 0,
                target: 3,
              },
            },
      }),
    );
    // The preview is still Reading, but the click must use the freshly checked Grammar step.
    await button.click();
    await expect(page).toHaveURL(/\/grammar\/a1-present-simple#exercises$/);
    await expect(page.getByRole('button', { name: 'Pause timer', exact: true })).toBeVisible();
    await page.goto('/profile');
    await expect(button).toBeEnabled();
    finished = true;
    await button.click();
    await expect(
      region.getByRole('button', { name: 'Daily plan complete', exact: true }),
    ).toBeDisabled();
    await expect(page).toHaveURL(/\/profile$/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  } finally {
    expect(
      (
        await page.request.delete('/api/v1/me', {
          headers: { origin: 'http://localhost:3000' },
          data: { password },
        })
      ).status(),
    ).toBe(204);
  }
});
