'use client';

import { MAX_TERM_WORDS } from '@lingoup/contracts';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  blockText,
  excludedTranslationNode,
  INTERACTIVE_TEXT,
  lookupText,
  textBlock,
} from '@/lib/text-lookup';
import type { Lookup } from './reader/selection';
import { WordCard } from './reader/word-card';

type OpenWord = {
  lookup: Lookup;
  left: number;
  top: number;
  range: Range;
  focus: boolean;
  host: Element;
};
type CaretDocument = Omit<Document, 'caretPositionFromPoint' | 'caretRangeFromPoint'> & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

export function SiteWordTranslation() {
  const pathname = usePathname();
  return <WordTranslation key={pathname} pathname={pathname} />;
}

function WordTranslation({ pathname }: { pathname: string }) {
  const [word, setWord] = useState<OpenWord | null>(null);
  const [notice, setNotice] = useState('');
  const [draftSelected, setDraftSelected] = useState(false);
  const draftAction = useRef<() => void>(() => {});
  const [draftHost, setDraftHost] = useState<Element | null>(null);
  const popupOpen = useRef(false);
  const panel = useRef<HTMLElement>(null);
  const source = useRef<HTMLElement | null>(null);
  const close = useCallback(() => {
    setWord(null);
    setNotice('');
    window.getSelection()?.removeAllRanges();
    if (source.current?.isConnected) source.current.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    popupOpen.current = !!word;
    if (!word) return;
    if (typeof Highlight !== 'undefined' && 'highlights' in CSS)
      CSS.highlights.set('site-word-translation', new Highlight(word.range));
    if (word.focus)
      panel.current?.querySelector<HTMLButtonElement>('button[aria-label="Close"]')?.focus();
    return () => {
      if (typeof CSS !== 'undefined' && 'highlights' in CSS)
        CSS.highlights.delete('site-word-translation');
    };
  }, [word]);
  useEffect(() => {
    let start: { x: number; y: number } | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function show(
      root: Element,
      result: ReturnType<typeof lookupText>,
      range: Range | null,
      focus = false,
    ) {
      if (!result) return;
      if ('error' in result) {
        setNotice(`Select up to ${MAX_TERM_WORDS} words (80 characters) to translate.`);
        return;
      }
      if (!range) return;
      const rect = range.getBoundingClientRect();
      source.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setNotice('');
      setWord({
        lookup: {
          term: result.term,
          context: result.context,
          range: { paragraph: 0, from: 0, to: 0 },
        },
        left: Math.max(16, Math.min(rect.left, window.innerWidth - 416)),
        top: Math.max(16, Math.min(rect.bottom + 12, window.innerHeight - 600)),
        range,
        focus,
        host: root.closest('dialog[open]') ?? document.body,
      });
    }
    function selected(focus = false) {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
      const range = selection.getRangeAt(0);
      if (
        excludedTranslationNode(range.startContainer) ||
        excludedTranslationNode(range.endContainer)
      )
        return false;
      const root = textBlock(range.startContainer);
      if (!root) return false;
      const content = blockText(root);
      const from = content.offset(range.startContainer, range.startOffset);
      const to = root.contains(range.endContainer)
        ? content.offset(range.endContainer, range.endOffset)
        : content.text.length;
      if (from === null || to === null) return false;
      const result = lookupText(content.text, from, to);
      show(
        root,
        result,
        result && !('error' in result) ? content.range(result.from, result.to) : null,
        focus,
      );
      return !!result;
    }
    let draftField: HTMLInputElement | HTMLTextAreaElement | null = null;
    function editable(open: boolean, fromButton = false) {
      const field = fromButton ? draftField : document.activeElement;
      if (!(field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement))
        return false;
      if (field instanceof HTMLInputElement && !['text', 'search'].includes(field.type))
        return false;
      if (
        /password/i.test(field.autocomplete) ||
        /password|secret|token|api.?key|credential/i.test(field.name)
      )
        return false;
      const from = field.selectionStart;
      const to = field.selectionEnd;
      if (from === null || to === null || from === to) return false;
      draftField = field;
      setDraftHost(field.closest('dialog[open]') ?? document.body);
      if (open) {
        const range = document.createRange();
        range.selectNode(field);
        show(field, lookupText(field.value, from, to), range, !fromButton);
        source.current = field;
      }
      return true;
    }
    draftAction.current = () => {
      editable(true, true);
    };
    const down = (event: PointerEvent) => {
      start = event.isPrimary && event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
    };
    const cancel = () => {
      start = null;
    };
    const up = (event: PointerEvent) => {
      const initial = start;
      start = null;
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest('[data-translation-ignore]')) return;
      if (target.closest('[data-word-reader]')) {
        setWord(null);
        return;
      }
      if (!initial || Math.hypot(event.clientX - initial.x, event.clientY - initial.y) > 7) return;
      if (excludedTranslationNode(target) || target.closest(INTERACTIVE_TEXT)) {
        setWord(null);
        return;
      }
      if (selected()) return;
      const doc = document as CaretDocument;
      const caret = doc.caretPositionFromPoint?.(event.clientX, event.clientY);
      const legacy = caret ? null : doc.caretRangeFromPoint?.(event.clientX, event.clientY);
      const node = caret?.offsetNode ?? legacy?.startContainer;
      const position = caret?.offset ?? legacy?.startOffset;
      if (
        !node ||
        position === undefined ||
        !target.contains(node) ||
        excludedTranslationNode(node)
      ) {
        setWord(null);
        return;
      }
      const root = textBlock(node);
      if (!root) return;
      const content = blockText(root);
      const offset = content.offset(node, position);
      if (offset === null) return;
      const result = lookupText(content.text, offset);
      const range = result && !('error' in result) ? content.range(result.from, result.to) : null;
      if (
        !range ||
        ![...range.getClientRects()].some(
          (rect) =>
            event.clientX >= rect.left - 2 &&
            event.clientX <= rect.right + 2 &&
            event.clientY >= rect.top - 2 &&
            event.clientY <= rect.bottom + 2,
        )
      ) {
        setWord(null);
        return;
      }
      show(root, result, range);
    };
    const changed = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setDraftSelected(editable(false));
        selected();
      }, 300);
    };
    const key = (event: KeyboardEvent) => {
      if (event.altKey && event.code === 'KeyT' && !event.ctrlKey && !event.metaKey) {
        if (editable(true) || selected(true)) event.preventDefault();
      }
      if (event.key === 'Escape') {
        if (popupOpen.current) event.preventDefault();
        setWord(null);
        setNotice('');
        setDraftSelected(false);
      }
    };
    document.addEventListener('pointerdown', down);
    document.addEventListener('pointercancel', cancel);
    document.addEventListener('pointerup', up);
    document.addEventListener('selectionchange', changed);
    document.addEventListener('keydown', key);
    const modalClosed = () => {
      setWord(null);
      setDraftSelected(false);
    };
    document.addEventListener('close', modalClosed, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointercancel', cancel);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('selectionchange', changed);
      document.removeEventListener('keydown', key);
      document.removeEventListener('close', modalClosed, true);
    };
  }, [pathname]);

  return (
    <>
      {draftSelected &&
        !word &&
        draftHost &&
        createPortal(
          <button
            className="site-translate-selection"
            data-translation-ignore
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => draftAction.current()}
          >
            Translate selected text
          </button>,
          draftHost,
        )}
      {notice && (
        <div className="site-translation-notice" role="status" data-translation-ignore>
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Close translation notice">
            ×
          </button>
        </div>
      )}
      {word &&
        createPortal(
          <aside
            ref={panel}
            className="site-word-translation"
            data-translation-ignore
            role="dialog"
            aria-modal="false"
            aria-label="Word translation"
            style={{ left: word.left, '--translation-top': `${word.top}px` } as CSSProperties}
          >
            <WordCard
              key={`${pathname}|${word.lookup.term}|${word.lookup.context}`}
              lookup={word.lookup}
              onClose={close}
            />
            <p className="site-translation-tip">
              Click a word or select a short phrase anywhere. <kbd>Alt + T</kbd> translates a
              selection. <kbd>Esc</kbd> closes this card.
            </p>
          </aside>,
          word.host,
        )}
    </>
  );
}
