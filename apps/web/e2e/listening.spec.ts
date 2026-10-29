import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('listening has exactly two sections, grades questions and opens publisher videos', async ({
  page,
}) => {
  const id = randomUUID();
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      json: {
        id: randomUUID(),
        email: 'listener@example.test',
        displayName: 'Listener',
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
  await page.route('**/api/v1/learning/listening', async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      level: 'A1',
      topic: 'A library',
    });
    await route.fulfill({
      json: {
        id,
        title: 'A day at the library',
        level: 'A1',
        durationSeconds: 240,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        isMock: false,
        questions: Array.from({ length: 5 }, (_, index) => ({
          question: `Where does Nora work in part ${index + 1}?`,
          options: ['At the library', 'At a station', 'At a museum', 'At an office'],
        })),
      },
    });
  });
  await page.route('**/api/v1/learning/listening/*/audio', (route) => {
    const wave = Buffer.alloc(44 + 32000);
    wave.write('RIFF');
    wave.writeUInt32LE(wave.length - 8, 4);
    wave.write('WAVEfmt ', 8);
    wave.writeUInt32LE(16, 16);
    wave.writeUInt16LE(1, 20);
    wave.writeUInt16LE(1, 22);
    wave.writeUInt32LE(16000, 24);
    wave.writeUInt32LE(32000, 28);
    wave.writeUInt16LE(2, 32);
    wave.writeUInt16LE(16, 34);
    wave.write('data', 36);
    wave.writeUInt32LE(32000, 40);
    return route.fulfill({ contentType: 'audio/wav', body: wave });
  });
  await page.route('**/api/v1/learning/listening/*/answers', (route) => {
    expect(route.request().postDataJSON()).toEqual({ answers: [0, 0, 0, 0, 0] });
    return route.fulfill({
      json: {
        correct: 5,
        total: 5,
        transcript: 'Nora works at the library in a small town.',
        results: Array.from({ length: 5 }, () => ({
          correct: true,
          answerIndex: 0,
          explanation: 'The narrator describes her workplace.',
          evidence: 'Nora works at the library',
        })),
      },
    });
  });
  await page.route('https://www.youtube-nocookie.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html><body>Publisher player</body></html>' }),
  );
  await page.goto('/listening');
  await expect(page.getByRole('tab')).toHaveCount(2);
  const generate = page.getByRole('button', { name: 'Create 3–5 minute audio' });
  await expect(generate).toBeEnabled();
  await page.getByRole('combobox', { name: 'English level' }).selectOption('A1');
  await page.getByRole('textbox', { name: 'Topic (optional)' }).fill('A library');
  await generate.click();
  await expect(page.getByRole('heading', { name: 'A day at the library' })).toBeVisible();
  await expect(page.getByLabel('Listening audio')).toHaveAttribute(
    'src',
    `/api/v1/learning/listening/${id}/audio`,
  );
  await expect(page.getByText('A1 · 4:00', { exact: true })).toBeVisible();
  await expect(page.getByText('Show transcript')).toHaveCount(0);
  const check = page.getByRole('button', { name: 'Check answers' });
  await expect(check).toBeDisabled();
  for (let index = 1; index <= 5; index++)
    await page
      .getByRole('group', { name: `Question ${index}`, exact: true })
      .getByRole('button')
      .first()
      .click();
  await check.click();
  await expect(page.getByRole('status').filter({ hasText: 'Score: 5 of 5' })).toBeVisible();
  await page.getByText('Show transcript', { exact: true }).click();
  await expect(
    page.getByText('Nora works at the library in a small town.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Films and series' }).click();
  await page
    .getByRole('textbox', { name: 'YouTube video or playlist link' })
    .fill('https://youtu.be/eRsGyueVLvQ');
  await page.getByRole('button', { name: 'Open video' }).click();
  await expect(page.locator('iframe')).toHaveAttribute(
    'src',
    /youtube-nocookie\.com\/embed\/eRsGyueVLvQ/,
  );
  await expect(page.frameLocator('iframe').getByText('Publisher player')).toBeVisible();
  await page.getByLabel('Open your own video', { exact: true }).setInputFiles({
    name: 'episode.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('test video'),
  });
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('video')).toHaveAttribute('src', /^blob:/);
  await page.getByLabel('Add SRT / VTT subtitles', { exact: true }).setInputFiles({
    name: 'english.srt',
    mimeType: 'text/plain',
    buffer: Buffer.from('1\n00:00:01,000 --> 00:00:03,000\nHello!'),
  });
  await expect(page.getByText('English subtitles are ready.', { exact: false })).toBeVisible();
  await expect(page.locator('video track')).toHaveAttribute('srclang', 'en');
});
