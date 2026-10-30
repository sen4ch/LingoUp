import { randomUUID } from 'node:crypto';
import { studyDay } from '@lingoup/learning-engine';
import { expect, test } from '@playwright/test';

test('weekly summary records focused timer time, persists it and switches weeks without granting timer XP', async ({
  page,
}) => {
  const password = 'weekly-e2e-password-12345';
  const registered = await page.request.post('/api/v1/auth/register', {
    headers: { origin: 'http://localhost:3000' },
    data: { email: `weekly-${randomUUID()}@example.test`, password, displayName: 'Weekly learner' },
  });
  expect(registered.status()).toBe(201);
  try {
    await page.clock.install({ time: new Date(`${studyDay()}T10:00:00Z`) });
    await page.goto('/read/a1-morning-routine');
    await expect(page.getByRole('button', { name: 'Start timer', exact: true })).toBeVisible();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    await page.getByRole('button', { name: 'Start timer', exact: true }).click();
    await page.clock.fastForward(65_000);
    await page.clock.resume();
    await page.goto('/profile');
    const report = page.getByRole('region', { name: 'Weekly summary', exact: true });
    const time = report.getByText('Timer-recorded time', { exact: true }).locator('..');
    await expect(time).toContainText('1 min');
    await expect(report.getByText('Practice XP', { exact: true }).locator('..')).toContainText(
      '+0',
    );
    await expect(report.getByText('Active days', { exact: true }).locator('..')).toContainText(
      '1/7',
    );
    const saved = await page.request.get('/api/v1/progress/weekly');
    const before = await saved.json();
    expect(before.totals.seconds).toBeGreaterThanOrEqual(65);
    expect(before.totals.seconds).toBeLessThan(75);
    expect(before.totals.xp).toBe(0);
    await page.reload();
    await expect(time).toContainText('1 min');
    const after = await page.request.get('/api/v1/progress/weekly');
    expect((await after.json()).totals.seconds).toBe(before.totals.seconds);
    await report.getByRole('button', { name: 'Previous week', exact: true }).click();
    await expect(report.getByText(/Last week/)).toBeVisible();
    await expect(time).toContainText('0s');
    await report.getByRole('button', { name: 'Next week', exact: true }).click();
    await expect(time).toContainText('1 min');
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
