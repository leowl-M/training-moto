// Analisi del movimento di un file video, nel browser: ogni fotogramma in piccolo (480 px di larghezza, già ruotato come si vede),
// in grigio, confrontato con il precedente dal grossolano al fine (120 → 240 → 480 px), partendo dal movimento del fotogramma prima. Con WebCodecs si leggono tutti i fotogrammi in fila; se il browser non sa decodificare
// il file così, si fa scorrere il video in velocità e si analizzano i fotogrammi che arrivano (con il loro tempo esatto).
// Il risultato si ricorda nel browser (IndexedDB) per file: si analizza una volta sola.
import { VideoDecode, drawRotated } from './vdecode.ts';
import { grayOf, estimatePyr, pyramid, addMotion } from './stab.ts';
import type { Track } from './stab.ts';

const AW = 480;

export async function analyze(file: File, url: string | null, prog: (p: number) => void, stop: () => boolean = () => false): Promise<Track | null> {
  const dec = new VideoDecode(file);
  if (await dec.init()) {
    try { return await viaDecoder(dec, prog, stop); } finally { dec.close(); }
  }
  return url ? viaPlayback(url, prog, stop) : null;
}

function canvasFor(vw: number, vh: number) {
  const h = Math.max(16, Math.round(AW * vh / vw)), cv = new OffscreenCanvas(AW, h), cx = cv.getContext('2d', { willReadFrequently: true })! as unknown as CanvasRenderingContext2D;
  return { cv, cx, h };
}

async function viaDecoder(dec: VideoDecode, prog: (p: number) => void, stop: () => boolean): Promise<Track | null> {
  const vw = dec.rot % 180 ? dec.h : dec.w, vh = dec.rot % 180 ? dec.w : dec.h, { cx, h } = canvasFor(vw, vh);
  const tr: Track = { v: 3, aspect: vw / vh, t: [], x: [], y: [], a: [], s: [] }, ts = dec.times();
  let prev: ReturnType<typeof pyramid> | null = null, last = performance.now(), mv = { tx: 0, ty: 0 };
  for (let i = 0; i < ts.length; i++) {
    if (stop()) return null;
    const f = await dec.frameAt(ts[i] + 1e-4);
    if (!f) return null;
    drawRotated(cx, f, f.displayWidth, f.displayHeight, dec.rot, AW, h, 'cover');
    const g = pyramid(grayOf(cx.getImageData(0, 0, AW, h).data, AW, h), AW, h, 3);
    const m = prev ? estimatePyr(prev, g, mv) : null; if (m) mv = m;
    addMotion(tr, +ts[i].toFixed(4), m, AW);
    prev = g;
    if (performance.now() - last > 30) { prog((i + 1) / ts.length); await new Promise(r => setTimeout(r, 0)); last = performance.now(); }
  }
  prog(1);
  return tr;
}

function viaPlayback(url: string, prog: (p: number) => void, stop: () => boolean): Promise<Track | null> {
  return new Promise(res => {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.src = url; v.preload = 'auto';
    let tr: Track | null = null, prev: ReturnType<typeof pyramid> | null = null, c: ReturnType<typeof canvasFor> | null = null, done = false, mv = { tx: 0, ty: 0 };
    const end = (ok: boolean) => { if (done) return; done = true; v.pause(); v.removeAttribute('src'); v.load(); res(ok ? tr : null); };
    const onFrame = (_n: number, meta: any) => {
      if (done) return;
      if (stop()) return end(false);
      if (!c) { c = canvasFor(v.videoWidth, v.videoHeight); tr = { v: 3, aspect: v.videoWidth / v.videoHeight, t: [], x: [], y: [], a: [], s: [] }; }
      c.cx.drawImage(v, 0, 0, AW, c.h);
      const g = pyramid(grayOf(c.cx.getImageData(0, 0, AW, c.h).data, AW, c.h), AW, c.h, 3), t = +meta.mediaTime.toFixed(4);
      if (!tr!.t.length || t > tr!.t[tr!.t.length - 1]) { const m = prev ? estimatePyr(prev, g, mv) : null; if (m) mv = m; addMotion(tr!, t, m, AW); prev = g; }
      prog(Math.min(.99, t / (v.duration || 1)));
      (v as any).requestVideoFrameCallback(onFrame);
    };
    v.onended = () => end(true); v.onerror = () => end(false);
    v.onloadedmetadata = () => { v.playbackRate = 2; (v as any).requestVideoFrameCallback(onFrame); v.play().catch(() => end(false)); };
  });
}

/* --- memoria nel browser --- */
const DB = 'moto-stab', ST = 'tracks';   // le analisi di versioni vecchie (meno precise) non valgono: si rifanno
function db(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
}
export async function loadTrack(key: string): Promise<Track | null> {
  try { const d = await db(); return await new Promise(ok => { const q = d.transaction(ST).objectStore(ST).get(key); q.onsuccess = () => ok(q.result && q.result.v === 3 ? q.result : null); q.onerror = () => ok(null); }); } catch { return null; }
}
export async function saveTrack(key: string, tr: Track) {
  try { const d = await db(); await new Promise(ok => { const t = d.transaction(ST, 'readwrite'); t.objectStore(ST).put(tr, key); t.oncomplete = ok; t.onerror = ok; }); } catch { /* */ }
}
