import type { DataLocality } from './ai-provider.js';

/** Port for text-to-speech adapters. Returns MP3 audio. */
export interface SpeechProvider {
  readonly name: string;
  readonly voice: string;
  readonly dataLocality: DataLocality;
  synthesize(text: string, signal: AbortSignal): Promise<Buffer>;
}

export const SPEECH_PROVIDER = Symbol('SPEECH_PROVIDER');

export const SPEECH_AUDIO_TYPE = 'audio/mpeg';
