import { describe, expect, it } from 'vitest';
import { parseDomainEvent } from './index.js';

const base = {
  id: '01923f4e-6b1a-7c3d-8e9f-0a1b2c3d4e5f',
  occurredAt: '2026-10-26T10:00:00.000Z',
  userId: '01923f4e-6b1a-7c3d-8e9f-0a1b2c3d4e60',
};

describe('domain event contracts', () => {
  it('parses a valid WordSaved v1 event', () => {
    const event = parseDomainEvent({
      ...base,
      type: 'WordSaved',
      version: 1,
      payload: {
        wordId: '01923f4e-6b1a-7c3d-8e9f-0a1b2c3d4e61',
        cardId: '01923f4e-6b1a-7c3d-8e9f-0a1b2c3d4e62',
        sourceTextId: null,
      },
    });
    expect(event.type).toBe('WordSaved');
  });

  it('rejects unknown versions so consumers never guess the payload shape', () => {
    expect(() =>
      parseDomainEvent({
        ...base,
        type: 'UserRegistered',
        version: 2,
        payload: { userId: base.userId },
      }),
    ).toThrow();
  });

  it('rejects payloads that do not match the event type', () => {
    expect(() =>
      parseDomainEvent({
        ...base,
        type: 'LessonCompleted',
        version: 1,
        payload: { userId: base.userId },
      }),
    ).toThrow();
  });
});
