import { SpacedRepetitionScheduler } from '@lingoup/learning-engine';

/** FSRS scheduler with default parameters (desired retention 0.9, fuzzed intervals). */
export const SCHEDULER = Symbol('SCHEDULER');

export const schedulerProvider = {
  provide: SCHEDULER,
  useFactory: () => new SpacedRepetitionScheduler(),
};
