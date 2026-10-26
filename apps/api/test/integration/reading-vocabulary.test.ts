import { randomUUID } from 'node:crypto';
import { outboxEvents } from '@lingoup/database/schema/platform';
import { reviewLogs } from '@lingoup/database/schema/vocabulary';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, TestAgent, type TestContext } from './harness.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.close();
});

describe('content library (public)', () => {
  it('lists texts filtered by CEFR level and opens one', async () => {
    const anonymous = new TestAgent(ctx.app);
    const all = await anonymous.request('GET', '/v1/texts');
    expect(all.body.items.map((t: { level: string }) => t.level)).toEqual([
      'A1',
      'A2',
      'B1',
      'B2',
      'C1',
      'C2',
    ]);

    const b2 = await anonymous.request('GET', '/v1/texts?level=B2');
    expect(b2.body.items).toHaveLength(1);
    const text = await anonymous.request('GET', `/v1/texts/${b2.body.items[0].slug}`);
    expect(text.body.paragraphs.length).toBeGreaterThan(2);
    expect(text.body.license).toBe('CC-BY-4.0');

    expect((await anonymous.request('GET', '/v1/texts?level=X1')).status).toBe(400);
    expect((await anonymous.request('GET', '/v1/texts/does-not-exist')).status).toBe(404);
  });
});

describe('interactive reading + personal vocabulary', () => {
  it('looks up a glossary term without AI, and falls back to the mock provider otherwise', async () => {
    const agent = new TestAgent(ctx.app);
    await agent.register();

    const glossary = await agent.request('POST', '/v1/vocabulary/lookup', {
      term: 'Bargain!',
      context: 'What a bargain!',
      textSlug: 'a2-weekend-market',
    });
    expect(glossary.status).toBe(200);
    expect(glossary.body).toMatchObject({
      normalizedTerm: 'bargain',
      aiStatus: 'skipped',
      ai: null,
      glossary: { translation: 'выгодная покупка' },
    });

    const ai = await agent.request('POST', '/v1/vocabulary/lookup', {
      term: 'grandmother',
      context: 'Maria goes to the market with her grandmother.',
      textSlug: 'a2-weekend-market',
    });
    expect(ai.body.aiStatus).toBe('ok');
    expect(ai.body.ai).toMatchObject({ provider: 'mock', isMock: true });
  });

  it('requires a session for vocabulary endpoints', async () => {
    const anonymous = new TestAgent(ctx.app);
    const response = await anonymous.request('POST', '/v1/vocabulary/lookup', { term: 'x' });
    expect(response.status).toBe(401);
  });

  it('saves words with context, prevents duplicates and paginates', async () => {
    const agent = new TestAgent(ctx.app);
    const user = await agent.register();
    const saved = await agent.request('POST', '/v1/vocabulary/words', {
      term: 'Fresh',
      definition: 'recently picked or made',
      translation: 'свежий',
      contextSentence: 'That means they are fresh.',
      sourceTextSlug: 'a2-weekend-market',
    });
    expect(saved.status).toBe(201);
    expect(saved.body).toMatchObject({
      normalizedTerm: 'fresh',
      sourceTextSlug: 'a2-weekend-market',
      card: { state: 'new' },
    });

    const duplicate = await agent.request('POST', '/v1/vocabulary/words', { term: '  fresh ' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.details.wordId).toBe(saved.body.id);

    for (const term of ['stall', 'crowded', 'change']) {
      await agent.request('POST', '/v1/vocabulary/words', { term });
    }
    const first = await agent.request('GET', '/v1/vocabulary/words?limit=3');
    expect(first.body.items).toHaveLength(3);
    expect(first.body.nextCursor).toBeTypeOf('string');
    const second = await agent.request(
      'GET',
      `/v1/vocabulary/words?limit=3&cursor=${first.body.nextCursor}`,
    );
    expect(second.body.items).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();
    expect(second.body.items[0].term).toBe('Fresh');

    const search = await agent.request('GET', '/v1/vocabulary/words?q=CROW');
    expect(search.body.items.map((w: { term: string }) => w.term)).toEqual(['crowded']);

    const lookup = await agent.request('POST', '/v1/vocabulary/lookup', {
      term: 'fresh',
      textSlug: 'a2-weekend-market',
    });
    expect(lookup.body.savedWordId).toBe(saved.body.id);

    const events = await ctx.database.db
      .select()
      .from(outboxEvents)
      .where(and(eq(outboxEvents.userId, user.id), eq(outboxEvents.type, 'WordSaved')));
    expect(events).toHaveLength(4);
  });

  it('isolates users from each other', async () => {
    const alice = new TestAgent(ctx.app);
    const bob = new TestAgent(ctx.app);
    await alice.register();
    await bob.register();
    const word = await alice.request('POST', '/v1/vocabulary/words', { term: 'private' });

    expect((await bob.request('GET', `/v1/vocabulary/words/${word.body.id}`)).status).toBe(404);
    expect(
      (await bob.request('PATCH', `/v1/vocabulary/words/${word.body.id}`, { note: 'hack' })).status,
    ).toBe(404);
    expect((await bob.request('DELETE', `/v1/vocabulary/words/${word.body.id}`)).status).toBe(404);
    const bobReview = await bob.request('POST', '/v1/vocabulary/reviews', {
      cardId: word.body.card.id,
      rating: 'easy',
      clientReviewId: randomUUID(),
    });
    expect(bobReview.status).toBe(404);
    expect((await bob.request('GET', '/v1/vocabulary/words')).body.items).toHaveLength(0);
    expect((await alice.request('GET', `/v1/vocabulary/words/${word.body.id}`)).status).toBe(200);
  });

  it('reviews with FSRS, persists history and is idempotent per clientReviewId', async () => {
    const agent = new TestAgent(ctx.app);
    const user = await agent.register();
    await agent.request('POST', '/v1/vocabulary/words', { term: 'retrieve' });

    const due = await agent.request('GET', '/v1/vocabulary/reviews/due');
    expect(due.body.totalDue).toBe(1);
    const card = due.body.cards[0];
    expect(Date.parse(card.nextDue.easy)).toBeGreaterThanOrEqual(Date.parse(card.nextDue.again));

    const clientReviewId = randomUUID();
    const payload = { cardId: card.cardId, rating: 'easy', clientReviewId, durationMs: 1800 };
    // Concurrent duplicates (double click / retry) must produce exactly one review.
    const results = await Promise.all([
      agent.request('POST', '/v1/vocabulary/reviews', payload),
      agent.request('POST', '/v1/vocabulary/reviews', payload),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(results.filter((r) => r.body.duplicate)).toHaveLength(1);
    expect(results[0].body.due).toBe(results[1].body.due);

    const logs = await ctx.database.db
      .select()
      .from(reviewLogs)
      .where(eq(reviewLogs.userId, user.id));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ rating: 'easy', previousState: 'new', durationMs: 1800 });

    const after = await agent.request('GET', '/v1/vocabulary/reviews/due');
    expect(after.body.totalDue).toBe(0);

    const summary = await agent.request('GET', '/v1/progress/summary');
    expect(summary.body.vocabulary).toMatchObject({ total: 1, totalReviews: 1, dueNow: 0 });
    expect(summary.body.activity).toHaveLength(30);
  });

  it('marks a text as read once and emits a single LessonCompleted event', async () => {
    const agent = new TestAgent(ctx.app);
    const user = await agent.register();
    const first = await agent.request('POST', '/v1/learning/reading/b1-learning-to-cycle/complete');
    const second = await agent.request(
      'POST',
      '/v1/learning/reading/b1-learning-to-cycle/complete',
    );
    expect(first.body.completedAt).toBe(second.body.completedAt);
    const completions = await agent.request('GET', '/v1/learning/reading/completions');
    expect(completions.body.items).toHaveLength(1);
    const events = await ctx.database.db
      .select()
      .from(outboxEvents)
      .where(and(eq(outboxEvents.userId, user.id), eq(outboxEvents.type, 'LessonCompleted')));
    expect(events).toHaveLength(1);
    expect(events[0]!.event).toMatchObject({ payload: { lessonType: 'reading', level: 'B1' } });
  });
});

describe('AI privacy policy', () => {
  it('does not call AI when the provider is disabled; the glossary still works', async () => {
    const disabled = await createTestContext({ AI_PROVIDER: 'none' });
    try {
      const agent = new TestAgent(disabled.app);
      await agent.register();
      const response = await agent.request('POST', '/v1/vocabulary/lookup', {
        term: 'grandmother',
      });
      expect(response.body).toMatchObject({ aiStatus: 'disabled', ai: null });
      const glossary = await agent.request('POST', '/v1/vocabulary/lookup', {
        term: 'stall',
        textSlug: 'a2-weekend-market',
      });
      expect(glossary.body.glossary).not.toBeNull();
    } finally {
      await disabled.close();
    }
  });
});
