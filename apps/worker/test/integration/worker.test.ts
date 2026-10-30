import { randomUUID } from 'node:crypto';
import type { DomainEvent } from '@lingoup/contracts/events';
import { createDatabase, type DatabaseConnection } from '@lingoup/database';
import { users } from '@lingoup/database/schema/identity';
import { outboxEvents, processedEvents } from '@lingoup/database/schema/platform';
import { dailyActivity, skillRewards } from '@lingoup/database/schema/progress';
import { requireTestDatabaseUrl } from '@lingoup/database/testing';
import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ProgressProjector } from '../../src/handlers/progress-projector.js';
import { cleanupEventTables } from '../../src/maintenance.js';
import { OutboxRelay } from '../../src/outbox-relay.js';

let connection: DatabaseConnection;
let valkey: Redis;

beforeAll(() => {
  connection = createDatabase({ connectionString: requireTestDatabaseUrl(), max: 4 });
  const valkeyUrl = process.env.VALKEY_URL;
  if (!valkeyUrl) throw new Error('VALKEY_URL is not set');
  valkey = new Redis(valkeyUrl, { maxRetriesPerRequest: null });
});

afterAll(async () => {
  await connection.close();
  await valkey.quit();
});

async function createUser(): Promise<string> {
  const [user] = await connection.db
    .insert(users)
    .values({ email: `${randomUUID()}@example.test`, passwordHash: 'x', displayName: 'Test' })
    .returning({ id: users.id });
  return user!.id;
}

function wordSaved(userId: string, occurredAt = '2026-10-26T10:00:00.000Z'): DomainEvent {
  return {
    id: randomUUID(),
    type: 'WordSaved',
    version: 1,
    occurredAt,
    userId,
    payload: { wordId: randomUUID(), cardId: randomUUID(), sourceTextId: null },
  };
}

describe('ProgressProjector', () => {
  it('awards each practice once even when different events repeat the same completed result', async () => {
    const userId = await createUser();
    const projector = new ProgressProjector(connection.db);
    const event: DomainEvent = {
      id: randomUUID(),
      type: 'PracticeCompleted',
      version: 1,
      occurredAt: '2026-10-30T10:00:00.000Z',
      userId,
      payload: { skill: 'listening', sourceKey: `listening:${randomUUID()}` },
    };
    await projector.handle(event);
    await projector.handle(event);
    await projector.handle({ ...event, id: randomUUID() });
    const rewards = await connection.db
      .select()
      .from(skillRewards)
      .where(eq(skillRewards.userId, userId));
    expect(rewards).toHaveLength(1);
    expect(rewards[0]?.skill).toBe('listening');
    const [activity] = await connection.db
      .select()
      .from(dailyActivity)
      .where(eq(dailyActivity.userId, userId));
    expect(activity?.exercisesDone).toBe(1);
  });
  it('awards grammar only for the first correct result on an exercise', async () => {
    const userId = await createUser();
    const projector = new ProgressProjector(connection.db);
    const exerciseId = randomUUID();
    for (const correct of [false, true, true])
      await projector.handle({
        id: randomUUID(),
        type: 'ExerciseCompleted',
        version: 1,
        occurredAt: '2026-10-30T10:00:00.000Z',
        userId,
        payload: { exerciseId, attemptId: randomUUID(), correct, score: correct ? 1 : 0 },
      });
    expect(
      await connection.db.select().from(skillRewards).where(eq(skillRewards.userId, userId)),
    ).toHaveLength(1);
  });
  it('projects each event exactly once, even when delivered twice', async () => {
    const userId = await createUser();
    const projector = new ProgressProjector(connection.db);
    const event = wordSaved(userId);

    await projector.handle(event);
    await projector.handle(event);
    await projector.handle(wordSaved(userId));

    const [row] = await connection.db
      .select()
      .from(dailyActivity)
      .where(eq(dailyActivity.userId, userId));
    expect(row).toMatchObject({ day: '2026-10-26', wordsSaved: 2, reviewsDone: 0 });
  });

  it('counts completed exercises', async () => {
    const userId = await createUser();
    const projector = new ProgressProjector(connection.db);
    for (const correct of [true, false]) {
      await projector.handle({
        id: randomUUID(),
        type: 'ExerciseCompleted',
        version: 1,
        occurredAt: '2026-10-27T10:00:00.000Z',
        userId,
        payload: {
          exerciseId: randomUUID(),
          attemptId: randomUUID(),
          correct,
          score: correct ? 1 : 0,
        },
      });
    }
    const [row] = await connection.db
      .select()
      .from(dailyActivity)
      .where(eq(dailyActivity.userId, userId));
    expect(row).toMatchObject({ day: '2026-10-27', exercisesDone: 2, wordsSaved: 0 });
  });

  it('skips events of deleted accounts instead of failing forever', async () => {
    const userId = await createUser();
    await connection.db.delete(users).where(eq(users.id, userId));
    await expect(
      new ProgressProjector(connection.db).handle(wordSaved(userId)),
    ).resolves.toBeUndefined();
  });
});

describe('OutboxRelay', () => {
  it('publishes unpublished events with the event id as job id and marks them published', async () => {
    const queue = new Queue(`relay-test-${randomUUID()}`, { connection: valkey });
    try {
      const userId = await createUser();
      const event = wordSaved(userId);
      await connection.db.insert(outboxEvents).values({
        id: event.id,
        type: event.type,
        version: event.version,
        userId,
        event,
        occurredAt: new Date(event.occurredAt),
      });

      const relay = new OutboxRelay(
        connection.db,
        queue,
        { batchSize: 100, pollIntervalMs: 1000 },
        pino({ level: 'silent' }),
      );
      expect(await relay.relayOnce()).toBeGreaterThanOrEqual(1);

      const job = await queue.getJob(event.id);
      expect(job?.data).toMatchObject({ id: event.id, type: 'WordSaved' });
      const [row] = await connection.db
        .select()
        .from(outboxEvents)
        .where(eq(outboxEvents.id, event.id));
      expect(row?.publishedAt).toBeInstanceOf(Date);

      // Nothing left to publish: a second pass must not enqueue the same event again.
      await relay.relayOnce();
      expect(await queue.getJobCountByTypes('waiting', 'delayed', 'active')).toBe(1);
    } finally {
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });
});

describe('cleanupEventTables', () => {
  it('removes only published outbox rows and processed markers older than the retention window', async () => {
    const userId = await createUser();
    const old = wordSaved(userId, '2026-01-01T00:00:00.000Z');
    const fresh = wordSaved(userId);
    const rows = [old, fresh].map((event) => ({
      id: event.id,
      type: event.type,
      version: event.version,
      userId,
      event,
      occurredAt: new Date(event.occurredAt),
    }));
    await connection.db
      .insert(outboxEvents)
      .values([{ ...rows[0]!, publishedAt: new Date('2026-01-01T00:00:00.000Z') }, rows[1]!]);
    await connection.db.insert(processedEvents).values({
      consumer: 'test',
      eventId: old.id,
      processedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await cleanupEventTables(connection.db, 7, new Date('2026-10-26T00:00:00.000Z'));

    const remaining = await connection.db
      .select({ id: outboxEvents.id })
      .from(outboxEvents)
      .where(eq(outboxEvents.userId, userId));
    expect(remaining.map((r) => r.id)).toEqual([fresh.id]);
    const markers = await connection.db
      .select()
      .from(processedEvents)
      .where(eq(processedEvents.eventId, old.id));
    expect(markers).toHaveLength(0);
  });
});
