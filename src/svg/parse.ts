// Lettura di un SVG (file o "Copia come SVG" di Figma) in un elenco di tracciati pronti da disegnare sul canvas.
// Serve il browser: l'SVG viene montato per un istante fuori dallo schermo per leggere stili calcolati, trasformazioni e lunghezze.
import { shapeToD, lineFromD, classify, roleOf, partOf, spansDoc, KIND_ORDER } from './geom';
import type { ElKind, Role, Part } from './geom';

export type Mat = [number, number, number, number, number, number];
export interface SvgEl {
  i: number; tag: string; name: string; group: string;
  anc?: string[];                                 // nomi dei gruppi che la contengono, dal più vicino al più esterno
  d: string; p: Path2D; m: Mat;                  // tracciato e trasformazione verso le coordinate del documento
  fill: string | null; stroke: string | null;    // colori risolti (null = assente)
  fo: number; so: number; op: number;            // opacità di riempimento, di contorno e d'insieme (gruppi compresi)
  sw: number; cap: CanvasLineCap; join: CanvasLineJoin; rule: CanvasFillRule;
  len: number;                                    // lunghezza del tracciato (unità locali)
  bb: [number, number, number, number];           // riquadro nel documento
  kind: ElKind; role: Role; part: Part;
  line?: [number, number, number, number];        // estremi nel documento (solo linee)
  span?: boolean;                                 // la linea parte da un bordo del documento
  pts: number[];                                  // punti lungo il tracciato, a passo costante, nel documento (x, y, x, y…): servono a seguire la penna
  ord: number;                                    // posizione nell'ordine di disegno (costruzione, marchio, oppure da sinistra a destra in naming e payoff)
}
export type Box = [number, number, number, number];
export interface SvgDoc {
  vb: Box; els: SvgEl[]; nGuide: number; nMark: number; named: boolean; warn: string[];
  lockup: boolean;                                // logo completo: ci sono naming o payoff
  parts: Record<Part, { n: number; bb: Box | null }>;   // quanti elementi e riquadro di marchio, naming e payoff
}

const SKIP = 'defs,clipPath,mask,symbol,pattern,marker,linearGradient,radialGradient,filter';
const mul = (a: Mat, b: Mat): Mat => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
/** Riquadro che contiene tutti i riquadri (null se l'elenco è vuoto). */
export function unionBox(bs: Box[]): Box | null {
  if (!bs.length) return null;
  const x0 = Math.min(...bs.map(b => b[0])), y0 = Math.min(...bs.map(b => b[1])), x1 = Math.max(...bs.map(b => b[0] + b[2])), y1 = Math.max(...bs.map(b => b[1] + b[3]));
  return [x0, y0, x1 - x0, y1 - y0];
}
const ap = (m: Mat, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** Colore di riempimento o contorno: "none" diventa null, un gradiente diventa il colore del suo primo punto. */
function paint(v: string, root: Element, warn: Set<string>): string | null {
  if (!v || v === 'none') return null;
  const u = /url\(["']?#([^"')]+)["']?\)/.exec(v);
  if (u) {
    warn.add('I gradienti sono resi con un colore pieno (il primo del gradiente).');
    const g = root.querySelector('#' + CSS.escape(u[1])), st = g && g.querySelector('stop');
    return st ? (getComputedStyle(st).stopColor || st.getAttribute('stop-color') || '#000') : '#000';
  }
  return v;
}

/** Legge l'SVG. Restituisce null se il testo non è un SVG valido. */
export function parseSvg(src: string): SvgDoc | null {
  if (typeof document === 'undefined') return null;
  const xml = new DOMParser().parseFromString(src, 'image/svg+xml'), root0 = xml.documentElement;
  if (!root0 || root0.nodeName.toLowerCase() !== 'svg' || xml.querySelector('parsererror')) return null;
  const svg = document.importNode(root0, true) as unknown as SVGSVGElement;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';   // non "visibility:hidden": si erediterebbe
  host.appendChild(svg); document.body.appendChild(host);
  const warn = new Set<string>();
  try {
    let vb: [number, number, number, number];
    const b = svg.viewBox && svg.viewBox.baseVal;
    if (b && b.width > 0 && b.height > 0) vb = [b.x, b.y, b.width, b.height];
    else { const w = parseFloat(svg.getAttribute('width') || '') || 0, h = parseFloat(svg.getAttribute('height') || '') || 0; vb = [0, 0, w, h]; }
    if (!(vb[2] > 0 && vb[3] > 0)) { const bb = svg.getBBox(); vb = [bb.x, bb.y, bb.width || 1, bb.height || 1]; }
    // 1 unità del documento = 1 pixel: le matrici del browser sono già in coordinate del documento a meno dello spostamento della viewBox
    svg.setAttribute('width', String(vb[2])); svg.setAttribute('height', String(vb[3]));
    svg.setAttribute('viewBox', vb.join(' ')); svg.removeAttribute('style');
    const toDoc: Mat = [1, 0, 0, 1, vb[0], vb[1]];
    const els: SvgEl[] = [];
    const nodes = svg.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon');
    if (svg.querySelector('text')) warn.add('Il testo dentro l\'SVG non viene disegnato: in Figma convertilo in tracciati (Contorna testo).');
    if (svg.querySelector('image')) warn.add('Le immagini dentro l\'SVG non vengono disegnate.');
    if (svg.querySelector('[clip-path],[mask],[filter]')) warn.add('Maschere, ritagli ed effetti (ombre, sfocature) dell\'SVG vengono ignorati.');
    nodes.forEach(node => {
      const e = node as SVGGeometryElement;
      if (e.closest(SKIP)) return;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const tag = e.tagName.toLowerCase();
      const attrs: Record<string, string> = {};
      for (const a of Array.from(e.attributes)) attrs[a.name] = a.value;
      const d = shapeToD(tag, attrs);
      if (!d) return;
      const fill = paint(cs.fill, svg, warn), stroke = paint(cs.stroke, svg, warn);
      const sw = parseFloat(cs.strokeWidth) || 0;
      if (!fill && !(stroke && sw > 0)) return;
      let op = 1;
      for (let x: Element | null = e; x && x !== svg; x = x.parentElement) op *= parseFloat(getComputedStyle(x).opacity || '1');
      if (op <= 0) return;
      const ctm = e.getCTM(), m: Mat = ctm ? mul(toDoc, [ctm.a, ctm.b, ctm.c, ctm.d, ctm.e, ctm.f]) : toDoc;
      let len = 0; try { len = e.getTotalLength(); } catch { /* forme vuote */ }
      const lb = e.getBBox(), cs4 = [ap(m, lb.x, lb.y), ap(m, lb.x + lb.width, lb.y), ap(m, lb.x, lb.y + lb.height), ap(m, lb.x + lb.width, lb.y + lb.height)];
      const xs = cs4.map(q => q[0]), ys = cs4.map(q => q[1]);
      const bb: [number, number, number, number] = [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
      // nomi dei livelli (Figma li esporta come id se attivi "Includi attributo id")
      const nm = (x: Element) => x.getAttribute('data-name') || x.getAttribute('id') || '';
      let group = '', names = nm(e);
      const anc: string[] = [];
      for (let x: Element | null = e.parentElement; x && x !== (svg as Element); x = x.parentElement) { const s = nm(x); if (s) { names += ' ' + s; anc.push(s); if (!group) group = s; } }
      const kind = classify({ tag, d, fill: !!fill, stroke: !!stroke, w: bb[2], h: bb[3] }, Math.min(vb[2], vb[3]));
      const el: SvgEl = {
        i: els.length, tag, name: nm(e), group, d, p: new Path2D(d), m, fill, stroke,
        fo: parseFloat(cs.fillOpacity || '1'), so: parseFloat(cs.strokeOpacity || '1'), op, sw,
        cap: (cs.strokeLinecap as CanvasLineCap) || 'butt', join: (cs.strokeLinejoin as CanvasLineJoin) || 'miter', rule: cs.fillRule === 'evenodd' ? 'evenodd' : 'nonzero',
        len: len || Math.hypot(bb[2], bb[3]), bb, kind, role: 'mark', part: 'mark', ord: 0, pts: [],
      };
      const NP = 24;
      for (let k = 0; k < NP; k++) { let q = { x: lb.x + lb.width / 2, y: lb.y + lb.height / 2 }; try { if (len > 0) q = e.getPointAtLength(len * k / (NP - 1)); } catch { /* resta il centro */ } const dq = ap(m, q.x, q.y); el.pts.push(dq[0], dq[1]); }
      const ln = kind === 'line' ? (tag === 'line' ? [+attrs.x1 || 0, +attrs.y1 || 0, +attrs.x2 || 0, +attrs.y2 || 0] : lineFromD(d)) : null;
      if (ln) { const p0 = ap(m, ln[0], ln[1]), p1 = ap(m, ln[2], ln[3]); el.line = [p0[0], p0[1], p1[0], p1[1]]; el.span = spansDoc(el.line, vb); }
      (el as any)._names = names.trim(); el.anc = anc;
      els.push(el);
    });
    const hasFill = els.some(e => e.fill);
    for (const e of els) { const nm = (e as any)._names; e.role = roleOf(e.kind, hasFill, nm); e.part = e.role === 'mark' ? partOf(nm) : 'mark'; delete (e as any)._names; }
    // un contorno senza riempimento dello stesso colore delle linee guida è costruzione anche se sta nel gruppo del marchio
    const guideCols = new Set(els.filter(e => e.role === 'guide' && e.stroke).map(e => e.stroke));
    for (const e of els) if (hasFill && e.role === 'mark' && !e.fill && e.stroke && guideCols.has(e.stroke)) { e.role = 'guide'; e.part = 'mark'; }
    // ordine di disegno della costruzione: per tipo (linee, cerchi, contorni, cerchietti), a parità nell'ordine del file
    els.filter(e => e.role === 'guide').sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.i - b.i).forEach((e, k) => (e.ord = k));
    // marchio nell'ordine del file; naming e payoff da sinistra a destra
    const parts = {} as SvgDoc['parts'];
    for (const p of ['mark', 'naming', 'payoff'] as Part[]) {
      const list = els.filter(e => e.role === 'mark' && e.part === p);
      (p === 'mark' ? list : [...list].sort((a, b) => a.bb[0] - b.bb[0] || a.i - b.i)).forEach((e, k) => (e.ord = k));
      parts[p] = { n: list.length, bb: unionBox(list.map(e => e.bb)) };
    }
    if (!els.length) warn.add('Nessun tracciato disegnabile nell\'SVG.');
    const lockup = parts.naming.n > 0 || parts.payoff.n > 0;
    return { vb, els, nGuide: els.filter(e => e.role === 'guide').length, nMark: parts.mark.n, named: els.some(e => e.group || e.name), warn: [...warn], lockup, parts };
  } finally { host.remove(); }
}

const CACHE = new Map<string, SvgDoc | null>();
/** SVG letto e ricordato (la chiave è il testo stesso dell'SVG). */
export function svgDoc(src: string): SvgDoc | null {
  if (!src) return null;
  let d = CACHE.get(src);
  if (d === undefined) { d = parseSvg(src); if (CACHE.size > 32) CACHE.clear(); CACHE.set(src, d); }
  return d;
}
