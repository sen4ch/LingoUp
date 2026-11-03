import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  pickVoice,
  primePronunciation,
  pronounce,
  resetPronunciationCache,
  warmPronunciation,
  type VoiceLike,
} from './pronunciation';

const voice = (lang: string, localService: boolean, isDefault = false): VoiceLike => ({
  lang,
  localService,
  default: isDefault,
});

class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  error = null;
  paused = true;
  currentTime = 0;
  preload = '';
  play = vi.fn(() => {
    this.paused = false;
    queueMicrotask(() => this.dispatchEvent(new Event('ended')));
    return Promise.resolve();
  });
  pause() {
    this.paused = true;
    queueMicrotask(() => this.dispatchEvent(new Event('pause')));
  }
  load = vi.fn();
  removeAttribute = vi.fn();
  constructor(public src: string) {
    super();
    FakeAudio.instances.push(this);
  }
}

describe('prepared pronunciation', () => {
  const query = { text: 'hello', kind: 'term' as const };
  const options = {
    useServer: true,
    localOnly: false,
    cacheScope: 'learner-1',
    externalSharingConsent: true,
  };
  let policy = { enabled: true, local: false, prefetchAllowed: true, revision: 'voice-1' };
  beforeEach(() => {
    vi.stubGlobal('window', { speechSynthesis: { cancel: vi.fn() } });
    vi.stubGlobal('Audio', FakeAudio);
    policy = { enabled: true, local: false, prefetchAllowed: true, revision: 'voice-1' };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(policy)))),
    );
    resetPronunciationCache();
    FakeAudio.instances = [];
  });
  afterEach(() => {
    resetPronunciationCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reuses prepared audio for repeated playback without restarting the download', async () => {
    await Promise.all([primePronunciation(query, options), primePronunciation(query, options)]);
    expect(fetch).toHaveBeenCalledOnce();
    await pronounce(query, options);
    await pronounce(query, options);
    await primePronunciation(query, options);
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0]!.play).toHaveBeenCalledTimes(2);
    expect(FakeAudio.instances[0]!.load).not.toHaveBeenCalled();
  });

  it('does not speculatively send text externally without consent or to a paid voice', async () => {
    await primePronunciation(query, { ...options, externalSharingConsent: false });
    expect(FakeAudio.instances).toHaveLength(0);
    resetPronunciationCache();
    policy.prefetchAllowed = false;
    await primePronunciation(query, options);
    expect(FakeAudio.instances).toHaveLength(0);
    resetPronunciationCache();
    policy.local = true;
    policy.prefetchAllowed = true;
    await primePronunciation(query, { ...options, externalSharingConsent: false });
    expect(FakeAudio.instances).toHaveLength(1);
  });

  it('separates learners and voice revisions and bounds the in-memory cache', async () => {
    await primePronunciation(query, options);
    await primePronunciation(query, { ...options, cacheScope: 'learner-2' });
    const original = FakeAudio.instances[0]!;
    expect(FakeAudio.instances).toHaveLength(2);
    policy.revision = 'voice-2';
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 11_000);
    await primePronunciation(query, options);
    expect(FakeAudio.instances[2]!.src).toContain('voice-2');
    for (let i = 0; i < 30; i++) await primePronunciation({ ...query, text: `word-${i}` }, options);
    expect(original.removeAttribute).toHaveBeenCalledWith('src');
    expect(
      FakeAudio.instances.filter((audio) => audio.removeAttribute.mock.calls.length === 0),
    ).toHaveLength(24);
  });

  it('discards pending settings and prefetch work when the learner signs out', async () => {
    let finish!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    const preparing = primePronunciation(query, options);
    resetPronunciationCache();
    finish(new Response(JSON.stringify(policy)));
    await preparing;
    expect(FakeAudio.instances).toHaveLength(0);
    await warmPronunciation();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('pickVoice', () => {
  const online = voice('en-US', false);
  const localUs = voice('en-US', true);
  const localGb = voice('en_GB', true);
  const russian = voice('ru-RU', true, true);

  it('prefers an American, on-device voice', () => {
    expect(pickVoice([russian, online, localGb, localUs], false)).toBe(localUs);
  });

  it('falls back to any English voice', () => {
    expect(pickVoice([russian, localGb], false)).toBe(localGb);
    expect(pickVoice([russian, online], false)).toBe(online);
  });

  it('never picks an online voice when the text must stay on the device', () => {
    expect(pickVoice([online, localGb], true)).toBe(localGb);
    expect(pickVoice([online, russian], true)).toBeNull();
  });
});
