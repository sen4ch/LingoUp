const FALLBACK = '/library';
const BASE = 'http://lingoup.invalid';

/**
 * Only allows same-origin relative redirects after login (prevents open redirects).
 * Browsers normalize `\` to `/` and strip tabs/newlines, so `/\evil.com` would become
 * `//evil.com`; resolving against a fixed base catches every such variant.
 */
export function safeNextPath(value: string | null): string {
  // Control characters are matched on purpose: browsers silently strip them from URLs.
  // eslint-disable-next-line no-control-regex
  if (!value?.startsWith('/') || /[\\\u0000-\u001f]/.test(value)) return FALLBACK;
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return FALLBACK;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return FALLBACK;
  }
}
