import type { CefrLevel, WritingIssue, WritingMessage } from '@lingoup/contracts';

export const WRITING_CORRECTION_LIMITS: Record<CefrLevel, number> = {
  A1: 3,
  A2: 4,
  B1: 5,
  B2: 6,
  C1: 50,
  C2: 50,
};

/** Optional focus types allow future mistake-history prioritization without new storage. */
export function prioritizeWritingIssues<T extends WritingIssue>(
  issues: T[],
  level: CefrLevel,
  focusTypes: string[] = [],
): T[] {
  const basic = [
    'sentence_structure',
    'agreement',
    'word_form',
    'word_order',
    'verb_tense',
    'articles',
    'punctuation',
    'spelling',
    'word_choice',
    'sentence_connection',
    'ambiguity',
    'naturalness',
  ];
  const advanced = [
    'sentence_structure',
    'word_order',
    'verb_tense',
    'sentence_connection',
    'agreement',
    'word_form',
    'articles',
    'punctuation',
    'spelling',
    'word_choice',
    'ambiguity',
    'naturalness',
  ];
  const priorities = ['A1', 'A2'].includes(level) ? basic : advanced;
  return [...issues].sort((a, b) => {
    const rank = (issue: T) =>
      focusTypes.includes(issue.errorType ?? '')
        ? -1
        : priorities.indexOf(issue.errorType ?? 'spelling');
    return rank(a) - rank(b);
  });
}

export interface LocatedWritingIssue extends WritingIssue {
  start: number;
  end: number;
}

export function writingIssueLabel(issue: WritingIssue, level?: CefrLevel): string {
  if (level === 'A1') {
    const simple = {
      sentence_structure: 'Missing verb',
      agreement: 'One or many',
      word_form: 'Verb form',
      word_order: 'Questions and word order',
      verb_tense: 'Present or past',
      punctuation: 'Full stops and commas',
      sentence_connection: 'Joining ideas',
      articles: 'A, an and the',
    };
    if (issue.errorType && issue.errorType in simple)
      return simple[issue.errorType as keyof typeof simple];
  }
  const labels = {
    sentence_structure: 'Sentence structure',
    word_order: 'Word order',
    sentence_connection: 'Sentence connection',
    verb_tense: 'Verb tense',
    punctuation: 'Punctuation',
    agreement: 'Agreement',
    articles: 'Articles',
    word_form: 'Word form',
    spelling: 'Spelling',
    word_choice: 'Word choice',
    naturalness: 'Natural phrasing',
    ambiguity: 'Clarify meaning',
  };
  return issue.errorType
    ? labels[issue.errorType]
    : issue.category === 'word'
      ? 'Word error'
      : issue.category === 'suggestion'
        ? 'Suggestion'
        : 'Grammar';
}

/** Normalize typography while retaining positions in the learner's original text. */
function searchable(text: string) {
  let value = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const character of text) {
    const end = offset + character.length;
    const normalized = /\s/u.test(character)
      ? ' '
      : /[‘’]/u.test(character)
        ? "'"
        : /[“”]/u.test(character)
          ? '"'
          : character.toLowerCase();
    if (normalized === ' ' && value.endsWith(' ')) ends[ends.length - 1] = end;
    else
      for (const unit of normalized) {
        value += unit;
        for (let index = 0; index < unit.length; index++) {
          starts.push(offset);
          ends.push(end);
        }
      }
    offset = end;
  }
  return { value, starts, ends };
}

function occurrenceOf(text: string, quote: string, occurrence: number) {
  let from = 0;
  let matched = 0;
  while (from <= text.length) {
    const start = text.indexOf(quote, from);
    if (start === -1) return -1;
    from = start + quote.length;
    const word = (character: string) => /[\p{L}\p{N}_]/u.test(character);
    if (
      (word(quote[0]!) && start > 0 && word(text[start - 1]!)) ||
      (word(quote.at(-1)!) && word(text[from] ?? ''))
    )
      continue;
    if (matched++ === occurrence) return start;
  }
  return -1;
}

/** Match original wording, tolerating typography only. Keep overlapping corrections. */
export function locateWritingIssues(text: string, issues: WritingIssue[]): LocatedWritingIssue[] {
  const found: LocatedWritingIssue[] = [];
  const normalized = searchable(text);
  for (const issue of [...issues].sort(
    (a, b) => Number(a.category !== 'grammar') - Number(b.category !== 'grammar'),
  )) {
    if (!issue.quote) continue;
    if (
      issue.errorType !== 'ambiguity' &&
      issue.quote.trim().toLowerCase() === issue.replacement.trim().toLowerCase()
    )
      continue;
    if (
      typeof issue.start === 'number' &&
      typeof issue.end === 'number' &&
      issue.start >= 0 &&
      issue.end > issue.start &&
      text.slice(issue.start, issue.end) === issue.quote
    ) {
      if (!found.some((existing) => existing.start === issue.start && existing.end === issue.end))
        found.push({ ...issue, start: issue.start, end: issue.end });
      continue;
    }
    let start = occurrenceOf(text, issue.quote, issue.occurrence);
    let end = start + issue.quote.length;
    if (start === -1) {
      const quote = searchable(issue.quote.trim()).value;
      if (!quote) continue;
      const match = occurrenceOf(normalized.value, quote, issue.occurrence);
      if (match !== -1) {
        start = normalized.starts[match]!;
        end = normalized.ends[match + quote.length - 1]!;
      }
    }
    if (start !== -1 && !found.some((existing) => existing.start === start && existing.end === end))
      found.push({ ...issue, quote: text.slice(start, end), start, end });
  }
  return found.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Errors take precedence over optional suggestions when highlights overlap. */
export function writingSegments(text: string, issues: LocatedWritingIssue[]) {
  const priority = { word: 3, grammar: 2, suggestion: 1 };
  const boundaries = [
    ...new Set([0, text.length, ...issues.flatMap((issue) => [issue.start, issue.end])]),
  ].sort((a, b) => a - b);
  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1]!;
    const covering = issues
      .map((issue, issueIndex) => ({ issue, issueIndex }))
      .filter(({ issue }) => issue.start <= start && issue.end >= end)
      .sort(
        (a, b) =>
          priority[b.issue.category] - priority[a.issue.category] ||
          a.issue.end - a.issue.start - (b.issue.end - b.issue.start),
      );
    return { text: text.slice(start, end), correction: covering[0] };
  });
}

/** Bound context by complete email pairs so long exchanges fit the API body limit. */
export function writingContext(messages: WritingMessage[]): WritingMessage[] {
  let context = messages.slice(-20);
  while (context.reduce((total, message) => total + message.content.length, 0) > 14000) {
    context = context.slice(2);
  }
  return context;
}
