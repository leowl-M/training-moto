// Dal file alle parole con i tempi: audio mono a 16 kHz (canale della voce), si trova dove si parla, si tolgono le pause,
// si trascrive l'audio compresso e si riportano i tempi sul file. Così Whisper non "allunga" le parole dentro le pause.
import { energy, voiceRuns } from '../seq/silence.ts';
import { compressMap, mapWords, joinPieces } from './model.ts';
import type { Piece } from './model.ts';

export interface Progress { stage: 'prep' | 'load' | 'run'; loaded?: number; total?: number; sec?: number }
let W: Worker | null = null, seq = 0;
const jobs = new Map<number, { ok: (w: any) => void; ko: (e: Error) => void; prog: (p: Progress) => void; sec: number }>();
let cur = 0;

function worker() {
  if (W) return W;
  W = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  W.onmessage = e => {
    const m = e.data, j = jobs.get(m.id ?? cur);
    if (!j) return;
    if (m.type === 'load') j.prog({ stage: 'load', loaded: m.loaded, total: m.total });
    else if (m.type === 'run') j.prog({ stage: 'run', sec: j.sec });
    else if (m.type === 'done') { jobs.delete(m.id); j.ok(m.words); }
    else if (m.type === 'error') { jobs.delete(m.id); j.ko(new Error(m.msg)); }
  };
  return W;
}

/** Audio mono a 16 kHz da un AudioBuffer (canali già scelti: per la voce su un solo lato si usa quel lato). */
export async function to16k(chs: Float32Array[], sr: number): Promise<Float32Array> {
  const n = chs[0].length, m = new Float32Array(n);
  for (const c of chs) for (let i = 0; i < n; i++) m[i] += c[i] / chs.length;
  if (sr === 16000) return m;
  const len = Math.ceil(n * 16000 / sr), oc = new OfflineAudioContext(1, len, 16000), b = oc.createBuffer(1, n, sr);
  b.copyToChannel(m, 0);
  const s = oc.createBufferSource(); s.buffer = b; s.connect(oc.destination); s.start();
  return (await oc.startRendering()).getChannelData(0);
}

/** Tratti di voce dentro i pezzi usati e audio compresso da trascrivere. */
export function compress(x: Float32Array, ranges: [number, number][]): { audio: Float32Array; map: Piece[] } {
  const dur = x.length / 16000, runs = voiceRuns(energy([x], 16000), .3, .35);
  const inR: [number, number][] = [];
  for (const [a, b] of runs) for (const [p, q] of ranges) { const u = Math.max(a, p), v = Math.min(b, q); if (v - u > .03) inR.push([u, v]); }
  const map = compressMap(inR, .12, dur, .25);
  const tot = map.length ? Math.ceil((map[map.length - 1].ce + .25) * 16000) : 0, audio = new Float32Array(tot);
  for (const p of map) { const a = Math.round(p.os * 16000), n = Math.round((p.ce - p.cs) * 16000); audio.set(x.subarray(a, a + n), Math.round(p.cs * 16000)); }
  return { audio, map };
}

/** Trascrive: restituisce le parole con i tempi nel file. */
export async function transcribe(x16: Float32Array, ranges: [number, number][], lang: string | null, prog: (p: Progress) => void): Promise<{ t: string; s: number; e: number }[]> {
  prog({ stage: 'prep' });
  const { audio, map } = compress(x16, ranges);
  if (!map.length) return [];
  const id = ++seq; cur = id;
  const raw: { t: string; s: number; e: number }[] = await new Promise((ok, ko) => { jobs.set(id, { ok, ko, prog, sec: audio.length / 16000 }); worker().postMessage({ id, audio, lang }, [audio.buffer]); });
  return mapWords(joinPieces(raw), map);
}
