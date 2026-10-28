import {
  SpeakingTurnResponseSchema,
  TranscriptionResponseSchema,
  type CefrLevel,
  type SpeakingMessage,
} from '@lingoup/contracts';
import { api } from './api-client';
import { recordingWav } from './speaking-audio';
import { teacherVoice } from './teacher-voice';

export type CallState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'paused';
interface CallOptions {
  level: CefrLevel;
  topic: string;
  consent: boolean;
  onState: (state: CallState) => void;
  onMessages: (messages: SpeakingMessage[]) => void;
  onMock: () => void;
  onError: (error: unknown) => void;
}

/** One cancellable call; mic capture and teacher playback never overlap (echo protection). */
export class SpeakingCall {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private recorder: AudioWorkletNode | null = null;
  private operation = new AbortController();
  private ended = false;
  private capture = false;
  private chunks: Float32Array[] = [];
  private voiceSamples = 0;
  private lastVoice = 0;
  private startedAt = 0;
  private messages: SpeakingMessage[] = [];
  constructor(private readonly options: CallOptions) {}

  async start() {
    const signal = this.operation.signal;
    this.options.onState('connecting');
    try {
      if (!window.isSecureContext) throw new Error('Microphone requires HTTPS or localhost');
      const context = new AudioContext();
      this.context = context;
      await context.resume();
      signal.throwIfAborted();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      if (signal.aborted) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      this.microphone(false);
      await context.audioWorklet.addModule('/speaking-recorder.js');
      signal.throwIfAborted();
      const node = new AudioWorkletNode(context, 'speaking-recorder');
      this.recorder = node;
      const mute = context.createGain();
      mute.gain.value = 0;
      context
        .createMediaStreamSource(stream)
        .connect(node)
        .connect(mute)
        .connect(context.destination);
      node.port.onmessage = (event: MessageEvent<Float32Array>) => this.samples(event.data);
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => this.end();
      });
      await this.reply(signal);
    } catch (error) {
      if (!signal.aborted) this.fail(error);
    }
  }

  private microphone(enabled: boolean) {
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }
  private listen() {
    if (this.ended) return;
    this.chunks = [];
    this.voiceSamples = 0;
    this.startedAt = performance.now();
    this.lastVoice = this.startedAt;
    this.capture = true;
    this.microphone(true);
    this.options.onState('listening');
  }
  private samples(samples: Float32Array) {
    if (!this.capture || !this.context || this.ended) return;
    this.chunks.push(samples);
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
    const now = performance.now();
    if (rms > 0.015) {
      this.lastVoice = now;
      this.voiceSamples += samples.length;
    }
    const voiced = this.voiceSamples > this.context.sampleRate * 0.15;
    if (voiced && (now - this.lastVoice > 1100 || now - this.startedAt > 20000)) this.send();
    else if (!voiced && now - this.startedAt > 10000) {
      this.chunks = [];
      this.startedAt = now;
    }
  }
  send() {
    if (!this.capture || !this.context) return;
    this.capture = false;
    this.microphone(false);
    if (this.voiceSamples < this.context.sampleRate * 0.15) {
      this.listen();
      return;
    }
    const audio = recordingWav(this.chunks, this.context.sampleRate);
    this.chunks = [];
    this.options.onState('thinking');
    const signal = this.operation.signal;
    void this.transcribe(audio, signal).catch((error: unknown) => {
      if (!signal.aborted) this.fail(error);
    });
  }
  private async transcribe(audio: Blob, signal: AbortSignal) {
    const result = await api('/v1/learning/speaking/transcribe', {
      method: 'POST',
      body: audio,
      schema: TranscriptionResponseSchema,
      signal,
    });
    signal.throwIfAborted();
    if (!result.text.trim()) {
      this.listen();
      return;
    }
    this.messages.push({ role: 'user', content: result.text });
    this.options.onMessages([...this.messages]);
    await this.reply(signal);
  }
  private async reply(signal: AbortSignal) {
    const result = await api('/v1/learning/speaking/turn', {
      method: 'POST',
      body: {
        level: this.options.level,
        topic: this.options.topic,
        messages: this.messages.slice(-20),
      },
      schema: SpeakingTurnResponseSchema,
      signal,
    });
    signal.throwIfAborted();
    if (result.isMock) this.options.onMock();
    this.messages.push({ role: 'assistant', content: result.reply });
    this.options.onMessages([...this.messages]);
    this.options.onState('speaking');
    await teacherVoice(result.reply, this.options.consent, signal);
    signal.throwIfAborted();
    this.listen();
  }
  pause() {
    if (this.ended) return;
    this.capture = false;
    this.chunks = [];
    this.microphone(false);
    this.operation.abort();
    this.operation = new AbortController();
    this.options.onState('paused');
  }
  resume() {
    if (!this.ended) this.listen();
  }
  interrupt() {
    this.pause();
    this.resume();
  }
  end() {
    this.ended = true;
    this.capture = false;
    this.operation.abort();
    this.chunks = [];
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    this.recorder?.disconnect();
    if (this.context) void this.context.close().catch(() => undefined);
    this.stream = null;
    this.context = null;
    this.options.onState('idle');
  }
  private fail(error: unknown) {
    if (this.ended) return;
    this.end();
    this.options.onError(error);
  }
}
