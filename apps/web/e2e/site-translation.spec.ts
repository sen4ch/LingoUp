import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';

async function tapWord(page: Page, locator: Locator, desired?: string, touch = false) {
  await locator.scrollIntoViewIfNeeded();
  const point = await locator.evaluate((root, requested) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const match = requested
        ? { index: node.data.indexOf(requested), text: requested }
        : (() => {
            const found = node.data.match(/[A-Za-z][A-Za-z'-]+/);
            return found ? { index: found.index!, text: found[0] } : null;
          })();
      if (!match || match.index < 0) continue;
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match.text.length);
      const rect = range.getBoundingClientRect();
      if (rect.width && rect.height)
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, term: match.text };
    }
    throw new Error('No visible word found');
  }, desired);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  return point.term;
}

test('word translation across pages, inline formatting, live text, editors and the original reader', async ({
  page,
  isMobile,
}) => {
  test.setTimeout(180_000);
  const password = 'Site-translation-QA-password-123!';
  const registered = await page.request.post('/api/v1/auth/register', {
    data: {
      email: `site-translation-${randomUUID()}@example.test`,
      password,
      displayName: 'Translation learner',
    },
  });
  expect(registered.status()).toBe(201);
  const lookups: { term: string; context: string; textSlug?: string }[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/v1/vocabulary/lookup', async (route) => {
    const input = route.request().postDataJSON();
    lookups.push(input);
    await route.fulfill({
      json: {
        term: input.term,
        normalizedTerm: input.term.toLowerCase(),
        glossary: null,
        ai: {
          provider: 'ollama',
          model: 'translation-test',
          isMock: false,
          definition: 'A contextual explanation for this word.',
          translation: 'переклад',
          partOfSpeech: 'word',
          example: null,
          usageNote: 'Used in this sentence.',
        },
        aiStatus: 'ok',
        savedWordId: null,
      },
    });
  });
  const popup = page.getByRole('dialog', { name: 'Word translation', exact: true });
  try {
    expect(
      (await page.request.patch('/api/v1/me/settings', { data: { nativeLanguage: 'uk' } })).ok(),
    ).toBe(true);
    await page.goto('/grammar/a1-sentence-basics');
    const term = await tapWord(
      page,
      page
        .locator('.grammar-rule-blocks strong')
        .filter({ hasText: /^verb$/ })
        .first(),
      'verb',
      isMobile,
    );
    await expect(popup.getByRole('heading', { name: term, exact: true })).toBeVisible();
    await expect(popup.getByText('переклад', { exact: true })).toBeVisible();
    expect(lookups.at(-1)?.textSlug).toBeUndefined();
    expect(lookups.at(-1)?.context).toContain('subject');
    const savedResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/vocabulary/words') && response.request().method() === 'POST',
    );
    await popup.getByRole('button', { name: /Save/ }).click();
    const saved = await (await savedResponse).json();
    expect(saved).toMatchObject({ term: 'verb', translation: 'переклад', sourceTextSlug: null });
    await popup.getByRole('button', { name: 'Close', exact: true }).click();

    for (const path of [
      '/',
      '/library',
      '/grammar',
      '/vocabulary',
      '/vocabulary/practice',
      '/review',
      '/speaking',
      '/writing',
      '/mistakes',
      '/listening',
      '/exams',
      '/profile',
      '/my-texts',
      '/setup',
      '/login',
      '/register',
    ]) {
      await page.goto(path);
      const heading = page.locator('main h1').first();
      await expect(heading).toBeVisible();
      const word = await tapWord(page, heading, undefined, isMobile);
      await expect(popup.getByRole('heading', { name: word, exact: true })).toBeVisible();
      await expect(popup.getByText('переклад', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
      await popup.getByRole('button', { name: 'Close', exact: true }).click();
    }

    await page.goto('/grammar/a1-sentence-basics');
    await page.evaluate(() => {
      const p = document.createElement('p');
      p.id = 'translation-dynamic';
      p.append('New ');
      const strong = document.createElement('strong');
      strong.textContent = 'perspectives';
      p.append(strong, ' make everyday practice interesting.');
      const hidden = document.createElement('span');
      hidden.hidden = true;
      hidden.textContent = 'HIDDEN-ANSWER-DO-NOT-SEND';
      p.append(hidden);
      document.querySelector('main')!.append(p);
    });
    await tapWord(page, page.locator('#translation-dynamic strong'), 'perspectives', isMobile);
    await expect(popup.getByRole('heading', { name: 'perspectives', exact: true })).toBeVisible();
    expect(lookups.at(-1)?.context).not.toContain('HIDDEN-ANSWER');
    await popup.getByRole('button', { name: 'Close', exact: true }).click();
    await page.evaluate(() => {
      const p = document.querySelector('#translation-dynamic')!;
      const range = document.createRange();
      range.setStart(p.firstChild!, 0);
      range.setEnd(p.querySelector('strong')!.firstChild!, 12);
      const selection = getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });
    await expect(
      popup.getByRole('heading', { name: 'New perspectives', exact: true }),
    ).toBeVisible();
    await popup.getByRole('button', { name: 'Close', exact: true }).click();
    await page.evaluate(() => {
      getSelection()?.removeAllRanges();
      document.querySelector('#translation-dynamic')?.remove();
    });

    await page.goto('/vocabulary');
    await page
      .getByRole('button', { name: /Add word/ })
      .first()
      .click();
    const editor = page.locator('dialog.word-editor-dialog');
    const example = editor.getByLabel('Example sentence (optional)');
    await example.fill('I open the window every morning.');
    await example.evaluate((element) => {
      const input = element as HTMLInputElement;
      input.setSelectionRange(2, 6);
      document.dispatchEvent(new Event('selectionchange'));
    });
    await page.getByRole('button', { name: 'Translate selected text', exact: true }).click();
    await expect(popup.getByRole('heading', { name: 'open', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);
    await expect(editor).toBeVisible();
    await expect(example).toHaveValue('I open the window every morning.');
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click();

    await page.goto('/login');
    const secret = page.getByLabel('Password', { exact: true });
    await secret.fill('Never-send-this-private-password');
    await secret.evaluate((element) => {
      (element as HTMLInputElement).setSelectionRange(0, 12);
      document.dispatchEvent(new Event('selectionchange'));
    });
    const before = lookups.length;
    await page.keyboard.press('Alt+t');
    await expect(popup).toHaveCount(0);
    expect(lookups.length).toBe(before);
    expect(lookups.some((lookup) => lookup.context.includes('Never-send'))).toBe(false);

    await page.goto('/library');
    await page.locator('a[href^="/read/"]').first().click();
    const original = page.locator('[data-word-reader]');
    await expect(original).toBeVisible();
    const token = original.locator('.reader-word').first();
    const originalTerm = await token.innerText();
    await token.click();
    await expect(
      original.locator('aside').getByRole('heading', { name: originalTerm, exact: true }),
    ).toBeVisible();
    await expect(popup).toHaveCount(0);
    expect(lookups.at(-1)?.textSlug).toBeTruthy();
    expect(errors).toEqual([]);
  } finally {
    expect((await page.request.delete('/api/v1/me', { data: { password } })).status()).toBe(204);
  }
});
