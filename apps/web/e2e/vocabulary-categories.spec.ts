import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('categories: automatic grouping, full-list filtering and manual changes', async ({
  page,
  request,
}) => {
  await page.goto('/register');
  await page.getByLabel('Name').fill('Category learner');
  await page.getByLabel('Email').fill(`categories-${randomUUID()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('category-password-12345');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/library/);
  const origin = new URL(page.url()).origin;
  const headers = { origin };
  const saved = await page.request.post('/api/v1/vocabulary/words', {
    headers,
    data: { term: 'dressed' },
  });
  expect(saved.ok()).toBe(true);
  const dressed = await saved.json();
  expect(dressed.category).toBe('clothes');
  const food = await page.request.post('/api/v1/vocabulary/words', {
    headers,
    data: { term: 'apple' },
  });
  expect((await food.json()).category).toBe('food');
  // Push the matching words beyond the first page: filtering must happen on the server.
  for (let index = 0; index < 22; index++) {
    const result = await page.request.post('/api/v1/vocabulary/words', {
      headers,
      data: { term: `uncategorised${index}` },
    });
    expect(result.ok()).toBe(true);
  }
  const counts = await (await page.request.get('/api/v1/vocabulary/categories')).json();
  expect(counts.total).toBe(24);
  expect(counts.items).toContainEqual({ category: 'clothes', count: 1 });
  expect(counts.items).toContainEqual({ category: 'other', count: 22 });
  const invalid = await page.request.get('/api/v1/vocabulary/words?category=not-a-category');
  expect(invalid.status()).toBe(400);
  const firstPage = await (
    await page.request.get('/api/v1/vocabulary/words?category=other&limit=20')
  ).json();
  expect(firstPage.items).toHaveLength(20);
  const secondPage = await (
    await page.request.get(
      `/api/v1/vocabulary/words?category=other&limit=20&cursor=${firstPage.nextCursor}`,
    )
  ).json();
  expect(secondPage.items).toHaveLength(2);
  expect(new Set([...firstPage.items, ...secondPage.items].map((word) => word.id)).size).toBe(22);

  // Category counts never include another account's words.
  const otherUser = await request.post('/api/v1/auth/register', {
    headers,
    data: {
      displayName: 'Other learner',
      email: `other-categories-${randomUUID()}@example.test`,
      password: 'category-password-12345',
    },
  });
  expect(otherUser.ok()).toBe(true);
  const otherCounts = await (await request.get('/api/v1/vocabulary/categories')).json();
  expect(otherCounts.total).toBe(0);

  await page.goto('/vocabulary');
  const categories = page.getByRole('navigation', { name: 'Vocabulary categories' });
  await categories.getByRole('button', { name: /^Clothes/ }).click();
  await expect(page.getByRole('heading', { name: 'dressed', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'apple', exact: true })).toHaveCount(0);
  await page.getByLabel('Search vocabulary').fill('apple');
  await expect(page.getByText('No words found', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('button', { name: 'Edit: dressed', exact: true }).click();
  const edit = page.getByRole('form', { name: 'Edit word', exact: true });
  await expect(edit.getByLabel('Category', { exact: true })).toHaveValue('clothes');
  await edit.getByLabel('Category', { exact: true }).selectOption('work');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit).toHaveCount(0);
  await page.reload();
  await categories.getByRole('button', { name: /^Work/ }).click();
  await expect(page.getByRole('heading', { name: 'dressed', exact: true })).toBeVisible();
  const updated = await (await page.request.get(`/api/v1/vocabulary/words/${dressed.id}`)).json();
  expect(updated.category).toBe('work');
  expect(updated.card.id).toBe(dressed.card.id);

  await page.getByRole('button', { name: '+ Add word', exact: true }).click();
  const add = page.getByRole('form', { name: 'Add word', exact: true });
  await expect(add.getByLabel('Category', { exact: true })).toHaveValue('work');
  await add.getByLabel('English word or phrase').fill('banana');
  await add.getByLabel('Category', { exact: true }).selectOption('auto');
  await add.getByRole('button', { name: 'Add word', exact: true }).click();
  await expect(add).toHaveCount(0);
  await categories.getByRole('button', { name: /^Food & drink/ }).click();
  await expect(page.getByRole('heading', { name: 'banana', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'apple', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'dressed', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
