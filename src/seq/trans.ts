// Transizioni sui tagli: tra due clip vicine sulla stessa traccia (la seconda comincia dove finisce la prima).
// La transizione è centrata sul taglio: dura d secondi, metà prima e metà dopo. Nella prima metà la clip che entra mostra
// i fotogrammi che vengono prima del suo inizio, nella seconda la clip che esce continua oltre la sua fine
// (come in Premiere; se nel file non ci sono, resta fermo il primo o l'ultimo fotogramma).
import { clipEnd } from './seq.ts';
import type { Seq, Clip } from './seq.ts';

export type TrType = 'fade' | 'dip' | 'flash' | 'zoom' | 'push' | 'blur' | 'whip' | 'glitch' | 'luma' | 'burn' | 'spin' | 'iris' | 'wipe' | 'pixel' | 'slices';
export interface Tr { type: TrType; dur: number; dir?: 'L' | 'R' | 'U' | 'D' }
export const TR_TYPES: [TrType, string][] = [['fade', 'Dissolvenza'], ['dip', 'Al nero'], ['flash', 'Flash'], ['zoom', 'Zoom'], ['push', 'Scorrimento'], ['blur', 'Sfocatura'],
  ['whip', 'Frusta'], ['glitch', 'Glitch'], ['luma', 'Luminosità'], ['burn', 'Pellicola bruciata'], ['spin', 'Rotazione'], ['iris', 'Cerchio'], ['wipe', 'Tendina'], ['pixel', 'Pixel'], ['slices', 'Fasce']];
/** Gruppi per il menu (le transizioni di tendenza: frusta, glitch, luminosità, pellicola, fasce…). */
export const TR_GROUPS: [string, TrType[]][] = [['Classiche', ['fade', 'dip', 'wipe', 'iris', 'push']], ['Movimento', ['whip', 'zoom', 'spin', 'slices']], ['Effetti', ['flash', 'burn', 'glitch', 'luma', 'pixel', 'blur']]];
/** Transizioni che hanno una direzione. */
export const TR_DIR: TrType[] = ['push', 'whip', 'wipe', 'slices'];

const EPS = 1 / 120;
/** Clip che finisce esattamente dove comincia c, sulla stessa traccia. */
export function prevAdjacent(s: Seq, c: Clip): Clip | null {
  return s.clips.find(o => o !== c && o.track === c.track && Math.abs(clipEnd(o) - c.start) < EPS) || null;
}
export function nextAdjacent(s: Seq, c: Clip): Clip | null {
  return s.clips.find(o => o !== c && o.track === c.track && Math.abs(o.start - clipEnd(c)) < EPS) || null;
}
/** Durata effettiva della transizione in entrata di c (0 se non c'è o se non c'è una clip attaccata prima). */
export function trDur(s: Seq, c: Clip): number {
  const t = (c as any).tr as Tr | undefined;
  if (!t || !t.type || !(t.dur > 0)) return 0;
  const a = prevAdjacent(s, c);
  return a ? Math.min(t.dur, a.dur, c.dur) : 0;
}
/** Quanto una clip si allunga per le transizioni: prima del suo inizio (entrata) e dopo la sua fine (uscita verso la successiva). */
export function trExt(s: Seq, c: Clip): { pre: number; post: number } {
  const n = nextAdjacent(s, c);
  return { pre: trDur(s, c) / 2, post: n ? trDur(s, n) / 2 : 0 };
}
/** Transizione in corso all'istante T su una traccia: le due clip e l'avanzamento p (0 = solo la prima, 1 = solo la seconda). */
export function transitionAt(s: Seq, track: string, T: number): { a: Clip; b: Clip; p: number; tr: Tr } | null {
  for (const b of s.clips) {
    if (b.track !== track) continue;
    const d = trDur(s, b);
    if (!d || T < b.start - d / 2 || T >= b.start + d / 2) continue;
    return { a: prevAdjacent(s, b)!, b, p: (T - (b.start - d / 2)) / d, tr: (b as any).tr };
  }
  return null;
}
/** Visibile all'istante T, contando l'allungamento delle transizioni. */
export const activeExt = (s: Seq, c: Clip, T: number) => { const e = trExt(s, c); return T >= c.start - e.pre - 1e-9 && T < clipEnd(c) + e.post - 1e-9; };
