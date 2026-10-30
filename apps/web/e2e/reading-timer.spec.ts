import { expect, test } from '@playwright/test';

test('reading timer pauses, survives reload and text navigation, and finishes', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/read/a1-morning-routine');
  const timer = page.getByRole('timer', { name: 'Reading time remaining' });
  await expect(timer).toHaveText('10:00');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.getByRole('button', { name: 'Start timer', exact: true }).click();
  await page.clock.fastForward(12_000);
  await expect(timer).toHaveText('09:48');
  await page.getByRole('button', { name: 'Pause timer', exact: true }).click();
  await page.clock.fastForward(30_000);
  await expect(timer).toHaveText('09:48');
  await page.clock.resume();
  await page.reload();
  await expect(timer).toHaveText('09:48');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.getByRole('button', { name: 'Resume timer', exact: true }).click();

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(30_000);
  await expect(timer).toHaveText('09:48');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(2000);
  await expect(timer).toHaveText('09:46');
  await page.getByRole('button', { name: 'Pause timer', exact: true }).click();
  await page.clock.resume();
  await page.getByRole('link', { name: /Library/ }).click();
  await expect(page.getByRole('heading', { name: 'Text library' })).toBeVisible();
  await page.clock.fastForward(30_000);
  await page.goto('/read/a2-weekend-market');
  await expect(timer).toHaveText('09:46');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.getByRole('button', { name: 'Resume timer', exact: true }).click();
  await page.clock.fastForward(586_000);
  await expect(timer).toHaveText('00:00');
  await expect(page.getByRole('status')).toContainText('Reading session complete!');
  await page.getByRole('button', { name: 'Reset timer', exact: true }).click();
  await expect(timer).toHaveText('10:00');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
