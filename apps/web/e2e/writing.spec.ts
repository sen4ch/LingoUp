import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('email writing follows the profile level, highlights corrections and preserves failed drafts', async ({
  page,
}) => {
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      json: {
        id: randomUUID(),
        email: 'writing@example.test',
        displayName: 'Writer',
        createdAt: new Date().toISOString(),
        settings: {
          nativeLanguage: 'ru',
          targetLevel: 'A2',
          dailyGoalMinutes: 15,
          aiDataSharing: false,
        },
      },
    }),
  );
  await page.route('**/api/v1/vocabulary/reviews/due?*', (route) =>
    route.fulfill({ json: { cards: [], totalDue: 0 } }),
  );
  let fail = false;
  await page.route('**/api/v1/learning/writing/turn', (route) => {
    const input = route.request().postDataJSON();
    expect(input.level).toBe('A2');
    if (fail)
      return route.fulfill({
        status: 503,
        json: { error: { code: 'AI_UNAVAILABLE', message: 'Unavailable' } },
      });
    return route.fulfill({
      json: {
        subject: 'Weekend plans',
        reply: 'Hi,\n\nWhat will you do this weekend?\n\nBest,\nAlex',
        feedback: input.messages.length
          ? 'Check spelling and verb agreement.'
          : 'Tell me about your plans.',
        isMock: false,
        issues: input.messages.length
          ? [
              {
                quote: 'helllo',
                occurrence: 0,
                category: 'word',
                replacement: 'hello',
                explanation: 'Use two l letters.',
              },
              {
                quote: 'I is',
                occurrence: 0,
                category: 'grammar',
                errorType: 'agreement',
                replacement: 'I am',
                explanation: 'Use am with I.',
                example: 'I am ready.',
              },
              {
                quote: 'helllo, I is happy.',
                occurrence: 0,
                category: 'grammar',
                errorType: 'sentence_structure',
                replacement: 'Hello, I am happy.',
                explanation: 'Check this sentence structure.',
              },
              {
                quote: 'This wording is absent',
                occurrence: 0,
                category: 'grammar',
                replacement: 'A correction',
                explanation: 'This feedback must remain visible.',
              },
              {
                quote: 'I wont go',
                occurrence: 0,
                category: 'suggestion',
                errorType: 'ambiguity',
                replacement: 'I wont go',
                explanation: 'Do you want to go, or will you not go?',
                alternatives: [
                  { replacement: 'I want to go', meaning: 'You wish to attend.' },
                  { replacement: "I won't go", meaning: 'You will not attend.' },
                ],
              },
            ]
          : [],
      },
    });
  });
  await page.goto('/writing');
  await expect(page.getByLabel('CEFR level')).toHaveValue('A2');
  await page.getByRole('button', { name: 'Receive an email' }).click();
  await expect(page.getByRole('heading', { name: 'Weekend plans', exact: true })).toBeVisible();
  await page.getByLabel('Your email', { exact: true }).fill('helllo, I is happy. I wont go.');
  await page.getByRole('button', { name: 'Send & get feedback' }).click();
  await expect(page.getByRole('link', { name: 'helllo', exact: true })).toHaveClass(/bg-red-100/);
  await expect(page.getByRole('link', { name: 'I is', exact: true })).toHaveClass(/bg-yellow-100/);
  await expect(page.getByText('Use am with I.', { exact: true })).toBeVisible();
  await expect(page.getByText('Check this sentence structure.', { exact: true })).toBeVisible();
  await expect(page.getByText('This feedback must remain visible.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: ',', exact: true })).toHaveClass(/bg-yellow-100/);
  await expect(page.getByRole('heading', { name: /Agreement/ })).toBeVisible();
  await expect(page.getByText('I am ready.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'I wont go', exact: true })).toHaveClass(
    /bg-blue-100/,
  );
  await page.getByRole('link', { name: 'I wont go', exact: true }).click();
  await expect(page.getByText('I want to go', { exact: true })).toBeVisible();
  await expect(page.getByText("I won't go", { exact: true })).toBeVisible();
  fail = true;
  await page.getByLabel('Your email', { exact: true }).fill('Please keep my draft.');
  await page.getByRole('button', { name: 'Send & get feedback' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Could not send your email.' }),
  ).toContainText('Your draft is still here');
  await expect(page.getByLabel('Your email', { exact: true })).toHaveValue('Please keep my draft.');
});

test('A1 shows three explanations but keeps the complete correction and expands hidden links', async ({
  page,
}) => {
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      json: {
        id: randomUUID(),
        email: 'a1@example.test',
        displayName: 'Learner',
        createdAt: new Date().toISOString(),
        settings: {
          nativeLanguage: 'ru',
          targetLevel: 'A1',
          dailyGoalMinutes: 15,
          aiDataSharing: false,
        },
      },
    }),
  );
  await page.route('**/api/v1/vocabulary/reviews/due?*', (route) =>
    route.fulfill({ json: { cards: [], totalDue: 0 } }),
  );
  const source = Array.from({ length: 10 }, (_, i) => `bad${i}`).join(' ');
  const corrected = Array.from({ length: 10 }, (_, i) => `good${i}`).join(' ');
  await page.route('**/api/v1/learning/writing/turn', (route) =>
    route.fulfill({
      json: {
        subject: 'Hello',
        reply: 'Hi! How are you?',
        feedback: 'Let us practise three things.',
        isMock: false,
        correctedText: route.request().postDataJSON().messages.length ? corrected : null,
        issues: route.request().postDataJSON().messages.length
          ? Array.from({ length: 10 }, (_, i) => ({
              quote: `bad${i}`,
              occurrence: 0,
              category: 'grammar',
              errorType: 'sentence_structure',
              replacement: `good${i}`,
              explanation: 'Use a verb.',
              example: 'This is nice.',
            }))
          : [],
      },
    }),
  );
  await page.goto('/writing');
  await page.getByRole('button', { name: 'Receive an email' }).click();
  await page.getByLabel('Your email', { exact: true }).fill(source);
  await page.getByRole('button', { name: 'Send & get feedback' }).click();
  await expect(page.getByRole('region', { name: 'Corrected text', exact: true })).toContainText(
    corrected,
  );
  await expect(page.locator('[id^="sent-1-correction-"]:visible')).toHaveCount(3);
  await page.getByRole('button', { name: 'Show more corrections (7)' }).click();
  await expect(page.locator('[id^="sent-1-correction-"]:visible')).toHaveCount(10);
  await page.getByRole('button', { name: 'Show fewer corrections' }).click();
  await page.getByRole('link', { name: 'bad9', exact: true }).click();
  await expect(page.locator('#sent-1-correction-9')).toBeVisible();
});
