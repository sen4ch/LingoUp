import { createHash } from 'node:crypto';
import {
  AI_GENERATED_CONTENT_LICENSE,
  CefrLevelSchema,
  CONTENT_PROVENANCES,
  SlugSchema,
  type GrammarBlock,
  type TextSpan,
} from '@lingoup/contracts';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { normalizeAnswer } from './answer.js';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
const HTML_TAG = /<\/?[a-z][^>]*>/i;
export const GAP = '___';

const promptWithGap = z
  .string()
  .trim()
  .min(3)
  .max(300)
  .refine((value) => value.includes(GAP), `The prompt must contain ${GAP}`);

const ExerciseSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('choice'),
      prompt: promptWithGap,
      options: z.array(z.string().trim().min(1).max(80)).min(2).max(6),
      answer: z.string().trim().min(1).max(80),
      explanation: z.string().trim().max(500).nullable().default(null),
    })
    .refine((exercise) => exercise.options.includes(exercise.answer), {
      message: 'answer must be one of the options',
      path: ['answer'],
    }),
  z.object({
    type: z.literal('gap'),
    prompt: promptWithGap,
    /** Every accepted spelling, e.g. both the contraction and the full form. */
    answers: z.array(z.string().trim().min(1).max(80)).min(1).max(6),
    explanation: z.string().trim().max(500).nullable().default(null),
  }),
]);

const FrontmatterSchema = z
  .object({
    slug: SlugSchema,
    title: z.string().trim().min(1).max(200),
    level: CefrLevelSchema,
    summary: z.string().trim().min(1).max(500),
    author: z.string().trim().min(1).max(200),
    provenance: z.enum(CONTENT_PROVENANCES),
    license: z.string().trim().min(1).max(60),
    exercises: z.array(ExerciseSchema).min(1).max(30),
  })
  .refine(
    (meta) => meta.provenance !== 'ai-generated' || meta.license === AI_GENERATED_CONTENT_LICENSE,
    {
      message: `AI-generated content cannot carry exclusive rights; use license ${AI_GENERATED_CONTENT_LICENSE}`,
      path: ['license'],
    },
  );

export interface GrammarExerciseDefinition {
  kind: 'choice' | 'gap';
  prompt: string;
  options: string[];
  /** The first entry is the canonical answer shown after an attempt. */
  answers: string[];
  explanation: string | null;
}

export type GrammarDocument = Omit<z.infer<typeof FrontmatterSchema>, 'exercises'> & {
  blocks: GrammarBlock[];
  exercises: GrammarExerciseDefinition[];
  contentHash: string;
};

export class GrammarFormatError extends Error {
  constructor(source: string, reason: string) {
    super(`${source}: ${reason}`);
    this.name = 'GrammarFormatError';
  }
}

/** `**bold**` is the only inline markup; everything else is plain text. */
export function parseSpans(text: string): TextSpan[] {
  const spans: TextSpan[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) spans.push({ text: text.slice(last, match.index), strong: false });
    spans.push({ text: match[1]!, strong: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) spans.push({ text: text.slice(last), strong: false });
  return spans;
}

/**
 * Markdown subset for rule explanations, separated by blank lines:
 * `## heading`, `- list item` lines, `> example` lines, paragraphs and `**bold**`.
 * The result is structured data, rendered as React elements (never as HTML).
 */
export function parseBlocks(markdown: string): GrammarBlock[] {
  const blocks: GrammarBlock[] = [];
  for (const chunk of markdown.split(/\r?\n\s*\r?\n/)) {
    const lines = chunk
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;
    const first = lines[0]!;
    if (/^#{2,3} /.test(first) && lines.length === 1) {
      blocks.push({ type: 'heading', text: first.replace(/^#{2,3} /, '') });
    } else if (lines.every((line) => line.startsWith('- '))) {
      blocks.push({ type: 'list', items: lines.map((line) => parseSpans(line.slice(2))) });
    } else if (lines.every((line) => line.startsWith('> '))) {
      for (const line of lines) blocks.push({ type: 'example', spans: parseSpans(line.slice(2)) });
    } else {
      blocks.push({ type: 'paragraph', spans: parseSpans(lines.join(' ')) });
    }
  }
  return blocks;
}

export function parseGrammarDocument(raw: string, source: string): GrammarDocument {
  const match = FRONTMATTER.exec(raw.replace(/^\uFEFF/, ''));
  if (!match) throw new GrammarFormatError(source, 'missing YAML frontmatter');

  const meta = FrontmatterSchema.safeParse(parseYaml(match[1]!));
  if (!meta.success) {
    const issues = meta.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new GrammarFormatError(source, `invalid frontmatter (${issues})`);
  }
  const body = match[2]!;
  if (HTML_TAG.test(body)) throw new GrammarFormatError(source, 'HTML is not allowed');
  const blocks = parseBlocks(body);
  if (blocks.length === 0) throw new GrammarFormatError(source, 'the rule explanation is empty');

  const { exercises, ...rest } = meta.data;
  return {
    ...rest,
    blocks,
    exercises: exercises.map((exercise) =>
      exercise.type === 'choice'
        ? {
            kind: 'choice',
            prompt: exercise.prompt,
            options: exercise.options,
            answers: [exercise.answer],
            explanation: exercise.explanation,
          }
        : {
            kind: 'gap',
            prompt: exercise.prompt,
            options: [],
            answers: exercise.answers,
            explanation: exercise.explanation,
          },
    ),
    contentHash: createHash('sha256').update(raw).digest('hex'),
  };
}

/** True when the learner's answer matches any accepted answer (case and spacing ignored). */
export function isAcceptedAnswer(answer: string, accepted: readonly string[]): boolean {
  const normalized = normalizeAnswer(answer);
  return accepted.some((candidate) => normalizeAnswer(candidate) === normalized);
}
