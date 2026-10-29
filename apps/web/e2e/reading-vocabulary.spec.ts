import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('reading → word card → save → vocabulary → FSRS review → profile', async ({ page }) => {
  // Library is public.
  await page.goto('/library?level=A1');
  await expect(page.getByRole('heading', { name: 'Text library' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('body')).not.toContainText(/[А-Яа-яЁё]/);
  await expect(page.getByRole('link', { name: 'My Morning Routine' })).toBeVisible();

  // Register.
  await page.goto('/register');
  await page.getByLabel('Name').fill('E2E');
  await page.getByLabel('Email').fill(`e2e-${randomUUID()}@example.test`);
  await page.getByLabel('Password').fill('e2e-password-12345');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/library/);

  // Open a text and select a phrase with the keyboard: "wake up".
  await page.getByRole('link', { name: 'My Morning Routine' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'My Morning Routine' })).toBeVisible();
  const reader = page.getByRole('group', { name: /Reading text/ });
  await reader.focus();
  // The first arrow press places the cursor on the first word; ArrowDown then jumps to
  // paragraph 2, which starts with "I wake up at seven".
  await reader.press('ArrowDown');
  await reader.press('ArrowDown');
  await reader.press('ArrowRight');
  await reader.press('Shift+ArrowRight');
  await reader.press('Enter');

  const card = page.getByRole('complementary', { name: 'Word card' });
  await expect(card.getByRole('heading', { name: 'wake up' })).toBeVisible();
  await expect(card.getByText('stop sleeping')).toBeVisible();
  await card.getByRole('button', { name: 'Save to vocabulary' }).click();
  await expect(card.getByText('Saved to vocabulary')).toBeVisible();
  await reader.press('Escape');

  // Mouse selection of a word without a glossary entry falls back to the mock AI provider.
  await page.getByText('flat', { exact: true }).dblclick();
  await expect(card.getByRole('heading', { name: 'flat' })).toBeVisible();
  await expect(card.getByText('MockAIProvider', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Close' }).click();

  // Vocabulary survives navigation and reloads.
  await page.goto('/vocabulary');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'wake up' })).toBeVisible();

  // Review with FSRS.
  await page.getByRole('link', { name: 'Review', exact: true }).first().click();
  await expect(page.getByText('wake up', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Show answer/ }).click();
  await page.getByRole('button', { name: /Good/ }).click();
  await expect(page.getByText('All done for today!')).toBeVisible();

  // Progress in the profile.
  await page.goto('/profile');
  const stats = page.locator('dl');
  await expect(stats.getByText('Words in vocabulary').locator('..')).toContainText('1');
  await expect(stats.getByText('Reviews').locator('..')).toContainText('1');
});

test('anonymous visitors are asked to sign in when looking up words', async ({ page }) => {
  await page.goto('/read/a2-weekend-market');
  await page.getByText('crowded', { exact: true }).first().dblclick();
  const card = page.getByRole('complementary', { name: 'Word card' });
  await expect(card.getByText('Log in to see meanings and save words.')).toBeVisible();
});
