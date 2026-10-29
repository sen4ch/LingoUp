import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { outboxEvents } from '@lingoup/database/schema/platform';
import { texts } from '@lingoup/database/schema/content';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, TestAgent, type TestContext } from './harness.js';
import { GrammarImporter } from '../../src/modules/grammar/index.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.close();
});

const saveWords = async (agent: TestAgent, entries: [string, string | null][]) => {
  for (const [term, contextSentence] of entries) {
    const response = await agent.request('POST', '/v1/vocabulary/words', {
      term,
      contextSentence,
      definition: `meaning of ${term}`,
    });
    expect(response.status).toBe(201);
  }
};

describe('grammar', () => {
  it('preserves progress for translated explanations and resets it for changed questions', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'lingoup-grammar-'));
    const file = path.join(directory, 'topic.md');
    const document = `---
slug: b1-import-progress
title: Import progress
level: B1
summary: An importer regression fixture.
author: Test fixture
provenance: ai-generated
license: CC0-1.0
exercises:
  - type: choice
    prompt: I ___ ready.
    options: [am, is, are]
    answer: am
    explanation: Initial explanation.
---

## Rule

Use the correct form of to be.
`;
    try {
      const importer = new GrammarImporter(ctx.database.db);
      await writeFile(file, document);
      await importer.importDirectory(directory);
      const agent = new TestAgent(ctx.app);
      await agent.register();
      const before = await agent.request('GET', '/v1/grammar/topics/b1-import-progress');
      const id = before.body.exercises[0].id as string;
      await agent.request('POST', `/v1/grammar/exercises/${id}/attempts`, { answer: 'am' });
      const translated = document.replace('Initial explanation.', 'Updated English explanation.');
      await writeFile(file, translated);
      await importer.importDirectory(directory);
      const after = await agent.request('GET', '/v1/grammar/topics/b1-import-progress');
      expect(after.body.exercises[0].id).toBe(id);
      expect(after.body.progress).toEqual({ attempted: 1, correct: 1 });
      const feedback = await agent.request('POST', `/v1/grammar/exercises/${id}/attempts`, {
        answer: 'am',
      });
      expect(feedback.body.explanation).toBe('Updated English explanation.');

      await writeFile(
        file,
        translated.replace('I ___ ready.', 'She ___ ready.').replace('answer: am', 'answer: is'),
      );
      await importer.importDirectory(directory);
      const changed = await agent.request('GET', '/v1/grammar/topics/b1-import-progress');
      expect(changed.body.exercises[0].id).not.toBe(id);
      expect(changed.body.progress).toEqual({ attempted: 0, correct: 0 });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('lists topics by level and never exposes the answers', async () => {
    const anonymous = new TestAgent(ctx.app);
    const all = await anonymous.request('GET', '/v1/grammar/topics');
    expect(all.body.items.length).toBeGreaterThanOrEqual(10);
    expect(all.body.items.every((t: { progress: unknown }) => t.progress === null)).toBe(true);

    const a1 = await anonymous.request('GET', '/v1/grammar/topics?level=A1');
    expect(a1.body.items.map((t: { level: string }) => t.level)).toEqual(['A1', 'A1']);

    const topic = await anonymous.request('GET', '/v1/grammar/topics/a1-present-simple');
    expect(topic.body.blocks.length).toBeGreaterThan(3);
    expect(topic.body.exercises).toHaveLength(6);
    expect(JSON.stringify(topic.body.exercises)).not.toContain('answers');
    expect(topic.body.license).toBe('CC0-1.0');
  });

  it('checks answers on the server, records attempts and progress, emits events', async () => {
    const agent = new TestAgent(ctx.app);
    const user = await agent.register();
    const topic = await agent.request('GET', '/v1/grammar/topics/a1-present-simple');
    const [first, second] = topic.body.exercises as { id: string }[];

    const wrong = await agent.request('POST', `/v1/grammar/exercises/${first!.id}/attempts`, {
      answer: 'drink',
    });
    expect(wrong.body).toMatchObject({ correct: false, correctAnswer: 'drinks' });
    expect(wrong.body.explanation).toBeTypeOf('string');

    const right = await agent.request('POST', `/v1/grammar/exercises/${first!.id}/attempts`, {
      answer: ' Drinks ',
    });
    expect(right.body.correct).toBe(true);
    await agent.request('POST', `/v1/grammar/exercises/${second!.id}/attempts`, {
      answer: 'lives',
    });

    const after = await agent.request('GET', '/v1/grammar/topics/a1-present-simple');
    // Latest answer counts: exercise 1 now correct, exercise 2 wrong.
    expect(after.body.progress).toEqual({ attempted: 2, correct: 1 });

    const events = await ctx.database.db
      .select()
      .from(outboxEvents)
      .where(and(eq(outboxEvents.userId, user.id), eq(outboxEvents.type, 'ExerciseCompleted')));
    expect(events).toHaveLength(3);
  });

  it('requires a session to answer and rejects unknown exercises', async () => {
    const anonymous = new TestAgent(ctx.app);
    const id = randomUUID();
    expect(
      (await anonymous.request('POST', `/v1/grammar/exercises/${id}/attempts`, { answer: 'x' }))
        .status,
    ).toBe(401);
    const agent = new TestAgent(ctx.app);
    await agent.register();
    expect(
      (await agent.request('POST', `/v1/grammar/exercises/${id}/attempts`, { answer: 'x' })).status,
    ).toBe(404);
  });
});

describe('AI texts from the learner vocabulary', () => {
  it('uses all words beyond the previous limit and only the selected owned words', async () => {
    const owner = new TestAgent(ctx.app);
    await owner.register();
    const terms = [
      'apple',
      'book',
      'chair',
      'door',
      'egg',
      'flower',
      'garden',
      'house',
      'island',
      'juice',
      'kite',
    ];
    await saveWords(
      owner,
      terms.map((term) => [term, null]),
    );
    const listed = await owner.request('GET', '/v1/vocabulary/words');
    const ids = listed.body.items.map((word: { id: string }) => word.id) as string[];
    const all = await owner.request('POST', '/v1/learning/generated-texts', {});
    expect(all.status).toBe(201);
    expect(all.body.focusTerms.sort()).toEqual([...terms].sort());
    const wordIds = ids.slice(0, 3);
    const selected = await owner.request('POST', '/v1/learning/generated-texts', { wordIds });
    expect(selected.status).toBe(201);
    expect(selected.body.focusTerms.sort()).toEqual(
      listed.body.items
        .slice(0, 3)
        .map((word: { term: string }) => word.term)
        .sort(),
    );
    const stranger = new TestAgent(ctx.app);
    await stranger.register();
    expect(
      (await stranger.request('POST', '/v1/learning/generated-texts', { wordIds })).status,
    ).toBe(404);
    expect(
      (
        await owner.request('POST', '/v1/learning/generated-texts', {
          wordIds: [...wordIds.slice(0, 2), randomUUID()],
        })
      ).status,
    ).toBe(404);
    expect(
      (await owner.request('POST', '/v1/learning/generated-texts', { wordIds: ids.slice(0, 2) }))
        .status,
    ).toBe(400);
    expect(
      (
        await owner.request('POST', '/v1/learning/generated-texts', {
          wordIds: [ids[0], ids[0], ids[1]],
        })
      ).status,
    ).toBe(400);
  });

  it('needs at least three saved words', async () => {
    const agent = new TestAgent(ctx.app);
    await agent.register();
    await saveWords(agent, [['bargain', null]]);
    const response = await agent.request('POST', '/v1/learning/generated-texts', {});
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('NOT_ENOUGH_WORDS');
  });

  it('creates a private text visible only to its owner', async () => {
    const owner = new TestAgent(ctx.app);
    await owner.register();
    await saveWords(owner, [
      ['bargain', null],
      ['crowded', null],
      ['stall', null],
    ]);

    const generated = await owner.request('POST', '/v1/learning/generated-texts', { level: 'A2' });
    expect(generated.status).toBe(201);
    expect(generated.body).toMatchObject({ provider: 'mock', isMock: true, missingTerms: [] });
    expect(generated.body.focusTerms.sort()).toEqual(['bargain', 'crowded', 'stall']);

    const text = await owner.request('GET', `/v1/texts/${generated.body.slug}`);
    expect(text.body).toMatchObject({
      isPrivate: true,
      provenance: 'ai-generated',
      license: 'CC0-1.0',
      level: 'A2',
    });

    const mine = await owner.request('GET', '/v1/texts/mine');
    expect(mine.body.items.map((t: { slug: string }) => t.slug)).toEqual([generated.body.slug]);

    // Not in the public library, not readable by others or anonymously.
    const library = await new TestAgent(ctx.app).request('GET', '/v1/texts');
    expect(library.body.items.some((t: { slug: string }) => t.slug === generated.body.slug)).toBe(
      false,
    );
    const stranger = new TestAgent(ctx.app);
    await stranger.register();
    expect((await stranger.request('GET', `/v1/texts/${generated.body.slug}`)).status).toBe(404);
    expect(
      (await new TestAgent(ctx.app).request('GET', `/v1/texts/${generated.body.slug}`)).status,
    ).toBe(404);
    expect(
      (await stranger.request('POST', `/v1/learning/reading/${generated.body.slug}/complete`))
        .status,
    ).toBe(404);
    expect((await stranger.request('DELETE', `/v1/texts/mine/${generated.body.slug}`)).status).toBe(
      404,
    );

    // The owner can read it like any text and delete it.
    expect(
      (await owner.request('POST', `/v1/learning/reading/${generated.body.slug}/complete`)).status,
    ).toBe(200);
    expect((await owner.request('DELETE', `/v1/texts/mine/${generated.body.slug}`)).status).toBe(
      204,
    );
    const rows = await ctx.database.db
      .select()
      .from(texts)
      .where(eq(texts.slug, generated.body.slug));
    expect(rows).toHaveLength(0);
  });

  it('reports AI_UNAVAILABLE when no AI provider is configured', async () => {
    const noAi = await createTestContext({ AI_PROVIDER: 'none' });
    try {
      const agent = new TestAgent(noAi.app);
      await agent.register();
      await saveWords(agent, [
        ['bargain', null],
        ['crowded', null],
        ['stall', null],
      ]);
      const response = await agent.request('POST', '/v1/learning/generated-texts', {});
      expect(response.status).toBe(503);
      expect(response.body.error).toMatchObject({
        code: 'AI_UNAVAILABLE',
        details: { aiStatus: 'disabled' },
      });
    } finally {
      await noAi.close();
    }
  });
});

describe('vocabulary practice', () => {
  it('builds gap-fill items with options from the learner words and records completion', async () => {
    const agent = new TestAgent(ctx.app);
    const user = await agent.register();
    await saveWords(agent, [
      ['bargain', null],
      ['crowded', null],
      ['stall', null],
      ['fresh', null],
    ]);

    const set = await agent.request('POST', '/v1/vocabulary/practice');
    expect(set.status).toBe(200);
    expect(set.body).toMatchObject({ source: 'ai', provider: 'mock', isMock: true });
    for (const item of set.body.items) {
      expect(item.sentence).toContain('___');
      expect(item.options).toContain(item.answer);
      expect(item.options.length).toBe(4);
    }

    const done = await agent.request('POST', '/v1/vocabulary/practice/complete', {
      setId: set.body.setId,
      total: 4,
      correct: 3,
    });
    expect(done.status).toBe(204);
    const [event] = await ctx.database.db
      .select()
      .from(outboxEvents)
      .where(and(eq(outboxEvents.userId, user.id), eq(outboxEvents.type, 'ExerciseCompleted')));
    expect(event!.event).toMatchObject({
      payload: { exerciseId: set.body.setId, correct: false, score: 0.75 },
    });
  });

  it('falls back to saved context sentences without AI', async () => {
    const noAi = await createTestContext({ AI_PROVIDER: 'none' });
    try {
      const agent = new TestAgent(noAi.app);
      await agent.register();
      await saveWords(agent, [
        ['bargain', 'What a bargain!'],
        ['crowded', 'The market is always crowded.'],
        ['stall', null],
      ]);
      const set = await agent.request('POST', '/v1/vocabulary/practice');
      expect(set.body).toMatchObject({ source: 'context', aiStatus: 'disabled' });
      expect(set.body.items.map((item: { sentence: string }) => item.sentence).sort()).toEqual([
        'The market is always ___.',
        'What a ___!',
      ]);
    } finally {
      await noAi.close();
    }
  });
});

describe('pronunciation', () => {
  it('requires a session and validates the text', async () => {
    const anonymous = new TestAgent(ctx.app);
    expect((await anonymous.request('GET', '/v1/vocabulary/pronunciation?text=for')).status).toBe(
      401,
    );

    const agent = new TestAgent(ctx.app);
    await agent.register();
    const longTerm = encodeURIComponent('word '.repeat(20));
    const tooLong = await agent.request('GET', `/v1/vocabulary/pronunciation?text=${longTerm}`);
    expect(tooLong.status).toBe(400);
    const sentence = await agent.request(
      'GET',
      `/v1/vocabulary/pronunciation?kind=sentence&text=${longTerm}`,
    );
    // Valid sentence; the test environment has no speech provider configured.
    expect(sentence.status).toBe(503);
    expect(sentence.body.error).toMatchObject({
      code: 'AI_UNAVAILABLE',
      details: { aiStatus: 'disabled' },
    });
  });
});
