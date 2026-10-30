import { afterAll, beforeAll, expect, it } from 'vitest';
import { skillRewards } from '@lingoup/database/schema/progress';
import { createTestContext, TestAgent, type TestContext } from './harness.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.close();
});

it('requires authentication and saves a 90-minute personalized plan with six skills', async () => {
  const agent = new TestAgent(ctx.app);
  expect((await agent.request('GET', '/v1/progress/development')).status).toBe(401);
  const user = await agent.register();
  const saved = await agent.request('PATCH', '/v1/me/settings', {
    dailyGoalMinutes: 90,
    targetLevel: 'A2',
  });
  expect(saved.status).toBe(200);
  const response = await agent.request('GET', '/v1/progress/development');
  expect(response.status).toBe(200);
  expect(response.body.plan.dailyMinutes).toBe(90);
  expect(response.body.plan.cefrLevel).toBe('A2');
  expect(
    response.body.plan.activities.reduce(
      (total: number, activity: { minutes: number }) => total + activity.minutes,
      0,
    ),
  ).toBe(90);
  expect(response.body.skills).toHaveLength(6);
  expect(response.body.overall).toMatchObject({ xp: 0, level: 1 });
  await ctx.database.db
    .insert(skillRewards)
    .values({ userId: user.id, skill: 'reading', sourceKey: 'integration-reading' });
  const earned = await agent.request('GET', '/v1/progress/development');
  expect(earned.status).toBe(200);
  expect(
    earned.body.skills.find((skill: { skill: string }) => skill.skill === 'reading'),
  ).toMatchObject({ xp: 1, todayXp: 1 });
  expect(
    earned.body.plan.activities.find((activity: { skill: string }) => activity.skill === 'reading')
      .completed,
  ).toBe(1);
  const exported = await agent.request('GET', '/v1/me/export');
  expect(exported.body.sections.progress.skillRewards).toHaveLength(1);
  expect((await agent.request('PATCH', '/v1/me/settings', { dailyGoalMinutes: 241 })).status).toBe(
    400,
  );
});
