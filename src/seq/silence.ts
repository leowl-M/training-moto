// Elimina pause: trova la voce nell'audio (energia ogni 10 ms) e taglia i silenzi più lunghi di una soglia,
// lasciando un margine prima e dopo le parole. I tagli diventano clip normali sulla timeline (si possono ancora ritoccare)
// e tutto ciò che viene dopo si sposta indietro, come un "elimina con ricompattamento". Funzioni pure, provate da terminale.
import { spd, unoverlap } from './seq.ts';
import type { Seq, Clip } from './seq.ts';

export type Range = [number, number];
export interface PauseOpts { minPause: number; pad: number; thr: number }   // secondi, secondi, soglia della voce (0–1 tra rumore di fondo e voce)
export const PAUSE_PRESETS: Record<'delicata' | 'media' | 'serrata', PauseOpts> = {
  delicata: { minPause: .6, pad: .25, thr: .35 },
  media: { minPause: .35, pad: .15, thr: .35 },
  serrata: { minPause: .25, pad: .08, thr: .35 },
};
export const HOP = .01;                                   // un valore di energia ogni 10 ms

/** Energia in dB ogni 10 ms. Con più canali vale il più forte: se un canale è vuoto (microfono DJI su un solo lato) non abbassa la voce. */
export function energy(chs: Float32Array[], sr: number): Float32Array {
  const win = Math.max(1, Math.round(sr * HOP)), n = Math.floor((chs[0]?.length || 0) / win), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let best = 0;
    for (const c of chs) { let s = 0; for (let j = i * win, e = j + win; j < e; j++) s += c[j] * c[j]; if (s > best) best = s; }
    out[i] = 10 * Math.log10(best / win + 1e-12);
  }
  return out;
}

/** Tratti di voce (in secondi). La soglia si adatta al file: tra il rumore di fondo (8° percentile) e la voce (95°).
 *  Gli scatti isolati (lontani almeno isoGap dalla voce), brevi (< 0,25 s) e almeno 6 dB sotto la voce (respiri, schiocchi, rumori) non contano. */
export function voiceRuns(db: Float32Array, thr = .35, isoGap = .35): Range[] {
  const n = db.length;
  if (!n) return [];
  const sm = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0, k = 0; for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) { s += db[j]; k++; } sm[i] = s / k; }
  const so = [...sm].sort((a, b) => a - b), floor = so[Math.floor(n * .08)], peak = so[Math.floor(n * .95)];
  if (peak - floor < 6) return [[0, n * HOP]];               // tutto uguale (solo voce o solo rumore): niente da tagliare
  const lim = floor + (peak - floor) * thr, v = [...sm].map(x => x >= lim);
  // buchi brevissimi dentro la voce (consonanti, < 80 ms) restano voce; scatti brevissimi (< 50 ms) sono rumore
  const fill = (val: boolean, maxLen: number) => { let i = 0; while (i < n) { if (v[i] === val) { let j = i; while (j < n && v[j] === val) j++; if (j - i < maxLen && i > 0 && j < n) for (let k = i; k < j; k++) v[k] = !val; i = j; } else i++; } };
  fill(false, 8); fill(true, 5);
  const runs: Range[] = [];
  let st = -1;
  for (let i = 0; i <= n; i++) { if (i < n && v[i] && st < 0) st = i; if ((i === n || !v[i]) && st >= 0) { runs.push([st * HOP, i * HOP]); st = -1; } }
  // gruppi di tratti vicini: un gruppo breve, isolato e debole è rumore
  const loud = peak - 6, out: Range[] = [];
  for (let i = 0; i < runs.length;) {
    let j = i;
    while (j + 1 < runs.length && runs[j + 1][0] - runs[j][1] < isoGap) j++;
    const a = runs[i][0], b = runs[j][1];
    let top = -Infinity;
    for (let k = Math.floor(a / HOP); k < Math.min(n, Math.ceil(b / HOP)); k++) top = Math.max(top, sm[k]);   // media su 50 ms: uno schiocco secco resta basso
    if (b - a >= .25 || top >= loud) out.push(...runs.slice(i, j + 1));
    i = j + 1;
  }
  return out;
}

/** Parti da tenere: si tagliano solo le pause più lunghe di minPause, lasciando pad di margine attorno alla voce (anche all'inizio e alla fine). */
export function keepRanges(runs: Range[], dur: number, o: { minPause: number; pad: number }): Range[] {
  if (!runs.length) return [[0, dur]];
  const out: Range[] = [];
  for (const [a, b] of runs) {
    const l = out[out.length - 1];
    if (l && a - l[1] < o.minPause) l[1] = b; else out.push([a, b]);
  }
  const pad = out.map(([a, b]) => [Math.max(0, a - o.pad), Math.min(dur, b + o.pad)] as Range), res: Range[] = [];
  for (const r of pad) { const l = res[res.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else res.push(r); }
  return res;
}

/** Parti tenute dentro la porzione di sorgente usata dalla clip [inp, inp+dur] (i pezzi più corti di 2 fotogrammi si scartano). */
export function keptIn(kept: Range[], a: number, b: number, minLen = .08): Range[] {
  return kept.map(([x, y]) => [Math.max(a, x), Math.min(b, y)] as Range).filter(([x, y]) => y - x >= minLen);
}
/** Pause che verrebbero tolte da una clip (tempi della sorgente). */
export function pausesIn(kept: Range[], a: number, b: number): Range[] {
  const k = keptIn(kept, a, b), out: Range[] = [];
  let p = a;
  for (const [x, y] of k) { if (x - p > 1e-6) out.push([p, x]); p = y; }
  if (b - p > 1e-6) out.push([p, b]);
  return out;
}

/** Istante della timeline dopo aver tolto gli intervalli cuts (ordinati): chi cade dentro un taglio va al punto del taglio. */
export function mapTime(T: number, cuts: Range[]): number {
  let shift = 0;
  for (const [a, b] of cuts) { if (T >= b) shift += b - a; else if (T > a) return a - shift; else break; }
  return T - shift;
}

/** Taglia le pause di una clip: la clip diventa più pezzi uno dopo l'altro; le altre clip e i marker si spostano indietro
 *  (sulla stessa traccia non si sovrappongono: se serve, una clip aspetta la fine della precedente). */
export function removePauses(seq: Seq, id: string, kept: Range[], newId: () => string): { cuts: number; removed: number; ids: string[]; gcuts: Range[] } | null {
  const c = seq.clips.find(x => x.id === id);
  if (!c) return null;
  const sp = spd(c), end = c.inp + c.dur * sp;          // sorgente usata dalla clip
  const k = keptIn(kept, c.inp, end);
  if (!k.length) return null;
  const pz = pausesIn(kept, c.inp, end);
  if (!pz.length) return { cuts: 0, removed: 0, ids: [c.id], gcuts: [] };
  const cuts: Range[] = pz.map(([a, b]) => [c.start + (a - c.inp) / sp, c.start + (b - c.inp) / sp]);
  const removed = cuts.reduce((s, [a, b]) => s + b - a, 0);
  // gli altri si spostano prima di inserire i pezzi
  for (const o of seq.clips) if (o !== c) o.start = mapTime(o.start, cuts);
  for (const m of seq.markers) m.t = mapTime(m.t, cuts);
  let at = c.start;
  const pieces: Clip[] = k.map(([a, b], i) => {
    const p: Clip = { ...c, id: i ? newId() : c.id, start: at, inp: a, dur: (b - a) / sp };
    if (i) { p.fadeIn = 0; delete (p as any).tr; }
    if (i < k.length - 1) p.fadeOut = 0;
    at += (b - a) / sp;
    return p;
  });
  seq.clips.splice(seq.clips.indexOf(c), 1, ...pieces);
  // stessa traccia: niente sovrapposizioni (una clip lunga sopra un taglio, per esempio la musica, non si accorcia)
  unoverlap(seq);
  return { cuts: pz.length, removed, ids: pieces.map(p => p.id), gcuts: cuts };
}
