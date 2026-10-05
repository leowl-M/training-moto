// Coreografia di un livello SVG: quanto è disegnato ogni tracciato, quanto è pieno il marchio, dove si trova il livello.
// Funzioni pure del tempo (tl = secondi dall'inizio del livello). Tre modi:
//  - build: le linee di costruzione si disegnano, il marchio compare in "bozza" (tono chiaro), le linee spariscono, il marchio si riempie;
//  - draw:  tutti i tracciati si disegnano uno dopo l'altro e le forme piene si riempiono appena il loro contorno è chiuso;
//  - fade:  dissolvenza semplice.
// In tutti i modi il livello può poi spostarsi (per esempio per fare spazio al nome).
// Con un logo completo (marchio + naming + payoff nello stesso file) lo spostamento va dall'inquadratura del solo marchio
// alla composizione intera, e naming e payoff entrano ciascuno con il suo tempo.

export type SvgMode = 'build' | 'draw' | 'fade' | 'none' | 'fx';   // fx = il logo finito entra con gli effetti della libreria (come le immagini)
export interface SvgAnim {
  mode: SvgMode;
  gStart: number; gDur: number; gStag: number;        // disegno dei tracciati (costruzione o contorni)
  mStart: number; mDur: number;                       // bozza del marchio (build)
  oMode: 'retract' | 'fade' | 'none'; oAt: number; oDur: number;   // le linee di costruzione spariscono (build)
  fAt: number; fDur: number;                          // riempimento pieno (build) o durata del riempimento di ogni forma (draw)
  mv: boolean; mvAt: number; mvDur: number;           // spostamento finale
  lock?: boolean;                                     // logo completo: naming e payoff entrano dopo il marchio
  nMode?: EnterMode; nAt?: number; nDur?: number; nStag?: number;   // entrata del naming
  pMode?: EnterMode; pAt?: number; pDur?: number; pStag?: number;   // entrata del payoff
  hold?: number;                                      // quanto resta fermo alla fine (secondi)
}
/** Entrata di naming e payoff: sale da una maschera, tendina da sinistra, contorno disegnato e poi riempito, dissolvenza. */
export type EnterMode = 'rise' | 'wipe' | 'draw' | 'fade';
/** Tratto visibile: da a a b (frazioni della lunghezza) con opacità op. */
export interface Seg { a: number; b: number; op: number }

const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const eOut = (t: number) => 1 - (1 - t) ** 3;
const eInOut = (t: number) => (t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** Avanzamento lineare (0–1) dell'elemento i di n in una finestra di durata dur che parte a start; stagger = quota della finestra usata per sfasarli. */
export function stag(tl: number, start: number, dur: number, stagger: number, i: number, n: number): number {
  const sg = Math.min(.95, Math.max(0, stagger)), L = Math.max(1e-6, dur * (1 - sg)), off = n > 1 ? (i / (n - 1)) * dur * sg : 0;
  return cl((tl - start - off) / L);
}
/** Istante in cui l'elemento i di n finisce di disegnarsi. */
export const stagEnd = (start: number, dur: number, stagger: number, i: number, n: number) => {
  const sg = Math.min(.95, Math.max(0, stagger)); return start + (n > 1 ? (i / (n - 1)) * dur * sg : 0) + dur * (1 - sg);
};

/** Tratto di una linea di costruzione (o di un tracciato da disegnare) all'istante tl. */
export function guideSeg(a: SvgAnim, i: number, n: number, tl: number): Seg {
  if (a.mode === 'none') return { a: 0, b: 1, op: 1 };
  if (a.mode === 'fade') return { a: 0, b: 1, op: eInOut(cl((tl - a.gStart) / Math.max(1e-6, a.gDur))) };
  const b = eOut(stag(tl, a.gStart, a.gDur, a.gStag, i, n));
  if (a.mode !== 'build' || a.oMode === 'none') return { a: 0, b, op: 1 };
  if (a.oMode === 'fade') return { a: 0, b, op: 1 - eInOut(cl((tl - a.oAt) / Math.max(1e-6, a.oDur))) };
  const r = eInOut(stag(tl, a.oAt, a.oDur, .5, i, n));       // si ritira dall'inizio verso la fine, nello stesso ordine
  return { a: r, b, op: r >= 1 ? 0 : 1 };
}

/** Stato di una forma del marchio: sketch = quanto è apparsa la bozza, fill = quanto è pieno (0–1), draw = contorno disegnato (modo draw). */
export function markState(a: SvgAnim, i: number, n: number, tl: number): { sketch: number; fill: number; draw: number } {
  switch (a.mode) {
    case 'none': return { sketch: 1, fill: 1, draw: 0 };
    case 'fade': { const f = eInOut(cl((tl - a.gStart) / Math.max(1e-6, a.gDur))); return { sketch: f, fill: f, draw: 0 }; }
    case 'draw': {
      const draw = eOut(stag(tl, a.gStart, a.gDur, a.gStag, i, n)), end = stagEnd(a.gStart, a.gDur, a.gStag, i, n);
      return { sketch: 0, fill: eInOut(cl((tl - end) / Math.max(1e-6, a.fDur))), draw };
    }
    default: return { sketch: eOut(cl((tl - a.mStart) / Math.max(1e-6, a.mDur))), fill: eInOut(cl((tl - a.fAt) / Math.max(1e-6, a.fDur))), draw: 0 };
  }
}

/** Avanzamento dello spostamento finale (0–1, già con la curva), 0 se lo spostamento è spento. */
export function moveT(a: SvgAnim, tl: number, ease: (t: number) => number = eInOut): number {
  return a.mv ? ease(cl((tl - a.mvAt) / Math.max(1e-6, a.mvDur))) : 0;
}

/** Entrata dell'elemento i di n di naming o payoff: draw = contorno disegnato (0–1), fill = riempimento, p = avanzamento con la curva. */
export function enterState(mode: EnterMode, at: number, dur: number, stagger: number, i: number, n: number, tl: number): { p: number; draw: number; fill: number } {
  if (mode === 'draw') {
    const draw = eOut(stag(tl, at, dur * .7, stagger, i, n)), end = stagEnd(at, dur * .7, stagger, i, n);
    return { p: draw, draw, fill: eInOut(cl((tl - end) / Math.max(1e-6, dur * .3))) };
  }
  const p = mode === 'wipe' ? eInOut(cl((tl - at) / Math.max(1e-6, dur))) : eOut(stag(tl, at, dur, stagger, i, n));
  return { p, draw: 0, fill: p };
}

/** Quando finisce l'animazione del livello (secondi dall'inizio del livello), compresa la pausa finale. */
export function animEnd(a: SvgAnim): number {
  let e = a.mode === 'none' ? 0 : a.gStart + a.gDur;
  if (a.mode === 'build') e = Math.max(e, a.mStart + a.mDur, a.oMode !== 'none' ? a.oAt + a.oDur : 0, a.fAt + a.fDur);
  if (a.mode === 'draw') e += a.fDur;
  if (a.mv) e = Math.max(e, a.mvAt + a.mvDur);
  if (a.lock) e = Math.max(e, (a.nAt ?? 0) + (a.nDur ?? 0), (a.pAt ?? 0) + (a.pDur ?? 0));
  return e + (a.hold ?? 0);
}

/* --- Inquadrature: durante la costruzione la camera si avvicina a una zona del disegno, poi a un'altra, poi si allarga sul tutto.
   L'animazione non cambia: cambia solo dove guarda la camera. Tempi in secondi dall'inizio del livello. */
export interface Shot { area: string; at: number; dur: number; z: number }
export interface SvgShots { on: boolean; list: Shot[]; tr: number; cut: boolean; push: number; restart?: boolean }
export const newShots = (): SvgShots => ({ on: false, list: [], tr: .6, cut: true, push: .06, restart: true });
/** Quanto durano le riprese ravvicinate se, tornando al quadro intero, l'animazione riparte da capo (altrimenti 0). */
export function shotsLen(S?: SvgShots | null): number {
  if (!S || !S.on || !S.list.length || S.restart === false) return 0;
  return Math.max(...S.list.map(s => s.at + Math.max(.01, s.dur)));
}
/** Tempo dell'animazione per un livello con riprese: a ogni stacco (nuova ripresa o ritorno al quadro intero) l'animazione riparte da 0. */
export function animTime(S: SvgShots | undefined | null, tl: number): number {
  const e = shotsLen(S);
  if (!e) return tl;
  if (tl >= e) return tl - e;
  const L = [...S!.list].sort((a, b) => a.at - b.at);
  let start = 0;
  for (const s of L) if (tl >= s.at) start = s.at;
  return tl - start;
}
const eSine = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
/** Fase delle inquadrature all'istante tl: k = inquadratura, hold = ferma (p = avanzamento al suo interno),
 *  move = passaggio verso la successiva, out = allargamento finale, done = finite. Con cut (stacco netto) niente passaggi:
 *  si salta da un'inquadratura all'altra e, alla fine, direttamente al quadro intero. f = avanzamento del passaggio con la curva. */
export function shotPhase(S: SvgShots | undefined, tl: number): { k: number; kind: 'hold' | 'move' | 'out' | 'done'; f: number; p: number } {
  const L = S && S.on ? [...S.list].sort((a, b) => a.at - b.at) : [];
  if (!L.length) return { k: -1, kind: 'done', f: 1, p: 1 };
  if (tl < L[0].at) return { k: 0, kind: 'hold', f: 0, p: 0 };
  for (let i = 0; i < L.length; i++) {
    const a = L[i], end = a.at + Math.max(.01, a.dur), nx = L[i + 1];
    if (tl < end) return { k: i, kind: 'hold', f: 0, p: cl((tl - a.at) / Math.max(.01, a.dur)) };
    if (nx && tl < nx.at) return S!.cut ? { k: i, kind: 'hold', f: 0, p: 1 } : { k: i, kind: 'move', f: eSine(cl((tl - end) / Math.max(1e-6, nx.at - end))), p: 1 };
    if (!nx) return !S!.cut && tl < end + S!.tr ? { k: i, kind: 'out', f: eSine(cl((tl - end) / Math.max(1e-6, S!.tr))), p: 1 } : { k: i, kind: 'done', f: 1, p: 1 };
  }
  return { k: L.length - 1, kind: 'done', f: 1, p: 1 };
}
