'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  InstallationSettingsSchema,
  InstallationStatusSchema,
  InstallationSafeSettingsSchema,
  InstallationApplySchema,
  InstallationConnectionSchema,
  InstallationPullSchema,
  API_PROVIDER_PROFILES,
  VOICE_PROFILES,
  type InstallationSettings,
  type InstallationStatus,
} from '@lingoup/contracts';
import { api, ApiRequestError } from '@/lib/api-client';
import { resetPronunciationCache } from '@/lib/pronunciation';
import { InstallationHardwarePanel } from './installation-hardware';
import { InstallationVoices } from './installation-voices';

type Pull = {
  status: 'idle' | 'downloading' | 'complete' | 'error';
  message: string;
  completed: number;
  total: number;
};
const modes = [
  {
    id: 'basic',
    number: '01',
    title: 'Start with the essentials',
    tag: 'NO MODEL NEEDED',
    description:
      'Read, explore every grammar topic, build your vocabulary and review at your own pace.',
  },
  {
    id: 'ollama',
    number: '02',
    title: 'Keep AI on your computer',
    tag: 'LOCAL AI',
    description:
      'Generate practice, get writing feedback and talk with a tutor using your own Ollama model.',
  },
  {
    id: 'openai-compatible',
    number: '03',
    title: 'Connect a model server',
    tag: 'YOUR PROVIDER',
    description: 'Use an OpenAI-compatible API, including a server you host yourself.',
  },
] as const;
const defaults = InstallationSettingsSchema.parse({ mode: 'basic' });

export function InstallationWizard() {
  const [status, setStatus] = useState<InstallationStatus | null>(null);
  const [settings, setSettings] = useState<InstallationSettings>(defaults);
  const [step, setStep] = useState(0);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savedKey, setSavedKey] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [connection, setConnection] = useState<{
    ok: boolean;
    message: string;
    models?: string[];
  } | null>(null);
  const [pull, setPull] = useState<Pull | null>(null);
  const [done, setDone] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const mounted = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);

  function fail(error: unknown) {
    setError(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    if (error instanceof ApiRequestError && error.status === 401)
      setStatus((value) => value && { ...value, authenticated: false });
  }

  async function refresh() {
    setError('');
    try {
      const state = await api('/v1/setup/status', { schema: InstallationStatusSchema });
      if (!mounted.current) return;
      if (state.authenticated) {
        const [safe, progress] = await Promise.all([
          api('/v1/setup/settings', { schema: InstallationSafeSettingsSchema }),
          api('/v1/setup/pull', { schema: InstallationPullSchema }),
        ]);
        if (!mounted.current) return;
        setSettings({ ...safe, apiKey: '' });
        setSavedKey(safe.apiKeyConfigured);
        setStep(1);
        setPull(progress);
      }
      setStatus(state);
    } catch (error) {
      if (mounted.current) fail(error);
    }
  }

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (pull?.status !== 'downloading') return;
    const timer = setInterval(() => {
      void api('/v1/setup/pull', { schema: InstallationPullSchema })
        .then(setPull)
        .catch((error) => {
          fail(error);
          setPull(null);
        });
    }, 2000);
    return () => clearInterval(timer);
  }, [pull?.status]);

  function change(patch: Partial<InstallationSettings>) {
    setSettings((value) => ({
      ...value,
      ...patch,
      ...(patch.endpoint !== undefined &&
      patch.endpoint !== value.endpoint &&
      patch.hardwareOverride === undefined
        ? { hardwareOverride: null }
        : {}),
    }));
    setConnection(null);
    setError('');
  }
  function go(next: number) {
    setStep(next);
    setError('');
    requestAnimationFrame(() => heading.current?.focus());
  }
  function validated() {
    const result = InstallationSettingsSchema.safeParse(settings);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Check your settings');
      return null;
    }
    return result.data;
  }

  async function unlock(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!status?.claimed && password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setBusy('unlock');
    try {
      await api(`/v1/setup/${status?.claimed ? 'login' : 'owner'}`, {
        method: 'POST',
        body: { password },
      });
      setPassword('');
      setConfirmation('');
      await refresh();
    } catch (error) {
      fail(error);
    } finally {
      setBusy('');
    }
  }

  async function test() {
    const body = validated();
    if (!body) return;
    setBusy('test');
    setError('');
    try {
      setConnection(
        await api('/v1/setup/test', { method: 'POST', body, schema: InstallationConnectionSchema }),
      );
    } catch (error) {
      fail(error);
    } finally {
      setBusy('');
    }
  }

  async function download() {
    const body = validated();
    if (!body) return;
    setBusy('download');
    setError('');
    setConnection(null);
    try {
      setPull(
        await api('/v1/setup/pull', { method: 'POST', body, schema: InstallationPullSchema }),
      );
    } catch (error) {
      fail(error);
    } finally {
      setBusy('');
    }
  }

  async function save() {
    const body = validated();
    if (!body) return;
    setBusy('save');
    setError('');
    try {
      const result = await api('/v1/setup/settings', {
        method: 'PUT',
        body,
        schema: InstallationApplySchema,
      });
      setSettings((value) => ({ ...value, apiKey: '' }));
      for (let attempt = 0; attempt < 90 && mounted.current; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const state = await api('/v1/setup/status', { schema: InstallationStatusSchema }).catch(
          () => null,
        );
        if (state?.activeRevision === result.revision) {
          resetPronunciationCache();
          setStatus(state);
          setDone(true);
          return;
        }
      }
      if (mounted.current)
        setError(
          'Your settings were saved, but the services are taking longer to restart. Reload this page in a moment.',
        );
    } catch (error) {
      fail(error);
    } finally {
      if (mounted.current) setBusy('');
    }
  }

  async function lock() {
    setBusy('lock');
    try {
      await api('/v1/setup/logout', { method: 'POST' });
      setDone(false);
      await refresh();
    } catch (error) {
      fail(error);
    } finally {
      setBusy('');
    }
  }

  const downloading = pull?.status === 'downloading';
  const disabled = !!busy || downloading || voiceBusy;
  const unlocked = !!status?.authenticated;

  return (
    <section className="installation" aria-labelledby="installation-title">
      <div className="installation-intro">
        <p className="eyebrow">
          <span className="status-dot" /> A LITTLE SETUP. A LOT OF POSSIBILITY.
        </p>
        <h1 id="installation-title">
          Your LingoUp.
          <br />
          <span>Your way.</span>
        </h1>
        <p>A comfortable place to learn, ready in a few simple steps.</p>
      </div>
      {!status ? (
        <div className="installation-panel">
          <p role="status">{error || 'Checking your installation…'}</p>
          {error && <button onClick={() => void refresh()}>Try again</button>}
        </div>
      ) : !status.enabled ? (
        <div className="installation-panel">
          <h2>Environment-managed installation</h2>
          <p>
            Browser setup is not enabled here. Your installation settings are managed by its
            operator.
          </p>
          <Link href="/">Back to learning →</Link>
        </div>
      ) : done ? (
        <div className="installation-panel installation-success">
          {error && (
            <div className="installation-error" role="alert">
              {error}
            </div>
          )}
          <span className="installation-check" aria-hidden="true">
            ✓
          </span>
          <p className="eyebrow">ALL SET</p>
          <h2>You’re ready to grow.</h2>
          <p>Your settings are saved. You can change them here whenever you need.</p>
          <p>Create a learner account, or log in to continue your learning journey.</p>
          <div className="installation-actions">
            <Link className="installation-primary" href="/register">
              Create a learner account →
            </Link>
            <Link href="/">Go to LingoUp</Link>
          </div>
          <button
            className="installation-text-button"
            disabled={!!busy}
            onClick={() => void lock()}
          >
            Lock installation settings
          </button>
        </div>
      ) : (
        <div className="installation-layout">
          <aside className="installation-sidebar">
            <ol aria-label="Setup steps">
              {['Protect your installation', 'Choose your learning mode', 'Review & finish'].map(
                (label, index) => (
                  <li
                    key={label}
                    aria-current={(unlocked ? step : 0) === index ? 'step' : undefined}
                  >
                    <span>{index === 0 && unlocked ? '✓' : `0${index + 1}`}</span>
                    <div>
                      <strong>{label}</strong>
                      <small>
                        {
                          [
                            'One password for shared settings',
                            'Essentials, local AI or your provider',
                            'Everything in one place',
                          ][index]
                        }
                      </small>
                    </div>
                  </li>
                ),
              )}
            </ol>
            <p>
              Installation settings apply to everyone using this copy of LingoUp. Your learner
              account stays separate.
            </p>
            {unlocked && (
              <button disabled={disabled} onClick={() => void lock()}>
                Lock settings ↗
              </button>
            )}
          </aside>
          <div className="installation-panel" aria-busy={!!busy}>
            {error && (
              <div className="installation-error" role="alert">
                {error}
              </div>
            )}
            {!unlocked ? (
              <form onSubmit={(event) => void unlock(event)}>
                <p className="eyebrow">
                  {status.claimed ? 'WELCOME BACK' : 'STEP 01 / MAKE IT YOURS'}
                </p>
                <h2 ref={heading} tabIndex={-1}>
                  {status.claimed ? 'Unlock your settings.' : 'A password for your installation.'}
                </h2>
                <p>
                  {status.claimed
                    ? 'Use your installation password to manage shared services.'
                    : 'Choose a password to keep shared settings and provider keys under your control. Save it in your password manager.'}
                </p>
                <label className="installation-field">
                  Installation password
                  <input
                    name="password"
                    aria-label="Installation password"
                    aria-describedby="installation-password-help"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={status.claimed ? 'current-password' : 'new-password'}
                    minLength={12}
                    maxLength={128}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={!!busy}
                  />
                  <small id="installation-password-help">
                    At least 12 characters. Separate from your learner account password.
                  </small>
                </label>
                {!status.claimed && (
                  <label className="installation-field">
                    Confirm installation password
                    <input
                      name="confirmation"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={12}
                      maxLength={128}
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                      disabled={!!busy}
                    />
                  </label>
                )}
                <label className="installation-checkbox">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(event) => setShowPassword(event.target.checked)}
                  />
                  Show password
                </label>
                <div className="installation-actions">
                  <button className="installation-primary" disabled={!!busy} type="submit">
                    {busy
                      ? 'Opening settings…'
                      : status.claimed
                        ? 'Unlock settings →'
                        : 'Save password & continue →'}
                  </button>
                </div>
              </form>
            ) : step === 1 ? (
              <>
                <p className="eyebrow">STEP 02 / FIND YOUR FIT</p>
                <h2 ref={heading} tabIndex={-1}>
                  How would you like to learn?
                </h2>
                <p>Start simple. You can add AI or change providers later.</p>
                <fieldset className="installation-modes" disabled={disabled}>
                  <legend className="sr-only">Learning mode</legend>
                  {modes.map((mode) => (
                    <label
                      key={mode.id}
                      className={`installation-mode ${settings.mode === mode.id ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="mode"
                        value={mode.id}
                        checked={settings.mode === mode.id}
                        onChange={() => {
                          change({
                            mode: mode.id,
                            apiProvider: 'custom',
                            workspaceId: '',
                            endpoint: mode.id === 'openai-compatible' ? '' : 'http://ollama:11434',
                            apiKey: '',
                            speaking: mode.id === 'basic' ? false : settings.speaking,
                          });
                          setSavedKey(false);
                        }}
                      />
                      <div>
                        <small>{mode.tag}</small>
                        <strong>{mode.title}</strong>
                        <p>{mode.description}</p>
                      </div>
                    </label>
                  ))}
                </fieldset>
                {settings.mode !== 'basic' && (
                  <fieldset className="installation-model-fields" disabled={disabled}>
                    <legend>Connect your model</legend>
                    {settings.mode === 'openai-compatible' && (
                      <label className="installation-field">
                        AI provider
                        <select
                          value={settings.apiProvider}
                          aria-label="AI provider"
                          onChange={(event) => {
                            const profile = API_PROVIDER_PROFILES.find(
                              (item) => item.id === event.target.value,
                            )!;
                            change({
                              apiProvider: profile.id,
                              endpoint: profile.endpoint,
                              model: profile.model,
                              apiKey: '',
                              clearApiKey: false,
                              workspaceId: '',
                              dataLocality: 'external',
                              allowExternal: false,
                            });
                            setSavedKey(false);
                          }}
                        >
                          {API_PROVIDER_PROFILES.map((profile) => (
                            <option value={profile.id} key={profile.id}>
                              {profile.title}
                            </option>
                          ))}
                        </select>
                        <small>
                          Provider API keys are separate from chat subscriptions. You can edit the
                          model name and API address.
                        </small>
                      </label>
                    )}
                    {settings.mode === 'ollama' && (
                      <div className="installation-presets">
                        <button
                          type="button"
                          onClick={() => change({ endpoint: 'http://ollama:11434' })}
                        >
                          Bundled Ollama
                        </button>
                        <button
                          type="button"
                          onClick={() => change({ endpoint: 'http://host.docker.internal:11434' })}
                        >
                          Ollama on this computer
                        </button>
                      </div>
                    )}
                    <label className="installation-field">
                      {settings.mode === 'ollama' ? 'Ollama server address' : 'API base address'}
                      <input
                        type="url"
                        aria-label={
                          settings.mode === 'ollama' ? 'Ollama server address' : 'API base address'
                        }
                        required
                        placeholder={
                          settings.mode === 'ollama'
                            ? 'http://ollama:11434'
                            : 'https://your-provider.example/v1'
                        }
                        value={settings.endpoint}
                        onChange={(event) => change({ endpoint: event.target.value })}
                        autoComplete="off"
                      />
                      <small>
                        {settings.mode === 'ollama'
                          ? 'The bundled server is included in the easy Docker installation.'
                          : 'Include /v1 if your provider requires it. Put credentials in the API key field.'}
                      </small>
                    </label>
                    <label className="installation-field">
                      Model name
                      <input
                        value={settings.model}
                        aria-label="Model name"
                        onChange={(event) => change({ model: event.target.value })}
                        maxLength={120}
                        autoComplete="off"
                        required
                      />
                      <small>Use the exact model name offered by your server.</small>
                    </label>
                    {settings.mode === 'openai-compatible' && (
                      <>
                        <label className="installation-field">
                          API key
                          <input
                            type="password"
                            aria-label="API key"
                            value={settings.apiKey ?? ''}
                            placeholder={
                              savedKey
                                ? 'A key is saved. Leave blank to keep it.'
                                : 'Enter a key if your server requires one'
                            }
                            autoComplete="new-password"
                            maxLength={4096}
                            onChange={(event) =>
                              change({ apiKey: event.target.value, clearApiKey: false })
                            }
                          />
                          <small>Saved keys are never returned to the browser.</small>
                        </label>
                        {savedKey && (
                          <label className="installation-checkbox">
                            <input
                              type="checkbox"
                              checked={settings.clearApiKey}
                              onChange={(event) =>
                                change({ clearApiKey: event.target.checked, apiKey: '' })
                              }
                            />
                            Remove the saved API key
                          </label>
                        )}
                        {settings.apiProvider === 'anthropic' && (
                          <label className="installation-field">
                            Claude workspace ID (optional)
                            <input
                              autoComplete="off"
                              maxLength={120}
                              value={settings.workspaceId}
                              onChange={(event) => change({ workspaceId: event.target.value })}
                            />
                            <small>
                              Required by Anthropic for keys not already scoped to a workspace.
                            </small>
                          </label>
                        )}
                        <label className="installation-field">
                          Where does this model run?
                          <select
                            value={settings.dataLocality}
                            disabled={settings.apiProvider !== 'custom'}
                            onChange={(event) =>
                              change({ dataLocality: event.target.value as 'local' | 'external' })
                            }
                          >
                            <option value="external">External provider</option>
                            <option value="local">On infrastructure I operate</option>
                          </select>
                        </label>
                        {settings.dataLocality === 'external' && (
                          <label className="installation-checkbox">
                            <input
                              type="checkbox"
                              checked={settings.allowExternal}
                              onChange={(event) => change({ allowExternal: event.target.checked })}
                            />
                            Allow this installation to send AI requests to an external provider.
                            Each learner must also give their own consent.
                          </label>
                        )}
                      </>
                    )}
                    <div className="installation-actions">
                      <button type="button" disabled={disabled} onClick={() => void test()}>
                        {busy === 'test' ? 'Checking connection…' : 'Test connection ↗'}
                      </button>
                      {settings.mode === 'ollama' && (
                        <button type="button" disabled={disabled} onClick={() => void download()}>
                          Download this model
                        </button>
                      )}
                    </div>
                    {settings.mode === 'ollama' && (
                      <p className="installation-hint">
                        Model downloads can take several minutes and use several GB of disk space.
                        CPU inference is supported; speed depends on your computer.
                      </p>
                    )}
                    {connection && (
                      <p
                        role="status"
                        className={connection.ok ? 'installation-ok' : 'installation-error'}
                      >
                        {connection.message}
                      </p>
                    )}
                    {!!connection?.models?.length && (
                      <label className="installation-field">
                        Models available with this connection
                        <select
                          value=""
                          disabled={disabled}
                          onChange={(event) => change({ model: event.target.value })}
                        >
                          <option value="" disabled>
                            Choose a model from this server
                          </option>
                          {connection.models.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {pull && pull.status !== 'idle' && (
                      <div role="status" className="installation-download">
                        <p>{pull.message}</p>
                        {pull.total > 0 && (
                          <progress
                            aria-label="Model download progress"
                            max={pull.total}
                            value={pull.completed}
                          />
                        )}
                        {downloading && (
                          <small>You can leave this tab open while the model downloads.</small>
                        )}
                      </div>
                    )}
                  </fieldset>
                )}
                <InstallationHardwarePanel
                  settings={settings}
                  change={change}
                  disabled={disabled}
                />
                <details className="installation-options">
                  <summary>
                    Voice quality & preview{' '}
                    <span>
                      {VOICE_PROFILES.find((voice) => voice.id === settings.speech)?.title}
                    </span>
                  </summary>
                  <InstallationVoices
                    settings={settings}
                    change={change}
                    disabled={disabled}
                    onBusyChange={setVoiceBusy}
                  />
                </details>
                <details className="installation-options">
                  <summary>
                    Optional extras <span>Pictures & recognition</span>
                  </summary>
                  <fieldset disabled={disabled}>
                    <label className="installation-field">
                      Word picture search
                      <select
                        value={settings.imageSearch}
                        onChange={(event) =>
                          change({
                            imageSearch: event.target.value as InstallationSettings['imageSearch'],
                          })
                        }
                      >
                        <option value="none">Off — upload your own pictures</option>
                        <option value="wikimedia">Wikimedia Commons</option>
                        <option value="openverse">Openverse</option>
                      </select>
                      <small>Online search sends your search terms to the selected service.</small>
                    </label>
                    {settings.mode !== 'basic' && (
                      <label className="installation-checkbox">
                        <input
                          type="checkbox"
                          checked={settings.speaking}
                          onChange={(event) => change({ speaking: event.target.checked })}
                        />
                        Enable local speech recognition for speaking practice. The speech model
                        downloads automatically when enabled.
                      </label>
                    )}
                  </fieldset>
                </details>
                <div className="installation-actions">
                  <button
                    className="installation-primary"
                    disabled={disabled}
                    onClick={() => {
                      if (validated()) go(2);
                    }}
                  >
                    Review settings →
                  </button>
                  <Link href="/library">Explore first</Link>
                </div>
              </>
            ) : (
              <>
                <p className="eyebrow">STEP 03 / READY WHEN YOU ARE</p>
                <h2 ref={heading} tabIndex={-1}>
                  A good place to begin.
                </h2>
                <p>Check your choices, then we’ll get everything ready.</p>
                <dl className="installation-summary">
                  <div>
                    <dt>Learning mode</dt>
                    <dd>{modes.find((mode) => mode.id === settings.mode)?.title}</dd>
                  </div>
                  {settings.mode !== 'basic' && (
                    <>
                      <div>
                        <dt>Model</dt>
                        <dd>{settings.model}</dd>
                      </div>
                      <div>
                        <dt>Model server</dt>
                        <dd>{settings.endpoint}</dd>
                      </div>
                      <div>
                        <dt>Connection check</dt>
                        <dd>
                          {connection?.ok
                            ? 'Passed'
                            : 'Not verified — you can test it before finishing'}
                        </dd>
                      </div>
                    </>
                  )}
                  <div>
                    <dt>Picture search</dt>
                    <dd>
                      {settings.imageSearch === 'none'
                        ? 'Own uploads'
                        : settings.imageSearch === 'wikimedia'
                          ? 'Wikimedia Commons'
                          : 'Openverse'}
                    </dd>
                  </div>
                  <div>
                    <dt>Pronunciation</dt>
                    <dd>{VOICE_PROFILES.find((voice) => voice.id === settings.speech)?.title}</dd>
                  </div>
                  <div>
                    <dt>Speech recognition</dt>
                    <dd>{settings.speaking ? 'Local speech model' : 'Off'}</dd>
                  </div>
                </dl>
                {settings.mode !== 'basic' && !connection?.ok && (
                  <p className="installation-hint">
                    You can save now and connect your model later. AI features need an available
                    model to work.
                  </p>
                )}
                <div className="installation-actions">
                  <button
                    className="installation-primary"
                    disabled={disabled}
                    onClick={() => void save()}
                  >
                    {busy === 'save' ? 'Applying settings…' : 'Finish setup →'}
                  </button>
                  <button disabled={disabled} onClick={() => go(1)}>
                    Back to settings
                  </button>
                </div>
                {busy === 'save' && (
                  <p role="status" className="installation-hint">
                    Your services are restarting with the new settings. This usually takes a few
                    seconds.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
