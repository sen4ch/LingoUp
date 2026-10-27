import type { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../../config/app-config.js';
import { AzureSpeechProvider, buildSsml } from '../infrastructure/azure-speech-provider.js';
import type { AiQuota } from './ai-quota.js';
import { SpeechGateway, type SpeechRequest } from './speech-gateway.js';
import type { SpeechProvider } from './speech-provider.js';

const config = {
  ai: { timeoutMs: 1000, maxConcurrency: 2 },
  speech: { cacheTtlSeconds: 3600 },
} as AppConfig;
const audio = Buffer.from('mp3-bytes');
const term: SpeechRequest = {
  userId: 'u1',
  text: '  look   forward to ',
  sensitive: false,
  externalSharingConsent: false,
};

function fakeValkey(cached: Buffer | null = null) {
  return {
    getBuffer: vi.fn().mockResolvedValue(cached),
    set: vi.fn().mockResolvedValue('OK'),
  };
}

function fakeProvider(synthesize = vi.fn().mockResolvedValue(audio)) {
  const provider: SpeechProvider = {
    name: 'fake',
    voice: 'en-US-TestNeural',
    dataLocality: 'external',
    synthesize,
  };
  return { provider, synthesize };
}

function quota(allowed = true) {
  const tryConsume = vi.fn().mockResolvedValue(allowed);
  return { quota: { tryConsume } as unknown as AiQuota, tryConsume };
}

function gateway(provider: SpeechProvider | null, valkey = fakeValkey(), aiQuota = quota().quota) {
  return new SpeechGateway(provider, valkey as unknown as Redis, aiQuota, config);
}

describe('SpeechGateway', () => {
  it('is disabled without a provider', async () => {
    await expect(gateway(null).synthesize(term)).resolves.toEqual({ status: 'disabled' });
  });

  it('sends a term to an external provider without consent and caches the audio', async () => {
    const { provider, synthesize } = fakeProvider();
    const valkey = fakeValkey();
    const outcome = await gateway(provider, valkey).synthesize(term);

    expect(outcome).toEqual({ status: 'ok', audio, cached: false });
    expect(synthesize).toHaveBeenCalledWith('look forward to', expect.any(AbortSignal));
    const [key, value, , ttl] = valkey.set.mock.calls[0]!;
    expect(key).toMatch(/^speech:v1:fake:en-US-TestNeural:[0-9a-f]{64}$/);
    expect(value).toBe(audio);
    expect(ttl).toBe(3600);
  });

  it('keeps a sentence away from an external provider without consent', async () => {
    const { provider, synthesize } = fakeProvider();
    const outcome = await gateway(provider).synthesize({ ...term, sensitive: true });
    expect(outcome).toEqual({ status: 'consent_required' });
    expect(synthesize).not.toHaveBeenCalled();
  });

  it('serves cached audio without calling the provider or consuming quota', async () => {
    const { provider, synthesize } = fakeProvider();
    const { quota: aiQuota, tryConsume } = quota();
    const outcome = await gateway(provider, fakeValkey(audio), aiQuota).synthesize(term);
    expect(outcome).toEqual({ status: 'ok', audio, cached: true });
    expect(synthesize).not.toHaveBeenCalled();
    expect(tryConsume).not.toHaveBeenCalled();
  });

  it('respects the daily quota', async () => {
    const { provider, synthesize } = fakeProvider();
    await expect(
      gateway(provider, fakeValkey(), quota(false).quota).synthesize(term),
    ).resolves.toEqual({
      status: 'quota_exceeded',
    });
    expect(synthesize).not.toHaveBeenCalled();
  });

  it('reports provider failures and empty audio as unavailable without caching', async () => {
    const valkey = fakeValkey();
    const failing = fakeProvider(vi.fn().mockRejectedValue(new Error('boom'))).provider;
    const empty = fakeProvider(vi.fn().mockResolvedValue(Buffer.alloc(0))).provider;
    await expect(gateway(failing, valkey).synthesize(term)).resolves.toEqual({
      status: 'unavailable',
    });
    await expect(gateway(empty, valkey).synthesize(term)).resolves.toEqual({
      status: 'unavailable',
    });
    expect(valkey.set).not.toHaveBeenCalled();
  });
});

describe('AzureSpeechProvider', () => {
  it('escapes the text so it cannot inject SSML', () => {
    expect(buildSsml(`rock & "roll" <break time='9s'/>`, 'en-US-AvaMultilingualNeural')).toBe(
      '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">' +
        '<voice name="en-US-AvaMultilingualNeural">rock &amp; &quot;roll&quot; ' +
        '&lt;break time=&apos;9s&apos;/&gt;</voice></speak>',
    );
  });

  it('calls the regional endpoint with the key and asks for MP3', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(audio, { status: 200 }));
    const provider = new AzureSpeechProvider(
      { key: 'k'.repeat(32), region: 'westeurope', voice: 'en-US-AvaMultilingualNeural' },
      fetchImpl,
    );
    await expect(provider.synthesize('for', AbortSignal.timeout(1000))).resolves.toEqual(audio);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1');
    expect(init.headers['Ocp-Apim-Subscription-Key']).toBe('k'.repeat(32));
    expect(init.headers['X-Microsoft-OutputFormat']).toBe('audio-24khz-48kbitrate-mono-mp3');
  });

  it('reports only the status when Azure fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('secret details', { status: 401 }));
    const provider = new AzureSpeechProvider(
      { key: 'k'.repeat(32), region: 'westeurope', voice: 'en-US-AvaMultilingualNeural' },
      fetchImpl,
    );
    await expect(provider.synthesize('for', AbortSignal.timeout(1000))).rejects.toThrow(
      'Azure Speech responded with 401',
    );
  });
});
