/* Mic capture worklet: downsamples the AudioContext rate to 16 kHz PCM16 LE and posts
   binary chunks to the main thread for WebSocket forwarding. */
class MicCaptureProcessor extends AudioWorkletProcessor {
  constructor(opts) {
    super();
    this.targetRate = (opts && opts.processorOptions && opts.processorOptions.targetRate) || 16000;
    this.inputRate = sampleRate; // AudioWorkletGlobalScope
    this.ratio = this.inputRate / this.targetRate;
    this.buf = [];
    this.acc = 0;
    this.chunkMs = 100;
    this.chunkSamples = Math.round(this.targetRate * (this.chunkMs / 1000));
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    // Linear resample mono Float32 → targetRate.
    for (let i = 0; this.acc < ch.length; i++) {
      const idx = Math.floor(this.acc);
      const next = Math.min(idx + 1, ch.length - 1);
      const frac = this.acc - idx;
      const s = ch[idx] * (1 - frac) + ch[next] * frac;
      const clamped = Math.max(-1, Math.min(1, s));
      this.buf.push(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
      this.acc += this.ratio;
    }
    this.acc -= ch.length;
    while (this.buf.length >= this.chunkSamples) {
      const slice = this.buf.splice(0, this.chunkSamples);
      const pcm = new Int16Array(slice);
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }
    return true;
  }
}

registerProcessor("mic-capture", MicCaptureProcessor);
