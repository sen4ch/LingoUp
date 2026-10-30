import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { NextPracticeSchema, type LearningSkill } from '@lingoup/contracts';
import { skillRewards } from '@lingoup/database/schema/progress';
import { texts } from '@lingoup/database/schema/content';
import { cards } from '@lingoup/database/schema/vocabulary';
import { eq } from 'drizzle-orm';
import { ProgressService } from '../../src/modules/progress/index.js';
import { GrammarService } from '../../src/modules/grammar/index.js';
import { AiGateway } from '../../src/modules/ai-gateway/index.js';
import { createTestContext, TestAgent, type TestContext } from './harness.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await ctx.close();
});
async function finish(userId: string, skill: LearningSkill) {
  const development = await ctx.app.get(ProgressService).development(userId);
  const activity = development.plan.activities.find((item) => item.skill === skill)!;
  const needed = Math.max(0, activity.target - activity.completed);
  if (needed)
    await ctx.database.db
      .insert(skillRewards)
      .values(Array.from({ length: needed }, () => ({ userId, skill, sourceKey: randomUUID() })));
}
async function privateText(userId: string) {
  const slug = `next-private-${randomUUID()}`;
  await ctx.database.db
    .insert(texts)
    .values({
      slug,
      title: 'My private A1 text',
      level: 'A1',
      summary: 'A private practice text.',
      paragraphs: ['I live in a small town. I walk to school every day.'],
      wordCount: 13,
      author: 'Test',
      license: 'CC0-1.0',
      provenance: 'ai-generated',
      contentHash: randomUUID(),
      ownerUserId: userId,
      publishedAt: new Date(),
    });
  return slug;
}

it('selects the next available activity at the saved level, handles due cards and stops at a completed plan', async () => {
  const agent = new TestAgent(ctx.app);
  const path = '/v1/learning/next-practice';
  expect((await agent.request('GET', path)).status).toBe(401);
  const user = await agent.register();
  await agent.request('PATCH', '/v1/me/settings', { dailyGoalMinutes: 90, targetLevel: 'A1' });
  const other = new TestAgent(ctx.app);
  const second = await other.register();
  const hidden = await privateText(second.id);
  const ai = vi.spyOn(ctx.app.get(AiGateway), 'run');
  let response = await agent.request('GET', path);
  expect(response.status).toBe(200);
  expect(NextPracticeSchema.safeParse(response.body).success).toBe(true);
  expect(response.body).toMatchObject({
    state: 'ready',
    accountId: user.id,
    level: 'A1',
    href: '/read/a1-morning-routine',
    activity: { skill: 'reading', minutes: 20 },
  });
  expect((await agent.request('GET', '/v1/learning/reading/completions')).body.items).toEqual([]);
  await agent.request('POST', '/v1/learning/reading/a1-morning-routine/complete');
  const topic = await agent.request('GET', '/v1/grammar/topics/a1-present-simple');
  await agent.request('POST', `/v1/grammar/exercises/${topic.body.exercises[0].id}/attempts`, {
    answer: 'drink',
  });
  response = await agent.request('GET', path);
  expect(response.body.href).toBe('/grammar/a1-present-simple#exercises');
  expect(response.body.notes).toHaveLength(2);
  expect(JSON.stringify(response.body)).not.toContain(hidden);
  const owned = await privateText(user.id);
  expect((await agent.request('GET', path)).body.href).toBe(`/read/${owned}`);
  await agent.request('POST', `/v1/learning/reading/${owned}/complete`);
  await finish(user.id, 'reading');
  for (const term of ['apple', 'river', 'train'])
    expect(
      (
        await agent.request('POST', '/v1/vocabulary/words', {
          term,
          definition: `A meaning for ${term}`,
        })
      ).status,
    ).toBe(201);
  response = await agent.request('GET', path);
  expect(response.body).toMatchObject({ href: '/review', activity: { skill: 'vocabulary' } });
  await ctx.database.db
    .update(cards)
    .set({ due: new Date(Date.now() + 7 * 86400_000) })
    .where(eq(cards.userId, user.id));
  expect((await agent.request('GET', path)).body.href).toBe('/vocabulary/practice');
  await finish(user.id, 'vocabulary');
  expect((await agent.request('GET', path)).body.href).toBe('/grammar/a1-present-simple#exercises');
  await finish(user.id, 'grammar');
  expect((await agent.request('GET', path)).body.href).toBe('/listening');
  await finish(user.id, 'listening');
  expect((await agent.request('GET', path)).body.href).toBe('/writing');
  await finish(user.id, 'writing');
  expect((await agent.request('GET', path)).body.href).toBe('/speaking');
  await finish(user.id, 'speaking');
  response = await agent.request('GET', path);
  expect(response.body).toMatchObject({ state: 'complete', activity: null });
  expect(ai).not.toHaveBeenCalled();
});

it('offers setup without pretending that unavailable activities are completed', async () => {
  const agent = new TestAgent(ctx.app);
  const user = await agent.register();
  await agent.request('PATCH', '/v1/me/settings', { dailyGoalMinutes: 90, targetLevel: 'A1' });
  await agent.request('POST', '/v1/learning/reading/a1-morning-routine/complete');
  const grammar = ctx.app.get(GrammarService);
  const topics = await grammar.listTopics('A1', user.id);
  vi.spyOn(grammar, 'listTopics').mockResolvedValue(
    topics.map((topic) => ({
      ...topic,
      progress: { attempted: topic.exerciseCount, correct: topic.exerciseCount },
    })),
  );
  for (const skill of ['listening', 'writing', 'speaking'] as const) await finish(user.id, skill);
  const response = await agent.request('GET', '/v1/learning/next-practice');
  expect(response.body).toMatchObject({
    state: 'setup',
    href: '/library?level=A1',
    activity: null,
  });
  expect(response.body.notes).toHaveLength(3);
  const plan = await ctx.app.get(ProgressService).development(user.id);
  expect(plan.plan.activities.find((activity) => activity.skill === 'reading')!.completed).toBe(0);
});
