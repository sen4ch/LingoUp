import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('real speech replays from memory and prefetch respects learner consent', async ({ page }) => {
  test.setTimeout(120_000);
  const password = 'Pronunciation-QA-password-123!';
  const registered = await page.request.post('/api/v1/auth/register', {
    data: {
      email: `speech-cache-${randomUUID()}@example.test`,
      password,
      displayName: 'Speech learner',
    },
  });
  expect(registered.status()).toBe(201);
  const audioRequests: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/v1/vocabulary/pronunciation')
      audioRequests.push(url.searchParams.get('text') ?? '');
  });
  await page.addInitScript(() => {
    const timings: number[] = [];
    Object.assign(window, { pronunciationTimings: timings });
    // Keep the native method so the wrapper can forward its media element as `this`.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const started = performance.now();
      this.addEventListener('playing', () => timings.push(performance.now() - started), {
        once: true,
      });
      return original.call(this);
    };
  });
  await page.route('**/api/v1/vocabulary/lookup', async (route) => {
    const input = route.request().postDataJSON();
    await route.fulfill({
      json: {
        term: input.term,
        normalizedTerm: input.term.toLowerCase(),
        glossary: null,
        ai: null,
        aiStatus: 'disabled',
        savedWordId: null,
      },
    });
  });
  const popup = page.getByRole('dialog', { name: 'Word translation', exact: true });
  async function selectWord(word: string) {
    await expect(page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible();
    await page.evaluate((text) => {
      const paragraph = document.createElement('p');
      paragraph.id = 'speech-speed-word';
      paragraph.textContent = text;
      paragraph.style.width = 'fit-content';
      document.querySelector('main')!.prepend(paragraph);
    }, word);
    await page.locator('#speech-speed-word').click({ timeout: 10_000 });
    await expect(popup).toBeVisible();
    return popup.getByRole('button', { name: `Pronounce “${word}”`, exact: true });
  }
  try {
    await page.goto('/grammar');
    const button = await selectWord('calamondin');
    await expect
      .poll(() =>
        page.request
          .get('/api/v1/vocabulary/pronunciation/settings')
          .then(async (response) => response.ok() && (await response.json()).enabled),
      )
      .toBe(true);
    // Preparing metadata is safe; unconsented external speech is generated only on a click.
    expect(audioRequests).toHaveLength(0);
    await button.click();
    await expect(button).not.toHaveAttribute('aria-busy', 'true', { timeout: 30_000 });
    expect(audioRequests).toContain('calamondin');
    const firstCount = audioRequests.length;
    await button.click();
    await expect(button).not.toHaveAttribute('aria-busy', 'true', { timeout: 15_000 });
    expect(audioRequests).toHaveLength(firstCount);
    const timings = await page.evaluate(
      () => (window as Window & { pronunciationTimings?: number[] }).pronunciationTimings,
    );
    expect(timings?.length).toBe(2);
    await test.info().attach('pronunciation-timings', {
      body: JSON.stringify({
        firstPlaybackMs: timings![0],
        repeatPlaybackMs: timings![1],
        repeatNetworkRequests: 0,
      }),
      contentType: 'application/json',
    });

    expect(
      (await page.request.patch('/api/v1/me/settings', { data: { aiDataSharing: true } })).ok(),
    ).toBe(true);
    await page.reload();
    const preparedButton = await selectWord('persimmon');
    await expect.poll(() => audioRequests.includes('persimmon')).toBe(true);
    await preparedButton.click();
    await expect(preparedButton).not.toHaveAttribute('aria-busy', 'true', { timeout: 30_000 });
    expect(errors).toEqual([]);
  } finally {
    expect((await page.request.delete('/api/v1/me', { data: { password } })).status()).toBe(204);
  }
});
