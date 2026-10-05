// Disegno di un livello SVG animato sul canvas: costruzione, bozza, riempimento e spostamento (vedi anim.ts).
import { svgDoc } from './parse';
import type { SvgDoc, SvgEl } from './parse';
import { guideSeg, markState, moveT, animEnd, enterState, shotPhase, newShots, shotsLen, animTime } from './anim';
import type { SvgAnim, Seg, SvgShots } from './anim';
import type { CamPose } from '../camera/camera';
import { extendToRect } from './geom';

export type ColChoice = 'A' | 'B' | 'svg' | 'custom';
/** Livello SVG come sta nel progetto (S.layers, kind: 'svg'). Posizioni e dimensioni in % del quadro (dimensione = larghezza). */
export interface SvgLayer extends SvgAnim {
  id: string; kind: 'svg'; name: string; src: string;
  x: number; y: number; size: number; op: number; start: number; z: 'above' | 'below'; hidden?: boolean;
  cMark: ColChoice; cGuide: ColChoice;            // colori: testo, colore B, quelli del file oppure uno scelto (cMarkC, cGuideC)
  cMarkC?: string; cGuideC?: string;
  skCol?: string;                                 // colore della bozza (il marchio appena costruito, prima del colore vero)
  gop: number; sketch: number; lw: number; extend: boolean;
  x2: number; y2: number; size2: number; mvEase: string;
  shots?: SvgShots;                               // inquadrature della camera durante la costruzione
  // modo "fx": entrata, uscita e movimento continuo della libreria di effetti, sul logo intero o a pezzi
  fx?: string; dIn?: number; dOut?: number; outMode?: 'mirror' | 'none'; ease?: string; prms?: any; lp?: any; rot?: number; pieces?: boolean; pstag?: number; porder?: 'doc' | 'lr' | 'center';
  lyr?: Record<string, { on: boolean; fx?: string; at?: number; dIn?: number; dOut?: number; ease?: string; prms?: any; lp?: any }>;   // livelli del file con animazione propria
}

/** Nuovo livello con le impostazioni di partenza: costruzione se l'SVG ha linee di costruzione, altrimenti disegno dei tracciati. */
export function mkSvgLayer(src: string, name: string): SvgLayer {
  const doc = svgDoc(src);
  return {
    id: 's' + Math.random().toString(36).slice(2, 8), kind: 'svg', name, src,
    x: 50, y: 50, size: 40, op: 1, start: 0, z: 'above',
    cMark: 'A', cGuide: 'B', cMarkC: '#e47724', cGuideC: '#de5266', skCol: SKETCH_GREY, gop: .6, sketch: .35, lw: 1, extend: true,
    mode: doc && doc.nGuide && doc.nMark ? 'build' : 'draw',
    gStart: 0, gDur: 2.2, gStag: .7, mStart: 1.3, mDur: .8, oMode: 'retract', oAt: 3, oDur: .8, fAt: 3.3, fDur: .6,
    mv: false, mvAt: 4.1, mvDur: 1, mvEase: 'inOutCubic', x2: 30, y2: 50, size2: 24, shots: newShots(),
    // logo completo (marchio + naming + payoff): si parte inquadrando il marchio e si arriva alla composizione intera, con i colori del file
    ...(doc && doc.lockup ? {
      lock: true, mode: doc.nGuide ? 'build' : 'draw', cMark: 'svg', cGuide: 'svg', size: 34, mv: true, x2: 50, y2: 50, size2: 70,
      nMode: 'rise', nAt: 4.6, nDur: 1, nStag: .5, pMode: 'rise', pAt: 5.4, pDur: .9, pStag: .3, hold: 1.5,
    } as Partial<SvgLayer> : {}),
  };
}

/** Fino a quando il livello si muove (secondi dall'inizio della clip): serve per allungare la clip. */
export const svgEnd = (L: SvgLayer) => L.mode === 'fx' ? fxEnd(L) : (L.start || 0) + shotsLen(L.shots) + animEnd(L);
/** Modo fx: entrata, poi fermo (hold), poi l'uscita se c'è. */
export const fxEnd = (L: SvgLayer) => { const own = Object.values(L.lyr || {}).filter(o => o && o.on); const inEnd = Math.max(L.dIn ?? .8, ...own.map(o => (o.at || 0) + (o.dIn ?? .8)));
  return (L.start || 0) + inEnd + (L.hold ?? 2) + (L.outMode === 'mirror' ? Math.max(L.dOut ?? .6, ...own.map(o => o.dOut ?? .6)) : 0); };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const SKETCH_GREY = '#9a9a9a';
const scaleOf = (m: number[]) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;

function dash(ctx: CanvasRenderingContext2D, len: number, s: Seg) {
  if (s.a <= 0 && s.b >= 1) { ctx.setLineDash([]); return; }
  ctx.setLineDash([Math.max(0, s.b - s.a) * len, len * 2 + 1]);
  ctx.lineDashOffset = -s.a * len;
}

/** Riquadro del livello all'istante tl: punto del documento da mettere in (cx, cy), in pixel, e scala documento → quadro.
 *  Di norma il riferimento è il centro del documento e la larghezza è quella del documento. Con un logo completo all'inizio
 *  il riferimento è il solo marchio (Posizione e Larghezza parlano del marchio) e alla fine l'intera composizione. */
export function svgPlace(L: SvgLayer, doc: SvgDoc, tl: number, W: number, H: number, ease?: (t: number) => number) {
  const m = moveT(L, animTime(L.shots, tl), ease), [vx, vy, vw, vh] = doc.vb;
  const cx = lerp(L.x, L.x2, m) / 100 * W, cy = lerp(L.y, L.y2, m) / 100 * H;
  const mb = L.lock && doc.parts.mark.bb;
  if (!mb) return { cx, cy, k: lerp(L.size, L.size2, m) / 100 * W / vw, rx: vx + vw / 2, ry: vy + vh / 2 };
  const k0 = L.size / 100 * W / Math.max(1e-6, mb[2]), k1 = L.size2 / 100 * W / vw;
  return { cx, cy, k: k0 * Math.pow(k1 / k0, m), rx: lerp(mb[0] + mb[2] / 2, vx + vw / 2, m), ry: lerp(mb[1] + mb[3] / 2, vy + vh / 2, m) };
}

/** Punta della penna (in pixel del quadro) all'istante t: media delle punte dei tracciati che si stanno disegnando;
 *  se nessuno si sta disegnando, la fine dell'ultimo finito (o l'inizio del primo, prima che cominci). Serve alla camera per seguire il disegno. */
export function svgPenTip(L: SvgLayer, t: number, W: number, H: number, ease?: (t: number) => number): [number, number] | null {
  const doc = svgDoc(L.src);
  if (!doc || !doc.els.length || (L.mode !== 'build' && L.mode !== 'draw')) return null;
  const tl0 = t - (L.start || 0), pl = svgPlace(L, doc, tl0, W, H, ease), n = doc.els.length, drawMode = L.mode === 'draw', tl = animTime(L.shots, tl0);
  const at = (e: SvgEl, b: number): [number, number] => {
    const N = e.pts.length / 2, f = Math.max(0, Math.min(1, b)) * (N - 1), i = Math.min(N - 2, Math.floor(f)), r = f - i;
    const X = N > 1 ? e.pts[i * 2] + (e.pts[i * 2 + 2] - e.pts[i * 2]) * r : e.pts[0], Y = N > 1 ? e.pts[i * 2 + 1] + (e.pts[i * 2 + 3] - e.pts[i * 2 + 1]) * r : e.pts[1];
    return [pl.cx + pl.k * (X - pl.rx), pl.cy + pl.k * (Y - pl.ry)];
  };
  let sx = 0, sy = 0, cnt = 0, last: [SvgEl, number] | null = null, first: [SvgEl, number] | null = null;
  for (const e of doc.els) {
    let ord: number, b: number;
    if (drawMode) { ord = e.i; b = e.role === 'mark' && e.fill ? markState(L, e.i, n, tl).draw : guideSeg(L, e.i, n, tl).b; }
    else if (e.role === 'guide') { ord = e.ord; b = guideSeg(L, e.ord, doc.nGuide, tl).b; }
    else continue;
    if (b > 0 && b < 1) { const p = at(e, b); sx += p[0]; sy += p[1]; cnt++; }
    if (b >= 1 && (!last || ord > last[1])) last = [e, ord];
    if (!first || ord < first[1]) first = [e, ord];
  }
  if (cnt) return [sx / cnt, sy / cnt];
  if (last) return at(last[0], 1);
  return first ? at(first[0], 0) : null;
}

/** Riquadro (in pixel del quadro) di una parte del livello all'istante t: 'mark', 'naming', 'payoff' o 'all'. */
export function svgPartBox(L: SvgLayer, part: string, t: number, W: number, H: number, ease?: (t: number) => number): [number, number, number, number] | null {
  const doc = svgDoc(L.src);
  if (!doc) return null;
  const bb = part === 'all' ? doc.vb : (doc.parts as any)[part]?.bb;
  if (!bb) return null;
  const pl = svgPlace(L, doc, t - (L.start || 0), W, H, ease);
  return [pl.cx + pl.k * (bb[0] - pl.rx), pl.cy + pl.k * (bb[1] - pl.ry), bb[2] * pl.k, bb[3] * pl.k];
}

/** Disegna il livello all'istante t (secondi dall'inizio della clip). A e B sono i colori del testo e il colore B del progetto. */
/** sd = spostamento dato dagli stati di layout (spostamento in % del quadro, scala, rotazione in gradi, opacità). */
export type StateXf = { dx: number; dy: number; s: number; r: number; op: number };
export function drawSvg(ctx: CanvasRenderingContext2D, L: SvgLayer, t: number, W: number, H: number, A: string, B: string, ease?: (t: number) => number, sd?: StateXf, only?: (e: SvgEl) => boolean) {
  const doc = svgDoc(L.src);
  if (!doc || !doc.els.length) return;
  const tl0 = t - (L.start || 0);
  if (tl0 < 0) return;
  const tl = animTime(L.shots, tl0);   // con le riprese ravvicinate, sul quadro intero l'animazione riparte da capo
  const pl0 = svgPlace(L, doc, tl0, W, H, ease), [vx, vy, vw, vh] = doc.vb, { rx, ry } = pl0, lw = L.lw ?? 1;
  const cx = pl0.cx + (sd ? sd.dx / 100 * W : 0), cy = pl0.cy + (sd ? sd.dy / 100 * H : 0), k = pl0.k * (sd ? sd.s : 1), rot = sd ? sd.r * Math.PI / 180 : 0, lop = (L.op ?? 1) * (sd ? sd.op : 1);
  const rc = Math.cos(rot), rs = Math.sin(rot);
  const base = ctx.getTransform(), drawMode = L.mode === 'draw', n = doc.els.length;
  const P = (X: number, Y: number): [number, number] => { const u = k * (X - rx), v = k * (Y - ry); return [cx + rc * u - rs * v, cy + rs * u + rc * v]; };
  const colOf = (c: string, custom: string | undefined, e: SvgEl, prefer: 'stroke' | 'fill') => (c === 'A' ? A : c === 'B' ? B : c === 'custom' ? custom || A : (prefer === 'stroke' ? e.stroke || e.fill : e.fill || e.stroke) || A);

  const stroke = (e: SvgEl, s: Seg, col: string, al: number, width: number) => {
    if (al <= .002 || s.b - s.a <= 1e-4) return;
    if (e.kind === 'line' && e.span && L.extend && e.line) {
      // linea di costruzione da bordo a bordo: allungata fino ai bordi del quadro, disegnata in pixel
      const a = P(e.line[0], e.line[1]), b = P(e.line[2], e.line[3]), x = extendToRect(a[0], a[1], b[0], b[1], W, H, 4);
      if (!x) return;
      ctx.save(); ctx.setTransform(base);
      ctx.globalAlpha = al; ctx.strokeStyle = col; ctx.lineWidth = width * k * scaleOf(e.m); ctx.lineCap = e.cap;
      dash(ctx, Math.hypot(x[2] - x[0], x[3] - x[1]), s);
      ctx.beginPath(); ctx.moveTo(x[0], x[1]); ctx.lineTo(x[2], x[3]); ctx.stroke(); ctx.restore();
      return;
    }
    ctx.save(); ctx.transform(e.m[0], e.m[1], e.m[2], e.m[3], e.m[4], e.m[5]);
    ctx.globalAlpha = al; ctx.strokeStyle = col; ctx.lineWidth = width; ctx.lineCap = e.cap; ctx.lineJoin = e.join;
    dash(ctx, e.len, s); ctx.stroke(e.p); ctx.restore();
  };

  ctx.save();
  ctx.translate(cx, cy); if (rot) ctx.rotate(rot); ctx.scale(k, k); ctx.translate(-rx, -ry);
  for (const e of doc.els) {
    if (only && !only(e)) continue;
    if (e.role === 'guide') {
      const s = guideSeg(L, drawMode ? e.i : e.ord, drawMode ? n : doc.nGuide, tl);
      const al = (L.cGuide === 'svg' ? (e.stroke ? e.so : e.fo) * e.op : L.gop) * s.op * lop;   // colori del file: opacità del file
      if (e.stroke && e.sw > 0) stroke(e, s, colOf(L.cGuide, L.cGuideC, e, 'stroke'), al, e.sw * lw);
      else if (e.fill) { ctx.save(); ctx.transform(e.m[0], e.m[1], e.m[2], e.m[3], e.m[4], e.m[5]); ctx.globalAlpha = al * s.b; ctx.fillStyle = colOf(L.cGuide, L.cGuideC, e, 'fill'); ctx.fill(e.p, e.rule); ctx.restore(); }
      continue;
    }
    const own = L.cMark === 'svg';
    const fillEl = (col: string, al: number) => { if (al <= .002) return; ctx.save(); ctx.transform(e.m[0], e.m[1], e.m[2], e.m[3], e.m[4], e.m[5]); ctx.globalAlpha = al; ctx.fillStyle = col; ctx.fill(e.p, e.rule); ctx.restore(); };
    const contour = (col: string, upto: number, al: number) => stroke({ ...e, kind: 'shape' }, { a: 0, b: upto, op: 1 }, col, al, Math.max(e.sw, Math.min(vw, vh) * .003) * lw / scaleOf(e.m));
    // naming e payoff del logo completo: entrano dopo lo spostamento, ciascuno con il suo tempo, da sinistra a destra
    if (L.lock && e.part !== 'mark') {
      const isN = e.part === 'naming', mode = (isN ? L.nMode : L.pMode) || 'rise', box = doc.parts[e.part].bb!;
      const es = enterState(mode, (isN ? L.nAt : L.pAt) ?? 0, (isN ? L.nDur : L.pDur) ?? 1, (isN ? L.nStag : L.pStag) ?? .4, e.ord, doc.parts[e.part].n, tl);
      if (es.p <= 0 && es.draw <= 0) continue;
      const col = colOf(L.cMark, L.cMarkC, e, e.fill ? 'fill' : 'stroke'), fin = (own ? e.op : 1) * lop, pad = box[3] * .12;
      ctx.save();
      if (mode === 'rise' || mode === 'wipe') { ctx.beginPath(); if (mode === 'rise') ctx.rect(box[0] - pad * 6, box[1] - pad, box[2] + pad * 12, box[3] + pad * 2); else ctx.rect(box[0] - pad, box[1] - pad * 2, (box[2] + pad * 2) * es.p, box[3] + pad * 4); ctx.clip(); }
      if (mode === 'rise') ctx.translate(0, (1 - es.p) * (box[3] + pad * 2));
      if (mode === 'fade') ctx.translate(0, (1 - es.p) * box[3] * .3);
      const al = mode === 'fade' ? es.p : mode === 'draw' ? es.fill : 1;
      if (mode === 'draw' && e.fill && es.draw > 0) contour(col, es.draw, fin);
      if (e.fill) fillEl(col, al * (own ? e.fo : 1) * fin);
      if (e.stroke && e.sw > 0) stroke(e, { a: 0, b: mode === 'draw' ? es.draw : 1, op: 1 }, col, (mode === 'draw' ? 1 : al) * (own ? e.so : 1) * fin, e.sw * lw);
      ctx.restore();
      continue;
    }
    // marchio
    const i = drawMode ? e.i : e.ord, nn = drawMode ? n : doc.nMark, st = markState(L, i, nn, tl);
    // in costruzione: prima la bozza (colore e opacità della bozza), poi il colore vero; negli altri modi resta l'opacità del file
    const build = L.mode === 'build', sk = L.skCol || SKETCH_GREY, skA = st.sketch * L.sketch * (1 - st.fill) * lop;
    const amount = (fin: number) => st.fill * fin * (own && !build ? e.op : 1);
    if (e.fill) {
      const col = colOf(L.cMark, L.cMarkC, e, 'fill');
      if (drawMode && st.draw > 0) contour(col, st.draw, lop * (own ? e.op : 1));
      if (build) fillEl(sk, skA);
      fillEl(col, amount(own ? e.fo : 1) * lop);
    }
    if (e.stroke && e.sw > 0) {
      const col = colOf(L.cMark, L.cMarkC, e, 'stroke');
      if (drawMode) stroke(e, guideSeg(L, i, nn, tl), col, (own ? e.so * e.op : 1) * lop, e.sw * lw);
      else { if (build) stroke(e, { a: 0, b: 1, op: 1 }, sk, skA, e.sw * lw); stroke(e, { a: 0, b: 1, op: 1 }, col, amount(own ? e.so : 1) * lop, e.sw * lw); }
    }
  }
  ctx.restore();
}

/* --- Inquadrature della camera durante la costruzione --- */
/** Zone del disegno che si possono inquadrare: i quattro angoli e il centro del marchio, il marchio intero, naming e payoff. */
export const SHOT_AREAS: [string, string][] = [['tl', 'Marchio, in alto a sinistra'], ['tr', 'Marchio, in alto a destra'], ['bl', 'Marchio, in basso a sinistra'], ['br', 'Marchio, in basso a destra'], ['c', 'Marchio, centro'], ['mark', 'Marchio intero'], ['naming', 'Naming'], ['payoff', 'Payoff']];
/** Riquadro (nel documento) di una zona. Gli angoli sono un po' più grandi di un quarto, così si vede la linea che arriva. */
export function areaBox(doc: SvgDoc, area: string): [number, number, number, number] {
  const mb = doc.parts.mark.bb || doc.vb, [x, y, w, h] = mb, q = .62;
  switch (area) {
    case 'tl': return [x - w * .08, y - h * .08, w * q, h * q];
    case 'tr': return [x + w * (1.08 - q), y - h * .08, w * q, h * q];
    case 'bl': return [x - w * .08, y + h * (1.08 - q), w * q, h * q];
    case 'br': return [x + w * (1.08 - q), y + h * (1.08 - q), w * q, h * q];
    case 'c': return [x + w * .25, y + h * .25, w * .5, h * .5];
    case 'naming': case 'payoff': return (doc.parts as any)[area]?.bb || mb;
    default: return mb;
  }
}

/** Inquadratura all'istante t: la zona riempie il quadro (moltiplicata per lo zoom della ripresa), con una lenta spinta in avanti
 *  durante la ripresa; w = quanto conta (0 = quadro normale). */
export function svgShotsCam(L: SvgLayer, t: number, W: number, H: number, ease?: (t: number) => number): { pose: CamPose; w: number } | null {
  const S = L.shots, doc = svgDoc(L.src);
  if (!S || !S.on || !S.list.length || !doc) return null;
  const tl = t - (L.start || 0);
  if (tl < 0) return null;
  const ph = shotPhase(S, tl);
  if (ph.kind === 'done') return null;
  const list = [...S.list].sort((a, b) => a.at - b.at), pl = svgPlace(L, doc, tl, W, H, ease);
  const poseOf = (k: number, p: number): CamPose => {
    const sh = list[k], b = areaBox(doc, sh.area), fx = pl.cx + pl.k * (b[0] - pl.rx), fy = pl.cy + pl.k * (b[1] - pl.ry), fw = b[2] * pl.k, fh = b[3] * pl.k;
    const z = Math.min(W / Math.max(1, fw), H / Math.max(1, fh)) * (sh.z || 1) * (1 + (S.push || 0) * p);
    return { x: (fx + fw / 2) / W * 100, y: (fy + fh / 2) / H * 100, z: Math.max(1, z), r: 0 };
  };
  if (ph.kind === 'hold') return { pose: poseOf(ph.k, ph.p), w: 1 };
  if (ph.kind === 'move') { const a = poseOf(ph.k, 1), b = poseOf(ph.k + 1, 0); return { pose: { x: a.x + (b.x - a.x) * ph.f, y: a.y + (b.y - a.y) * ph.f, z: a.z * Math.pow(b.z / a.z, ph.f), r: 0 }, w: 1 }; }
  return { pose: poseOf(ph.k, 1), w: 1 - ph.f };
}

/** Inquadrature proposte: due angoli opposti del marchio, 2 secondi ciascuno, poi stacco sul quadro intero dove l'animazione riparte da capo. */
export function defaultShots(L: SvgLayer): SvgShots {
  const a = L.start ? 0 : L.gStart, d = 2;
  return { ...newShots(), on: true, list: [{ area: 'tl', at: +a.toFixed(2), dur: +d.toFixed(2), z: 1 }, { area: 'br', at: +(a + d).toFixed(2), dur: +d.toFixed(2), z: 1 }] };
}
