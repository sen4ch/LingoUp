import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('grammar reference: all levels, subject filtering and search are available publicly', async ({
  page,
}) => {
  const response = await page.request.get('/api/v1/grammar/topics');
  expect(response.ok()).toBe(true);
  const { items } = await response.json();
  expect(items).toHaveLength(100);
  expect(
    items.reduce((sum: number, item: { exerciseCount: number }) => sum + item.exerciseCount, 0),
  ).toBe(420);
  for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
    expect(
      items.filter((item: { level: string }) => item.level === level).length,
    ).toBeGreaterThanOrEqual(10);
  await page.goto('/grammar');
  await page.getByLabel('Grammar area', { exact: true }).selectOption('conditionals');
  await expect(
    page.getByRole('link', { name: 'Third conditional: alternative pasts', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'A, an and the: first steps', exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('Search grammar topics').fill('mixed');
  await expect(page.locator('.grammar-topic-grid > li')).toHaveCount(1);
  await page.getByLabel('Search grammar topics').fill('');
  await page.getByLabel('Grammar area', { exact: true }).selectOption('');
  await page.getByLabel('Search grammar topics').fill('glossary');
  await expect(
    page.getByRole('link', { name: 'Grammar terminology: a practical glossary', exact: true }),
  ).toBeVisible();
  await page.getByText('About this reference', { exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Cambridge: English Grammar Today', exact: true }),
  ).toHaveAttribute('href', 'https://dictionary.cambridge.org/grammar/british-grammar/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('grammar reference: extended references have working contents and examples', async ({
  page,
}) => {
  await page.goto('/grammar/a2-irregular-verbs-reference');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Irregular verbs: an extended reference',
      exact: true,
    }),
  ).toBeVisible();
  await page.getByText('On this page', { exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Lesson contents', exact: true })
    .getByRole('link', { name: 'Common irregular forms', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Common irregular forms', exact: true }),
  ).toBeInViewport();
  await expect(page.getByText('withdraw — withdrew — withdrawn', { exact: true })).toBeVisible();
  await page.goto('/grammar/b1-tense-aspect-reference');
  await expect(
    page.getByRole('heading', { name: 'Future-reference constructions', exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Future perfect continuous: I will have been working/)).toBeVisible();
  await expect(
    page.getByText('Log in to check your answers and save your progress.', { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('grammar reference: new exercises at every level grade correctly and save progress', async ({
  page,
}) => {
  const password = 'grammar-reference-e2e-password-12345';
  const registration = await page.request.post('/api/v1/auth/register', {
    headers: { origin: 'http://localhost:3000' },
    data: {
      email: `grammar-reference-${randomUUID()}@example.test`,
      password,
      displayName: 'Grammar learner',
    },
  });
  expect(registration.status()).toBe(201);
  try {
    for (const [slug, answer] of [
      ['a1-sentence-basics', 'It'],
      ['a2-past-continuous', 'was cooking'],
      ['b1-past-perfect', 'had'],
      ['b2-third-conditional', 'would have'],
      ['c1-cleft-sentences', 'who'],
      ['c2-negation-scope', 'some students did not pass'],
    ]) {
      const details = await (await page.request.get(`/api/v1/grammar/topics/${slug}`)).json();
      for (const exercise of details.exercises) {
        expect(exercise).not.toHaveProperty('answers');
        expect(exercise).not.toHaveProperty('correctAnswer');
      }
      await page.goto(`/grammar/${slug}`);
      const result = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/grammar/exercises/${details.exercises[0].id}/attempts`) &&
          response.request().method() === 'POST',
      );
      await page
        .getByRole('group', { name: 'Exercise 1', exact: true })
        .getByRole('button', { name: answer, exact: true })
        .click();
      expect((await (await result).json()).correct).toBe(true);
      const saved = await (await page.request.get(`/api/v1/grammar/topics/${slug}`)).json();
      expect(saved.progress).toMatchObject({ attempted: 1, correct: 1 });
    }
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
