import { describe, expect, it } from 'vitest';
import { SpacedRepetitionScheduler } from './fsrs.js';

const DAY_MS = 86_400_000;
const scheduler = new SpacedRepetitionScheduler({ enableFuzz: false });
const start = new Date('2026-10-26T09:00:00.000Z');

describe('SpacedRepetitionScheduler', () => {
  it('creates a new card that is due immediately', () => {
    const card = scheduler.createCard(start);
    expect(card.state).toBe('new');
    expect(card.due.getTime()).toBe(start.getTime());
    expect(card.reps).toBe(0);
    expect(card.lastReviewAt).toBeNull();
  });

  it('orders preview intervals again <= hard <= good <= easy', () => {
    const preview = scheduler.preview(scheduler.createCard(start), start);
    expect(preview.again.getTime()).toBeLessThanOrEqual(preview.hard.getTime());
    expect(preview.hard.getTime()).toBeLessThanOrEqual(preview.good.getTime());
    expect(preview.good.getTime()).toBeLessThanOrEqual(preview.easy.getTime());
  });

  it('grows intervals with consecutive successful reviews', () => {
    let card = scheduler.createCard(start);
    let now = start;
    const intervals: number[] = [];
    for (let i = 0; i < 5; i++) {
      const outcome = scheduler.review(card, 'good', now);
      intervals.push(outcome.card.due.getTime() - now.getTime());
      card = outcome.card;
      now = card.due;
    }
    expect(card.state).toBe('review');
    expect(card.reps).toBe(5);
    expect(intervals.at(-1)!).toBeGreaterThan(intervals[0]!);
    expect(intervals.at(-1)!).toBeGreaterThan(DAY_MS);
  });

  it('counts a lapse and moves to relearning when a review card is forgotten', () => {
    let card = scheduler.createCard(start);
    let now = start;
    while (card.state !== 'review') {
      card = scheduler.review(card, 'good', now).card;
      now = card.due;
    }
    const outcome = scheduler.review(card, 'again', now);
    expect(outcome.card.state).toBe('relearning');
    expect(outcome.card.lapses).toBe(1);
    expect(outcome.log.previousState).toBe('review');
  });

  it('is deterministic without fuzz', () => {
    const card = scheduler.createCard(start);
    const a = scheduler.review(card, 'easy', start).card.due;
    const b = scheduler.review(card, 'easy', start).card.due;
    expect(a.getTime()).toBe(b.getTime());
  });
});
