import { expect, test } from '@playwright/test';

// This suite claims an installation and changes its shared settings.
// Run ONLY against a disposable compose.easy.yml stack with the model fixture.
test.describe('disposable browser installation', () => {
  test.use({ actionTimeout: 15_000 });
  test.skip(process.env.E2E_INSTALLATION !== '1', 'Requires an explicitly disposable installation');
  test('initial setup, owner protection, model download, provider keys and runtime restart', async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    const password = 'QA installation password 123!';
    const initial = await request.get('/api/v1/setup/status');
    const state = await initial.json();
    await page.goto('/');
    if (!state.configured) await expect(page).toHaveURL(/\/setup/);
    else await page.goto('/setup');
    await expect(page.getByRole('heading', { name: 'Your LingoUp. Your way.' })).toBeVisible();
    await page.getByLabel('Installation password', { exact: true }).fill(password);
    if (!state.claimed) {
      await page.getByLabel('Confirm installation password').fill(password);
      await page.getByRole('button', { name: 'Save password & continue' }).click();
    } else await page.getByRole('button', { name: 'Unlock settings' }).click();
    await expect(page.getByRole('heading', { name: 'How would you like to learn?' })).toBeVisible();
    const unauthenticated = await request.get('/api/v1/setup/settings');
    expect(unauthenticated.status()).toBe(401);
    for (const path of ['test', 'pull']) {
      expect(
        (await request.post(`/api/v1/setup/${path}`, { data: { mode: 'basic' } })).status(),
      ).toBe(401);
    }
    expect(
      (await request.put('/api/v1/setup/settings', { data: { mode: 'basic' } })).status(),
    ).toBe(401);
    const foreignOrigin = await request.post('/api/v1/setup/login', {
      headers: { origin: 'https://other.example' },
      data: { password },
    });
    expect(foreignOrigin.status()).toBe(403);
    await page.getByRole('radio', { name: /Keep AI on your computer/ }).check();
    await page.getByLabel('Model name', { exact: true }).fill('qa-model');
    await page.getByRole('button', { name: 'Download this model' }).click();
    await expect(
      page.getByText('Model downloaded. Test the connection to continue.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Test connection' }).click();
    await expect(page.getByText('Connected. Your selected model is available.')).toBeVisible();
    await page.getByRole('button', { name: 'Review settings' }).click();
    await page.getByRole('button', { name: 'Finish setup' }).click();
    await expect(page.getByRole('heading', { name: 'You’re ready to grow.' })).toBeVisible({
      timeout: 90_000,
    });
    await page.reload();
    await expect(page.getByLabel('Model name', { exact: true })).toHaveValue('qa-model');
    await page.getByRole('radio', { name: /Connect a model server/ }).check();
    await page.getByLabel('API base address').fill('http://ollama:11434/v1');
    await page.getByLabel('Model name', { exact: true }).fill('qa-model');
    await page.getByLabel('API key', { exact: true }).fill('qa-test-key');
    await page.getByRole('checkbox', { name: /Allow this installation/ }).uncheck();
    await page.getByRole('button', { name: 'Test connection' }).click();
    await expect(page.locator('.installation').getByRole('alert')).toContainText(
      'Allow external AI processing',
    );
    await page.getByRole('checkbox', { name: /Allow this installation/ }).check();
    await page.getByRole('button', { name: 'Test connection' }).click();
    await expect(page.getByText('Connected. Your selected model is available.')).toBeVisible();
    await page.getByRole('button', { name: 'Review settings' }).click();
    await page.getByRole('button', { name: 'Finish setup' }).click();
    await expect(page.getByRole('heading', { name: 'You’re ready to grow.' })).toBeVisible({
      timeout: 90_000,
    });
    const safe = await page.request.get('/api/v1/setup/settings');
    const safeText = await safe.text();
    expect(safeText).not.toContain('qa-test-key');
    expect(JSON.parse(safeText).apiKeyConfigured).toBe(true);
    await page.getByRole('button', { name: 'Lock installation settings' }).click();
    await expect(page.getByRole('heading', { name: 'Unlock your settings.' })).toBeVisible();
    expect((await page.request.get('/api/v1/setup/settings')).status()).toBe(401);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Small steps/ })).toBeVisible();
  });

  test('core learning can be enabled without a model or an API key', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/setup');
    await page
      .getByLabel('Installation password', { exact: true })
      .fill('QA installation password 123!');
    await page.getByRole('button', { name: 'Unlock settings' }).click();
    await page.getByRole('radio', { name: /Start with the essentials/ }).check();
    await expect(page.getByLabel('API key', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Model name', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Review settings' }).click();
    await page.getByRole('button', { name: 'Finish setup' }).click();
    await expect(page.getByRole('heading', { name: 'You’re ready to grow.' })).toBeVisible({
      timeout: 90_000,
    });
    await page.getByRole('link', { name: 'Create a learner account' }).click();
    await expect(page).toHaveURL(/\/register/);
    await page.goto('/grammar');
    await expect(page.locator('.grammar-topic-grid > li')).toHaveCount(100);
    await page.goto('/setup');
    await page.getByRole('button', { name: 'Lock settings' }).click();
    await expect(page.getByRole('heading', { name: 'Unlock your settings.' })).toBeVisible();
  });
});
