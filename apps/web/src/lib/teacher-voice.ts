import { pickVoice } from './pronunciation';

/** Playback is abortable, including a pending download: hang-up must never speak later. */
export async function teacherVoice(
  text: string,
  consent: boolean,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  if (consent) {
    try {
      const query = new URLSearchParams({ text, kind: 'sentence' });
      const response = await fetch(`/api/v1/vocabulary/pronunciation?${query}`, { signal });
      if (!response.ok) throw new Error('Speech unavailable');
      const url = URL.createObjectURL(await response.blob());
      try {
        signal.throwIfAborted();
        const audio = new Audio(url);
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            audio.pause();
            finish(new DOMException('Cancelled', 'AbortError'));
          };
          const finish = (error?: Error) => {
            signal.removeEventListener('abort', abort);
            audio.onended = null;
            audio.onerror = null;
            if (error) reject(error);
            else resolve();
          };
          audio.onended = () => finish();
          audio.onerror = () => finish(new Error('Audio playback failed'));
          signal.addEventListener('abort', abort, { once: true });
          void audio
            .play()
            .catch((error: unknown) =>
              finish(error instanceof Error ? error : new Error('Audio playback blocked')),
            );
        });
        return;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      if (signal.aborted) throw error;
    }
  }
  signal.throwIfAborted();
  if (!('speechSynthesis' in window)) throw new Error('English voice unavailable');
  const synth = window.speechSynthesis;
  if (!synth.getVoices().length) await new Promise<void>((resolve) => setTimeout(resolve, 500));
  signal.throwIfAborted();
  const voice = pickVoice(synth.getVoices(), !consent);
  if (!voice) throw new Error('English voice unavailable');
  await new Promise<void>((resolve, reject) => {
    const speech = new SpeechSynthesisUtterance(text);
    speech.voice = voice;
    speech.lang = 'en-US';
    speech.rate = 0.92;
    const abort = () => {
      synth.cancel();
      finish(new DOMException('Cancelled', 'AbortError'));
    };
    const finish = (error?: Error) => {
      signal.removeEventListener('abort', abort);
      speech.onend = null;
      speech.onerror = null;
      if (error) reject(error);
      else resolve();
    };
    speech.onend = () => finish();
    speech.onerror = () => finish(new Error('English voice unavailable'));
    signal.addEventListener('abort', abort, { once: true });
    synth.speak(speech);
  });
}
