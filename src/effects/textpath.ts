// Testo su tracciato: il testo si dispone lungo una forma (arco, cerchio, onda, spirale…) e può "camminarci" sopra.
// Funzioni pure, in pixel dello spazio del blocco. Il motore le usa così: ogni lettera sta in una posizione (X, Y) del testo disteso;
// X diventa la distanza lungo il tracciato (con in più lo "scorrimento" che fa camminare il testo) e Y la distanza dal tracciato.
// Perciò qualunque effetto che muove le lettere in orizzontale (scivolare, camminare) le fa percorrere la forma.

import { SEPS } from './marquee.ts';

export type TpShape = 'line' | 'arc' | 'circle' | 'wave' | 'zig' | 'spiral' | 'loop' | 'eight' | 'heart' | 'pill';
export type TpKind = 'open' | 'closed' | 'periodic';

export interface TpOpts {
  L: number; E: number;          // lunghezza del testo e dimensione del carattere, in px
  rot?: number; flip?: boolean;  // rotazione del tracciato (°) e rovesciamento sopra/sotto
  curve?: number;                // arco: gradi coperti dal testo (con segno: positivo = verso l'alto)
  size?: number;                 // forme chiuse e spirale: % della lunghezza del testo (100 = il testo fa un giro intero)
  squash?: number;               // cerchio: schiacciamento verticale, 0..0.8
  asp?: number;                  // capsula: rapporto larghezza/altezza
  amp?: number; cyc?: number; soft?: number;   // onde e zigzag: altezza (em), onde sul testo, morbidezza
  turns?: number; inner?: number;              // spirale: giri e raggio interno (%)
  rr?: number; n?: number;                     // ricci: ampiezza e quantità sul testo
}

/** Tracciato campionato a passo costante. Punti, direzioni (radianti) e come proseguire oltre la fine. */
export interface PathTable {
  kind: TpKind;
  s0: number; len: number; n: number; step: number;   // il tracciato copre s0 … s0 + len
  xs: Float64Array; ys: Float64Array; as: Float64Array;
  dx: number; dy: number;                              // spostamento per periodo (solo periodico)
}
export interface Pt { x: number; y: number; a: number }

const TAU = Math.PI * 2;
const tri = (x: number) => (2 / Math.PI) * Math.asin(Math.sin(x));
const mod = (a: number, b: number) => ((a % b) + b) % b;

interface Dense { x: number[]; y: number[]; kind: TpKind; s0: number }

/* ---------- forme: punti fitti, in unità qualsiasi (poi scalati sulla lunghezza richiesta) ---------- */
function polyLen(x: number[], y: number[], close: boolean): number {
  let s = 0;
  for (let i = 1; i < x.length; i++) s += Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
  if (close && x.length > 1) s += Math.hypot(x[0] - x[x.length - 1], y[0] - y[y.length - 1]);
  return s;
}
function scaleTo(d: Dense, target: number): Dense {
  const len = polyLen(d.x, d.y, d.kind === 'closed') || 1, k = target / len;
  return { ...d, x: d.x.map(v => v * k), y: d.y.map(v => v * k) };
}
/** Fa partire il tracciato chiuso dal punto indicato e lo percorre da sinistra verso destra. */
function rollStart(x: number[], y: number[], idx: number): { x: number[]; y: number[] } {
  const n = x.length, xs = x.slice(idx).concat(x.slice(0, idx)), ys = y.slice(idx).concat(y.slice(0, idx));
  if (xs[Math.min(3, n - 1)] >= xs[0]) return { x: xs, y: ys };
  // tangente verso sinistra: invertire il senso, mantenendo il punto di partenza
  return { x: [xs[0], ...xs.slice(1).reverse()], y: [ys[0], ...ys.slice(1).reverse()] };
}
const argBest = (a: number[], ok: (i: number) => boolean, better: (u: number, v: number) => boolean) => {
  let bi = -1; for (let i = 0; i < a.length; i++) if (ok(i) && (bi < 0 || better(a[i], a[bi]))) bi = i; return Math.max(0, bi);
};

function dense(shape: TpShape, o: TpOpts): Dense {
  const L = Math.max(1, o.L), E = Math.max(1, o.E), size = Math.max(5, o.size ?? 100) / 100, N = 720;
  const closed = (x: number[], y: number[], start: number): Dense => { const r = rollStart(x, y, start); return scaleTo({ x: r.x, y: r.y, kind: 'closed', s0: 0 }, L * size) };
  switch (shape) {
    case 'arc': {
      const th = (o.curve ?? 140) * Math.PI / 180, a = Math.abs(th), x: number[] = [], y: number[] = [];
      if (a < 1e-3) return { x: [-L / 2, L / 2], y: [0, 0], kind: 'open', s0: -L / 2 };
      const R = L / a, sg = Math.sign(th);
      for (let i = 0; i <= 240; i++) { const f = -a / 2 + a * i / 240; x.push(R * Math.sin(f)); y.push(sg * R * (1 - Math.cos(f))); }
      return { x, y, kind: 'open', s0: -L / 2 };
    }
    case 'circle': {
      const q = Math.min(.8, Math.max(0, o.squash ?? 0)), x: number[] = [], y: number[] = [];
      for (let i = 0; i < N; i++) { const f = -Math.PI / 2 + TAU * i / N; x.push(Math.cos(f)); y.push((1 - q) * Math.sin(f)); }
      return closed(x, y, 0);
    }
    case 'pill': {
      const asp = Math.max(1, o.asp ?? 3), h = 1, w = asp, r = h / 2, sx = w - h, x: number[] = [], y: number[] = [];
      // dall'alto al centro: lato superiore verso destra, calotta destra, lato inferiore verso sinistra, calotta sinistra
      const seg = 60;
      for (let i = 0; i <= seg; i++) { x.push(sx / 2 * i / seg); y.push(-r); }
      for (let i = 1; i < seg; i++) { const f = -Math.PI / 2 + Math.PI * i / seg; x.push(sx / 2 + r * Math.cos(f)); y.push(r * Math.sin(f)); }
      for (let i = 0; i <= 2 * seg; i++) { x.push(sx / 2 - sx * i / (2 * seg)); y.push(r); }
      for (let i = 1; i < seg; i++) { const f = Math.PI / 2 + Math.PI * i / seg; x.push(-sx / 2 + r * Math.cos(f)); y.push(r * Math.sin(f)); }
      for (let i = 0; i < seg; i++) { x.push(-sx / 2 + sx / 2 * i / seg); y.push(-r); }
      return closed(x, y, 0);
    }
    case 'eight': {
      const x: number[] = [], y: number[] = [];
      for (let i = 0; i < N; i++) { const t = TAU * i / N, d = 1 + Math.sin(t) ** 2; x.push(Math.cos(t) / d); y.push(Math.sin(t) * Math.cos(t) / d); }
      return closed(x, y, argBest(y, i => x[i] > 0, (u, v) => u < v));   // cima del cerchio di destra
    }
    case 'heart': {
      const x: number[] = [], y: number[] = [];
      for (let i = 0; i < N; i++) { const t = TAU * i / N; x.push(16 * Math.sin(t) ** 3); y.push(-(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))); }
      return closed(x, y, argBest(y, i => x[i] < 0, (u, v) => u < v));    // cima del lobo di sinistra
    }
    case 'spiral': {
      const turns = Math.max(.25, o.turns ?? 2), k = Math.min(.95, Math.max(.02, (o.inner ?? 15) / 100)), th = turns * TAU, x: number[] = [], y: number[] = [], M = Math.max(240, Math.round(turns * 240));
      for (let i = 0; i <= M; i++) { const f = th * i / M, r = k + (1 - k) * i / M; x.push(r * Math.cos(f - Math.PI / 2)); y.push(r * Math.sin(f - Math.PI / 2)); }
      const d = scaleTo({ x, y, kind: 'open', s0: 0 }, L * size);
      return { ...d, s0: -L / 2 };   // il testo parte dal centro della spirale
    }
    case 'wave': case 'zig': {
      const cyc = Math.max(.1, o.cyc ?? 1.5), lam = L / cyc, A = (o.amp ?? .7) * E, soft = Math.min(1, Math.max(0, o.soft ?? 0)), x: number[] = [], y: number[] = [];
      for (let i = 0; i <= 200; i++) { const f = TAU * i / 200; x.push(lam * i / 200); y.push(A * (shape === 'wave' ? Math.sin(f) : (1 - soft) * tri(f) + soft * Math.sin(f))); }
      return { x, y, kind: 'periodic', s0: 0 };
    }
    case 'loop': {
      const n = Math.max(.25, o.n ?? 2), lam = L / n, c = lam / TAU, r = c * Math.max(.2, o.rr ?? 1.6), x: number[] = [], y: number[] = [];
      for (let i = 0; i <= 240; i++) { const t = Math.PI + TAU * i / 240; x.push(c * (t - Math.PI) - r * Math.sin(t)); y.push(-r * Math.cos(t)); }
      return { x, y, kind: 'periodic', s0: 0 };
    }
    default: return { x: [-L / 2, L / 2], y: [0, 0], kind: 'open', s0: -L / 2 };
  }
}

/* ---------- campionamento a passo costante ---------- */
function resample(d: Dense): PathTable {
  const close = d.kind === 'closed';
  const px = close ? [...d.x, d.x[0]] : d.x, py = close ? [...d.y, d.y[0]] : d.y;
  const m = px.length, cum = new Float64Array(m);
  for (let i = 1; i < m; i++) cum[i] = cum[i - 1] + Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1]);
  const len = Math.max(1e-6, cum[m - 1]), n = Math.max(48, Math.min(6000, Math.round(len / 1.2))), step = len / n, cnt = d.kind === 'open' ? n + 1 : n;
  const xs = new Float64Array(cnt), ys = new Float64Array(cnt), as = new Float64Array(cnt);
  let j = 1;
  for (let k = 0; k < cnt; k++) {
    const s = k * step; while (j < m - 1 && cum[j] < s) j++;
    const seg = Math.max(1e-9, cum[j] - cum[j - 1]), f = Math.min(1, Math.max(0, (s - cum[j - 1]) / seg));
    xs[k] = px[j - 1] + (px[j] - px[j - 1]) * f; ys[k] = py[j - 1] + (py[j] - py[j - 1]) * f;
  }
  const dx = d.kind === 'periodic' ? px[m - 1] - px[0] : 0, dy = d.kind === 'periodic' ? py[m - 1] - py[0] : 0;
  const at = (i: number) => d.kind === 'open' ? [xs[Math.max(0, Math.min(cnt - 1, i))], ys[Math.max(0, Math.min(cnt - 1, i))]]
    : i < 0 ? (d.kind === 'periodic' ? [xs[cnt - 1] - dx, ys[cnt - 1] - dy] : [xs[cnt - 1], ys[cnt - 1]])
    : i >= cnt ? (d.kind === 'periodic' ? [xs[0] + dx, ys[0] + dy] : [xs[0], ys[0]]) : [xs[i], ys[i]];
  for (let k = 0; k < cnt; k++) { const a = at(k - 1), b = at(k + 1); as[k] = Math.atan2(b[1] - a[1], b[0] - a[0]); }
  return { kind: d.kind, s0: d.s0, len, n: cnt, step, xs, ys, as, dx, dy };
}

const lerpAngle = (a: number, b: number, f: number) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return a + d * f; };

/** Punto e direzione del tracciato a distanza s (le forme aperte proseguono dritte oltre le estremità; quelle chiuse e periodiche si ripetono). */
export function sampleTable(tb: PathTable, s: number, out: Pt): Pt {
  let u = s - tb.s0, k = 0;
  if (tb.kind === 'open') {
    if (u <= 0) { const a = tb.as[0]; out.x = tb.xs[0] + Math.cos(a) * u; out.y = tb.ys[0] + Math.sin(a) * u; out.a = a; return out; }
    if (u >= tb.len) { const e = tb.n - 1, a = tb.as[e], r = u - tb.len; out.x = tb.xs[e] + Math.cos(a) * r; out.y = tb.ys[e] + Math.sin(a) * r; out.a = a; return out; }
  } else if (tb.kind === 'closed') u = mod(u, tb.len);
  else { k = Math.floor(u / tb.len); u -= k * tb.len; }
  const q = u / tb.step, i = Math.min(tb.n - 1, Math.floor(q)), f = q - i;
  const j = tb.kind === 'open' ? Math.min(tb.n - 1, i + 1) : (i + 1) % tb.n;
  let x1 = tb.xs[j], y1 = tb.ys[j];
  if (tb.kind === 'periodic' && j === 0) { x1 += tb.dx; y1 += tb.dy; }
  out.x = tb.xs[i] + (x1 - tb.xs[i]) * f + k * tb.dx;
  out.y = tb.ys[i] + (y1 - tb.ys[i]) * f + k * tb.dy;
  out.a = lerpAngle(tb.as[i], tb.as[j], f);
  return out;
}

const CACHE = new Map<string, PathTable>();
const keyOf = (shape: string, o: TpOpts) => shape + '|' + [o.L, o.E, o.rot, o.flip ? 1 : 0, o.curve, o.size, o.squash, o.asp, o.amp, o.cyc, o.soft, o.turns, o.inner, o.rr, o.n].map(v => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)).join(',');

/** Costruisce (e ricorda) il tracciato per una forma. L'origine è il centro del tratto occupato dal testo, così il blocco resta dov'è. */
export function buildTable(shape: TpShape, o: TpOpts): PathTable {
  const key = keyOf(shape, o), hit = CACHE.get(key);
  if (hit) return hit;
  const d = dense(shape, o);
  if (o.flip) d.y = d.y.map(v => -v);
  const rot = (o.rot || 0) * Math.PI / 180;
  if (rot) { const c = Math.cos(rot), s = Math.sin(rot), x = d.x, y = d.y; d.x = x.map((v, i) => v * c - y[i] * s); d.y = x.map((v, i) => v * s + y[i] * c); }
  const tb = resample(d);
  // centro del tratto occupato dal testo a riposo (da -L/2 a L/2)
  const tmp: Pt = { x: 0, y: 0, a: 0 }, M = 160;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i <= M; i++) { sampleTable(tb, -o.L / 2 + o.L * i / M, tmp); x0 = Math.min(x0, tmp.x); x1 = Math.max(x1, tmp.x); y0 = Math.min(y0, tmp.y); y1 = Math.max(y1, tmp.y); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  for (let i = 0; i < tb.n; i++) { tb.xs[i] -= cx; tb.ys[i] -= cy; }
  if (CACHE.size > 24) CACHE.clear();
  CACHE.set(key, tb);
  return tb;
}

/** Distanza di cammino in px: velocità continua o avanti e indietro, più la partenza. Sulle forme aperte il cammino riparte dall'altro lato fuori dal quadro. */
export function walkOffset(o: { speed?: number; pp?: boolean; start?: number }, t: number, L: number, E: number, kind: TpKind, span: number): number {
  const v = (o.speed || 0) * E;
  let w: number;
  if (o.pp) { const A = Math.max(1, L * .5); w = A * Math.sin(v * t / A); }
  else if (kind === 'open' && v && span > 0) w = mod(v * t + span / 2, span) - span / 2;
  else w = v * t;
  return w + (o.start || 0) / 100 * L;
}

/** Porta il punto (X, Y) del testo disteso sul tracciato. env = 0 lascia il testo dritto, 1 lo dispone sul tracciato (valori intermedi: transizione).
 *  Restituisce la posizione e l'angolo (radianti) con cui disegnare il carattere. */
export function warpAt(tb: PathTable, shift: number, env: number, follow: number, X: number, Y: number, out: Pt): Pt {
  sampleTable(tb, X + shift, out);
  const th = out.a, px = out.x - Y * Math.sin(th), py = out.y + Y * Math.cos(th);
  out.x = X + (px - X) * env; out.y = Y + (py - Y) * env; out.a = th * follow * env;
  return out;
}

/** Cammino "a passaggio": il testo attraversa il tracciato con una velocità che è alta all'inizio, bassa a metà e di nuovo alta alla fine.
 *  A metà clip si trova a riposo (scorrimento 0). dist è in lunghezze del testo; slow = 1 dà velocità costante; pass = passaggi nella clip. */
export function passOffset(o: { slow: number; dist: number; pass: number; rev?: boolean; start?: number }, t: number, total: number, L: number): number {
  const np = Math.max(1, Math.round(o.pass || 1)), x = total > 0 ? Math.min(1, Math.max(0, t / total)) * np : 0;
  const fr = x >= np ? 1 : x - Math.floor(x), y = 2 * fr - 1, g = .5 + .5 * Math.sign(y) * Math.abs(y) ** Math.max(1, o.slow || 1);
  return (g - .5) * 2 * o.dist * L * (o.rev ? -1 : 1) + (o.start || 0) / 100 * L;
}

/** Ripete la parola (o la riga) più volte sulla stessa riga, con un separatore. */
export function repeatLines(lines: string[], n: number, sep: string): string[] {
  const k = Math.max(1, Math.min(40, Math.round(n))), s = SEPS[sep] ?? SEPS.space;
  return k <= 1 ? lines : lines.map(l => (l ? Array(k).fill(l).join(s) : l));
}
