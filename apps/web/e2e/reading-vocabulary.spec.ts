import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('reading → word card → save → vocabulary → FSRS review → profile', async ({ page }) => {
  // Library is public.
  await page.goto('/library?level=A1');
  await expect(page.getByRole('heading', { name: 'Библиотека текстов' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My Morning Routine' })).toBeVisible();

  // Register.
  await page.goto('/register');
  await page.getByLabel('Имя').fill('E2E');
  await page.getByLabel('Email').fill(`e2e-${randomUUID()}@example.test`);
  await page.getByLabel('Пароль').fill('e2e-password-12345');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(page).toHaveURL(/\/library/);

  // Open a text and select a phrase with the keyboard: "wake up".
  await page.getByRole('link', { name: 'My Morning Routine' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'My Morning Routine' })).toBeVisible();
  const reader = page.getByRole('group', { name: /Текст для чтения/ });
  await reader.focus();
  // The first arrow press places the cursor on the first word; ArrowDown then jumps to
  // paragraph 2, which starts with "I wake up at seven".
  await reader.press('ArrowDown');
  await reader.press('ArrowDown');
  await reader.press('ArrowRight');
  await reader.press('Shift+ArrowRight');
  await reader.press('Enter');

  const card = page.getByRole('complementary', { name: 'Карточка слова' });
  await expect(card.getByRole('heading', { name: 'wake up' })).toBeVisible();
  await expect(card.getByText('просыпаться')).toBeVisible();
  await card.getByRole('button', { name: 'Сохранить в словарь' }).click();
  await expect(card.getByText('В словаре')).toBeVisible();
  await reader.press('Escape');

  // Mouse selection of a word without a glossary entry falls back to the mock AI provider.
  await page.getByText('flat', { exact: true }).dblclick();
  await expect(card.getByRole('heading', { name: 'flat' })).toBeVisible();
  await expect(card.getByText('MockAIProvider', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Закрыть' }).click();

  // Vocabulary survives navigation and reloads.
  await page.goto('/vocabulary');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'wake up' })).toBeVisible();

  // Review with FSRS.
  await page.getByRole('link', { name: 'Повторение', exact: true }).first().click();
  await expect(page.getByText('wake up', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Показать ответ/ }).click();
  await page.getByRole('button', { name: /Хорошо/ }).click();
  await expect(page.getByText('На сегодня всё!')).toBeVisible();

  // Progress in the profile.
  await page.goto('/profile');
  const stats = page.locator('dl');
  await expect(stats.getByText('Слов в словаре').locator('..')).toContainText('1');
  await expect(stats.getByText('Повторений').locator('..')).toContainText('1');
});

test('anonymous visitors are asked to sign in when looking up words', async ({ page }) => {
  await page.goto('/read/a2-weekend-market');
  await page.getByText('crowded', { exact: true }).first().dblclick();
  const card = page.getByRole('complementary', { name: 'Карточка слова' });
  await expect(card.getByText('Войдите, чтобы смотреть значения и сохранять слова.')).toBeVisible();
});
