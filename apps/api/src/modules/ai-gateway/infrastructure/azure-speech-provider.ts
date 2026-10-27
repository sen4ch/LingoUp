import type { SpeechProvider } from '../application/speech-provider.js';

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/** Builds SSML; the text is escaped, so it cannot inject SSML tags. */
export function buildSsml(text: string, voice: string): string {
  const lang = voice.slice(0, 5);
  const escaped = text.replace(/[&<>"']/g, (char) => XML_ESCAPES[char]!);
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}"><voice name="${voice}">${escaped}</voice></speak>`;
}

/** Azure AI Speech text-to-speech over REST (no SDK, no native dependencies). */
export class AzureSpeechProvider implements SpeechProvider {
  readonly name = 'azure';
  readonly dataLocality = 'external' as const;

  constructor(
    private readonly options: { key: string; region: string; voice: string },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get voice(): string {
    return this.options.voice;
  }

  async synthesize(text: string, signal: AbortSignal): Promise<Buffer> {
    const response = await this.fetchImpl(
      `https://${this.options.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.options.key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'lingoup-api',
        },
        body: buildSsml(text, this.options.voice),
        signal,
      },
    );
    if (!response.ok) {
      // The body may echo request details; only the status is reported.
      throw new Error(`Azure Speech responded with ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
}
