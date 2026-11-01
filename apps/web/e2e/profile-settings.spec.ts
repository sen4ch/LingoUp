import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('profile sections preserve independent settings, recover failed saves and cancel account removal', async ({
  page,
}) => {
  const password = 'profile-settings-e2e-password-12345';
  const registration = await page.request.post('/api/v1/auth/register', {
    headers: { origin: 'http://localhost:3000' },
    data: {
      email: `profile-${randomUUID()}@example.test`,
      password,
      displayName: 'Profile learner',
    },
  });
  expect(registration.status()).toBe(201);
  try {
    await page.goto('/profile');
    await expect(page.getByRole('button', { name: 'Overview', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Learning plan', exact: true }).click();
    await page.getByLabel('Daily study time (minutes)').fill('90');
    await page.getByRole('button', { name: 'Build my plan', exact: true }).click();
    await expect(
      page.getByText('Your study time and plan are saved.', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel('Native language (for translations)', { exact: true }).selectOption('uk');
    await page.getByLabel('Target level', { exact: true }).selectOption('A2');
    let failed = false;
    await page.route('**/api/v1/me/settings', (route) => {
      expect(route.request().postDataJSON()).not.toHaveProperty('dailyGoalMinutes');
      if (!failed) {
        failed = true;
        return route.fulfill({
          status: 503,
          json: { error: { code: 'UNAVAILABLE', message: 'Please try again.' } },
        });
      }
      return route.fallback();
    });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Something went wrong' })).toBeVisible();
    await expect(
      page.getByLabel('Native language (for translations)', { exact: true }),
    ).toHaveValue('uk');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Settings saved', { exact: true })).toBeVisible();
    const saved = await (await page.request.get('/api/v1/me')).json();
    expect(saved.settings).toMatchObject({
      dailyGoalMinutes: 90,
      nativeLanguage: 'uk',
      targetLevel: 'A2',
      aiDataSharing: false,
    });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByLabel('Target level', { exact: true })).toHaveValue('A2');
    await expect(
      page.getByRole('link', { name: 'Download all my data (JSON)', exact: true }),
    ).toHaveAttribute('href', '/api/v1/me/export');
    let deletions = 0;
    page.on('request', (request) => {
      if (request.method() === 'DELETE' && new URL(request.url()).pathname === '/api/v1/me')
        deletions++;
    });
    await page.getByRole('button', { name: 'Delete account', exact: true }).click();
    await page
      .getByLabel('Enter your password to confirm', { exact: true })
      .fill('discard this input');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Delete account', exact: true }).click();
    await expect(page.getByLabel('Enter your password to confirm', { exact: true })).toHaveValue(
      '',
    );
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(deletions).toBe(0);
    await page.getByRole('button', { name: 'Edit daily study time', exact: true }).click();
    await expect(page.getByLabel('Daily study time (minutes)')).toHaveValue('90');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
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
