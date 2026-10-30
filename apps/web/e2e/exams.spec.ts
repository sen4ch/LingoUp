import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

test('IELTS practice keeps answers on a failed assessment and shows a score after completion', async ({
  page,
}) => {
  const id = randomUUID();
  const audioDirectory = path.resolve(import.meta.dirname, '../../../content/exams/audio');
  const audioFile = (await readdir(audioDirectory)).find((file) => file.endsWith('.mp3'))!;
  const recording = await readFile(path.join(audioDirectory, audioFile));
  let audioAttempts = 0;
  await page.route(`**/api/v1/learning/exams/${id}/audio/0`, (route) => {
    audioAttempts++;
    return audioAttempts === 1
      ? route.fulfill({
          status: 503,
          json: { error: { code: 'AI_UNAVAILABLE', message: 'Unavailable' } },
        })
      : route.fulfill({ status: 200, contentType: 'audio/mpeg', body: recording });
  });
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      json: {
        id: randomUUID(),
        email: 'exam@example.test',
        displayName: 'Candidate',
        createdAt: new Date().toISOString(),
        settings: {
          nativeLanguage: 'ru',
          targetLevel: 'B2',
          dailyGoalMinutes: 15,
          aiDataSharing: false,
        },
      },
    }),
  );
  await page.route('**/api/v1/vocabulary/reviews/due?*', (route) =>
    route.fulfill({ json: { cards: [], totalDue: 0 } }),
  );
  const questions = Array.from({ length: 10 }, (_, index) => ({
    section: index % 3,
    prompt: `Question ${index + 1}`,
    options: ['A', 'B', 'C'],
  }));
  await page.route('**/api/v1/learning/exams', (route) =>
    route.fulfill({
      json: {
        id,
        title: 'IELTS Academic — short practice',
        expiresAt: new Date(Date.now() + 86400_000).toISOString(),
        reading: [1, 2, 3].map((index) => ({
          title: `Passage ${index}`,
          text: 'A reading passage.',
        })),
        readingQuestions: questions,
        listeningQuestions: questions,
        writingTasks: ['Describe the data.', 'Discuss the views.'],
        speakingTasks: ['Introduce yourself.', 'Describe a skill.', 'Discuss education.'],
      },
    }),
  );
  let attempts = 0;
  await page.route(`**/api/v1/learning/exams/${id}/answers`, (route) => {
    const body = route.request().postDataJSON();
    expect(body.reading).toHaveLength(10);
    expect(body.listening).toHaveLength(10);
    expect(body.writing[0]).toBe('My report on the data.');
    attempts++;
    if (attempts === 1)
      return route.fulfill({
        status: 503,
        json: { error: { code: 'AI_UNAVAILABLE', message: 'Unavailable' } },
      });
    const review = { band: 7, feedback: 'Develop your examples more clearly.' };
    return route.fulfill({
      json: {
        id,
        completedAt: new Date().toISOString(),
        score: 84,
        reading: 10,
        listening: 8,
        writingTask1: { ...review, band: 6 },
        writingTask2: { ...review, band: 7.5 },
        writingBand: 7,
        speakingLanguage: review,
        isMock: false,
        readingAnswers: Array<number>(10).fill(0),
        listeningAnswers: Array<number>(10).fill(0),
        listeningTranscripts: ['Part one', 'Part two', 'Part three', 'Part four'],
      },
    });
  });
  await page.goto('/exams');
  await page.getByRole('button', { name: 'Start IELTS practice' }).click();
  await expect(page.getByLabel('Listening part 1', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Load audio for Part 1', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Could not load this recording.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry audio for Part 1', exact: true }).click();
  const player = page.getByLabel('Listening part 1', { exact: true });
  await expect(player).toBeVisible();
  await expect
    .poll(() => player.evaluate((audio: HTMLAudioElement) => audio.duration))
    .toBeGreaterThan(1);
  await player.evaluate((audio: HTMLAudioElement) => audio.play());
  await expect
    .poll(() => player.evaluate((audio: HTMLAudioElement) => audio.currentTime))
    .toBeGreaterThan(0.1);
  await player.evaluate((audio: HTMLAudioElement) => audio.pause());
  await expect(page.getByText('Practice score:', { exact: false })).toHaveCount(0);
  for (let index = 0; index < 10; index++)
    await page
      .getByRole('radio')
      .nth(index * 3)
      .check();
  await page.getByRole('button', { name: 'Next section' }).click();
  for (let index = 0; index < 10; index++)
    await page
      .getByRole('radio')
      .nth(index * 3)
      .check();
  await page.getByRole('button', { name: 'Next section' }).click();
  await page.getByLabel('Writing Task 1 answer').fill('My report on the data.');
  await page.getByLabel('Writing Task 2 answer').fill('My essay discussing both views.');
  await page.getByRole('button', { name: 'Next section' }).click();
  for (let index = 1; index <= 3; index++)
    await page
      .getByLabel(`Speaking Part ${index} transcript`)
      .fill(`My spoken answer for part ${index}.`);
  await page.getByRole('button', { name: 'Finish exam & see score' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Could not assess the exam.' }),
  ).toContainText('Your answers are still here');
  await expect(page.getByLabel('Speaking Part 1 transcript')).toHaveValue(
    'My spoken answer for part 1.',
  );
  await page.getByRole('button', { name: 'Finish exam & see score' }).click();
  await expect(page.getByRole('heading', { name: 'Practice score: 84/100' })).toBeVisible();
  await expect(page.getByText('10/10 correct', { exact: true })).toBeVisible();
  await expect(page.getByText('8/10 correct', { exact: true })).toBeVisible();
});
