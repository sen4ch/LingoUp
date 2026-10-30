import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { WeeklyReportSchema } from '@lingoup/contracts';
import { studyDay, shiftStudyDay } from '@lingoup/learning-engine';
import { focusTime, skillRewards, mistakeEntries } from '@lingoup/database/schema/progress';
import { eq } from 'drizzle-orm';
import { WeeklyReportService } from '../../src/modules/progress/application/weekly-report.service.js';
import { createTestContext, TestAgent, type TestContext } from './harness.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.close();
});

it('authenticates timer writes, accepts cumulative retries, rejects account/day changes, exports and cascades data', async () => {
  const agent = new TestAgent(ctx.app);
  expect((await agent.request('GET', '/v1/progress/weekly')).status).toBe(401);
  expect((await agent.request('POST', '/v1/progress/focus-time', {})).status).toBe(401);
  const user = await agent.register();
  const other = new TestAgent(ctx.app);
  const second = await other.register();
  const entry = { id: randomUUID(), skill: 'reading', day: studyDay(), milliseconds: 10_000 };
  for (const milliseconds of [10_000, 10_000, 5000, 20_000]) {
    expect(
      (
        await agent.request('POST', '/v1/progress/focus-time', {
          accountId: user.id,
          entries: [{ ...entry, milliseconds }],
        })
      ).status,
    ).toBe(200);
  }
  expect(
    (
      await other.request('POST', '/v1/progress/focus-time', {
        accountId: user.id,
        entries: [entry],
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await agent.request('POST', '/v1/progress/focus-time', {
        accountId: user.id,
        entries: [{ ...entry, skill: 'writing' }],
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await agent.request('POST', '/v1/progress/focus-time', {
        accountId: user.id,
        entries: [{ ...entry, day: shiftStudyDay(entry.day, 1) }],
      })
    ).status,
  ).toBe(400);
  const batch = await agent.request('POST', '/v1/progress/focus-time', {
    accountId: user.id,
    entries: [
      { ...entry, id: randomUUID() },
      { ...entry, skill: 'writing' },
    ],
  });
  expect(batch.status).toBe(400);
  const rows = await ctx.database.db.select().from(focusTime).where(eq(focusTime.userId, user.id));
  expect(rows).toHaveLength(1);
  expect(rows[0]!.milliseconds).toBe(20_000);
  const report = await agent.request('GET', '/v1/progress/weekly');
  expect(report.status).toBe(200);
  expect(WeeklyReportSchema.safeParse(report.body).success).toBe(true);
  expect(report.body.totals).toMatchObject({ seconds: 20, xp: 0, activeDays: 1 });
  expect((await other.request('GET', '/v1/progress/weekly')).body.totals.seconds).toBe(0);
  expect((await agent.request('GET', '/v1/progress/weekly?offset=53')).status).toBe(400);
  const exported = await agent.request('GET', '/v1/me/export');
  expect(exported.body.sections.studyTime).toHaveLength(1);
  expect(
    await ctx.database.db.select().from(skillRewards).where(eq(skillRewards.userId, user.id)),
  ).toHaveLength(0);
  expect((await agent.request('DELETE', '/v1/me', { password: user.password })).status).toBe(204);
  expect(
    await ctx.database.db.select().from(focusTime).where(eq(focusTime.userId, user.id)),
  ).toHaveLength(0);
  expect(second.id).not.toBe(user.id);
});

it('reports Kyiv week boundaries, skill/player gains, saved words and errors without mixing suggestions or other accounts', async () => {
  const agent = new TestAgent(ctx.app);
  const user = await agent.register();
  await agent.request('PATCH', '/v1/me/settings', { dailyGoalMinutes: 90 });
  const before = [
    ...Array.from({ length: 8 }, (_, index) => ({
      userId: user.id,
      skill: 'reading',
      sourceKey: `older-reading-${index}`,
      earnedAt: new Date('2026-10-10T10:00:00Z'),
    })),
    ...Array.from({ length: 9 }, (_, index) => ({
      userId: user.id,
      skill: 'grammar',
      sourceKey: `older-grammar-${index}`,
      earnedAt: new Date('2026-10-10T10:00:00Z'),
    })),
    {
      userId: user.id,
      skill: 'reading',
      sourceKey: 'previous-reading',
      earnedAt: new Date('2026-10-25T21:59:59Z'),
    },
    {
      userId: user.id,
      skill: 'grammar',
      sourceKey: 'previous-grammar',
      earnedAt: new Date('2026-10-20T10:00:00Z'),
    },
  ];
  const earned = [
    {
      userId: user.id,
      skill: 'reading',
      sourceKey: 'monday',
      earnedAt: new Date('2026-10-25T22:00:00Z'),
    },
    ...['reading', 'grammar', 'grammar', 'grammar', 'vocabulary', 'vocabulary', 'vocabulary'].map(
      (skill, index) => ({
        userId: user.id,
        skill,
        sourceKey: index >= 4 && index < 6 ? `save:${randomUUID()}` : randomUUID(),
        earnedAt: new Date('2026-10-30T10:00:00Z'),
      }),
    ),
    {
      userId: user.id,
      skill: 'reading',
      sourceKey: 'next-monday',
      earnedAt: new Date('2026-11-01T22:00:00Z'),
    },
  ];
  await ctx.database.db.insert(skillRewards).values([...before, ...earned]);
  await ctx.database.db.insert(focusTime).values([
    {
      userId: user.id,
      sessionId: randomUUID(),
      skill: 'reading',
      day: '2026-10-26',
      milliseconds: 60_000,
    },
    {
      userId: user.id,
      sessionId: randomUUID(),
      skill: 'writing',
      day: '2026-10-28',
      milliseconds: 120_000,
    },
    {
      userId: user.id,
      sessionId: randomUUID(),
      skill: 'reading',
      day: '2026-10-25',
      milliseconds: 30_000,
    },
  ]);
  await ctx.database.db
    .insert(mistakeEntries)
    .values(
      Array.from({ length: 6 }, (_, index) => ({
        userId: user.id,
        fingerprint: randomUUID(),
        source: 'writing',
        category: index === 5 ? 'suggestion' : index < 3 ? 'word' : 'grammar',
        errorType: index === 5 ? 'naturalness' : index < 3 ? 'spelling' : 'verb_tense',
        original: 'I go',
        corrected: 'I went',
        explanation: 'Use the past tense.',
        context: 'A day out',
        sourceHref: '/writing',
        createdAt: new Date('2026-10-30T10:00:00Z'),
        resolvedAt: index === 0 ? new Date('2026-10-30T11:00:00Z') : null,
      })),
    );
  const report = await ctx.app
    .get(WeeklyReportService)
    .report(user.id, 0, new Date('2026-10-30T12:00:00Z'));
  expect(report.period).toEqual({
    start: '2026-10-26',
    end: '2026-11-01',
    offset: 0,
    complete: false,
  });
  expect(report.totals).toMatchObject({
    xp: 8,
    previousXp: 2,
    seconds: 180,
    previousSeconds: 30,
    activeDays: 3,
    textsRead: 2,
    wordsAdded: 2,
    grammarSolved: 3,
    newMistakes: 5,
    openMistakes: 4,
  });
  expect(report.player).toEqual({ startLevel: 1, endLevel: 2 });
  expect(report.currentWeeklyGoalMinutes).toBe(630);
  expect(report.skills.find((skill) => skill.skill === 'reading')).toMatchObject({
    xp: 2,
    seconds: 60,
    startLevel: 1,
    endLevel: 2,
  });
  expect(report.commonErrors).toEqual([
    { type: 'spelling', count: 3 },
    { type: 'verb_tense', count: 2 },
  ]);
  expect(report.nextGoal).toMatchObject({ title: 'Review 3 saved corrections', href: '/mistakes' });
  expect(report.days[0]).toMatchObject({ day: '2026-10-26', xp: 1, seconds: 60 });
  const previous = await ctx.app
    .get(WeeklyReportService)
    .report(user.id, 1, new Date('2026-10-30T12:00:00Z'));
  expect(previous.period.complete).toBe(true);
  expect(previous.totals).toMatchObject({ xp: 2, seconds: 30 });
});
