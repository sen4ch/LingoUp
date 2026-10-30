import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { ReadingCheckSchema } from '@lingoup/contracts';
import { readingChecks } from '@lingoup/database/schema/learning';
import { texts } from '@lingoup/database/schema/content';
import { outboxEvents } from '@lingoup/database/schema/platform';
import { and, eq } from 'drizzle-orm';
import { AiGateway } from '../../src/modules/ai-gateway/index.js';
import { authoredReadingCheck } from '../../src/modules/learning/domain/reading-checks.js';
import { ContentQuery } from '../../src/modules/content/index.js';
import { createTestContext, TestAgent, type TestContext } from './harness.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await ctx.close();
});

it('provides grounded checks for all six levels without AI, grades on the server, saves results and grants completion once', async () => {
  const agent = new TestAgent(ctx.app);
  const path = '/v1/learning/reading/a1-morning-routine/check';
  expect((await agent.request('POST', path)).status).toBe(401);
  const user = await agent.register();
  expect((await agent.request('GET', path)).body).toEqual({ check: null });
  const run = vi.spyOn(ctx.app.get(AiGateway), 'run');
  for (const slug of [
    'a1-morning-routine',
    'a2-weekend-market',
    'b1-learning-to-cycle',
    'b2-four-day-week',
    'c1-memory-and-forgetting',
    'c2-the-cartographers-dilemma',
  ]) {
    const response = await agent.request('POST', `/v1/learning/reading/${slug}/check`);
    expect(response.status).toBe(200);
    expect(ReadingCheckSchema.safeParse(response.body).success).toBe(true);
    expect(response.body.source).toBe('authored');
    const passage = await ctx.app.get(ContentQuery).getText(slug, user.id);
    const content = authoredReadingCheck(passage)!;
    expect(
      content.questions.every((q) => passage.paragraphs.join('\n\n').includes(q.evidence)),
    ).toBe(true);
    expect(response.body.questions).toHaveLength(3);
    expect(response.body.questions[0]).not.toHaveProperty('answerIndex');
    expect(response.body.questions[0]).not.toHaveProperty('explanation');
    expect(response.body.questions[0]).not.toHaveProperty('evidence');
  }
  expect(run).not.toHaveBeenCalled();
  const started = await agent.request('POST', path);
  const id = started.body.id as string;
  expect((await agent.request('POST', path)).body.id).toBe(id);
  const answerPath = `${path}/${id}/answers`;
  expect((await agent.request('POST', answerPath, { answers: [0, 2] })).status).toBe(400);
  expect((await agent.request('POST', answerPath, { answers: [0, 2, 7] })).status).toBe(400);
  const failed = await agent.request('POST', answerPath, { answers: [1, 0, 0] });
  expect(failed.body.result).toMatchObject({ correct: 0, total: 3, passed: false, score: 0 });
  expect((await agent.request('GET', '/v1/learning/reading/completions')).body.items).toHaveLength(
    0,
  );
  const passed = await agent.request('POST', answerPath, { answers: [0, 2, 0] });
  expect(passed.body.result).toMatchObject({ correct: 2, total: 3, passed: true, score: 67 });
  expect(passed.body.result.results[2]).toMatchObject({ correct: false, answerIndex: 3 });
  expect(passed.body.result.results[2].evidence).toContain('eight');
  expect((await agent.request('GET', path)).body.check.result.score).toBe(67);
  await agent.request('POST', answerPath, { answers: [0, 2, 3] });
  expect((await agent.request('GET', '/v1/learning/reading/completions')).body.items).toHaveLength(
    1,
  );
  const events = await ctx.database.db
    .select()
    .from(outboxEvents)
    .where(and(eq(outboxEvents.userId, user.id), eq(outboxEvents.type, 'LessonCompleted')));
  expect(events).toHaveLength(1);
  const other = new TestAgent(ctx.app);
  await other.register();
  expect((await other.request('POST', answerPath, { answers: [0, 2, 3] })).status).toBe(404);
  expect((await agent.request('GET', '/v1/me/export')).body.sections.readingChecks).toHaveLength(6);
  expect((await agent.request('DELETE', '/v1/me', { password: user.password })).status).toBe(204);
  expect(
    await ctx.database.db.select().from(readingChecks).where(eq(readingChecks.userId, user.id)),
  ).toHaveLength(0);
});

it('protects private texts, generates grounded AI questions, and invalidates checks when a passage changes', async () => {
  const agent = new TestAgent(ctx.app);
  const user = await agent.register();
  const other = new TestAgent(ctx.app);
  await other.register();
  const slug = `private-check-${randomUUID()}`;
  const passage = [
    'Mila travels by train to a museum on Saturday. She goes there to see paintings.',
  ];
  const [text] = await ctx.database.db
    .insert(texts)
    .values({
      slug,
      title: 'A museum visit',
      level: 'A2',
      summary: 'Mila visits a museum.',
      topics: [],
      paragraphs: passage,
      wordCount: 17,
      author: 'Test',
      license: 'CC0-1.0',
      provenance: 'ai-generated',
      contentHash: randomUUID(),
      publishedAt: new Date(),
      ownerUserId: user.id,
    })
    .returning();
  const path = `/v1/learning/reading/${slug}/check`;
  expect((await other.request('POST', path)).status).toBe(404);
  expect((await other.request('GET', path)).status).toBe(404);
  const run = vi.spyOn(ctx.app.get(AiGateway), 'run');
  const questions = [
    {
      question: 'How does Mila travel?',
      options: ['By train', 'By bus', 'By car', 'On foot'],
      answerIndex: 0,
      explanation: 'The text says she travels by train.',
      evidence: 'Mila travels by train',
    },
    {
      question: 'Where does she go?',
      options: ['To a school', 'To a museum', 'To a shop', 'To a park'],
      answerIndex: 1,
      explanation: 'Her destination is a museum.',
      evidence: 'to a museum on Saturday',
    },
    {
      question: 'Why does she go?',
      options: ['To swim', 'To work', 'To see paintings', 'To buy food'],
      answerIndex: 2,
      explanation: 'She wants to see paintings.',
      evidence: 'She goes there to see paintings.',
    },
  ];
  run.mockResolvedValueOnce({
    status: 'ok',
    result: {
      provider: 'test-local',
      model: 'fixture',
      output: { questions: questions.map((q) => ({ ...q, evidence: 'invented quote' })) },
    },
  });
  expect((await agent.request('POST', path)).status).toBe(503);
  expect((await agent.request('GET', path)).body.check).toBeNull();
  run.mockResolvedValueOnce({
    status: 'ok',
    result: { provider: 'test-local', model: 'fixture', output: { questions } },
  });
  const response = await agent.request('POST', path);
  expect(response.status).toBe(200);
  expect(response.body.source).toBe('ai');
  expect(run).toHaveBeenLastCalledWith(
    'reading-comprehension',
    { level: 'A2', text: passage[0] },
    expect.objectContaining({ userId: user.id }),
  );
  await ctx.database.db
    .update(texts)
    .set({ paragraphs: ['Mila stays at home.'] })
    .where(eq(texts.id, text!.id));
  expect((await agent.request('GET', path)).body.check).toBeNull();
  expect(
    (await agent.request('POST', `${path}/${response.body.id}/answers`, { answers: [0, 1, 2] }))
      .status,
  ).toBe(404);
});
