import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('reading comprehension grades answers, completes reading once and restores results and a retelling draft', async ({
  page,
}) => {
  const password = 'reading-check-e2e-password-12345';
  await page.goto('/read/a1-morning-routine');
  await expect(
    page.getByText('to check your understanding and save your result.', { exact: false }),
  ).toBeVisible();
  const registered = await page.request.post('/api/v1/auth/register', {
    headers: { origin: 'http://localhost:3000' },
    data: {
      email: `reading-check-${randomUUID()}@example.test`,
      password,
      displayName: 'Reading learner',
    },
  });
  expect(registered.status()).toBe(201);
  try {
    await page.goto('/read/a1-morning-routine');
    const section = page.getByRole('region', { name: 'Check your understanding', exact: true });
    await section.getByRole('button', { name: 'Start comprehension check', exact: true }).click();
    await expect(
      section.getByRole('button', { name: 'Check answers', exact: true }),
    ).toBeDisabled();
    for (const answer of ['In a hospital', 'Coffee', 'At seven'])
      await section.getByRole('radio', { name: answer, exact: true }).check();
    await section.getByRole('button', { name: 'Check answers', exact: true }).click();
    await expect(section.getByText('0/3 correct · 0%', { exact: true })).toBeVisible();
    await expect(section.getByText('From the text', { exact: true })).toHaveCount(3);
    await section.getByRole('button', { name: 'Try again', exact: true }).click();
    for (const answer of ['In a bookshop', 'Tea', 'At eight'])
      await section.getByRole('radio', { name: answer, exact: true }).check();
    await section.getByRole('button', { name: 'Check answers', exact: true }).click();
    await expect(section.getByText('3/3 correct · 100%', { exact: true })).toBeVisible();
    await expect(
      section.getByText('You passed! This text is marked as read.', { exact: true }),
    ).toBeVisible();
    await section.getByText('Retell the text in your own words', { exact: true }).click();
    const draft = 'Tom describes his morning before going to work at a bookshop.';
    await section.getByLabel('Your retelling', { exact: true }).fill(draft);
    await page.reload();
    await expect(section.getByText('3/3 correct · 100%', { exact: true })).toBeVisible();
    await section.getByText('Retell the text in your own words', { exact: true }).click();
    await expect(section.getByLabel('Your retelling', { exact: true })).toHaveValue(draft);
    const completions = await page.request.get('/api/v1/learning/reading/completions');
    expect(
      (await completions.json()).items.filter(
        (item: { textSlug: string }) => item.textSlug === 'a1-morning-routine',
      ),
    ).toHaveLength(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  } finally {
    const removed = await page.request.delete('/api/v1/me', {
      headers: { origin: 'http://localhost:3000' },
      data: { password },
    });
    expect(removed.status()).toBe(204);
  }
});
