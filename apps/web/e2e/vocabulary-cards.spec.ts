import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('manual vocabulary and saved translation-first cards', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Name').fill('Vocabulary learner');
  await page.getByLabel('Email').fill(`cards-${randomUUID()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('test-password-12345');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/library/);
  await page.goto('/vocabulary');

  await page.getByRole('button', { name: '+ Add word', exact: true }).click();
  const add = page.getByRole('form', { name: 'Add word', exact: true });
  await expect(add.getByLabel('English word or phrase')).toBeFocused();
  await add.getByLabel('English word or phrase').fill('opportunity');
  await add.getByLabel('Translation', { exact: true }).fill('можливість');
  await add.getByLabel('Definition (optional)').fill('A chance to do something.');
  await add.getByLabel('Example sentence (optional)').fill('This is an opportunity to learn.');
  await add.getByRole('button', { name: 'Add word', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'opportunity', exact: true })).toBeVisible();

  // Duplicates retain the draft and report a useful error.
  await page.getByRole('button', { name: '+ Add word', exact: true }).click();
  await add.getByLabel('English word or phrase').fill('opportunity');
  await add.getByRole('button', { name: 'Add word', exact: true }).click();
  await expect(add.getByRole('alert')).toContainText('already in your vocabulary');
  await add.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Edit: opportunity', exact: true }).click();
  const edit = page.getByRole('form', { name: 'Edit word', exact: true });
  await edit.getByLabel('Translation', { exact: true }).fill('шанс');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit).toHaveCount(0);
  await expect(page.getByText('шанс', { exact: true })).toBeVisible();

  // A word without a translation must still be reviewable in reverse mode.
  await page.getByRole('button', { name: '+ Add word', exact: true }).click();
  await add.getByLabel('English word or phrase').fill('journey');
  await add.getByRole('button', { name: 'Add word', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'journey', exact: true })).toBeVisible();

  await page.getByText('Card display settings', { exact: true }).click();
  await page.getByLabel('Show first', { exact: true }).selectOption('translation');
  await page.getByLabel('Show definition after revealing').uncheck();
  await page.getByRole('button', { name: 'Save card settings' }).click();
  await expect(page.locator('#card-display').getByRole('status')).toContainText(
    'Card settings saved.',
  );
  await page.reload();
  await page.getByText('Card display settings', { exact: true }).click();
  await expect(page.getByLabel('Show first', { exact: true })).toHaveValue('translation');
  await expect(page.getByLabel('Show definition after revealing')).not.toBeChecked();

  await page.goto('/review');
  await expect(page.getByText('шанс', { exact: true })).toBeVisible();
  await expect(page.getByText('opportunity', { exact: true })).toHaveCount(0);
  await expect(page.getByText('“This is an opportunity to learn.”', { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: 'Pronounce “opportunity”' })).toHaveCount(0);
  await page.getByRole('button', { name: /Show answer/ }).click();
  await expect(page.getByText('opportunity', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pronounce “opportunity”' })).toBeVisible();
  await expect(page.getByText('“This is an opportunity to learn.”', { exact: true })).toBeVisible();
  await expect(page.getByText('A chance to do something.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Good/ }).click();
  await expect(page.getByText('journey', { exact: true })).toBeVisible();
  await expect(page.getByText('No translation saved. Showing English first.')).toBeVisible();

  // The settings link opens the editor, including its collapsed section.
  await page.getByRole('link', { name: 'Card display settings' }).click();
  await expect(page.getByLabel('Show first', { exact: true })).toBeVisible();
  await page.getByLabel('Show first', { exact: true }).selectOption('term');
  await page.getByRole('button', { name: 'Save card settings' }).click();
  await expect(page.locator('#card-display').getByRole('status')).toContainText(
    'Card settings saved.',
  );
  await page.goto('/review');
  await expect(page.getByText('journey', { exact: true })).toBeVisible();
  await expect(page.getByText('No translation saved. Showing English first.')).toHaveCount(0);

  await page.goto('/vocabulary');
  await page.getByRole('button', { name: 'Grid view' }).click();
  await expect(page.locator('.vocabulary-words-grid')).toBeVisible();
  await page.getByLabel('Search vocabulary').fill('journey');
  await expect(page.getByRole('heading', { name: 'journey', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'opportunity', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '+ Add word', exact: true }).click();
  await expect(add.getByLabel('English word or phrase')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '+ Add word', exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
