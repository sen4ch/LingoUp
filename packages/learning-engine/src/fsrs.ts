import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type FSRS,
  type Grade,
} from 'ts-fsrs';

export const CARD_STATES = ['new', 'learning', 'review', 'relearning'] as const;
export type CardState = (typeof CARD_STATES)[number];

export const RATINGS = ['again', 'hard', 'good', 'easy'] as const;
export type ReviewRating = (typeof RATINGS)[number];

/**
 * Persisted scheduling state of a card. Library-agnostic on purpose: the database and
 * the API depend on this shape, not on ts-fsrs internals.
 */
export interface CardSchedule {
  state: CardState;
  due: Date;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  lastReviewAt: Date | null;
}

export interface ReviewOutcome {
  card: CardSchedule;
  log: {
    rating: ReviewRating;
    previousState: CardState;
    reviewedAt: Date;
    /** Due date before this review, useful to analyse how late the review was. */
    previousDue: Date;
    stability: number;
    difficulty: number;
    scheduledDays: number;
  };
}

export interface SchedulerOptions {
  /** Target probability of recall at the due date (FSRS "desired retention"). */
  requestRetention?: number;
  /** Upper bound for intervals, in days. */
  maximumIntervalDays?: number;
  /** Randomizes long intervals slightly so reviews do not clump. Disable in tests. */
  enableFuzz?: boolean;
}

const STATE_TO_FSRS: Record<CardState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

const FSRS_TO_STATE: Record<State, CardState> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

const RATING_TO_GRADE: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function toFsrsCard(card: CardSchedule): Card {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    // Still required by the Card type in ts-fsrs 5, but ignored: elapsed time is derived
    // from last_review. Remove when upgrading to ts-fsrs 6.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    elapsed_days: 0,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_TO_FSRS[card.state],
    ...(card.lastReviewAt ? { last_review: card.lastReviewAt } : {}),
  };
}

function fromFsrsCard(card: Card): CardSchedule {
  return {
    state: FSRS_TO_STATE[card.state],
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    lastReviewAt: card.last_review ?? null,
  };
}

export class SpacedRepetitionScheduler {
  private readonly engine: FSRS;

  constructor(options: SchedulerOptions = {}) {
    this.engine = fsrs(
      generatorParameters({
        request_retention: options.requestRetention ?? 0.9,
        maximum_interval: options.maximumIntervalDays ?? 36_500,
        enable_fuzz: options.enableFuzz ?? true,
      }),
    );
  }

  /** A brand-new card that is due immediately. */
  createCard(now: Date): CardSchedule {
    return fromFsrsCard(createEmptyCard(now));
  }

  review(card: CardSchedule, rating: ReviewRating, now: Date): ReviewOutcome {
    const result = this.engine.next(toFsrsCard(card), now, RATING_TO_GRADE[rating]);
    return {
      card: fromFsrsCard(result.card),
      log: {
        rating,
        previousState: card.state,
        reviewedAt: now,
        previousDue: card.due,
        stability: result.log.stability,
        difficulty: result.log.difficulty,
        scheduledDays: result.log.scheduled_days,
      },
    };
  }

  /** Due date the card would get for each rating; used to label review buttons. */
  preview(card: CardSchedule, now: Date): Record<ReviewRating, Date> {
    const outcomes = this.engine.repeat(toFsrsCard(card), now);
    return {
      again: outcomes[Rating.Again].card.due,
      hard: outcomes[Rating.Hard].card.due,
      good: outcomes[Rating.Good].card.due,
      easy: outcomes[Rating.Easy].card.due,
    };
  }
}
