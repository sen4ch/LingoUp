import type { PronunciationQuery } from '@lingoup/contracts';

export interface VoiceLike {
  lang: string;
  localService: boolean;
  default: boolean;
}

/**
 * Picks an English voice: American first, then any English. With `localOnly`, voices that
 * send text to an online service (e.g. Chrome's Google voices) are excluded.
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], localOnly: boolean): V | null {
  const usable = voices.filter((voice) => !localOnly || voice.localService);
  const byLang = (prefix: string) =>
    usable
      .filter((voice) => voice.lang.replace('_', '-').toLowerCase().startsWith(prefix))
      .sort(
        (a, b) =>
          Number(b.localService) - Number(a.localService) || Number(b.default) - Number(a.default),
      );
  return byLang('en-us')[0] ?? byLang('en')[0] ?? null;
}

let current: HTMLAudioElement | null = null;
/** After a server failure (e.g. speech not configured) use the browser voice for a while. */
const SERVER_RETRY_MS = 5 * 60_000;
let serverFailedAt = -Infinity;

function stopPlayback() {
  current?.pause();
  current = null;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

/** Voices load asynchronously in Chrome; waits briefly for them. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  if (voices.length > 0) return Promise.resolve(voices);
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener('voiceschanged', done);
      resolve(synth.getVoices());
    };
    synth.addEventListener('voiceschanged', done);
    setTimeout(done, 1500);
  });
}

async function speakWithBrowser(text: string, localOnly: boolean): Promise<void> {
  if (!('speechSynthesis' in window)) throw new Error('Speech synthesis is not supported');
  const voice = pickVoice(await loadVoices(), localOnly);
  if (!voice) throw new Error('No suitable voice');
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.9;
  await new Promise<void>((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = (event) =>
      event.error === 'interrupted' || event.error === 'canceled'
        ? resolve()
        : reject(new Error(event.error));
    window.speechSynthesis.speak(utterance);
  });
}

async function playFromServer(query: PronunciationQuery): Promise<void> {
  const params = new URLSearchParams({ text: query.text, kind: query.kind });
  const audio = new Audio(`/api/v1/vocabulary/pronunciation?${params.toString()}`);
  current = audio;
  // play() rejects when the response is an error (e.g. 503: speech not configured).
  await audio.play();
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onpause = () => resolve();
    audio.onerror = () => reject(new Error('Audio playback failed'));
  });
}

export interface PronounceOptions {
  /** Ask the server (Azure). Requires a session; sentences also require consent. */
  useServer: boolean;
  /** Restrict the browser fallback to on-device voices (text must not leave the device). */
  localOnly: boolean;
}

/** Plays the pronunciation, falling back to the browser's own voice. Rejects if neither works. */
export async function pronounce(query: PronunciationQuery, options: PronounceOptions) {
  stopPlayback();
  if (options.useServer && performance.now() - serverFailedAt > SERVER_RETRY_MS) {
    try {
      await playFromServer(query);
      return;
    } catch {
      current = null;
      serverFailedAt = performance.now();
    }
  }
  await speakWithBrowser(query.text, options.localOnly);
}
