import { z } from 'zod';
import { GlossaryEntrySchema, SlugSchema } from './content.js';
import { IsoDateTimeSchema, pageOf, PageQuerySchema, UuidSchema } from './common.js';

export const MAX_TERM_WORDS = 6;

/** A word or a short phrase. */
export const TermSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine(
    (value) => value.split(/\s+/).length <= MAX_TERM_WORDS,
    `A term may contain at most ${MAX_TERM_WORDS} words`,
  );

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const LookupRequestSchema = z.object({
  term: TermSchema,
  /** Sentence the term was selected in; used for disambiguation. */
  context: z.string().trim().max(600).default(''),
  textSlug: SlugSchema.optional(),
});
export type LookupRequest = z.infer<typeof LookupRequestSchema>;

export const AI_LOOKUP_STATUSES = [
  /** AI explanation is included. */
  'ok',
  /** Not requested: the curated glossary already explains the term. */
  'skipped',
  /** No AI provider is configured. */
  'disabled',
  /** The provider is external and the user has not consented to data sharing. */
  'consent_required',
  'quota_exceeded',
  /** Provider failed, timed out or returned invalid output. */
  'unavailable',
] as const;
export const AiLookupStatusSchema = z.enum(AI_LOOKUP_STATUSES);
export type AiLookupStatus = z.infer<typeof AiLookupStatusSchema>;

export const AiExplanationSchema = z.object({
  provider: z.string(),
  model: z.string(),
  /** True when the explanation came from a placeholder provider, not a language model. */
  isMock: z.boolean(),
  definition: z.string(),
  translation: z.string().nullable(),
  partOfSpeech: z.string().nullable(),
  example: z.string().nullable(),
  usageNote: z.string().nullable(),
});
export type AiExplanation = z.infer<typeof AiExplanationSchema>;

export const LookupResponseSchema = z.object({
  term: z.string(),
  normalizedTerm: z.string(),
  glossary: GlossaryEntrySchema.nullable(),
  ai: AiExplanationSchema.nullable(),
  aiStatus: AiLookupStatusSchema,
  savedWordId: UuidSchema.nullable(),
});
export type LookupResponse = z.infer<typeof LookupResponseSchema>;

export const SaveWordRequestSchema = z.object({
  term: TermSchema,
  definition: optionalText(500),
  translation: optionalText(200),
  contextSentence: optionalText(600),
  sourceTextSlug: SlugSchema.nullable().optional(),
  note: optionalText(500),
});
export type SaveWordRequest = z.infer<typeof SaveWordRequestSchema>;

export const UpdateWordRequestSchema = SaveWordRequestSchema.pick({
  definition: true,
  translation: true,
  contextSentence: true,
  note: true,
});
export type UpdateWordRequest = z.infer<typeof UpdateWordRequestSchema>;

export const CARD_STATES = ['new', 'learning', 'review', 'relearning'] as const;
export const CardStateSchema = z.enum(CARD_STATES);
export type CardState = z.infer<typeof CardStateSchema>;

export const WORD_IMAGE_SOURCES = ['wikimedia', 'openverse', 'upload'] as const;

/**
 * Picture the learner chose for a word. The bytes are served by
 * GET /v1/vocabulary/words/:id/image; attribution fields are shown under the picture
 * because Creative Commons licenses require it.
 */
export const WordImageSchema = z.object({
  source: z.enum(WORD_IMAGE_SOURCES),
  title: z.string().nullable(),
  creator: z.string().nullable(),
  license: z.string().nullable(),
  licenseUrl: z.string().nullable(),
  landingUrl: z.string().nullable(),
  /** Changes on every replacement; use it to bust the browser cache. */
  updatedAt: IsoDateTimeSchema,
});
export type WordImage = z.infer<typeof WordImageSchema>;

export const WordSchema = z.object({
  id: UuidSchema,
  term: z.string(),
  normalizedTerm: z.string(),
  definition: z.string().nullable(),
  translation: z.string().nullable(),
  contextSentence: z.string().nullable(),
  sourceTextSlug: z.string().nullable(),
  note: z.string().nullable(),
  image: WordImageSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  card: z.object({
    id: UuidSchema,
    state: CardStateSchema,
    due: IsoDateTimeSchema,
    reps: z.number().int(),
    lapses: z.number().int(),
  }),
});
export type Word = z.infer<typeof WordSchema>;

export const ListWordsQuerySchema = PageQuerySchema.extend({
  q: z.string().trim().min(1).max(80).optional(),
});
export type ListWordsQuery = z.infer<typeof ListWordsQuerySchema>;

export const WordPageSchema = pageOf(WordSchema);
export type WordPage = z.infer<typeof WordPageSchema>;

export const IdParamSchema = z.object({ id: UuidSchema });

export const REVIEW_RATINGS = ['again', 'hard', 'good', 'easy'] as const;
export const ReviewRatingSchema = z.enum(REVIEW_RATINGS);
export type ReviewRating = z.infer<typeof ReviewRatingSchema>;

export const ReviewCardSchema = z.object({
  cardId: UuidSchema,
  wordId: UuidSchema,
  term: z.string(),
  definition: z.string().nullable(),
  translation: z.string().nullable(),
  contextSentence: z.string().nullable(),
  image: WordImageSchema.nullable(),
  state: CardStateSchema,
  due: IsoDateTimeSchema,
  /** Next due date for each rating, so the UI can show intervals on the buttons. */
  nextDue: z.object({
    again: IsoDateTimeSchema,
    hard: IsoDateTimeSchema,
    good: IsoDateTimeSchema,
    easy: IsoDateTimeSchema,
  }),
});
export type ReviewCard = z.infer<typeof ReviewCardSchema>;

export const DueReviewsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type DueReviewsQuery = z.infer<typeof DueReviewsQuerySchema>;

export const DueReviewsResponseSchema = z.object({
  cards: z.array(ReviewCardSchema),
  totalDue: z.number().int().nonnegative(),
});
export type DueReviewsResponse = z.infer<typeof DueReviewsResponseSchema>;

export const SubmitReviewRequestSchema = z.object({
  cardId: UuidSchema,
  rating: ReviewRatingSchema,
  /** Client-generated id; resubmitting the same id is a no-op (idempotency). */
  clientReviewId: UuidSchema,
  durationMs: z.number().int().min(0).max(3_600_000).optional(),
});
export type SubmitReviewRequest = z.infer<typeof SubmitReviewRequestSchema>;

export const SubmitReviewResponseSchema = z.object({
  cardId: UuidSchema,
  state: CardStateSchema,
  due: IsoDateTimeSchema,
  reviewedAt: IsoDateTimeSchema,
  /** True when this clientReviewId was already processed; nothing changed. */
  duplicate: z.boolean(),
});
export type SubmitReviewResponse = z.infer<typeof SubmitReviewResponseSchema>;

/** Gap-fill practice built from the learner's own words. */
export const PracticeItemSchema = z.object({
  wordId: UuidSchema,
  term: z.string(),
  /** Sentence with the term replaced by ___. */
  sentence: z.string(),
  hint: z.string().nullable(),
  options: z.array(z.string()),
  /** Self-practice: the answer is included so the client can check instantly. */
  answer: z.string(),
});
export type PracticeItem = z.infer<typeof PracticeItemSchema>;

export const PRACTICE_SOURCES = ['ai', 'context'] as const;

export const PracticeSetSchema = z.object({
  setId: UuidSchema,
  /** ai: sentences written by the model; context: the learner's saved context sentences. */
  source: z.enum(PRACTICE_SOURCES),
  provider: z.string().nullable(),
  isMock: z.boolean(),
  /** Why AI sentences were not used, when source is context. */
  aiStatus: AiLookupStatusSchema,
  items: z.array(PracticeItemSchema),
});
export type PracticeSet = z.infer<typeof PracticeSetSchema>;

export const CompletePracticeRequestSchema = z
  .object({
    setId: UuidSchema,
    total: z.number().int().min(1).max(20),
    correct: z.number().int().min(0).max(20),
  })
  .refine((value) => value.correct <= value.total, 'correct cannot exceed total');
export type CompletePracticeRequest = z.infer<typeof CompletePracticeRequestSchema>;

export const PRONUNCIATION_KINDS = ['term', 'sentence'] as const;

/**
 * Pronunciation audio (audio/mpeg). A term is a single dictionary entry; a sentence is the
 * context it was read in and may come from the learner's private text.
 */
export const PronunciationQuerySchema = z
  .object({
    text: z.string().trim().min(1).max(600),
    kind: z.enum(PRONUNCIATION_KINDS).default('term'),
  })
  .refine((value) => value.kind === 'sentence' || value.text.length <= 80, {
    message: 'A term is at most 80 characters',
    path: ['text'],
  });
export type PronunciationQuery = z.infer<typeof PronunciationQuerySchema>;

export const ImageSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
  page: z.coerce.number().int().min(1).max(10).default(1),
});
export type ImageSearchQuery = z.infer<typeof ImageSearchQuerySchema>;

/** Provider-specific image id: a Wikimedia page id or an Openverse UUID. */
export const ImageIdSchema = z.string().regex(/^[A-Za-z0-9-]{1,64}$/, 'Invalid image id');

/** A free-licensed image found by image search; its thumbnail is proxied by the API. */
export const ImageCandidateSchema = z.object({
  id: ImageIdSchema,
  title: z.string().nullable(),
  creator: z.string().nullable(),
  license: z.string().nullable(),
  licenseUrl: z.string().nullable(),
  landingUrl: z.string().nullable(),
});
export type ImageCandidate = z.infer<typeof ImageCandidateSchema>;

export const ImageSearchResponseSchema = z.object({
  items: z.array(ImageCandidateSchema),
  hasMore: z.boolean(),
});
export type ImageSearchResponse = z.infer<typeof ImageSearchResponseSchema>;

export const ChooseWordImageRequestSchema = z.object({ imageId: ImageIdSchema });
export type ChooseWordImageRequest = z.infer<typeof ChooseWordImageRequestSchema>;

export const ImageIdParamSchema = z.object({ imageId: ImageIdSchema });

/** Image types accepted for uploads; every image is re-encoded to WebP on the server. */
export const WORD_IMAGE_UPLOAD_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;
export const WORD_IMAGE_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
