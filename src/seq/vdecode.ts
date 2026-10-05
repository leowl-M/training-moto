// Fotogrammi esatti dei video per l'esportazione (WebCodecs): molto più veloce che spostare il lettore fotogramma per fotogramma.
// Il file si legge con mp4box.js (caricato al bisogno, come mp4-muxer); la rotazione dei video verticali si legge dalla matrice della traccia.

import { framedRect, FRAME0 } from './frame.ts';
import type { Frame } from './frame.ts';

const MP4BOX_URL = 'https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js';
let lib: Promise<any> | null = null;
function loadMp4box(): Promise<any> {
  return lib || (lib = new Promise((ok, ko) => {
    const w = window as any;
    if (w.MP4Box) return ok(w.MP4Box);
    const s = document.createElement('script'); s.src = MP4BOX_URL;
    s.onload = () => (w.MP4Box ? ok(w.MP4Box) : ko(new Error('mp4box non valido')));
    s.onerror = () => { lib = null; ko(new Error('mp4box non raggiungibile')); };
    document.head.appendChild(s);
  }));
}

/** Rotazione (gradi, 0/90/180/270) dalla matrice di una traccia MP4. */
export function rotationOf(matrix: ArrayLike<number> | undefined): number {
  if (!matrix || matrix.length < 4) return 0;
  const a = matrix[0] / 65536, b = matrix[1] / 65536, deg = Math.round(Math.atan2(b, a) * 180 / Math.PI);
  return ((deg % 360) + 360) % 360;
}

export class VideoDecode {
  private samples: any[] = []; private cfg: VideoDecoderConfig | null = null; private dec: VideoDecoder | null = null;
  private next = 0; private frames: VideoFrame[] = []; private err: any = null; private ended = false;
  rot = 0; w = 0; h = 0; ok = false;
  /** Tempo del primo fotogramma nel file: i video con fotogrammi B (Sony, iPhone…) partono per esempio da 0,04 s. Il lettore del browser
   *  lo toglie (parte da 0), quindi lo togliamo anche qui: stessi tempi per anteprima, esportazione, audio e stabilizzazione. */
  t0 = 0;
  constructor(private file: File) {}

  async init(): Promise<boolean> {
    try {
      const MP4Box = await loadMp4box(), buf: any = await this.file.arrayBuffer(); buf.fileStart = 0;
      const mp4 = MP4Box.createFile();
      const info: any = await new Promise((res, rej) => { mp4.onError = rej; mp4.onReady = res; mp4.appendBuffer(buf); mp4.flush(); });
      const vt = info.videoTracks[0];
      if (!vt) return false;
      const trak = mp4.getTrackById(vt.id);
      let desc: Uint8Array | undefined;
      for (const e of trak.mdia.minf.stbl.stsd.entries) {
        const b = e.avcC || e.hvcC || e.vpcC || e.av1C;
        if (b) { const s = new (window as any).DataStream(undefined, 0, (window as any).DataStream.BIG_ENDIAN); b.write(s); desc = new Uint8Array(s.buffer, 8); break; }
      }
      this.rot = rotationOf(vt.matrix);
      this.w = vt.video.width; this.h = vt.video.height;
      await new Promise<void>(res => { mp4.onSamples = (_id: number, _u: any, ss: any[]) => { this.samples.push(...ss); if (this.samples.length >= vt.nb_samples) res(); }; mp4.setExtractionOptions(vt.id, null, { nbSamples: 1000 }); mp4.start(); });
      this.t0 = this.samples.length ? Math.min(...this.samples.map(x => x.cts / x.timescale)) : 0;
      this.cfg = { codec: vt.codec, codedWidth: this.w, codedHeight: this.h, description: desc, hardwareAcceleration: 'no-preference' };
      if (!(await VideoDecoder.isConfigSupported(this.cfg)).supported) return false;
      this.ok = true;
      return true;
    } catch { return false; }
  }

  private open(fromSample: number) {
    this.close();
    this.frames = []; this.err = null; this.ended = false;
    this.dec = new VideoDecoder({ output: f => this.frames.push(f), error: e => { this.err = e; } });
    this.dec.configure(this.cfg!);
    this.next = fromSample;
  }
  /** Tempi di tutti i fotogrammi (secondi, in ordine). */
  times(): number[] { return this.samples.map((_, i) => this.tsOf(i)).sort((a, b) => a - b); }
  private tsOf(i: number) { const s = this.samples[i]; return s.cts / s.timescale - this.t0; }
  private keyBefore(t: number) { let k = 0; for (let i = 0; i < this.samples.length; i++) { if (this.tsOf(i) > t) break; if (this.samples[i].is_sync) k = i; } return k; }

  /** Fotogramma visibile all'istante t (secondi nel file). Il fotogramma resta valido fino alla prossima chiamata. */
  async frameAt(t: number): Promise<VideoFrame | null> {
    if (!this.ok) return null;
    const last = this.frames.length ? this.frames[this.frames.length - 1].timestamp / 1e6 : -Infinity;
    const first = this.frames.length ? this.frames[0].timestamp / 1e6 : Infinity;
    // si torna indietro o si salta molto avanti: si riparte dal fotogramma chiave precedente
    if (!this.dec || t < first - 1e-3 || t > last + 2) this.open(this.keyBefore(t));
    const dec = this.dec!;
    while (!this.err) {
      const have = this.frames.length ? this.frames[this.frames.length - 1].timestamp / 1e6 : -Infinity;
      if (have > t + 1e-4) break;
      if (this.next < this.samples.length) {
        const s = this.samples[this.next++];
        dec.decode(new EncodedVideoChunk({ type: s.is_sync ? 'key' : 'delta', timestamp: Math.round(1e6 * (s.cts / s.timescale - this.t0)), duration: Math.round(1e6 * s.duration / s.timescale), data: s.data }));
        if (dec.decodeQueueSize > 8) await new Promise(r => setTimeout(r, 0));
        else await Promise.resolve();
      } else if (!this.ended) { this.ended = true; await dec.flush(); }
      else break;
      if (this.frames.length < 1 && dec.decodeQueueSize > 0) await new Promise(r => setTimeout(r, 0));
    }
    if (this.err) return null;
    this.frames.sort((a, b) => a.timestamp - b.timestamp);
    // tiene l'ultimo fotogramma non successivo a t e libera quelli prima
    let k = -1;
    for (let i = 0; i < this.frames.length; i++) if (this.frames[i].timestamp / 1e6 <= t + 1e-4) k = i;
    if (k < 0) return this.frames[0] || null;
    for (let i = 0; i < k; i++) this.frames[i].close();
    this.frames = this.frames.slice(k);
    return this.frames[0];
  }

  close() { for (const f of this.frames) { try { f.close(); } catch { /* */ } } this.frames = []; try { this.dec?.close(); } catch { /* */ } this.dec = null; }
}

/** Disegna un fotogramma (anche ruotato) dentro il riquadro W×H: cover riempie, contain sta dentro. */
/** st = correzione della stabilizzazione (spostamento in frazione della larghezza, rotazione, zoom), attorno al centro del video. */
export function drawRotated(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, rot: number, W: number, H: number, fit: 'cover' | 'contain', f: Frame = FRAME0, st?: { tx: number; ty: number; th: number; sc: number } | null) {
  const vw = rot % 180 ? sh : sw, vh = rot % 180 ? sw : sh;   // dimensioni dopo la rotazione
  const r = framedRect(vw, vh, W, H, fit, f), k = r.k;          // inquadratura del formato (centro e zoom)
  ctx.save(); ctx.translate(r.x0 + r.rw / 2, r.y0 + r.rh / 2);
  if (st) { ctx.translate(st.tx * r.rw, st.ty * r.rw); if (st.th) ctx.rotate(st.th); ctx.scale(st.sc, st.sc); }
  if (rot) ctx.rotate(rot * Math.PI / 180); ctx.scale(k, k);
  ctx.drawImage(src, -sw / 2, -sh / 2, sw, sh);
  ctx.restore();
}
