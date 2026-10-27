import { describe, expect, it } from 'vitest';
import { loadAppConfig } from './app-config.js';

const base = { DATABASE_URL: 'postgres://u:p@db/x', VALKEY_URL: 'redis://valkey:6379' };

describe('speech configuration', () => {
  it('is off by default and accepts the empty values Compose passes', () => {
    const config = loadAppConfig({ ...base, AZURE_SPEECH_KEY: '', AZURE_SPEECH_REGION: '' });
    expect(config.speech).toMatchObject({ provider: 'none', azure: null });
  });

  it('requires a key and region for Azure', () => {
    expect(() => loadAppConfig({ ...base, SPEECH_PROVIDER: 'azure' })).toThrow(
      /AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are required/,
    );
    const config = loadAppConfig({
      ...base,
      SPEECH_PROVIDER: 'azure',
      AZURE_SPEECH_KEY: 'k'.repeat(32),
      AZURE_SPEECH_REGION: 'westeurope',
    });
    expect(config.speech).toMatchObject({
      provider: 'azure',
      azure: { region: 'westeurope' },
      voice: 'en-US-AvaMultilingualNeural',
      cacheTtlSeconds: 30 * 24 * 60 * 60,
    });
  });

  it('rejects a region that would change the request host', () => {
    expect(() =>
      loadAppConfig({
        ...base,
        SPEECH_PROVIDER: 'azure',
        AZURE_SPEECH_KEY: 'k'.repeat(32),
        AZURE_SPEECH_REGION: 'evil.example/x',
      }),
    ).toThrow(/AZURE_SPEECH_REGION/);
  });
});
