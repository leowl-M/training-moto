// Audio della sequenza: riproduzione nell'anteprima (WebAudio, sincronizzata con la testina) e mix per l'esportazione (OfflineAudioContext).
// Ogni clip con audio (la voce dei video, la musica) diventa una sorgente con il suo volume e le dissolvenze.
import { clipEnd, fadeShape } from './seq';
import type { Seq, Clip } from './seq';

const SR = 48000;
type GetBuf = (c: Clip) => AudioBuffer | null;
/** Regolazioni del mix: guadagno in più per clip (volume uniformato) e, per la musica, i punti di abbassamento sotto la voce. */
export interface MixOpts { gainOf?: (c: Clip) => number; duck?: (c: Clip) => [number, number][] | null }
const interp = (p: [number, number][], x: number) => { if (!p.length) return 1; if (x <= p[0][0]) return p[0][1]; for (let i = 1; i < p.length; i++) if (x <= p[i][0]) { const [a, u] = p[i - 1], [b, v] = p[i]; return b > a ? u + (v - u) * (x - a) / (b - a) : v; } return p[p.length - 1][1]; };

/** Programma le clip con audio su un contesto, a partire dall'istante T della timeline; "at" è quando, nel contesto, cade T. */
function schedule(ctx: BaseAudioContext, dest: AudioNode, seq: Seq, T: number, at: number, get: GetBuf, o: MixOpts = {}): AudioBufferSourceNode[] {
  const out: AudioBufferSourceNode[] = [];
  for (const c of seq.clips) {
    if (c.kind === 'motion' || c.mute || (c.vol ?? 1) <= 0) continue;
    const end = clipEnd(c);
    if (end <= T + 1e-6) continue;
    const buf = get(c);
    if (!buf) continue;
    // velocità: o l'audio è già stato riallungato a tono costante (buf._stretch), o si suona più veloce/lento (cambia il tono)
    const from = Math.max(T, c.start), sp = c.speed || 1, pre = (buf as any)._stretch === sp, src0 = c.inp + (from - c.start) * sp;
    const offset = pre ? src0 / sp : src0, dur = end - from;
    if (offset >= buf.duration) continue;
    const when = at + (from - T), src = ctx.createBufferSource(), g = ctx.createGain(), v = (c.vol ?? 1) * (o.gainOf ? o.gainOf(c) : 1);
    src.buffer = buf; src.connect(g); g.connect(dest);
    // volume con dissolvenze, espresso nel tempo del contesto
    const tc = (x: number) => at + (x - T), fi = c.fadeIn || 0, fo = c.fadeOut || 0;
    const gainAt = (x: number) => { let k = v; if (fi && x - c.start < fi) k *= fadeShape((x - c.start) / fi, c.fadeCurve); if (fo && end - x < fo) k *= fadeShape((end - x) / fo, c.fadeCurve); return k; };
    // le dissolvenze seguono la loro curva a piccoli passi (50 al secondo)
    g.gain.setValueAtTime(gainAt(from), Math.max(0, tc(from)));
    const steps = (a: number, b: number) => { a = Math.max(a, from); const n = Math.max(1, Math.ceil((b - a) * 50)); for (let i = 1; i <= n; i++) { const x = a + (b - a) * i / n; g.gain.linearRampToValueAtTime(gainAt(x), tc(x)); } };
    if (fi && c.start + fi > from) steps(c.start, Math.min(end, c.start + fi));
    if (fo && end > from) { const a = Math.max(from, end - fo, fi ? c.start + fi : -Infinity); g.gain.linearRampToValueAtTime(gainAt(a), tc(a)); steps(a, end); }
    // musica sotto la voce: un secondo guadagno che segue i punti di abbassamento
    const pts = o.duck ? o.duck(c) : null;
    if (pts && pts.length) {
      const dg = ctx.createGain();
      g.disconnect(); g.connect(dg); dg.connect(dest);
      dg.gain.setValueAtTime(interp(pts, from), Math.max(0, tc(from)));
      for (const [x, y] of pts) if (x > from && x < end) dg.gain.linearRampToValueAtTime(y, tc(x));
      dg.gain.linearRampToValueAtTime(interp(pts, end), tc(end));
    }
    if (!pre && sp !== 1) src.playbackRate.value = sp;
    src.start(Math.max(0, when), offset); src.stop(Math.max(0, when) + dur);
    out.push(src);
  }
  return out;
}

/** Riproduzione nell'anteprima: l'orologio dell'audio guida la testina, così video, grafica e suono restano allineati. */
export class SeqAudio {
  ac: AudioContext | null = null;
  private srcs: AudioBufferSourceNode[] = [];
  private master: GainNode | null = null; private lim: DynamicsCompressorNode | null = null;
  /** Uscita dell'anteprima: guadagno finale (volume uniformato) e, se acceso, un limitatore contro i picchi. */
  out(gain = 1, limitDb: number | null = -1): AudioNode {
    const ac = this.ctx();
    if (!this.master) { this.master = ac.createGain(); this.lim = ac.createDynamicsCompressor(); this.lim.connect(ac.destination); }
    const m = this.master, l = this.lim!;
    m.gain.value = gain; m.disconnect();
    if (limitDb != null) { l.threshold.value = limitDb - .5; l.knee.value = 0; l.ratio.value = 20; l.attack.value = .002; l.release.value = .1; m.connect(l); } else m.connect(ac.destination);
    return m;
  }
  setGain(g: number) { if (this.master) this.master.gain.setTargetAtTime(g, this.ctx().currentTime, .05); }
  private t0 = 0; private a0 = 0; running = false;
  ctx(): AudioContext { if (!this.ac) this.ac = new AudioContext({ sampleRate: SR, latencyHint: 'interactive' }); return this.ac; }
  start(seq: Seq, T: number, get: GetBuf, o: MixOpts = {}, gain = 1, limitDb: number | null = -1) {
    const ac = this.ctx();
    this.stop();
    if (ac.state === 'suspended') ac.resume();
    const at = ac.currentTime + .05;
    this.srcs = schedule(ac, this.out(gain, limitDb), seq, T, at, get, o);
    this.t0 = T; this.a0 = at; this.running = true;
  }
  stop() { for (const s of this.srcs) { try { s.stop(); } catch { /* già ferma */ } s.disconnect(); } this.srcs = []; this.running = false; }
  /** Istante della timeline secondo l'orologio dell'audio (null se ferma). */
  now(): number | null { return this.running && this.ac ? this.t0 + Math.max(0, this.ac.currentTime - this.a0) : null; }
}

/** Mix finale per l'esportazione: tutto l'audio della sequenza in un AudioBuffer stereo a 48 kHz. */
export async function mixdown(seq: Seq, total: number, get: GetBuf, o: MixOpts = {}): Promise<AudioBuffer> {
  const n = Math.max(1, Math.ceil(total * SR)), oc = new OfflineAudioContext(2, n, SR);
  schedule(oc, oc.destination, seq, 0, 0, get, o);
  return oc.startRendering();
}

/** Codifica AAC dell'audio mixato, a pezzi da 1024 campioni, verso il muxer MP4. */
export async function encodeAac(buf: AudioBuffer, onChunk: (c: EncodedAudioChunk, m?: EncodedAudioChunkMetadata) => void, bitrate = 192000): Promise<void> {
  let err: any = null;
  const enc = new AudioEncoder({ output: (c, m) => onChunk(c, m), error: e => { err = e; } });
  enc.configure({ codec: 'mp4a.40.2', sampleRate: SR, numberOfChannels: 2, bitrate });
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, step = 1024 * 4;
  for (let i = 0; i < buf.length && !err; i += step) {
    const n = Math.min(step, buf.length - i), data = new Float32Array(n * 2);
    data.set(L.subarray(i, i + n), 0); data.set(R.subarray(i, i + n), n);
    const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / SR * 1e6), data });
    enc.encode(ad); ad.close();
    if (enc.encodeQueueSize > 20) await new Promise(r => setTimeout(r, 1));
  }
  await enc.flush(); enc.close();
  if (err) throw err;
}
