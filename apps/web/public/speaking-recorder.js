/* AudioWorklet: batches mono PCM samples without recording on the UI thread. */
class SpeakingRecorder extends AudioWorkletProcessor {
  samples = new Float32Array(2048);
  offset = 0;
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) {
      for (const sample of channel) {
        this.samples[this.offset++] = sample;
        if (this.offset === this.samples.length) {
          this.port.postMessage(this.samples, [this.samples.buffer]);
          this.samples = new Float32Array(2048);
          this.offset = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('speaking-recorder', SpeakingRecorder);
