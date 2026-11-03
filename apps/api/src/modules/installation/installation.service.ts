import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import type { AppConfig } from '../../config/app-config.js';
import {
  InstallationSettingsSchema,
  readInstallationRuntime,
  type InstallationSettings,
} from '../../config/installation.js';
import { APP_CONFIG, DomainError } from '../../platform/index.js';

type Owner = { password: string; key: string };
export const INSTALLATION_COOKIE = 'lingoup_installation';
export const INSTALLATION_SESSION_SECONDS = 1800;

export async function passwordHash(password: string, salt = randomBytes(24).toString('hex')) {
  const hash = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, maxmem: 64 * 1024 * 1024 }, (error, value) =>
      error ? reject(error) : resolve(value),
    );
  });
  return `${salt}.${hash.toString('hex')}`;
}

export async function passwordMatches(password: string, stored: string) {
  const candidate = await passwordHash(password, stored.split('.')[0]);
  const a = Buffer.from(candidate);
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}

@Injectable()
export class InstallationService {
  private claiming = false;
  private restarting = false;
  private pull: {
    status: 'idle' | 'downloading' | 'complete' | 'error';
    message: string;
    completed: number;
    total: number;
  } = { status: 'idle', message: '', completed: 0, total: 0 };
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}
  get secureCookie() {
    return this.config.session.cookieSecure;
  }
  get storageDirectory() {
    return this.directory();
  }

  private directory() {
    if (!this.config.installation.directory)
      throw new DomainError('NOT_FOUND', 'Browser setup is not enabled for this installation');
    mkdirSync(this.config.installation.directory, { recursive: true });
    return this.config.installation.directory;
  }

  private owner(): Owner | null {
    const file = join(this.directory(), 'owner.json');
    return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Owner) : null;
  }

  private write(name: string, value: unknown, mode: number) {
    const target = join(this.directory(), name);
    const temporary = `${target}.${randomUUID()}.tmp`;
    writeFileSync(temporary, JSON.stringify(value), { mode, flag: 'wx' });
    renameSync(temporary, target);
  }

  authenticated(cookie?: string) {
    if (!cookie || !this.config.installation.directory) return false;
    const owner = this.owner();
    if (!owner) return false;
    const [expires, signature] = cookie.split('.');
    if (!expires || !signature || !/^\d+$/.test(expires) || Number(expires) <= Date.now())
      return false;
    const expected = this.signature(expires, owner);
    const supplied = Buffer.from(signature);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }

  private signature(expires: string, owner: Owner) {
    return Buffer.from(
      createHmac('sha256', owner.key).update(`${expires}:${owner.password}`).digest('hex'),
    );
  }

  private session(owner: Owner) {
    const expires = String(Date.now() + INSTALLATION_SESSION_SECONDS * 1000);
    return `${expires}.${this.signature(expires, owner).toString()}`;
  }

  requireOwner(cookie?: string) {
    this.directory();
    if (!this.authenticated(cookie))
      throw new DomainError('UNAUTHENTICATED', 'Unlock installation settings to continue');
  }

  status(cookie?: string) {
    if (!this.config.installation.directory)
      return {
        enabled: false,
        claimed: false,
        configured: false,
        authenticated: false,
        activeRevision: null,
      };
    const runtime = readInstallationRuntime(this.directory());
    return {
      enabled: true,
      required: this.config.installation.required,
      claimed: !!this.owner(),
      configured: !!runtime,
      authenticated: this.authenticated(cookie),
      activeRevision: this.config.installation.revision,
    };
  }

  async claim(password: string) {
    if (this.claiming || this.owner())
      throw new DomainError(
        'CONFLICT',
        'An installation password already exists. Unlock settings to continue.',
      );
    this.claiming = true;
    try {
      const owner = {
        password: await passwordHash(password),
        key: randomBytes(32).toString('hex'),
      };
      this.write('owner.json', owner, 0o600);
      return this.session(owner);
    } finally {
      this.claiming = false;
    }
  }

  async login(password: string) {
    const owner = this.owner();
    if (!owner || !(await passwordMatches(password, owner.password)))
      throw new DomainError('INVALID_CREDENTIALS', 'The installation password is incorrect');
    return this.session(owner);
  }

  logout(cookie?: string) {
    if (!this.authenticated(cookie)) return;
    const owner = this.owner();
    if (owner) this.write('owner.json', { ...owner, key: randomBytes(32).toString('hex') }, 0o600);
  }

  settings() {
    const settings =
      readInstallationRuntime(this.directory())?.settings ??
      InstallationSettingsSchema.parse({ mode: 'basic' });
    const { apiKey, ...safe } = settings;
    return { ...safe, apiKeyConfigured: !!apiKey };
  }

  private effective(input: InstallationSettings): InstallationSettings {
    const previous = readInstallationRuntime(this.directory())?.settings;
    // A blank field retains a key only for the same endpoint, never another provider.
    const retained =
      previous?.mode === input.mode &&
      previous.endpoint === input.endpoint &&
      previous.apiProvider === input.apiProvider
        ? previous.apiKey
        : undefined;
    const effective = {
      ...input,
      apiKey:
        input.mode !== 'openai-compatible' || input.clearApiKey
          ? undefined
          : input.apiKey || retained,
      clearApiKey: false,
    };
    if (
      effective.mode === 'openai-compatible' &&
      effective.apiProvider !== 'custom' &&
      !effective.apiKey
    )
      throw new DomainError('VALIDATION_FAILED', 'Enter an API key for the selected provider');
    return effective;
  }

  async test(input: InstallationSettings) {
    const settings = this.effective(input);
    if (settings.mode === 'basic')
      return { ok: true, message: 'Core learning is ready. No AI service is required.' };
    const base = settings.endpoint.replace(/\/+$/, '');
    let response: Response;
    try {
      response = await fetch(`${base}${settings.mode === 'ollama' ? '/api/tags' : '/models'}`, {
        signal: AbortSignal.timeout(15_000),
        redirect: 'error',
        headers: {
          ...(settings.apiKey ? { authorization: `Bearer ${settings.apiKey}` } : {}),
          ...(settings.mode === 'openai-compatible' && settings.apiProvider === 'anthropic'
            ? {
                'x-api-key': settings.apiKey ?? '',
                'anthropic-version': '2023-06-01',
                ...(settings.workspaceId ? { 'anthropic-workspace-id': settings.workspaceId } : {}),
              }
            : {}),
        },
      });
    } catch {
      return {
        ok: false,
        message: 'Could not reach the model server. Check its address and that it is running.',
      };
    }
    if (!response.ok) {
      await response.body?.cancel();
      return {
        ok: false,
        message:
          response.status === 401 || response.status === 403
            ? 'The model server rejected the API key.'
            : 'The server did not return a model list. Check the API base address.',
      };
    }
    try {
      const body = (await response.json()) as {
        models?: { name?: string }[];
        data?: { id?: string }[];
      };
      const names =
        settings.mode === 'ollama'
          ? body.models?.map((model) => model.name)
          : body.data?.map((model) => model.id);
      const found = names?.some(
        (name) => name === settings.model || name === `${settings.model}:latest`,
      );
      return {
        ok: !!found,
        models:
          names?.filter((name): name is string => typeof name === 'string').slice(0, 200) ?? [],
        message: found
          ? 'Connected. Your selected model is available.'
          : 'Connected, but the selected model is not installed or is not listed by this server.',
      };
    } catch {
      return { ok: false, message: 'The server returned an invalid model list.' };
    }
  }

  pullStatus() {
    return { ...this.pull };
  }

  async previewVoice(speech: 'edge' | 'piper-medium' | 'piper-high') {
    if (!this.config.ai.serviceToken)
      throw new DomainError('AI_UNAVAILABLE', 'The voice service is not configured');
    try {
      const response = await fetch(`${this.config.ai.serviceUrl}/v1/tasks/speech-synthesis`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ai-service-token': this.config.ai.serviceToken,
        },
        body: JSON.stringify({
          text: 'Welcome to LingoUp. Small steps open a whole new world. Make English part of your everyday.',
          voice: speech === 'edge' ? 'en-US-AndrewMultilingualNeural' : speech,
        }),
        signal: AbortSignal.timeout(125_000),
        redirect: 'error',
      });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/mpeg'))
        throw new Error('Voice unavailable');
      const audio = Buffer.from(await response.arrayBuffer());
      if (!audio.length || audio.length > 1024 * 1024) throw new Error('Invalid audio');
      return audio;
    } catch {
      throw new DomainError(
        'AI_UNAVAILABLE',
        'Could not prepare the voice. Check the AI service, network connection and model storage.',
      );
    }
  }

  startPull(input: InstallationSettings) {
    if (input.mode !== 'ollama')
      throw new DomainError('VALIDATION_FAILED', 'Model downloads are available for Ollama only');
    if (this.pull.status === 'downloading')
      throw new DomainError('CONFLICT', 'A model download is already running');
    this.pull = { status: 'downloading', message: 'Connecting to Ollama', completed: 0, total: 0 };
    void this.download(input);
    return this.pullStatus();
  }

  private async download(input: InstallationSettings) {
    try {
      const response = await fetch(`${input.endpoint.replace(/\/+$/, '')}/api/pull`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: input.model, stream: true }),
        signal: AbortSignal.timeout(30 * 60_000),
        redirect: 'error',
      });
      if (!response.ok || !response.body) throw new Error('Download failed');
      const decoder = new TextDecoder();
      let buffer = '';
      let success = false;
      for await (const chunk of response.body) {
        if (!(chunk instanceof Uint8Array)) throw new Error('Invalid progress');
        buffer += decoder.decode(chunk, { stream: true });
        if (buffer.length > 128_000) throw new Error('Invalid progress');
        let newline: number;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            error?: string;
            status?: string;
            completed?: number;
            total?: number;
          };
          if (event.error) throw new Error('Download failed');
          if (event.status === 'success') success = true;
          this.pull = {
            status: 'downloading',
            message: (event.status ?? 'Downloading').slice(0, 120),
            completed: Number(event.completed) || 0,
            total: Number(event.total) || 0,
          };
        }
      }
      if (!success) throw new Error('Incomplete download');
      this.pull = {
        ...this.pull,
        status: 'complete',
        message: 'Model downloaded. Test the connection to continue.',
      };
    } catch {
      this.pull = {
        ...this.pull,
        status: 'error',
        message:
          'The download did not complete. Check the model name, network connection and free disk space, then retry.',
      };
    }
  }

  save(input: InstallationSettings) {
    if (this.restarting || this.pull.status === 'downloading')
      throw new DomainError('CONFLICT', 'Wait for the current operation to finish');
    const revision = randomUUID();
    this.write('runtime.json', { revision, settings: this.effective(input) }, 0o644);
    this.restarting = true;
    // Compose restarts the API after a graceful shutdown. No Docker socket is exposed.
    const timer = setTimeout(() => process.kill(process.pid, 'SIGTERM'), 1200);
    timer.unref();
    return { revision };
  }
}
