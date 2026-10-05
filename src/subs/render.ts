// Disegno dei sottotitoli sul quadro (anteprima ed esportazione): la frase si divide in righe, si rimpicciolisce se non ci sta,
// ogni parola compare con l'animazione scelta e quella che si sta dicendo si evidenzia.
import { splitLines } from './model.ts';
import type { Cue } from './model.ts';
import type { SubStyle } from './style.ts';
import { yFor } from './style.ts';

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const back = (x: number) => { const c = 1.9; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
function rrect(cx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, h / 2, w / 2); cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath();
}
function rgba(hex: string, a: number) { const h = hex.replace('#', ''), n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }

/** Disegna la frase che si vede (at) nel quadro W×H (unità del contesto). fam = famiglia CSS del carattere. */
export function drawSubs(cx: CanvasRenderingContext2D, W: number, H: number, at: { cue: Cue; src: number; word: number }, st: SubStyle, fam: string, fmt: string) {
  const { cue, src } = at, ws = cue.w, base = Math.min(W, H);
  if (!ws.length) return;
  const txt = (i: number) => (st.upper ? ws[i].t.toLocaleUpperCase('it') : ws[i].t);
  const cur = at.word;
  // quali parole si vedono
  let idx = ws.map((_, i) => i);
  if (st.mode === 'parola') idx = [Math.max(0, cur)];
  const shown = (i: number) => st.mode === 'accumula' ? i <= cur : true;
  // righe (per "accumula" la disposizione è quella della frase intera: le parole non saltano)
  const items = idx.map(i => ({ i, t: txt(i) }));
  const lines = st.mode === 'parola' ? [items] : splitLines(items, st.lines, st.maxChars);
  let fs = st.size / 100 * base;
  const font = (f: number) => `${Math.round(st.wght)} ${f}px ${fam}`;
  cx.save();
  cx.font = font(fs);
  const sp = cx.measureText(' ').width, wd = (s: string) => cx.measureText(s).width;
  let widths = lines.map(l => l.reduce((n, x) => n + wd(x.t), 0) + sp * (l.length - 1));
  const maxW = W * st.width / 100, k = Math.min(1, maxW / Math.max(1, ...widths));
  if (k < 1) { fs *= k; cx.font = font(fs); widths = widths.map(w => w * k); }
  const sp2 = sp * k, lh = fs * 1.2, cy = H * yFor(st, fmt) / 100, top = cy - lines.length * lh / 2;
  const pad = fs * .28;
  // tempo della comparsa: la frase intera, oppure ogni parola quando viene detta
  const t0 = (i: number) => (st.mode === 'accumula' || st.mode === 'parola' ? ws[i].s : cue.s);
  const prog = (i: number) => st.anim === 'nessuna' ? 1 : clamp((src - t0(i)) / Math.max(.01, st.animDur));
  // riquadro dietro
  if (st.box !== 'no') {
    cx.fillStyle = rgba(st.boxCol, st.boxOp);
    const pb = st.mode === 'frase' || st.mode === 'karaoke' ? prog(idx[0]) : 1;
    cx.globalAlpha = pb;
    if (st.box === 'frase') { const w = Math.max(...widths); rrect(cx, W / 2 - w / 2 - pad * 1.4, top - pad * .5, w + pad * 2.8, lines.length * lh + pad, fs * .3); cx.fill(); }
    else lines.forEach((l, j) => { const w = widths[j]; rrect(cx, W / 2 - w / 2 - pad, top + j * lh + lh * .04, w + pad * 2, lh * .96, fs * .22); cx.fill(); });
    cx.globalAlpha = 1;
  }
  cx.textBaseline = 'middle'; cx.textAlign = 'left'; cx.lineJoin = 'round';
  lines.forEach((l, j) => {
    let x = W / 2 - widths[j] / 2;
    const y = top + j * lh + lh / 2;
    for (const it of l) {
      const w = wd(it.t), p = prog(it.i), isCur = it.i === cur && st.hlMode !== 'nessuna' && st.mode !== 'frase';
      if (shown(it.i) && p > 0) {
        cx.save();
        let a = 1, sc = 1, dy = 0;
        if (st.anim === 'dissolvenza') a = p;
        else if (st.anim === 'pop') { sc = .55 + .45 * back(p); a = clamp(p * 3); }
        else if (st.anim === 'sale') { dy = (1 - (1 - (1 - p) ** 3)) * fs * .45; a = p; }
        else if (st.anim === 'scala') { sc = .8 + .2 * (1 - (1 - p) ** 3); a = p; }
        if (isCur) sc *= st.hlScale;
        const mx = x + w / 2;
        cx.translate(mx, y + dy); cx.scale(sc, sc); cx.translate(-mx, -y);
        cx.globalAlpha = a;
        if (isCur && st.hlMode === 'box') { cx.fillStyle = st.hl; rrect(cx, x - pad * .55, y - lh * .48, w + pad * 1.1, lh * .96, fs * .2); cx.fill(); }
        const fill = isCur ? (st.hlMode === 'box' ? st.hlText : st.hl) : st.color;
        const sh = st.shadow;
        if (sh > 0) { cx.shadowColor = `rgba(0,0,0,${(.35 + .45 * sh).toFixed(3)})`; cx.shadowBlur = fs * .3 * sh; cx.shadowOffsetY = fs * .06 * sh; }
        if (st.stroke > 0 && !(isCur && st.hlMode === 'box')) { cx.strokeStyle = st.strokeCol; cx.lineWidth = st.stroke * fs * 2; cx.strokeText(it.t, x, y); cx.shadowColor = 'transparent'; }
        cx.fillStyle = fill; cx.fillText(it.t, x, y);
        cx.restore();
      }
      x += w + sp2;
    }
  });
  cx.restore();
}
