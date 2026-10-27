import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

async function register(page: Page) {
  await page.goto('/register');
  await page.getByLabel('Имя').fill('E2E');
  await page.getByLabel('Email').fill(`e2e-${randomUUID()}@example.test`);
  await page.getByLabel('Пароль').fill('e2e-password-12345');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(page).toHaveURL(/\/library/);
}

test('grammar: public rule, exercises checked after login, progress on the list', async ({
  page,
}) => {
  await page.goto('/grammar?level=A1');
  await page.getByRole('link', { name: 'Глагол to be: am, is, are' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Глагол to be/ })).toBeVisible();
  await expect(page.getByText('Войдите, чтобы проверять ответы')).toBeVisible();

  await register(page);
  await page.goto('/grammar/a1-verb-to-be');
  const first = page.getByRole('listitem').filter({ hasText: 'Упражнение 1' });
  await first.getByRole('button', { name: 'is', exact: true }).click();
  await expect(first.getByText('Неверно', { exact: true })).toBeVisible();
  await expect(first.getByText('Правильный ответ: am')).toBeVisible();

  const gap = page.getByRole('listitem').filter({ hasText: 'Упражнение 4' });
  await gap.getByPlaceholder('Ваш ответ').fill("aren't");
  await gap.getByRole('button', { name: 'Проверить' }).click();
  await expect(gap.getByText('Верно!', { exact: true })).toBeVisible();

  await page.goto('/grammar?level=A1');
  await expect(page.getByText('Верно: 1 из 6')).toBeVisible();
});

test('AI text from my words and a vocabulary exercise', async ({ page, request }) => {
  await register(page);
  for (const [term, contextSentence] of [
    ['bargain', 'What a bargain!'],
    ['crowded', 'The market is always crowded.'],
    ['borrow', 'Can I borrow your bike?'],
  ]) {
    const response = await page.request.post('/api/v1/vocabulary/words', {
      headers: { origin: new URL(page.url()).origin },
      data: { term, contextSentence },
    });
    expect(response.ok()).toBe(true);
  }

  await page.goto('/library');
  await page.getByRole('link', { name: /Мои тексты из ваших слов/ }).click();
  await page.getByRole('button', { name: 'Создать текст из моих слов' }).click();
  await expect(page.getByText(/Текст «.+» готов/)).toBeVisible({ timeout: 60_000 });
  await page
    .getByRole('status')
    .filter({ hasText: 'готов' })
    .getByRole('link', { name: 'Открыть' })
    .click();
  await expect(page).toHaveURL(/\/read\/my-/);
  await expect(page.getByText('Личный текст')).toBeVisible();
  await expect(page.getByText('Подчёркнуты слова из вашего словаря')).toBeVisible();

  // Private texts are invisible to anonymous visitors (`request` has no session cookie).
  const slug = page.url().split('/read/')[1] ?? '';
  const anonymous = await request.get(`/api/v1/texts/${slug}`);
  expect(anonymous.status()).toBe(404);

  await page.goto('/vocabulary/practice');
  await page.getByRole('button', { name: 'Начать упражнение' }).click();
  await expect(page.getByText('1 из 3')).toBeVisible({ timeout: 60_000 });
  for (let step = 0; step < 3; step++) {
    await page
      .getByRole('group', { name: 'Упражнение по словам' })
      .getByRole('button')
      .first()
      .click();
    await page.getByRole('button', { name: step === 2 ? 'Завершить' : 'Дальше' }).click();
  }
  await expect(page.getByText(/Результат: \d из 3/)).toBeVisible();
});

test('texts use the selected words or the entire vocabulary', async ({ page }) => {
  await register(page);
  const terms = ['apple', 'book', 'chair', 'door'];
  for (const term of terms) {
    const saved = await page.request.post('/api/v1/vocabulary/words', {
      headers: { origin: new URL(page.url()).origin },
      data: { term },
    });
    expect(saved.ok()).toBe(true);
  }
  await page.goto('/my-texts');
  await expect(page.getByText('Слов для текста: 4', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Выбрать слова', exact: true }).check();
  const generate = page.getByRole('button', { name: 'Создать текст из моих слов' });
  await expect(generate).toBeDisabled();
  await page.getByRole('button', { name: 'Выбрать все', exact: true }).click();
  await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(4);
  await page.getByRole('button', { name: 'Снять выбор' }).click();
  for (const term of terms.slice(0, 3))
    await page.getByRole('checkbox', { name: term, exact: true }).check();
  await page.getByRole('textbox', { name: 'Найти слово' }).fill('door');
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  await expect(page.getByText('Слов для текста: 3', { exact: true })).toBeVisible();
  const selectedResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/learning/generated-texts') &&
      response.request().method() === 'POST',
  );
  await generate.click();
  expect((await (await selectedResponse).json()).focusTerms.sort()).toEqual(terms.slice(0, 3));
  await expect(page.getByRole('status').filter({ hasText: 'готов' })).toBeVisible();
  await page.getByRole('radio', { name: 'Использовать все слова' }).check();
  const allResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/learning/generated-texts') &&
      response.request().method() === 'POST',
  );
  await generate.click();
  expect((await (await allResponse).json()).focusTerms.sort()).toEqual(terms);
});
