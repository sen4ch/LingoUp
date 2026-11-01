import type { SpeechProvider } from '../application/speech-provider.js';

/**
 * Microsoft Edge read-aloud voices, synthesized by ai-service (edge-tts). Free and keyless,
 * but the text is sent to Microsoft, so it is treated as an external provider.
 */
export class AiServiceSpeechProvider implements SpeechProvider {
  get name() {
    return this.options.voice.startsWith('piper-') ? this.options.voice : 'edge';
  }
  get dataLocality(): 'local' | 'external' {
    return this.options.voice.startsWith('piper-') ? 'local' : 'external';
  }

  constructor(
    private readonly options: { baseUrl: string; token: string; voice: string },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get voice(): string {
    return this.options.voice;
  }

  async synthesize(text: string, signal: AbortSignal): Promise<Buffer> {
    const response = await this.fetchImpl(
      new URL('/v1/tasks/speech-synthesis', this.options.baseUrl),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ai-service-token': this.options.token,
        },
        body: JSON.stringify({ text, voice: this.options.voice }),
        signal,
      },
    );
    if (!response.ok) throw new Error(`AI service responded with ${response.status}`);
    if (response.headers.get('content-type') !== 'audio/mpeg')
      throw new Error('AI service returned something other than MP3');
    return Buffer.from(await response.arrayBuffer());
  }
}
