import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('checked mistakes persist, can be practised, filtered, understood and reopened', async ({
  page,
}) => {
  const password = 'journal-e2e-password-12345';
  const registered = await page.request.post('/api/v1/auth/register', {
    headers: { origin: 'http://localhost:3000' },
    data: {
      email: `journal-${randomUUID()}@example.test`,
      password,
      displayName: 'Journal learner',
    },
  });
  expect(registered.status()).toBe(201);
  try {
    await page.goto('/grammar/a1-present-simple');
    await page
      .getByRole('group', { name: 'Exercise 1', exact: true })
      .getByRole('button', { name: 'drink', exact: true })
      .click();
    await page.getByRole('link', { name: 'Saved to your mistake journal' }).click();
    await expect(page.getByRole('heading', { name: 'Mistake journal', exact: true })).toBeVisible();
    await expect(page.getByText('1 to review · 0 understood', { exact: true })).toBeVisible();
    const card = page
      .locator('main li')
      .filter({ has: page.getByRole('button', { name: 'Mark as understood', exact: true }) });
    await expect(card.getByText('drink', { exact: true })).toBeVisible();
    await expect(card.getByText('drinks', { exact: true })).toBeVisible();
    await page.getByLabel('Hide corrections to practise first').check();
    await expect(card.getByText('drinks', { exact: true })).toBeHidden();
    await card.getByText('Correction and rule', { exact: true }).click();
    await expect(card.getByText('drinks', { exact: true })).toBeVisible();
    await page.getByLabel('Source', { exact: true }).selectOption('writing');
    await expect(page.getByText('No matching entries', { exact: true })).toBeVisible();
    await page.getByLabel('Source', { exact: true }).selectOption('grammar');
    await card.getByRole('button', { name: 'Mark as understood', exact: true }).click();
    await expect(page.getByText('0 to review · 1 understood', { exact: true })).toBeVisible();
    await page.getByLabel('Status', { exact: true }).selectOption('resolved');
    await page.reload();
    // Filter state resets on reload; the understood status itself is saved on the server.
    await page.getByLabel('Status', { exact: true }).selectOption('resolved');
    await page.getByRole('button', { name: 'Review again', exact: true }).click();
    await expect(page.getByText('1 to review · 0 understood', { exact: true })).toBeVisible();
    await page.getByLabel('Status', { exact: true }).selectOption('open');
    await expect(page.getByText('drink', { exact: true })).toBeVisible();
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
