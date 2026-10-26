#!/usr/bin/env node
// End-to-end API smoke test of the Interactive Reading + Vocabulary scenario.
// Runs against a live API:  API_URL=http://localhost:4000 node scripts/smoke-api.mjs
// Creates a throwaway user and deletes it at the end.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const API_URL = (process.env.API_URL ?? 'http://127.0.0.1:4000').replace(/\/+$/, '');
const ORIGIN = process.env.SMOKE_ORIGIN ?? 'http://localhost:3000';
let cookie = '';

async function call(method, path, body, { expect = [200], origin = ORIGIN } = {}) {
  const headers = { origin };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  assert.ok(
    expect.includes(response.status),
    `${method} ${path}: expected ${expect.join('/')}, got ${response.status} ${text}`,
  );
  return json;
}

const step = (name) => console.log(`✔ ${name}`);

const ready = await call('GET', '/health/ready');
assert.equal(ready.status, 'ok');
step('health/ready: database and valkey are up');

const email = `smoke-${randomUUID()}@example.test`;
const password = 'smoke-test-password-123';
await call(
  'POST',
  '/v1/auth/register',
  { email, password, displayName: 'Smoke' },
  {
    origin: 'https://evil.example',
    expect: [403],
  },
);
step('foreign Origin is rejected (CSRF protection)');

const me = await call(
  'POST',
  '/v1/auth/register',
  { email, password, displayName: 'Smoke' },
  { expect: [201] },
);
assert.equal(me.email, email);
step('register + session cookie');

await call('GET', '/v1/vocabulary/words', undefined, { expect: [200] });
const anonymous = cookie;
cookie = '';
await call('GET', '/v1/vocabulary/words', undefined, { expect: [401] });
cookie = anonymous;
step('protected endpoints require a session');

const { items: texts } = await call('GET', '/v1/texts?level=A1');
assert.ok(texts.length > 0, 'expected at least one A1 text; run `pnpm content:import`');
const text = await call('GET', `/v1/texts/${texts[0].slug}`);
assert.ok(text.paragraphs.length > 0);
step(`library + open text "${text.title}"`);

const glossaryLookup = await call('POST', '/v1/vocabulary/lookup', {
  term: 'Wake up',
  context: "I wake up at seven o'clock every day.",
  textSlug: 'a1-morning-routine',
});
assert.equal(glossaryLookup.normalizedTerm, 'wake up');
assert.ok(glossaryLookup.glossary, 'expected a glossary entry for "wake up"');
assert.equal(glossaryLookup.aiStatus, 'skipped');
step('lookup uses the curated glossary (no AI needed)');

const aiLookup = await call('POST', '/v1/vocabulary/lookup', {
  term: 'flat',
  context: 'I live in a small flat in the city.',
  textSlug: 'a1-morning-routine',
});
assert.equal(aiLookup.glossary, null);
assert.ok(['ok', 'disabled', 'unavailable'].includes(aiLookup.aiStatus));
step(`lookup without glossary entry falls back to AI gateway (status: ${aiLookup.aiStatus})`);

const word = await call(
  'POST',
  '/v1/vocabulary/words',
  {
    term: 'wake up',
    definition: glossaryLookup.glossary.definition,
    translation: glossaryLookup.glossary.translation,
    contextSentence: "I wake up at seven o'clock every day.",
    sourceTextSlug: 'a1-morning-routine',
  },
  { expect: [201] },
);
assert.equal(word.card.state, 'new');
const duplicate = await call(
  'POST',
  '/v1/vocabulary/words',
  { term: 'Wake  up' },
  { expect: [409] },
);
assert.equal(duplicate.error.code, 'WORD_ALREADY_SAVED');
step('save word; duplicate is rejected with 409');

const page = await call('GET', '/v1/vocabulary/words?limit=10');
assert.equal(page.items.length, 1);
step('saved words are listed');

const due = await call('GET', '/v1/vocabulary/reviews/due');
assert.equal(due.totalDue, 1);
const clientReviewId = randomUUID();
const review = await call('POST', '/v1/vocabulary/reviews', {
  cardId: due.cards[0].cardId,
  rating: 'good',
  clientReviewId,
  durationMs: 2500,
});
assert.equal(review.duplicate, false);
const retry = await call('POST', '/v1/vocabulary/reviews', {
  cardId: due.cards[0].cardId,
  rating: 'good',
  clientReviewId,
});
assert.equal(retry.duplicate, true);
assert.equal(retry.due, review.due);
step(`FSRS review saved (next due ${review.due}); retry is idempotent`);

await call('POST', `/v1/learning/reading/${text.slug}/complete`);
const summary = await call('GET', '/v1/progress/summary');
assert.equal(summary.vocabulary.total, 1);
assert.equal(summary.vocabulary.totalReviews, 1);
step(
  `progress summary: ${summary.vocabulary.total} word(s), ${summary.vocabulary.totalReviews} review(s); ` +
    `activity projection ${summary.activityUpdatedAt ? 'updated by worker' : 'not yet projected (is the worker running?)'}`,
);

const exported = await call('GET', '/v1/me/export');
assert.equal(exported.sections.vocabulary.words.length, 1);
assert.equal(exported.sections.account.email, email);
step('personal data export');

await call('DELETE', '/v1/me', { password }, { expect: [204] });
await call('GET', '/v1/me', undefined, { expect: [401] });
step('account deleted, session revoked');

console.log('\nAPI smoke test passed.');
