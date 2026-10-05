// Geometria degli SVG importati: forme convertite in tracciati, riconoscimento di linee e cerchi, ruolo di ogni elemento.
// Funzioni pure (niente DOM), provate da terminale.

/** Tipo di elemento: linea dritta, cerchio (o ellisse), cerchietto (raccordi, punti), forma piena, contorno libero. */
export type ElKind = 'line' | 'circle' | 'dot' | 'shape' | 'outline';
/** Ruolo nell'animazione: "guide" = costruzione (si disegna e poi sparisce), "mark" = il marchio (resta). */
export type Role = 'guide' | 'mark';

const n = (v: any, d = 0) => { const x = parseFloat(v); return Number.isFinite(x) ? x : d; };
const pts = (s: string) => (s.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || []).map(Number);

/** Converte una forma SVG (rect, circle, ellipse, line, polyline, polygon) nel tracciato equivalente. */
export function shapeToD(tag: string, a: Record<string, any>): string | null {
  switch (tag) {
    case 'path': return a.d || null;
    case 'line': return `M${n(a.x1)} ${n(a.y1)}L${n(a.x2)} ${n(a.y2)}`;
    case 'circle': case 'ellipse': {
      const cx = n(a.cx), cy = n(a.cy), rx = tag === 'circle' ? n(a.r) : n(a.rx), ry = tag === 'circle' ? n(a.r) : n(a.ry, rx);
      if (rx <= 0 || ry <= 0) return null;
      return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
    }
    case 'rect': {
      const x = n(a.x), y = n(a.y), w = n(a.width), h = n(a.height);
      if (w <= 0 || h <= 0) return null;
      let rx = a.rx != null ? n(a.rx) : a.ry != null ? n(a.ry) : 0, ry = a.ry != null ? n(a.ry) : rx;
      rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
      if (rx <= 0 || ry <= 0) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
    }
    case 'polyline': case 'polygon': {
      const p = pts(a.points || '');
      if (p.length < 4) return null;
      let d = `M${p[0]} ${p[1]}`;
      for (let i = 2; i + 1 < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`;
      return tag === 'polygon' ? d + 'Z' : d;
    }
  }
  return null;
}

/** Comandi di un tracciato, con i loro numeri. */
export function pathCmds(d: string): { c: string; v: number[] }[] {
  const out: { c: string; v: number[] }[] = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) out.push({ c: m[1], v: pts(m[2]) });
  return out;
}

/** Se il tracciato è un solo segmento dritto restituisce i due estremi, altrimenti null. */
export function lineFromD(d: string): [number, number, number, number] | null {
  const cs = pathCmds(d);
  if (!cs.length || (cs[0].c !== 'M' && cs[0].c !== 'm')) return null;
  const m = cs[0].v;
  if (m.length === 4 && cs.length === 1) return cs[0].c === 'M' ? [m[0], m[1], m[2], m[3]] : [m[0], m[1], m[0] + m[2], m[1] + m[3]];
  if (m.length !== 2 || cs.length !== 2) return null;
  const x = m[0], y = m[1], { c, v } = cs[1];
  switch (c) {
    case 'L': return v.length === 2 ? [x, y, v[0], v[1]] : null;
    case 'l': return v.length === 2 ? [x, y, x + v[0], y + v[1]] : null;
    case 'H': return v.length === 1 ? [x, y, v[0], y] : null;
    case 'h': return v.length === 1 ? [x, y, x + v[0], y] : null;
    case 'V': return v.length === 1 ? [x, y, x, v[0]] : null;
    case 'v': return v.length === 1 ? [x, y, x, y + v[0]] : null;
  }
  return null;
}

/** Il tracciato è un'ellisse? (un punto di partenza e poi solo 2–8 curve, come esportano Figma e Illustrator). */
export function isEllipseD(d: string): boolean {
  const cs = pathCmds(d).filter(x => x.c !== 'Z' && x.c !== 'z');
  if (cs.length < 3 || (cs[0].c !== 'M' && cs[0].c !== 'm')) return false;
  const rest = cs.slice(1);
  const curves = rest.reduce((k, x) => k + (/[Cc]/.test(x.c) ? Math.floor(x.v.length / 6) : /[Aa]/.test(x.c) ? Math.floor(x.v.length / 7) : 0), 0);
  return rest.every(x => /[CcAa]/.test(x.c)) && curves >= 2 && curves <= 8;
}

export interface ClassInput { tag: string; d: string; fill: boolean; stroke: boolean; w: number; h: number }
/** Tipo di elemento, a partire da forma, riempimento e dimensioni (docMin = lato minore del documento). */
export function classify(e: ClassInput, docMin: number): ElKind {
  if (e.fill) return 'shape';
  if (e.tag === 'line' || lineFromD(e.d)) return 'line';
  const round = e.tag === 'circle' || e.tag === 'ellipse' || isEllipseD(e.d);
  if (round) return Math.max(e.w, e.h) < docMin * .07 ? 'dot' : 'circle';
  return 'outline';
}

const GUIDE_WORDS = /costru|guid|grigl|grid|linee|construct|helper|aiut|raccord/i;
const MARK_WORDS = /logo|marchi|forma|brand|mark|simbol|symbol|icon|pittogr|naming|payoff|claim|tagline|slogan|wordmark/i;
/** Parte del logo completo a cui appartiene un elemento, dai nomi dei livelli: naming (il nome), payoff (la frase), altrimenti marchio. */
export type Part = 'mark' | 'naming' | 'payoff';
export function partOf(names: string): Part {
  if (/pay-?off|claim|tagline|slogan|sottotitol/i.test(names)) return 'payoff';
  if (/naming|nome|logotip|wordmark|scritta|lettering/i.test(names)) return 'naming';
  return 'mark';
}
/** Ruolo dell'elemento. Se i livelli hanno un nome (Figma: "Includi attributo id") vince il nome; altrimenti, se il disegno ha forme piene,
 *  i tratti senza riempimento sono costruzione; un disegno di sole linee è tutto marchio (si disegna e resta). */
export function roleOf(kind: ElKind, docHasFill: boolean, names = ''): Role {
  if (names) { if (GUIDE_WORDS.test(names)) return 'guide'; if (MARK_WORDS.test(names)) return 'mark'; }
  if (!docHasFill) return 'mark';
  return kind === 'shape' ? 'mark' : 'guide';
}

/** Ordine di disegno della costruzione per tipo: prima le linee, poi i cerchi, poi i contorni e infine i cerchietti. */
export const KIND_ORDER: Record<ElKind, number> = { line: 0, circle: 1, outline: 2, dot: 3, shape: 4 };

/** Allunga il segmento finché attraversa tutto il rettangolo [-m, W+m] × [-m, H+m], nella stessa direzione. Null se non lo tocca. */
export function extendToRect(x0: number, y0: number, x1: number, y1: number, W: number, H: number, m = 0): [number, number, number, number] | null {
  const dx = x1 - x0, dy = y1 - y0;
  if (!dx && !dy) return null;
  let t0 = -Infinity, t1 = Infinity;
  for (const [p, d, lo, hi] of [[x0, dx, -m, W + m], [y0, dy, -m, H + m]]) {
    if (Math.abs(d) < 1e-12) { if (p < lo || p > hi) return null; continue; }
    let a = (lo - p) / d, b = (hi - p) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
  }
  if (t0 >= t1) return null;
  return [x0 + dx * t0, y0 + dy * t0, x0 + dx * t1, y0 + dy * t1];
}

/** La linea parte da un bordo del documento (allora è una linea guida "infinita" e ha senso allungarla fino ai bordi del quadro). */
export function spansDoc(l: [number, number, number, number], vb: [number, number, number, number], tol = .01): boolean {
  const [x, y, w, h] = vb, e = Math.max(w, h) * tol;
  const onEdge = (px: number, py: number) => Math.abs(px - x) < e || Math.abs(px - x - w) < e || Math.abs(py - y) < e || Math.abs(py - y - h) < e;
  return onEdge(l[0], l[1]) || onEdge(l[2], l[3]);
}
