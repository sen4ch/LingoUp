'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import {
  InstallationHardwareSchema,
  LOCAL_MODEL_PROFILES,
  modelCompatibility,
  recommendInstallation,
  type InstallationHardware,
  type InstallationSettings,
} from '@lingoup/contracts';
import { api } from '@/lib/api-client';

export function InstallationHardwarePanel({
  settings,
  change,
  disabled,
}: {
  settings: InstallationSettings;
  change: (patch: Partial<InstallationSettings>) => void;
  disabled: boolean;
}) {
  const [hardware, setHardware] = useState<InstallationHardware | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = () =>
    api('/v1/setup/hardware', { schema: InstallationHardwareSchema })
      .then(setHardware)
      .catch(() => {
        setError('Hardware detection is unavailable. You can enter specifications manually.');
      })
      .finally(() => setLoading(false));
  const loadOnMount = useEffectEvent(load);
  useEffect(() => {
    void loadOnMount();
  }, []);
  const automatic = hardware
    ? {
        memoryGiB: hardware.memoryGiB,
        cpuCores: hardware.cpuCores,
        gpuMemoryGiB: hardware.gpu?.memoryGiB ?? null,
      }
    : null;
  const remote =
    settings.mode === 'ollama' &&
    (() => {
      try {
        return new URL(settings.endpoint).hostname !== 'ollama';
      } catch {
        return true;
      }
    })();
  const machine = settings.hardwareOverride ?? (remote ? null : automatic);
  const recommendation = machine ? recommendInstallation(machine) : null;
  const manual = settings.hardwareOverride;
  return (
    <details className="installation-hardware">
      <summary>
        Hardware & compatibility{' '}
        <span>
          {loading
            ? 'Checking resources…'
            : recommendation
              ? `Suggested: ${recommendation.mode === 'ollama' ? recommendation.model : 'API provider'}`
              : 'Refine model server specifications'}
        </span>
      </summary>
      <div className="installation-section-heading">
        <div>
          <p className="eyebrow">FIND A COMFORTABLE FIT</p>
          <h3>Your computer or server</h3>
        </div>
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => {
            setLoading(true);
            setError('');
            void load();
          }}
        >
          {loading ? 'Checking…' : 'Check again'}
        </button>
      </div>
      <p>
        Detected on the application server, within Docker’s visible limits. This is not a scan of
        the computer running your browser.
      </p>
      {hardware && (
        <dl className="installation-hardware-stats">
          <div>
            <dt>RAM visible</dt>
            <dd>{hardware.memoryGiB.toFixed(1)} GiB</dd>
          </div>
          <div>
            <dt>CPU available</dt>
            <dd>{Number(hardware.cpuCores.toFixed(2))} vCPU</dd>
          </div>
          <div>
            <dt>GPU exposed here</dt>
            <dd>{hardware.gpu ? `${hardware.gpu.memoryGiB.toFixed(1)} GiB` : 'Unknown'}</dd>
          </div>
          <div>
            <dt>App storage free</dt>
            <dd>
              {hardware.diskFreeGiB === null ? 'Unknown' : `${hardware.diskFreeGiB.toFixed(1)} GiB`}
            </dd>
          </div>
        </dl>
      )}
      {hardware?.containerLimited && (
        <p className="installation-hint">
          Container limits were detected. Docker may have fewer resources than the physical machine.
        </p>
      )}
      {error && <p role="status">{error}</p>}
      <details>
        <summary>
          Refine specifications <span>For another server or a GPU Docker cannot see</span>
        </summary>
        <fieldset disabled={disabled}>
          <label className="installation-checkbox">
            <input
              type="checkbox"
              checked={!!manual}
              onChange={(event) =>
                change({
                  hardwareOverride: event.target.checked
                    ? (automatic ?? { memoryGiB: 8, cpuCores: 2, gpuMemoryGiB: null })
                    : null,
                })
              }
            />
            Use specifications I enter for the model server
          </label>
          {manual && (
            <div className="installation-manual-specs">
              <label className="installation-field">
                Model server RAM (GiB)
                <input
                  type="number"
                  min="0.5"
                  max="16384"
                  step="0.5"
                  value={manual.memoryGiB}
                  onChange={(event) =>
                    change({
                      hardwareOverride: { ...manual, memoryGiB: Number(event.target.value) },
                    })
                  }
                />
              </label>
              <label className="installation-field">
                Model server CPU cores
                <input
                  type="number"
                  min="0.25"
                  max="4096"
                  step="0.25"
                  value={manual.cpuCores}
                  onChange={(event) =>
                    change({
                      hardwareOverride: { ...manual, cpuCores: Number(event.target.value) },
                    })
                  }
                />
              </label>
              <label className="installation-field">
                GPU VRAM (GiB)
                <input
                  type="number"
                  min="0"
                  max="4096"
                  step="0.5"
                  placeholder="Unknown; 0 for CPU only"
                  value={manual.gpuMemoryGiB ?? ''}
                  onChange={(event) =>
                    change({
                      hardwareOverride: {
                        ...manual,
                        gpuMemoryGiB: event.target.value === '' ? null : Number(event.target.value),
                      },
                    })
                  }
                />
              </label>
            </div>
          )}
          <p className="installation-hint">
            GPU not detected does not mean no GPU exists. Enter VRAM only for a GPU your model
            server can actually use. Changing this estimate does not allocate Docker resources.
          </p>
        </fieldset>
      </details>
      <div className="installation-recommendation">
        <strong>
          {recommendation
            ? `Suggested: ${recommendation.mode === 'ollama' ? recommendation.model : 'API provider'} + ${recommendation.speech.startsWith('piper') ? 'local voice' : 'browser voices'}`
            : 'Check the model server’s specifications'}
        </strong>
        <p>
          {recommendation?.reason ??
            'Resources on this app server do not establish what a separate Ollama host can run. Enter that host’s RAM, CPU and usable VRAM above.'}
        </p>
        {recommendation && (
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              change({
                mode: recommendation.mode,
                hardwareOverride: settings.hardwareOverride,
                model: recommendation.model || 'gpt-4.1-mini',
                endpoint:
                  recommendation.mode === 'ollama'
                    ? settings.mode === 'ollama'
                      ? settings.endpoint
                      : 'http://ollama:11434'
                    : '',
                apiProvider: 'custom',
                apiKey: '',
                allowExternal: false,
                speech: recommendation.speech,
              })
            }
          >
            Use this starting point
          </button>
        )}
      </div>
      <details className="installation-requirements">
        <summary>Compare local model requirements</summary>
        <div className="installation-model-comparison">
          {LOCAL_MODEL_PROFILES.map((profile) => {
            const fit = modelCompatibility(machine, profile);
            return (
              <article key={profile.model}>
                <h4>
                  {profile.title} <span>{profile.model}</span>
                </h4>
                <p>{profile.description}</p>
                <dl>
                  <div>
                    <dt>RAM budget</dt>
                    <dd>
                      {profile.memoryGiB} GiB minimum · {profile.recommendedMemoryGiB} GiB preferred
                    </dd>
                  </div>
                  <div>
                    <dt>CPU</dt>
                    <dd>{profile.cpuCores}+ cores</dd>
                  </div>
                  <div>
                    <dt>GPU for faster generation</dt>
                    <dd>{profile.gpuMemoryGiB}+ GiB VRAM</dd>
                  </div>
                  <div>
                    <dt>Model storage</dt>
                    <dd>
                      {profile.diskGiB}+ GiB free · {profile.download} download
                    </dd>
                  </div>
                </dl>
                <p className={`installation-fit ${fit.kind}`}>{fit.label}</p>
                <div className="installation-actions">
                  <button
                    disabled={disabled}
                    type="button"
                    onClick={() =>
                      change({
                        mode: 'ollama',
                        hardwareOverride: settings.hardwareOverride,
                        apiProvider: 'custom',
                        apiKey: '',
                        model: profile.model,
                        endpoint:
                          settings.mode === 'ollama' ? settings.endpoint : 'http://ollama:11434',
                      })
                    }
                  >
                    Choose this model
                  </button>
                  <a href={profile.source} target="_blank" rel="noreferrer">
                    Model details ↗
                  </a>
                </div>
              </article>
            );
          })}
        </div>
        <p className="installation-hint">
          Planning estimates for Q4 models, about 4K context and one active learner, including
          application headroom. These are not benchmarks. Multiple users, larger contexts and
          simultaneous voice generation need more resources. App disk space may differ from the
          model server’s disk. A GPU must be passed through to Ollama; detecting it here does not
          enable acceleration.
        </p>
      </details>
    </details>
  );
}
