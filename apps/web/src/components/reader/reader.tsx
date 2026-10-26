'use client';

import type { TextDetail } from '@lingoup/contracts';
import { tokenize } from '@lingoup/learning-engine';
import { Alert, Kbd } from '@lingoup/ui';
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { t } from '@/i18n';
import { MarkAsRead } from './mark-as-read';
import {
  snapToWords,
  toLookup,
  type Lookup,
  type TokenizedParagraph,
  type WordRange,
} from './selection';
import { WordCard } from './word-card';

interface Cursor {
  paragraph: number;
  token: number;
}

/** Finds the token span that contains a DOM position, or null outside the reader. */
function tokenAt(node: Node | null): Cursor | null {
  const element = node instanceof Element ? node : node?.parentElement;
  const span = element?.closest<HTMLElement>('[data-t]');
  if (!span) return null;
  return { paragraph: Number(span.dataset.p), token: Number(span.dataset.t) };
}

const Paragraph = memo(function Paragraph({
  index,
  paragraph,
  activeFrom,
  activeTo,
}: {
  index: number;
  paragraph: TokenizedParagraph;
  activeFrom: number;
  activeTo: number;
}) {
  return (
    <p className="mb-5 last:mb-0">
      {paragraph.tokens.map((token, tokenIndex) => (
        <span
          key={tokenIndex}
          data-p={index}
          data-t={tokenIndex}
          className={token.isWord ? 'reader-word' : undefined}
          data-active={
            token.isWord && tokenIndex >= activeFrom && tokenIndex <= activeTo ? 'true' : undefined
          }
        >
          {token.text}
        </span>
      ))}
    </p>
  );
});

export function Reader({ text }: { text: TextDetail }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instructionsId = useId();
  const paragraphs = useMemo<TokenizedParagraph[]>(
    () =>
      text.paragraphs.map((paragraphText) => {
        const tokens = tokenize(paragraphText);
        return {
          text: paragraphText,
          tokens,
          words: tokens.flatMap((token, i) => (token.isWord ? [i] : [])),
        };
      }),
    [text.paragraphs],
  );

  const [range, setRange] = useState<WordRange | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const open = useCallback(
    (next: WordRange) => {
      const result = toLookup(paragraphs, next);
      if ('error' in result) {
        setNotice(t.reader.tooLong);
        return;
      }
      setNotice(null);
      setLookup(result);
    },
    [paragraphs],
  );

  const close = useCallback(() => {
    setLookup(null);
    setRange(null);
    window.getSelection()?.removeAllRanges();
    containerRef.current?.focus({ preventScroll: true });
  }, []);

  // Mouse, touch (long-press) and double-click selections all end up as a DOM Selection.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onSelectionChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const selection = window.getSelection();
        const container = containerRef.current;
        if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !container) return;
        const domRange = selection.getRangeAt(0);
        if (!container.contains(domRange.commonAncestorContainer)) return;
        const start = tokenAt(domRange.startContainer);
        if (!start) return;
        // Triple-click ends the range on the next <p>: treat it as "to the end of the paragraph".
        let end = tokenAt(domRange.endContainer) ?? {
          paragraph: start.paragraph,
          token: Number.MAX_SAFE_INTEGER,
        };
        // A range ending at offset 0 of a token does not include that token.
        if (
          domRange.endOffset === 0 &&
          end.paragraph === start.paragraph &&
          end.token > start.token
        ) {
          end = { ...end, token: end.token - 1 };
        }
        const snapped = snapToWords(paragraphs, start, end);
        if (!snapped) return;
        setRange(snapped);
        open(snapped);
      }, 250);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [open, paragraphs]);

  const moveCursor = (
    current: WordRange | null,
    direction: 1 | -1,
    extend: boolean,
  ): WordRange | null => {
    if (!current) {
      const first = paragraphs.findIndex((p) => p.words.length > 0);
      if (first < 0) return null;
      const token = paragraphs[first]!.words[0]!;
      return { paragraph: first, from: token, to: token };
    }
    const paragraph = paragraphs[current.paragraph]!;
    if (extend) {
      const position = paragraph.words.indexOf(current.to);
      const nextWord = paragraph.words[position + direction];
      if (nextWord === undefined || nextWord < current.from) return current;
      return { ...current, to: nextWord };
    }
    const anchor = direction === 1 ? current.to : current.from;
    const nextWord = paragraph.words[paragraph.words.indexOf(anchor) + direction];
    if (nextWord !== undefined)
      return { paragraph: current.paragraph, from: nextWord, to: nextWord };
    // Continue into the neighbouring paragraph.
    for (let p = current.paragraph + direction; p >= 0 && p < paragraphs.length; p += direction) {
      const words = paragraphs[p]!.words;
      if (words.length > 0) {
        const token = direction === 1 ? words[0]! : words.at(-1)!;
        return { paragraph: p, from: token, to: token };
      }
    }
    return current;
  };

  const jumpParagraph = (current: WordRange | null, direction: 1 | -1): WordRange | null => {
    const start = current ? current.paragraph + direction : 0;
    for (let p = start; p >= 0 && p < paragraphs.length; p += direction) {
      const token = paragraphs[p]!.words[0];
      if (token !== undefined) return { paragraph: p, from: token, to: token };
    }
    return current;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: WordRange | null | undefined;
    switch (event.key) {
      case 'ArrowRight':
        next = moveCursor(range, 1, event.shiftKey);
        break;
      case 'ArrowLeft':
        next = moveCursor(range, -1, event.shiftKey);
        break;
      case 'ArrowDown':
        next = jumpParagraph(range, 1);
        break;
      case 'ArrowUp':
        next = jumpParagraph(range, -1);
        break;
      case 'Enter':
      case ' ':
        if (range) {
          event.preventDefault();
          open(range);
        }
        return;
      case 'Escape':
        if (lookup || range) {
          event.preventDefault();
          close();
        }
        return;
      default:
        return;
    }
    event.preventDefault();
    if (!next) return;
    setRange(next);
    const result = toLookup(paragraphs, next);
    setAnnouncement('error' in result ? t.reader.tooLong : t.reader.currentWord(result.term));
    containerRef.current
      ?.querySelector(`[data-p="${next.paragraph}"][data-t="${next.to}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
      <div className="flex flex-col gap-4">
        <p id={instructionsId} className="text-sm text-muted">
          {t.reader.instructions} <Kbd>←</Kbd> <Kbd>→</Kbd> <Kbd>Enter</Kbd> <Kbd>Esc</Kbd>
        </p>
        {notice ? <Alert tone="warning">{notice}</Alert> : null}
        <div
          ref={containerRef}
          tabIndex={0}
          role="group"
          aria-label={t.reader.regionLabel}
          aria-describedby={instructionsId}
          onKeyDown={onKeyDown}
          className="rounded-lg font-reading text-lg leading-relaxed sm:text-xl sm:leading-loose"
        >
          {paragraphs.map((paragraph, index) => (
            <Paragraph
              key={index}
              index={index}
              paragraph={paragraph}
              activeFrom={range?.paragraph === index ? range.from : -1}
              activeTo={range?.paragraph === index ? range.to : -2}
            />
          ))}
        </div>
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
        <MarkAsRead slug={text.slug} />
      </div>

      <aside
        aria-label={t.card.title}
        className={
          lookup
            ? 'fixed inset-x-0 bottom-0 z-40 max-h-[65dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-5 shadow-2xl lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)] lg:rounded-xl lg:border lg:shadow-sm'
            : 'hidden lg:sticky lg:top-24 lg:block'
        }
      >
        {lookup ? (
          <WordCard
            key={`${lookup.term}|${lookup.context}`}
            lookup={lookup}
            textSlug={text.slug}
            onClose={close}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">
            {t.reader.instructions}
          </div>
        )}
      </aside>
    </div>
  );
}
