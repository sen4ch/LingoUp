import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test.use({
  channel: 'chromium',
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
});

test.describe('browser microphone policy', () => {
  test('allows native microphone access and local audio playback under the real response headers', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['microphone']);
    const response = await page.goto('/login');
    expect(response!.headers()['permissions-policy']).toContain('microphone=(self)');
    expect(response!.headers()['permissions-policy']).toContain('camera=()');
    expect(response!.headers()['content-security-policy']).toContain("media-src 'self' blob:");
    const device = await page.evaluate(async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = stream.getAudioTracks()[0]!;
      const state = track.readyState;
      stream.getTracks().forEach((item) => item.stop());
      return { state, released: track.readyState };
    });
    expect(device).toEqual({ state: 'live', released: 'ended' });
  });
});

test('voice call transcribes a turn, answers in English, pauses and releases the microphone', async ({
  page,
}) => {
  // UI audio tests use an isolated identity; API auth and the real teacher are tested separately.
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      json: {
        id: randomUUID(),
        email: 'speaking@example.test',
        displayName: 'Speaking E2E',
        createdAt: new Date().toISOString(),
        settings: {
          nativeLanguage: 'ru',
          targetLevel: 'B1',
          dailyGoalMinutes: 15,
          aiDataSharing: false,
        },
      },
    }),
  );
  await page.route('**/api/v1/vocabulary/reviews/due?*', (route) =>
    route.fulfill({ json: { cards: [], totalDue: 0 } }),
  );
  await page.route('**/api/v1/learning/speaking/turn', (route) => {
    const input = route.request().postDataJSON();
    if (input.messages.length)
      expect(input.messages.at(-1).content).toBe('Я хочу учить английский');
    return route.fulfill({
      json: {
        reply: 'Hello! I am your English teacher. What would you like to learn today?',
        isMock: true,
      },
    });
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: class {
        constructor(public text: string) {}
      },
    });
    const testing = window as typeof window & { testStream: MediaStream; testTone: OscillatorNode };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => {
        const context = new AudioContext();
        await context.resume();
        const destination = context.createMediaStreamDestination();
        const tone = context.createOscillator();
        tone.connect(destination);
        tone.start();
        testing.testStream = destination.stream;
        testing.testTone = tone;
        return destination.stream;
      },
    });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [{ lang: 'en-US', localService: true, default: true }],
        speak: (speech: SpeechSynthesisUtterance) =>
          setTimeout(() => speech.onend?.(new Event('end') as SpeechSynthesisEvent), 30),
        cancel: () => undefined,
      },
    });
  });
  await page.route('**/api/v1/learning/speaking/transcribe', async (route) => {
    const audio = route.request().postDataBuffer()!;
    expect(audio.subarray(0, 4).toString()).toBe('RIFF');
    expect(audio.length).toBeLessThan(1_000_000);
    await route.fulfill({ json: { text: 'Я хочу учить английский' } });
  });
  await page.goto('/speaking');
  await expect(page.getByRole('link', { name: 'Speaking', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Call the teacher' }).click();
  await expect(page.locator('p[role=status]')).toHaveText('Listening to you');
  await page.getByRole('button', { name: 'Mute microphone' }).click();
  await expect(page.locator('p[role=status]')).toHaveText('Microphone muted');
  expect(await page.evaluate(() => (window as any).testStream.getAudioTracks()[0].enabled)).toBe(
    false,
  );
  await page.getByRole('button', { name: 'Resume conversation' }).click();
  await expect(page.locator('p[role=status]')).toHaveText('Listening to you');
  // Stop the source after enough PCM frames to let silence detection submit automatically.
  const resumedAt = await page.evaluate(() => Number((window as any).testTone.context.currentTime));
  await expect
    .poll(() => page.evaluate(() => (window as any).testTone.context.currentTime))
    .toBeGreaterThan(resumedAt + 0.5);
  await page.evaluate(() => (window as any).testTone.stop());
  await expect(page.getByText('Я хочу учить английский', { exact: true })).toBeVisible();
  await expect(page.locator('p[role=status]')).toHaveText('Listening to you');
  await expect(page.locator('p[lang=en]')).toHaveCount(2);
  await page.getByRole('button', { name: 'End call' }).click();
  await expect(page.getByRole('button', { name: 'Call the teacher' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).testStream.getAudioTracks()[0].readyState)).toBe(
    'ended',
  );
});
