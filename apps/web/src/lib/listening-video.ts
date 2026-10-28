/** Only publisher-hosted YouTube embeds; arbitrary URLs are never placed in an iframe. */
export function youtubeEmbed(value: string): { src: string; original: string } | null {
  try {
    const input = value.trim();
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase();
    const youtube = [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'www.youtube-nocookie.com',
    ].includes(host);
    if (!youtube && host !== 'youtu.be') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const id =
      host === 'youtu.be'
        ? parts[0]
        : parts[0] === 'watch'
          ? url.searchParams.get('v')
          : ['embed', 'shorts'].includes(parts[0] ?? '')
            ? parts[1]
            : null;
    const playlist = url.searchParams.get('list');
    if (id && /^[\w-]{11}$/.test(id))
      return {
        src: `https://www.youtube-nocookie.com/embed/${id}?cc_load_policy=1&cc_lang_pref=en&hl=en&rel=0`,
        original: `https://www.youtube.com/watch?v=${id}`,
      };
    if (youtube && playlist && /^[\w-]{10,80}$/.test(playlist))
      return {
        src: `https://www.youtube-nocookie.com/embed/videoseries?list=${playlist}&cc_load_policy=1&cc_lang_pref=en&hl=en`,
        original: `https://www.youtube.com/playlist?list=${playlist}`,
      };
    return null;
  } catch {
    return null;
  }
}

export function subtitlesVtt(text: string): string {
  const clean = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (clean.startsWith('WEBVTT')) return clean;
  if (!/\d{2}:\d{2}:\d{2},\d{3}\s+-->/.test(clean)) throw new Error('Use SRT or WebVTT subtitles');
  return `WEBVTT\n\n${clean.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}\n`;
}
