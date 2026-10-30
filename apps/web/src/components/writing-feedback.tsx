'use client';

import { Fragment, useState } from 'react';
import type { CefrLevel, WritingIssue } from '@lingoup/contracts';
import { Button } from '@lingoup/ui';
import {
  locateWritingIssues,
  prioritizeWritingIssues,
  WRITING_CORRECTION_LIMITS,
  writingIssueLabel,
  writingSegments,
} from '@/lib/writing';

const highlight = (category: string) =>
  category === 'word'
    ? 'bg-red-100 text-red-900 decoration-red-600'
    : category === 'suggestion'
      ? 'bg-blue-100 text-blue-950 decoration-blue-600'
      : 'bg-yellow-100 text-yellow-950 decoration-yellow-600';

interface Props {
  id: string;
  text: string;
  level: CefrLevel;
  issues: WritingIssue[];
  feedback: string;
  correctedText?: string | null;
  needsClarification?: boolean;
}

export function WritingFeedback({
  id,
  text,
  level,
  issues,
  feedback,
  correctedText,
  needsClarification,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const unique = issues.filter(
    (issue, index) =>
      (issue.errorType === 'ambiguity' ||
        issue.quote.trim().toLowerCase() !== issue.replacement.trim().toLowerCase()) &&
      !issues
        .slice(0, index)
        .some(
          (previous) => previous.quote === issue.quote && previous.occurrence === issue.occurrence,
        ),
  );
  const all = prioritizeWritingIssues(unique, level);
  const located = all.flatMap((issue, detailIndex) =>
    locateWritingIssues(text, [issue]).map((location) => ({ ...location, detailIndex })),
  );
  const limit = WRITING_CORRECTION_LIMITS[level];
  const extra = Math.max(0, all.length - limit);
  const correctionId = (index: number) => `${id}-correction-${index}`;
  function openCorrection(index: number) {
    if (index >= limit) setExpanded(true);
    requestAnimationFrame(() => {
      const target = document.getElementById(correctionId(index));
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.focus({ preventScroll: true });
    });
  }
  return (
    <>
      <p lang="en" className="leading-8 whitespace-pre-wrap break-words">
        {writingSegments(text, located).map((segment, index) => {
          if (!segment.correction) return <Fragment key={index}>{segment.text}</Fragment>;
          const detailIndex = located[segment.correction.issueIndex]!.detailIndex;
          const issue = segment.correction.issue;
          return (
            <a
              key={index}
              href={`#${correctionId(detailIndex)}`}
              onClick={(event) => {
                event.preventDefault();
                openCorrection(detailIndex);
              }}
              title={`${writingIssueLabel(issue, level)}: ${issue.replacement} — ${issue.explanation}`}
              className={`rounded px-0.5 underline decoration-2 underline-offset-4 ${highlight(issue.category)}`}
            >
              {segment.text}
            </a>
          );
        })}
      </p>
      <section
        aria-label={`Writing feedback ${level}`}
        className="space-y-4 rounded-xl bg-surface-muted p-4"
      >
        <h3 className="font-semibold">Writing feedback — {level}</h3>
        <p className="text-sm">{feedback}</p>
        {correctedText ? (
          <section
            className="space-y-2 rounded-lg border border-border bg-surface p-4"
            aria-label="Corrected text"
          >
            <h4 className="font-semibold">Corrected text</h4>
            <p lang="en" className="leading-relaxed whitespace-pre-wrap break-words">
              {correctedText}
            </p>
          </section>
        ) : needsClarification ? (
          <p className="text-sm">
            Choose the meaning you intended before we show a complete corrected version.
          </p>
        ) : null}
        <ol className="space-y-4">
          {all.map((issue, index) => (
            <li
              key={index}
              hidden={!expanded && index >= limit}
              id={correctionId(index)}
              tabIndex={-1}
              className="scroll-mt-32 rounded-lg border border-border bg-surface p-4 text-sm"
            >
              <h4 className="font-semibold">
                <span className={`rounded px-1 ${highlight(issue.category)}`}>
                  {index + 1}. {issue.category === 'suggestion' ? 'Suggestion · ' : ''}
                  {writingIssueLabel(issue, level)}
                </span>
              </h4>
              <p className="mt-2">
                <span className="font-medium">Original: </span>
                <span lang="en">{issue.quote}</span>
              </p>
              {issue.errorType !== 'ambiguity' ? (
                <p className="mt-1">
                  <span className="font-medium">
                    {issue.category === 'suggestion' ? 'Optional rewrite: ' : 'Correction: '}
                  </span>
                  <strong lang="en">{issue.replacement || '(remove)'}</strong>
                </p>
              ) : null}
              <p className="mt-2">{issue.explanation}</p>
              {issue.example ? (
                <p className="mt-2 border-l-2 border-border pl-3">
                  <span className="font-medium">Example: </span>
                  <span lang="en">{issue.example}</span>
                </p>
              ) : null}
              {issue.alternatives?.length ? (
                <div className="mt-2 space-y-2">
                  <p className="font-medium">Possible meanings — choose what you intended:</p>
                  <ul className="space-y-2">
                    {issue.alternatives.map((alternative, alternativeIndex) => (
                      <li key={alternativeIndex}>
                        <p className="text-muted">{alternative.meaning}</p>
                        <p lang="en" className="font-semibold">
                          {alternative.replacement}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
        {extra ? (
          <Button
            variant="secondary"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show fewer corrections' : `Show more corrections (${extra})`}
          </Button>
        ) : null}
      </section>
    </>
  );
}
