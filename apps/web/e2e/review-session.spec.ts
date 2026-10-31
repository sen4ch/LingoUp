import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('review: empty state, keyboard recall, progress and completion', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Name').fill('Review learner');
  await page.getByLabel('Email').fill(`review-${randomUUID()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('review-password-12345');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/library/);
  await page.goto('/review');
  await expect(page.getByRole('heading', { name: 'No reviews due', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Grow my vocabulary' })).toHaveAttribute(
    'href',
    '/vocabulary',
  );
  for (const [term, translation] of [
    ['opportunity', 'a chance'],
    ['journey', 'a trip'],
  ]) {
    const result = await page.request.post('/api/v1/vocabulary/words', {
      headers: { origin: new URL(page.url()).origin },
      data: {
        term,
        translation,
        definition: 'A useful word to remember and use in everyday conversation.',
        contextSentence: `Every day brings a new ${term}.`,
      },
    });
    expect(result.ok()).toBe(true);
  }
  let submissions = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/vocabulary/reviews')) submissions++;
  });
  await page.reload();
  await expect(page.getByText('opportunity', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('progressbar', { name: 'Cards reviewed in this session' }),
  ).toHaveAttribute('value', '0');
  await page.keyboard.press('3');
  await expect(page.getByRole('button', { name: /Show answer/ })).toBeVisible();
  expect(submissions).toBe(0);
  await page.keyboard.press('Space');
  await expect(page.getByText('a chance', { exact: true })).toBeVisible();
  await expect(page.getByText('a chance', { exact: true })).toBeInViewport({ ratio: 1 });
  await expect
    .poll(() =>
      page.locator('.review-ratings').evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.top >= 0 && bounds.bottom <= innerHeight;
      }),
    )
    .toBe(true);
  await page.keyboard.press('3');
  await expect(page.getByText('journey', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('progressbar', { name: 'Cards reviewed in this session' }),
  ).toHaveAttribute('value', '1');
  await expect(page.getByText('a trip', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Show answer/ }).click();
  await page.getByRole('button', { name: /Easy/ }).click();
  await expect(
    page.getByRole('heading', { name: 'All done for today!', exact: true }),
  ).toBeVisible();
  expect(submissions).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
