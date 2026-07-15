// Lightweight voice plumbing for the Gemini Live bridge:
//   - MicStream: capture mic, emit PCM16 LE @ 16 kHz Int16Array chunks
//   - AudioSink: queue base64 PCM16 LE @ 24 kHz chunks and play them gaplessly

export class MicStream {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private stream: MediaStream | null = null;
  private src: MediaStreamAudioSourceNode | null = null;
  onChunk: ((pcm: Int16Array) => void) | null = null;

  async start() {
    if (this.ctx) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    const Ctor: typeof AudioContext =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctor();
    await this.ctx.audioWorklet.addModule("/mic-capture-worklet.js");
    this.src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, "mic-capture", {
      processorOptions: { targetRate: 16000 },
    });
    this.node.port.onmessage = (e) => {
      const buf = e.data as ArrayBuffer;
      this.onChunk?.(new Int16Array(buf));
    };
    this.src.connect(this.node);
    // Do not connect to destination — we don't want to hear ourselves.
  }

  async stop() {
    try { this.src?.disconnect(); } catch {}
    try { this.node?.disconnect(); } catch {}
    this.stream?.getTracks().forEach((t) => t.stop());
    try { await this.ctx?.close(); } catch {}
    this.ctx = null;
    this.node = null;
    this.src = null;
    this.stream = null;
  }
}

export function int16ToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(s);
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export class AudioSink {
  private ctx: AudioContext | null = null;
  private playHead = 0;
  readonly sampleRate: number;

  constructor(sampleRate = 24000) { this.sampleRate = sampleRate; }

  private ensure(): AudioContext {
    if (this.ctx) return this.ctx;
    const Ctor: typeof AudioContext =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctor({ sampleRate: this.sampleRate });
    this.playHead = this.ctx.currentTime;
    return this.ctx;
  }

  pushBase64Pcm16(b64: string) {
    const ctx = this.ensure();
    const bytes = base64ToUint8(b64);
    const samples = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    const f32 = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) f32[i] = samples[i] / 0x8000;
    const buf = ctx.createBuffer(1, f32.length, this.sampleRate);
    buf.getChannelData(0).set(f32);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const start = Math.max(ctx.currentTime, this.playHead);
    src.start(start);
    this.playHead = start + buf.duration;
  }

  interrupt() {
    if (!this.ctx) return;
    // Drop the queue by snapping playHead back to now.
    this.playHead = this.ctx.currentTime;
  }

  async resume() {
    try { await this.ensure().resume(); } catch {}
  }
}
