import { users, sessions } from '@lingoup/database/schema/identity';
import { words } from '@lingoup/database/schema/vocabulary';
import { outboxEvents } from '@lingoup/database/schema/platform';
import { randomInt, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, TestAgent, type TestContext } from './harness.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.close();
});

describe('identity', () => {
  it('registers, emits UserRegistered via the outbox and returns the current user', async () => {
    const agent = new TestAgent(ctx.app);
    const user = await agent.register();
    const me = await agent.request('GET', '/v1/me');
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      email: user.email,
      settings: { aiDataSharing: false, targetLevel: 'B1' },
    });

    const events = await ctx.database.db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.userId, user.id));
    expect(events.map((e) => e.type)).toContain('UserRegistered');
  });

  it('stores only a hash of the session token and an Argon2id password hash', async () => {
    const agent = new TestAgent(ctx.app);
    const user = await agent.register();
    const [row] = await ctx.database.db.select().from(users).where(eq(users.id, user.id));
    expect(row!.passwordHash.startsWith('$argon2id$')).toBe(true);
    const [session] = await ctx.database.db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id));
    expect(session!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects duplicate emails case-insensitively', async () => {
    const agent = new TestAgent(ctx.app);
    const user = await agent.register();
    const other = new TestAgent(ctx.app);
    const response = await other.request('POST', '/v1/auth/register', {
      email: user.email.toUpperCase(),
      password: 'another-password-123',
      displayName: 'Dup',
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('logs in with valid credentials only, and logout revokes the session', async () => {
    const agent = new TestAgent(ctx.app);
    const user = await agent.register();
    await agent.request('POST', '/v1/auth/logout');
    expect((await agent.request('GET', '/v1/me')).status).toBe(401);

    const wrong = await agent.request('POST', '/v1/auth/login', {
      email: user.email,
      password: 'wrong-password',
    });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');

    const ok = await agent.request('POST', '/v1/auth/login', {
      email: user.email,
      password: user.password,
    });
    expect(ok.status).toBe(200);
    expect((await agent.request('GET', '/v1/me')).status).toBe(200);
  });

  it('validates input and never echoes internals', async () => {
    const agent = new TestAgent(ctx.app);
    const response = await agent.request('POST', '/v1/auth/register', {
      email: 'not-an-email',
      password: 'short',
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.requestId).toBeTypeOf('string');
  });

  it('rejects state-changing requests from foreign origins', async () => {
    const agent = new TestAgent(ctx.app);
    const response = await agent.request(
      'POST',
      '/v1/auth/login',
      { email: 'a@b.c', password: 'x' },
      { origin: 'https://evil.example' },
    );
    expect(response.status).toBe(403);
  });

  const failLogin = (agent: TestAgent, email = `nobody-${randomUUID()}@example.test`) =>
    agent.request('POST', '/v1/auth/login', { email, password: 'wrong-password' });

  it('rate-limits login attempts per client IP', async () => {
    const agent = new TestAgent(ctx.app);
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await failLogin(agent)).status);
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it('limits failed logins per account even when the attacker rotates IP addresses', async () => {
    const owner = new TestAgent(ctx.app);
    const user = await owner.register();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++)
      statuses.push((await failLogin(new TestAgent(ctx.app), user.email)).status);
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    // Even the right password is refused until the window expires (documented trade-off).
    const locked = await new TestAgent(ctx.app).request('POST', '/v1/auth/login', {
      email: user.email,
      password: user.password,
    });
    expect(locked.status).toBe(429);
  });

  it('counts IPv6 clients per /64 network', async () => {
    const prefix = `2001:db8:${randomInt(0xffff).toString(16)}:${randomInt(0xffff).toString(16)}`;
    const statuses: number[] = [];
    // A new address inside the same /64 for every attempt.
    for (let i = 1; i <= 12; i++) {
      statuses.push(
        (await failLogin(new TestAgent(ctx.app, `${prefix}::${i.toString(16)}`))).status,
      );
    }
    expect(statuses.at(-1)).toBe(429);
  });

  it('updates settings with validation', async () => {
    const agent = new TestAgent(ctx.app);
    await agent.register();
    const ok = await agent.request('PATCH', '/v1/me/settings', {
      targetLevel: 'C1',
      aiDataSharing: true,
    });
    expect(ok.body).toMatchObject({ targetLevel: 'C1', aiDataSharing: true });
    const bad = await agent.request('PATCH', '/v1/me/settings', { targetLevel: 'D9' });
    expect(bad.status).toBe(400);
  });

  it('exports personal data and deletes the account with all of it', async () => {
    const agent = new TestAgent(ctx.app);
    const user = await agent.register();
    await agent.request('POST', '/v1/vocabulary/words', {
      term: 'resilient',
      translation: 'устойчивый',
    });

    const exported = await agent.request('GET', '/v1/me/export');
    expect(exported.status).toBe(200);
    expect(Object.keys(exported.body.sections).sort()).toEqual([
      'account',
      'grammar',
      'learning',
      'privateTexts',
      'progress',
      'vocabulary',
    ]);
    expect(exported.body.sections.vocabulary.words[0].term).toBe('resilient');
    expect(JSON.stringify(exported.body)).not.toContain('argon2');

    expect((await agent.request('DELETE', '/v1/me', { password: 'wrong' })).status).toBe(401);
    expect((await agent.request('DELETE', '/v1/me', { password: user.password })).status).toBe(204);

    const db = ctx.database.db;
    expect(await db.select().from(users).where(eq(users.id, user.id))).toHaveLength(0);
    expect(await db.select().from(words).where(eq(words.userId, user.id))).toHaveLength(0);
    expect(
      await db.select().from(outboxEvents).where(eq(outboxEvents.userId, user.id)),
    ).toHaveLength(0);
  });
});
