import { describe, expect, it } from 'vitest';
import { recordingWav } from './speaking-audio';

describe('microphone WAV', () => {
  it('downsamples to mono 16 kHz PCM16 and clamps amplitude without corrupting the header', async () => {
    const blob = recordingWav(
      [new Float32Array(24000).fill(2), new Float32Array(24000).fill(-2)],
      48000,
    );
    const buffer = await blob.arrayBuffer();
    const data = new DataView(buffer);
    expect(blob.type).toBe('audio/wav');
    expect(buffer.byteLength).toBe(32044);
    expect(new TextDecoder().decode(buffer.slice(0, 4))).toBe('RIFF');
    expect(data.getUint32(24, true)).toBe(16000);
    expect(data.getUint32(40, true)).toBe(32000);
    expect(data.getInt16(44, true)).toBe(32767);
    expect(data.getInt16(44 + 8000 * 2, true)).toBe(-32768);
  });
});
