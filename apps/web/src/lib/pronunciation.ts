import {
  PronunciationSettingsSchema,
  type PronunciationSettings,
  type PronunciationQuery,
} from '@lingoup/contracts';
import { api } from './api-client';

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
let generation = 0;
let cacheEpoch = 0;
let settings: { value: PronunciationSettings; expires: number } | null = null;
let settingsRequest: Promise<PronunciationSettings | null> | null = null;
const prepared = new Map<string, HTMLAudioElement>();
const MAX_PREPARED = 24;

/** Voice configuration is inexpensive to check; recordings never go into persistent storage. */
export function warmPronunciation(): Promise<PronunciationSettings | null> {
  if (settings && settings.expires > Date.now()) return Promise.resolve(settings.value);
  if (settingsRequest) return settingsRequest;
  const epoch = cacheEpoch;
  const request = api('/v1/vocabulary/pronunciation/settings', {
    schema: PronunciationSettingsSchema,
  })
    .then((value) => {
      if (epoch !== cacheEpoch) return null;
      settings = { value, expires: Date.now() + 10_000 };
      return value;
    })
    .catch(() => null)
    .finally(() => {
      if (settingsRequest === request) settingsRequest = null;
    });
  settingsRequest = request;
  return request;
}

export function resetPronunciationCache() {
  cacheEpoch++;
  generation++;
  stopPlayback();
  for (const audio of prepared.values()) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  prepared.clear();
  settings = null;
  settingsRequest = null;
  serverFailedAt = -Infinity;
}

function serverAudio(query: PronunciationQuery, options: PronounceOptions) {
  // Never replay an old voice while refreshing expired configuration (e.g. another
  // tab changed it). A fresh URL still benefits from the server's synthesis cache.
  const version =
    settings && settings.expires > Date.now() ? settings.value.revision : Date.now().toString(36);
  const key = JSON.stringify([
    options.cacheScope,
    options.localOnly,
    options.externalSharingConsent,
    version,
    query.kind,
    query.text,
  ]);
  let audio = prepared.get(key);
  if (audio && audio.error) {
    prepared.delete(key);
    audio = undefined;
  }
  if (audio) return audio;
  const params = new URLSearchParams({ text: query.text, kind: query.kind, v: version });
  audio = new Audio(`/api/v1/vocabulary/pronunciation?${params}`);
  audio.preload = 'auto';
  // All entries, including failed media, are bounded. Never evict the playing clip.
  for (const [oldKey, oldAudio] of prepared) {
    if (prepared.size < MAX_PREPARED) break;
    if (oldAudio === current) continue;
    oldAudio.pause();
    oldAudio.removeAttribute('src');
    oldAudio.load();
    prepared.delete(oldKey);
  }
  prepared.set(key, audio);
  return audio;
}

/** Prepare only an explicitly selected word, and never use a paid voice speculatively. */
export async function primePronunciation(query: PronunciationQuery, options: PronounceOptions) {
  if (!options.useServer || !options.cacheScope) return;
  const epoch = cacheEpoch;
  const policy = await warmPronunciation();
  if (
    epoch !== cacheEpoch ||
    !policy?.enabled ||
    !policy.prefetchAllowed ||
    (!policy.local && !options.externalSharingConsent)
  )
    return;
  // Constructing an Audio element with preload=auto starts loading; calling load() again
  // would cancel an existing download or interrupt a clip that is already playing.
  serverAudio(query, options);
}
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

async function speakWithBrowser(
  text: string,
  localOnly: boolean,
  requestGeneration: number,
): Promise<void> {
  if (!('speechSynthesis' in window)) throw new Error('Speech synthesis is not supported');
  const voice = pickVoice(await loadVoices(), localOnly);
  if (requestGeneration !== generation) return;
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

async function playFromServer(query: PronunciationQuery, options: PronounceOptions): Promise<void> {
  const audio = serverAudio(query, options);
  current = audio;
  audio.currentTime = 0;
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      audio.removeEventListener('ended', ended);
      audio.removeEventListener('pause', paused);
      audio.removeEventListener('error', failed);
      if (error) reject(error);
      else resolve();
    };
    const ended = () => finish();
    const paused = () => {
      if (audio.paused) finish();
    };
    const failed = () => finish(new Error('Audio playback failed'));
    audio.addEventListener('ended', ended);
    audio.addEventListener('pause', paused);
    audio.addEventListener('error', failed);
    void audio
      .play()
      .catch((error: unknown) =>
        finish(error instanceof Error ? error : new Error('Audio playback failed')),
      );
  });
}

export interface PronounceOptions {
  cacheScope?: string;
  externalSharingConsent?: boolean;
  /** Ask the configured server voice. Requires a session; external sentences require consent. */
  useServer: boolean;
  /** Restrict the browser fallback to on-device voices (text must not leave the device). */
  localOnly: boolean;
}

/** Plays the pronunciation, falling back to the browser's own voice. Rejects if neither works. */
export async function pronounce(query: PronunciationQuery, options: PronounceOptions) {
  const requestGeneration = ++generation;
  stopPlayback();
  void (options.useServer && warmPronunciation());
  const policy = settings?.value;
  const allowed =
    policy?.enabled !== false &&
    !(policy && !policy.local && query.kind === 'sentence' && options.localOnly);
  if (options.useServer && allowed && performance.now() - serverFailedAt > SERVER_RETRY_MS) {
    try {
      await playFromServer(query, options);
      return;
    } catch {
      if (requestGeneration !== generation) return;
      current = null;
      serverFailedAt = performance.now();
    }
  }
  await speakWithBrowser(query.text, options.localOnly, requestGeneration);
}
