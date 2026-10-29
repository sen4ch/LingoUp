import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

// 2×2 PNG: works without an image search provider (CI runs with IMAGE_SEARCH_PROVIDER=none).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWPQqDihUXGCAUIBACTuBaFpkxOkAAAAAElFTkSuQmCC',
  'base64',
);

test('a picture uploaded for a word shows up with the answer in reviews', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Name').fill('E2E');
  await page.getByLabel('Email').fill(`e2e-${randomUUID()}@example.test`);
  await page.getByLabel('Password').fill('e2e-password-12345');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/library/);
  const saved = await page.request.post('/api/v1/vocabulary/words', {
    headers: { origin: new URL(page.url()).origin },
    data: { term: 'flat', translation: 'apartment' },
  });
  expect(saved.ok()).toBe(true);

  await page.goto('/review');
  await page.getByRole('button', { name: 'Add picture' }).click();
  await expect(page.getByRole('textbox', { name: 'Picture search' })).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({
    name: 'flat.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(page.getByRole('button', { name: 'Change picture' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Show answer/ })).toBeVisible();
  await expect(page.getByRole('img', { name: 'flat' })).toHaveCount(0);
  await page.getByRole('button', { name: /Show answer/ }).click();
  await expect(page.getByRole('img', { name: 'flat' })).toBeVisible();
  await expect(page.getByText('Your picture')).toBeVisible();

  await page.goto('/vocabulary');
  const row = page.getByRole('listitem').filter({ hasText: 'flat' });
  await expect(row.locator('img[src*="/image?v="]')).toBeVisible();
});
