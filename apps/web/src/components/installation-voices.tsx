'use client';

import { useEffect, useState } from 'react';
import { VOICE_PROFILES, type InstallationSettings } from '@lingoup/contracts';

export function InstallationVoices({
  settings,
  change,
  disabled,
  onBusyChange,
}: {
  settings: InstallationSettings;
  change: (patch: Partial<InstallationSettings>) => void;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [audio, setAudio] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(
    () => () => {
      if (audio) URL.revokeObjectURL(audio);
    },
    [audio],
  );
  async function preview() {
    setBusy(true);
    onBusyChange(true);
    setError('');
    setAudio('');
    try {
      const response = await fetch('/api/v1/setup/voice-preview', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ speech: settings.speech }),
        signal: AbortSignal.timeout(140_000),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? 'Unlock installation settings again to preview a voice.'
            : 'Could not prepare the voice. Check your connection and try again.',
        );
      setAudio(URL.createObjectURL(await response.blob()));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Voice preview failed');
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <section className="installation-voices" aria-label="Voice quality">
      <h3>Choose your voice</h3>
      <p>Listen before you decide. The LLM and voice engine are independent choices.</p>
      <fieldset className="installation-voice-grid" disabled={disabled || busy}>
        <legend className="sr-only">Pronunciation voice</legend>
        {VOICE_PROFILES.map((voice) => (
          <label
            key={voice.id}
            className={`installation-voice ${settings.speech === voice.id ? 'selected' : ''}`}
          >
            <input
              type="radio"
              name="voice-quality"
              value={voice.id}
              checked={settings.speech === voice.id}
              onChange={() => change({ speech: voice.id })}
            />
            <div>
              <small>{voice.label}</small>
              <strong>{voice.title}</strong>
              <p>{voice.detail}</p>
              <span>
                {voice.memoryGiB
                  ? `${voice.memoryGiB}+ GiB server RAM · ${voice.cpuCores}+ CPU cores`
                  : 'Minimal server load'}
              </span>
              <span>{voice.disk}</span>
            </div>
          </label>
        ))}
      </fieldset>
      {settings.speech !== 'none' && (
        <>
          <div className="installation-actions">
            <button disabled={disabled || busy} type="button" onClick={() => void preview()}>
              {busy ? 'Preparing voice…' : 'Preview this voice'}
            </button>
            <span className="installation-hint">
              {settings.speech.startsWith('piper')
                ? 'First preview downloads the selected voice. Later synthesis works offline.'
                : 'Preview text is sent to Microsoft.'}
            </span>
          </div>
          {audio && <audio controls src={audio} aria-label="Selected voice preview" />}
          {busy && (
            <p role="status" className="installation-hint">
              Downloading or loading the voice model can take a minute. Your choice is saved only
              when you finish setup.
            </p>
          )}
          {error && (
            <p role="alert" className="installation-error">
              {error}
            </p>
          )}
        </>
      )}
      <p className="installation-hint">
        Voice budgets include the core app, without a local LLM. Add LLM and recognition headroom
        when running them together. Local profiles use Piper’s medium/high LJ Speech models; quality
        is subjective. Listening lessons also use the selected local quality (medium for
        browser/online pronunciation).{' '}
        <a
          href="https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/ljspeech"
          target="_blank"
          rel="noreferrer"
        >
          Voice models & credits ↗
        </a>
      </p>
    </section>
  );
}
