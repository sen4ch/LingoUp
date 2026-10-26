import { z } from 'zod';
import { CefrLevelSchema, IsoDateTimeSchema, UuidSchema } from '../common.js';
import { CardStateSchema, ReviewRatingSchema } from '../vocabulary.js';

/**
 * Versioned domain event contracts.
 *
 * Rules:
 * - A published (type, version) pair is immutable. Breaking changes add a new version;
 *   consumers keep handling old versions until the outbox no longer contains them.
 * - Payloads carry ids and facts, never secrets. Personal free-text is avoided where possible.
 */
const defineEvent = <TType extends string, TVersion extends number, TPayload extends z.ZodType>(
  type: TType,
  version: TVersion,
  payload: TPayload,
) =>
  z.object({
    id: UuidSchema,
    type: z.literal(type),
    version: z.literal(version),
    occurredAt: IsoDateTimeSchema,
    userId: UuidSchema.nullable(),
    payload,
  });

export const UserRegisteredV1 = defineEvent('UserRegistered', 1, z.object({ userId: UuidSchema }));

export const WordSavedV1 = defineEvent(
  'WordSaved',
  1,
  z.object({
    wordId: UuidSchema,
    cardId: UuidSchema,
    sourceTextId: UuidSchema.nullable(),
  }),
);

export const VocabularyReviewCompletedV1 = defineEvent(
  'VocabularyReviewCompleted',
  1,
  z.object({
    cardId: UuidSchema,
    reviewLogId: UuidSchema,
    rating: ReviewRatingSchema,
    previousState: CardStateSchema,
    nextState: CardStateSchema,
    nextDue: IsoDateTimeSchema,
  }),
);

export const LessonCompletedV1 = defineEvent(
  'LessonCompleted',
  1,
  z.object({
    lessonType: z.enum(['reading']),
    textId: UuidSchema,
    level: CefrLevelSchema,
  }),
);

// Contracts below are reserved for upcoming modules and are not published yet.

export const LessonStartedV1 = defineEvent(
  'LessonStarted',
  1,
  z.object({ lessonType: z.enum(['reading', 'grammar', 'listening']), lessonId: UuidSchema }),
);

export const ExerciseCompletedV1 = defineEvent(
  'ExerciseCompleted',
  1,
  z.object({
    exerciseId: UuidSchema,
    attemptId: UuidSchema,
    correct: z.boolean(),
    score: z.number().min(0).max(1),
  }),
);

export const SKILLS = [
  'reading',
  'listening',
  'speaking',
  'writing',
  'grammar',
  'vocabulary',
] as const;
export const SkillSchema = z.enum(SKILLS);

export const AssessmentCompletedV1 = defineEvent(
  'AssessmentCompleted',
  1,
  z.object({
    assessmentId: UuidSchema,
    skills: z.array(
      z.object({
        skill: SkillSchema,
        level: CefrLevelSchema,
        confidence: z.number().min(0).max(1),
      }),
    ),
  }),
);

export const SkillLevelUpdatedV1 = defineEvent(
  'SkillLevelUpdated',
  1,
  z.object({
    skill: SkillSchema,
    previousLevel: CefrLevelSchema.nullable(),
    level: CefrLevelSchema,
    confidence: z.number().min(0).max(1),
  }),
);

export const LearningPlanUpdatedV1 = defineEvent(
  'LearningPlanUpdated',
  1,
  z.object({ planId: UuidSchema, revision: z.number().int().positive() }),
);

export const DomainEventSchema = z.discriminatedUnion('type', [
  UserRegisteredV1,
  WordSavedV1,
  VocabularyReviewCompletedV1,
  LessonCompletedV1,
  LessonStartedV1,
  ExerciseCompletedV1,
  AssessmentCompletedV1,
  SkillLevelUpdatedV1,
  LearningPlanUpdatedV1,
]);
export type DomainEvent = z.infer<typeof DomainEventSchema>;
export type DomainEventType = DomainEvent['type'];
export type DomainEventOf<T extends DomainEventType> = Extract<DomainEvent, { type: T }>;

/** Event without envelope fields that the outbox fills in (id, occurredAt). */
export type NewDomainEvent<T extends DomainEventType = DomainEventType> = T extends DomainEventType
  ? Omit<DomainEventOf<T>, 'id' | 'occurredAt'>
  : never;

export function parseDomainEvent(input: unknown): DomainEvent {
  return DomainEventSchema.parse(input);
}

/** BullMQ queue that the outbox relay publishes domain events to. */
export const DOMAIN_EVENTS_QUEUE = 'domain-events';
