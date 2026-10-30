import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { WritingOutputSchema } from '@lingoup/contracts';
import { SpeakingTutorOutputSchema } from '@lingoup/ai-sdk';
import { mistakeEntries } from '@lingoup/database/schema/progress';
import { eq, sql } from 'drizzle-orm';
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

it('captures wrong grammar answers once, scopes access, filters, paginates, exports and deletes account data', async () => {
  const agent = new TestAgent(ctx.app);
  expect((await agent.request('GET', '/v1/progress/mistakes')).status).toBe(401);
  const user = await agent.register();
  const other = new TestAgent(ctx.app);
  await other.register();
  const topic = await agent.request('GET', '/v1/grammar/topics/a1-present-simple');
  const [first, second] = topic.body.exercises as { id: string }[];
  for (const answer of ['drink', 'drink', 'drinks']) {
    expect(
      (await agent.request('POST', `/v1/grammar/exercises/${first!.id}/attempts`, { answer }))
        .status,
    ).toBe(200);
  }
  let journal = await agent.request('GET', '/v1/progress/mistakes');
  expect(journal.status).toBe(200);
  expect(journal.body.items).toHaveLength(1);
  const entry = journal.body.items[0];
  expect(entry).toMatchObject({
    source: 'grammar',
    original: 'drink',
    corrected: 'drinks',
    resolvedAt: null,
    sourceHref: '/grammar/a1-present-simple',
  });
  expect(entry).not.toHaveProperty('userId');
  expect(entry).not.toHaveProperty('fingerprint');
  // Simulate a pre-journal account, then run the actual migration's historical import.
  await ctx.database.db.delete(mistakeEntries).where(eq(mistakeEntries.userId, user.id));
  const migration = readFileSync(
    new URL('../../../../packages/database/migrations/0005_mistake-journal.sql', import.meta.url),
    'utf8',
  );
  await ctx.database.db.execute(sql.raw(migration.split('--> statement-breakpoint').at(-1)!));
  const imported = await agent.request('GET', '/v1/progress/mistakes');
  expect(imported.body.items).toHaveLength(1);
  expect(imported.body.items[0]).toMatchObject({ original: 'drink', corrected: 'drinks' });
  entry.id = imported.body.items[0].id;
  expect((await other.request('GET', '/v1/progress/mistakes')).body.items).toEqual([]);
  expect(
    (await other.request('PATCH', `/v1/progress/mistakes/${entry.id}`, { resolved: true })).status,
  ).toBe(404);
  expect(
    (await agent.request('PATCH', `/v1/progress/mistakes/${entry.id}`, { resolved: true })).status,
  ).toBe(200);
  expect((await agent.request('GET', '/v1/progress/mistakes')).body.counts).toEqual({
    open: 0,
    resolved: 1,
  });
  expect(
    (await agent.request('GET', '/v1/progress/mistakes?status=resolved&source=grammar')).body.items,
  ).toHaveLength(1);
  expect(
    (await agent.request('GET', '/v1/progress/mistakes?status=all&source=writing')).body.items,
  ).toHaveLength(0);
  await agent.request('POST', `/v1/grammar/exercises/${first!.id}/attempts`, { answer: 'drink' });
  expect((await agent.request('GET', '/v1/progress/mistakes')).body.counts).toEqual({
    open: 0,
    resolved: 1,
  });
  await agent.request('PATCH', `/v1/progress/mistakes/${entry.id}`, { resolved: false });
  await agent.request('POST', `/v1/grammar/exercises/${second!.id}/attempts`, {
    answer: 'nonsense',
  });
  journal = await agent.request('GET', '/v1/progress/mistakes?limit=1');
  expect(journal.body.items).toHaveLength(1);
  const next = await agent.request(
    'GET',
    `/v1/progress/mistakes?limit=1&cursor=${journal.body.nextCursor}`,
  );
  expect(next.body.items).toHaveLength(1);
  expect(next.body.items[0].id).not.toBe(journal.body.items[0].id);
  expect(next.body.nextCursor).toBeNull();
  expect((await agent.request('GET', '/v1/progress/mistakes?source=invalid')).status).toBe(400);
  expect(
    (await agent.request('PATCH', `/v1/progress/mistakes/${entry.id}`, { resolved: 'yes' })).status,
  ).toBe(400);
  const exported = await agent.request('GET', '/v1/me/export');
  expect(exported.body.sections.mistakes).toHaveLength(2);
  expect((await agent.request('DELETE', '/v1/me', { password: user.password })).status).toBe(204);
  expect(
    await ctx.database.db.select().from(mistakeEntries).where(eq(mistakeEntries.userId, user.id)),
  ).toHaveLength(0);
});

it('saves validated writing and speaking fragments but excludes invented quotes, unchanged wording and demo feedback', async () => {
  const agent = new TestAgent(ctx.app);
  await agent.register();
  const request = {
    messages: [
      { role: 'assistant', content: 'Hello! What did you do yesterday?' },
      { role: 'user', content: 'Yesterday I go to a amaizing park.' },
    ],
  };
  const run = vi.spyOn(ctx.app.get(AiGateway), 'run');
  const issue = {
    quote: 'I go',
    replacement: 'I went',
    occurrence: 0,
    category: 'grammar',
    errorType: 'verb_tense',
    explanation: 'Use the past simple with yesterday.',
    example: 'Yesterday I went to the park.',
  };
  const output = WritingOutputSchema.parse({
    subject: 'Your day',
    reply: 'That sounds lovely. Who went with you?',
    feedback: 'Review the past tense.',
    issues: [
      issue,
      { ...issue, quote: 'invented phrase' },
      { ...issue, quote: 'park', replacement: 'park' },
    ],
  });
  const result = {
    status: 'ok' as const,
    result: { provider: 'test-local', model: 'fixture', output },
  };
  run.mockResolvedValueOnce(result).mockResolvedValueOnce(result);
  expect((await agent.request('POST', '/v1/learning/writing/turn', request)).status).toBe(200);
  expect((await agent.request('POST', '/v1/learning/writing/turn', request)).status).toBe(200);
  let journal = await agent.request('GET', '/v1/progress/mistakes?source=writing');
  expect(journal.body.items).toHaveLength(1);
  expect(journal.body.items[0]).toMatchObject({
    original: 'I go',
    corrected: 'I went',
    errorType: 'verb_tense',
    example: issue.example,
  });
  const speaking = SpeakingTutorOutputSchema.parse({
    reply: 'You went to the park. What did you see there?',
    corrections: [{ ...issue }],
  });
  run.mockResolvedValueOnce({
    status: 'ok',
    result: { provider: 'test-local', model: 'fixture', output: speaking },
  });
  expect((await agent.request('POST', '/v1/learning/speaking/turn', request)).status).toBe(200);
  journal = await agent.request('GET', '/v1/progress/mistakes?source=speaking');
  expect(journal.body.items).toHaveLength(1);
  run.mockRestore();
  expect((await agent.request('POST', '/v1/learning/writing/turn', request)).status).toBe(200);
  expect((await agent.request('GET', '/v1/progress/mistakes?status=all')).body.items).toHaveLength(
    2,
  );
});
