// Traiettorie: forme lungo cui un elemento arriva alla sua posizione (arco, onda, anello, S, zigzag).
// Funzioni pure, in "em", con due assi locali: a lungo la direzione di marcia e b perpendicolare.
// A p = 0 l'elemento è all'inizio (a distanza D, dietro); a p = 1 è a riposo: (0, 0).

export type PathShape = 'arc' | 'wave' | 'loop' | 's' | 'zig';
export interface PathOpts { D: number; amp: number; cyc: number; R: number; loops: number }

const TAU = Math.PI * 2;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Onda triangolare tra -1 e 1 (per lo zigzag). */
const tri = (x: number) => (2 / Math.PI) * Math.asin(Math.sin(x));
/** Ampiezza che si spegne negli ultimi istanti, così l'arrivo è pulito. */
const env = (p: number) => Math.min(1, clamp01(1 - p) * 4);

export function pathPoint(shape: PathShape, p: number, o: PathOpts): { a: number; b: number } {
  const q = clamp01(p), a0 = -o.D * (1 - q);
  switch (shape) {
    case 'arc': return { a: a0, b: o.amp * Math.sin(Math.PI * q) };
    case 'wave': return { a: a0, b: o.amp * Math.sin(TAU * o.cyc * q) * env(q) };
    case 's': return { a: a0, b: o.amp * Math.sin(TAU * q) };
    case 'zig': return { a: a0, b: o.amp * tri(TAU * o.cyc * q) * env(q) };
    case 'loop': { const L = Math.max(1, Math.round(o.loops)), f = TAU * L * q; return { a: a0 - o.R * Math.sin(f), b: o.R * (1 - Math.cos(f)) }; }
  }
}

/** Direzione della traiettoria in gradi rispetto alla direzione di marcia (0 = dritto), da usare per far girare le lettere lungo la curva. */
export function pathAngle(shape: PathShape, p: number, o: PathOpts): number {
  const e = 1e-3, p0 = clamp01(p - e), p1 = clamp01(p + e), A = pathPoint(shape, p0, o), B = pathPoint(shape, p1, o);
  return Math.atan2(B.b - A.b, B.a - A.a) * 180 / Math.PI;
}

/** Offset in pixel (x, y) a partire dalla direzione di marcia (tx, ty), dal lato (+1/-1) e dalla dimensione di un em. */
export function pathOffset(shape: PathShape, p: number, o: PathOpts, tx: number, ty: number, side: number, em: number): { x: number; y: number } {
  const P = pathPoint(shape, p, o), nx = -ty, ny = tx;
  return { x: (tx * P.a + nx * P.b * side) * em, y: (ty * P.a + ny * P.b * side) * em };
}
