import { expect, test } from '@playwright/test';

test.describe('disposable installation options', () => {
  test.skip(
    process.env.E2E_INSTALLATION !== '1',
    'Requires a disposable Docker stack and the model fixture',
  );
  test.use({ actionTimeout: 15_000 });
  test('hardware advice, provider presets, real local voice preview and persistence', async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    expect((await request.get('/api/v1/setup/hardware')).status()).toBe(401);
    expect(
      (
        await request.post('/api/v1/setup/voice-preview', { data: { speech: 'piper-high' } })
      ).status(),
    ).toBe(401);
    const status = await request.get('/api/v1/setup/status').then((response) => response.json());
    await page.goto('/setup');
    await page
      .getByLabel('Installation password', { exact: true })
      .fill('QA installation password 123!');
    if (!status.claimed) {
      await page.getByLabel('Confirm installation password').fill('QA installation password 123!');
      await page.getByRole('button', { name: 'Save password & continue' }).click();
    } else await page.getByRole('button', { name: 'Unlock settings' }).click();
    await expect(page.getByRole('heading', { name: 'How would you like to learn?' })).toBeVisible();
    const hardware = await page.request
      .get('/api/v1/setup/hardware')
      .then((response) => response.json());
    expect(hardware.scope).toBe('application-server');
    expect(hardware.memoryGiB).toBeGreaterThan(0);
    expect(hardware.cpuCores).toBeGreaterThan(0);
    await page.locator('.installation-hardware > summary').click();
    await page.locator('.installation-hardware details > summary').first().click();
    await page
      .getByRole('checkbox', { name: 'Use specifications I enter for the model server' })
      .check();
    await page.getByLabel('Model server RAM (GiB)').fill('8');
    await page.getByLabel('Model server CPU cores').fill('2');
    await page.getByLabel('GPU VRAM (GiB)').fill('0');
    await expect(page.locator('.installation-recommendation strong')).toContainText('API provider');
    await page.getByLabel('Model server RAM (GiB)').fill('64');
    await page.getByLabel('Model server CPU cores').fill('16');
    await page.getByLabel('GPU VRAM (GiB)').fill('24');
    await expect(page.locator('.installation-recommendation strong')).toContainText('qwen3:14b');
    await page.getByRole('button', { name: 'Use this starting point' }).click();
    await expect(page.getByLabel('Model name', { exact: true })).toHaveValue('qwen3:14b');
    await page.getByText('Compare local model requirements', { exact: true }).click();
    await expect(page.locator('.installation-model-comparison article')).toHaveCount(3);
    await expect(page.locator('.installation-fit.good')).toHaveCount(3);
    await page.locator('.installation-hardware > summary').click();
    await page
      .locator('details.installation-options > summary')
      .filter({ hasText: 'Voice quality & preview' })
      .click();
    await page.getByRole('radio', { name: /Larger neural voice/ }).check();
    const preview = page.waitForResponse(
      (response) =>
        response.url().includes('/setup/voice-preview') && response.request().method() === 'POST',
      { timeout: 140_000 },
    );
    await page.getByRole('button', { name: 'Preview this voice' }).click();
    const audioResponse = await preview;
    expect(audioResponse.status()).toBe(200);
    expect(audioResponse.headers()['content-type']).toContain('audio/mpeg');
    const player = page.getByLabel('Selected voice preview');
    await expect(player).toBeVisible();
    await expect
      .poll(async () => player.evaluate((element) => (element as HTMLAudioElement).duration > 1))
      .toBe(true);
    await page.getByRole('radio', { name: /Connect a model server/ }).check();
    for (const [provider, endpoint, model] of [
      ['openai', 'https://api.openai.com/v1', 'gpt-4.1-mini'],
      ['deepseek', 'https://api.deepseek.com', 'deepseek-flash'],
      ['anthropic', 'https://api.anthropic.com/v1', 'claude-haiku-5-5'],
    ]) {
      await page.getByLabel('AI provider').selectOption(provider!);
      await expect(page.getByLabel('API base address')).toHaveValue(endpoint!);
      await expect(page.getByLabel('Model name', { exact: true })).toHaveValue(model!);
    }
    await page.getByLabel('API base address').fill('http://ollama:11434/v1');
    await page.getByLabel('Model name', { exact: true }).fill('qa-model');
    await page.getByLabel('API key', { exact: true }).fill('qa-test-key');
    await page.getByLabel('Claude workspace ID (optional)').fill('default');
    await page.getByRole('checkbox', { name: /Allow this installation/ }).check();
    await page.getByRole('button', { name: 'Test connection' }).click();
    await expect(page.getByText('Connected. Your selected model is available.')).toBeVisible();
    await expect(page.getByLabel('Models available with this connection')).toBeVisible();
    await page.getByRole('button', { name: 'Review settings' }).click();
    await expect(page.locator('.installation-summary')).toContainText('Local · enhanced');
    await page.getByRole('button', { name: 'Finish setup' }).click();
    await expect(page.getByRole('heading', { name: 'You’re ready to grow.' })).toBeVisible({
      timeout: 90_000,
    });
    const safe = await page.request
      .get('/api/v1/setup/settings')
      .then((response) => response.json());
    expect(safe).toMatchObject({
      apiProvider: 'anthropic',
      speech: 'piper-high',
      apiKeyConfigured: true,
      workspaceId: 'default',
    });
    expect(JSON.stringify(safe)).not.toContain('qa-test-key');
    await page.getByRole('button', { name: 'Lock installation settings' }).click();
  });
});
