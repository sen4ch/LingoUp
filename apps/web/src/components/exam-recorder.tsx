'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@lingoup/ui';
import { TranscriptionResponseSchema } from '@lingoup/contracts';
import { api } from '@/lib/api-client';
import { recordingWav } from '@/lib/speaking-audio';

/** Reuses the speaking worklet and local recognition; each bounded segment fits its API limit. */
export function ExamRecorder({ onAppend }: { onAppend: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const stop = useRef<((cancel?: boolean) => void) | null>(null);
  const alive = useRef(true);
  const isAlive = () => alive.current;
  const pending = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current?.(true);
    };
  }, []);
  async function start() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isAlive()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      context = new AudioContext();
      await context.resume();
      await context.audioWorklet.addModule('/speaking-recorder.js');
      const chunks: Float32Array[] = [];
      const node = new AudioWorkletNode(context, 'speaking-recorder');
      node.port.onmessage = (event: MessageEvent<Float32Array>) =>
        chunks.push(new Float32Array(event.data));
      const mute = context.createGain();
      mute.gain.value = 0;
      context
        .createMediaStreamSource(stream)
        .connect(node)
        .connect(mute)
        .connect(context.destination);
      const activeContext = context;
      const activeStream = stream;
      let stopped = false;
      const finish = (cancel = false) => {
        if (stopped) return;
        stopped = true;
        clearTimeout(timer);
        node.disconnect();
        activeStream.getTracks().forEach((track) => track.stop());
        void activeContext.close();
        if (!alive.current || cancel) return;
        setRecording(false);
        setBusy(true);
        void api('/v1/learning/speaking/transcribe', {
          method: 'POST',
          body: recordingWav(chunks, activeContext.sampleRate),
          schema: TranscriptionResponseSchema,
        })
          .then((response) => {
            if (alive.current) onAppend(response.text);
          })
          .catch(() => {
            if (alive.current)
              setError('Could not transcribe. Try another segment or type your answer.');
          })
          .finally(() => {
            pending.current = false;
            if (alive.current) setBusy(false);
          });
      };
      const timer = setTimeout(() => finish(), 25_000);
      stop.current = finish;
      if (!isAlive()) {
        finish(true);
        return;
      }
      setRecording(true);
      setBusy(false);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      if (context) void context.close();
      pending.current = false;
      if (alive.current) {
        setBusy(false);
        setError('Microphone unavailable. Allow access or type your answer.');
      }
    }
  }
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        disabled={busy}
        onClick={() => (recording ? stop.current?.() : void start())}
      >
        {recording ? 'Stop & transcribe' : busy ? 'Transcribing…' : 'Record next segment (25 s)'}
      </Button>
      {recording ? (
        <p role="status" className="text-sm text-muted">
          Recording. This segment stops after 25 seconds; record another to continue.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
