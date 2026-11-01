import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAppConfig } from '../../config/app-config.js';
import { InstallationSettingsSchema } from '../../config/installation.js';
import { InstallationService } from './installation.service.js';

const directories: string[] = [];
const base = {
  DATABASE_URL: 'postgres://u:p@db/x',
  VALKEY_URL: 'redis://valkey:6379',
  AI_SERVICE_TOKEN: 'a'.repeat(64),
};
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'lingoup-installation-test-'));
  directories.push(directory);
  const source = { ...base, INSTALLATION_DIR: directory };
  return { directory, source, service: new InstallationService(loadAppConfig(source)) };
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe('installation ownership and runtime settings', () => {
  it('is unavailable without an explicitly enabled installation directory', () => {
    const service = new InstallationService(loadAppConfig(base));
    expect(service.status().enabled).toBe(false);
    expect(() => service.requireOwner()).toThrow('Browser setup is not enabled');
  });

  it('claims once, hashes the password, rejects forged cookies and survives restart', async () => {
    const { service, source, directory } = fixture();
    const password = 'An installation password 123!';
    const token = await service.claim(password);
    expect(service.authenticated(token)).toBe(true);
    expect(service.authenticated(`${token}1`)).toBe(false);
    expect(service.authenticated(`999999999999999999999.${token.split('.')[1]}`)).toBe(false);
    expect(() => service.requireOwner()).toThrow('Unlock installation settings');
    await expect(service.claim(password)).rejects.toThrow('already exists');
    await expect(service.login('Incorrect password 123!')).rejects.toThrow('incorrect');
    const stored = readFileSync(join(directory, 'owner.json'), 'utf8');
    expect(stored).not.toContain(password);
    if (process.platform !== 'win32')
      expect(statSync(join(directory, 'owner.json')).mode & 0o777).toBe(0o600);
    const restarted = new InstallationService(loadAppConfig(source));
    expect(restarted.authenticated(token)).toBe(true);
    expect(restarted.authenticated(await restarted.login(password))).toBe(true);
    vi.useFakeTimers();
    vi.advanceTimersByTime(1801_000);
    expect(restarted.authenticated(token)).toBe(false);
    vi.useRealTimers();
    const newToken = await restarted.login(password);
    restarted.logout(newToken);
    expect(restarted.authenticated(newToken)).toBe(false);
    expect(restarted.authenticated(token)).toBe(false);
  });

  it('allows only one simultaneous initial claim', async () => {
    const { service } = fixture();
    const results = await Promise.allSettled([
      service.claim('First long password!'),
      service.claim('Second long password!'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  });

  it('keeps keys out of responses, applies saved settings and retains keys only for the same server', () => {
    const { service, source } = fixture();
    vi.useFakeTimers();
    const kill = vi.spyOn(process, 'kill').mockReturnValue(true);
    const settings = InstallationSettingsSchema.parse({
      mode: 'openai-compatible',
      endpoint: 'https://provider.example/v1',
      model: 'my-model',
      apiKey: 'secret-key-for-provider',
      allowExternal: true,
      imageSearch: 'wikimedia',
    });
    const saved = service.save(settings);
    expect(JSON.stringify(service.settings())).not.toContain('secret-key-for-provider');
    expect(service.settings().apiKeyConfigured).toBe(true);
    const config = loadAppConfig(source);
    expect(config.ai).toMatchObject({ provider: 'ai-service', allowExternal: true });
    expect(config.images.searchProvider).toBe('wikimedia');
    expect(config.installation.revision).toBe(saved.revision);
    const environmentOnly = loadAppConfig({
      ...source,
      BROWSER_SETUP_ENABLED: 'false',
      AI_PROVIDER: 'mock',
    });
    expect(environmentOnly.installation.directory).toBeNull();
    expect(environmentOnly.ai.provider).toBe('mock');
    vi.advanceTimersByTime(1200);
    expect(kill).toHaveBeenCalledWith(process.pid, 'SIGTERM');
    const restarted = new InstallationService(config);
    restarted.save({ ...settings, apiKey: '' });
    expect(restarted.settings().apiKeyConfigured).toBe(true);
    const changed = new InstallationService(loadAppConfig(source));
    changed.save({ ...settings, endpoint: 'https://different.example/v1', apiKey: '' });
    expect(changed.settings().apiKeyConfigured).toBe(false);
  });

  it('requires external processing consent and rejects credentials embedded in URLs', () => {
    expect(InstallationSettingsSchema.safeParse({ mode: 'openai-compatible' }).success).toBe(false);
    for (const endpoint of [
      'file:///etc/passwd',
      'http://user:password@host',
      'https://host/v1?key=secret',
    ]) {
      expect(InstallationSettingsSchema.safeParse({ mode: 'ollama', endpoint }).success).toBe(
        false,
      );
    }
  });

  it('tests installed models and gives safe errors without disclosing provider responses', async () => {
    const { service } = fixture();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ models: [{ name: 'my-model:latest' }] }))
      .mockResolvedValueOnce(
        new Response('secret credential and internal details', { status: 401 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (await service.test(InstallationSettingsSchema.parse({ mode: 'ollama', model: 'my-model' })))
        .ok,
    ).toBe(true);
    const failure = await service.test(InstallationSettingsSchema.parse({ mode: 'ollama' }));
    expect(failure).toEqual({ ok: false, message: 'The model server rejected the API key.' });
  });

  it('tracks streamed model downloads and detects incomplete streams', async () => {
    const { service } = fixture();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('{"status":"pulling","completed":5,"total":10}\n{"status":"success"}\n'),
        ),
    );
    expect(service.startPull(InstallationSettingsSchema.parse({ mode: 'ollama' })).status).toBe(
      'downloading',
    );
    await vi.waitFor(() => expect(service.pullStatus().status).toBe('complete'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"status":"pulling"}\n')));
    service.startPull(InstallationSettingsSchema.parse({ mode: 'ollama' }));
    await vi.waitFor(() => expect(service.pullStatus().status).toBe('error'));
  });
});
