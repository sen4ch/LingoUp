import { MAX_TERM_WORDS } from '@lingoup/contracts';
import { sentenceAt, tokenize } from '@lingoup/learning-engine';

/** Snap a click/selection to complete words and retain the surrounding sentence. */
export function lookupText(text: string, start: number, end = start) {
  const words = tokenize(text).filter((token) => token.isWord);
  const selected =
    end > start
      ? words.filter((word) => word.start < end && word.start + word.text.length > start)
      : words
          .filter((word) => word.start <= start && word.start + word.text.length >= start)
          .slice(0, 1);
  if (!selected.length) return null;
  const first = selected[0]!;
  const last = selected.at(-1)!;
  const term = text.slice(first.start, last.start + last.text.length).trim();
  if (!/\p{L}/u.test(term)) return null;
  if (selected.length > MAX_TERM_WORDS || term.length > 80) return { error: 'too_long' as const };
  const sentence = sentenceAt(text, first.start);
  const sentenceStart = text.lastIndexOf(sentence, first.start);
  const contextStart = Math.max(
    0,
    Math.min(sentence.length - 600, first.start - Math.max(0, sentenceStart) - 240),
  );
  return {
    term,
    context: sentence.slice(contextStart, contextStart + 600),
    from: first.start,
    to: last.start + last.text.length,
  };
}

const EXCLUDED =
  'input,textarea,select,option,[contenteditable]:not([contenteditable="false"]),[role="textbox"],script,style,code,pre,svg,canvas,video,audio,[hidden],[aria-hidden="true"],.sr-only,[data-translation-ignore],[data-word-reader]';
export const INTERACTIVE_TEXT =
  'button,a,summary,label,[role="button"],[role="tab"],[role="option"],[role="switch"],[role="checkbox"],[role="radio"],[draggable="true"]';

export function excludedTranslationNode(node: Node | null) {
  const element = node instanceof Element ? node : node?.parentElement;
  return !element || !!element.closest(EXCLUDED);
}

export function textBlock(node: Node) {
  const element = node instanceof Element ? node : node.parentElement;
  return (
    element?.closest('p,li,h1,h2,h3,h4,h5,h6,blockquote,dt,dd,figcaption,td,th,label') ?? element
  );
}

/** Read visible text without wrapping or replacing React-owned DOM nodes. */
export function blockText(root: Element) {
  const nodes: { node: Text; start: number }[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let text = '';
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (excludedTranslationNode(node)) continue;
    const parent = node.parentElement;
    if (!parent || parent.closest('button,select,option')) continue;
    const style = getComputedStyle(parent);
    const visible = document.createRange();
    visible.selectNodeContents(node);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      !visible.getClientRects().length
    )
      continue;
    nodes.push({ node, start: text.length });
    text += node.data;
    if (text.length > 30_000) break;
  }
  function offset(node: Node, position: number) {
    if (node.nodeType === Node.TEXT_NODE) {
      const entry = nodes.find((entry) => entry.node === node);
      return entry ? entry.start + Math.min(position, entry.node.length) : null;
    }
    const child = node.childNodes[position];
    const entry = child
      ? nodes.find((entry) => child === entry.node || child.contains(entry.node))
      : undefined;
    if (entry) return entry.start;
    const contained = nodes.filter((entry) => node.contains(entry.node));
    const last = contained.at(-1);
    return last ? last.start + last.node.length : null;
  }
  function range(from: number, to: number) {
    const first = nodes.find((entry) => entry.start + entry.node.length > from);
    const last = nodes.find((entry) => entry.start + entry.node.length >= to);
    if (!first || !last) return null;
    const result = document.createRange();
    result.setStart(first.node, Math.max(0, from - first.start));
    result.setEnd(last.node, Math.min(last.node.length, to - last.start));
    return result;
  }
  return { text, offset, range };
}
