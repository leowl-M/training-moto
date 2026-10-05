// Maniglie sul quadro: spostare e ridimensionare il testo direttamente sull'anteprima.
// Le funzioni di calcolo sono pure (si provano da terminale); initHandles costruisce il livello sopra il canvas.

export interface Box { cx: number; cy: number; w: number; h: number; rot: number }   // coordinate del quadro (pixel logici W×H); rot in gradi

export const SNAP_PX = 8;     // distanza (in pixel dello schermo) entro cui il centro si aggancia alle linee guida

/** Aggancia un valore al bersaglio più vicino entro la tolleranza (nelle stesse unità). */
export function snap(value: number, targets: number[], tol: number): { value: number; hit: number | null } {
  let best: number | null = null, bd = tol;
  for (const t of targets) { const d = Math.abs(value - t); if (d <= bd) { bd = d; best = t; } }
  return best === null ? { value, hit: null } : { value: best, hit: best };
}

/** Nuova posizione del centro dopo un trascinamento di (dx, dy) pixel dello schermo, con aggancio al centro del quadro. */
export function dragCenter(start: { cx: number; cy: number }, dxCss: number, dyCss: number, frame: [number, number], css: [number, number], snapOn = true) {
  const k = frame[0] / css[0];
  let cx = start.cx + dxCss * k, cy = start.cy + dyCss * k;
  let gx: number | null = null, gy: number | null = null;
  if (snapOn) {
    const sx = snap(cx, [frame[0] / 2], SNAP_PX * k), sy = snap(cy, [frame[1] / 2], SNAP_PX * k);
    cx = sx.value; cy = sy.value; gx = sx.hit; gy = sy.hit;
  }
  return { cx, cy, guideX: gx, guideY: gy };
}

/** Variazione dello spostamento in % del quadro, a partire dal centro iniziale e da quello nuovo. */
export const offsetDelta = (from: { cx: number; cy: number }, to: { cx: number; cy: number }, frame: [number, number]) => ({ dx: (to.cx - from.cx) / frame[0] * 100, dy: (to.cy - from.cy) / frame[1] * 100 });

/** Fattore di scala dal rapporto tra la distanza attuale e quella iniziale del puntatore dal centro, entro limiti ragionevoli. */
export function scaleFactor(startDist: number, curDist: number, min = 0.05, max = 20): number {
  if (startDist < 1) return 1;
  return Math.max(min, Math.min(max, curDist / startDist));
}

export const round1 = (v: number) => Math.round(v * 10) / 10;

export interface HandleDeps {
  host: HTMLElement;                       // contenitore dell'anteprima
  canvas: HTMLCanvasElement;
  frame: () => [number, number];           // dimensioni del quadro in pixel logici
  box: () => Box | null;                   // riquadro del testo al momento attuale
  interactive: () => boolean;              // false = solo contorno (per esempio quando il blocco si muove da solo)
  enabled: () => boolean;
  onStart: () => void;
  onMove: (dxPct: number, dyPct: number) => string | void;      // può restituire un testo da mostrare accanto al riquadro
  onScale: (factor: number) => string | void;
  onEnd: () => void;
}

export function initHandles(d: HandleDeps) {
  const root = document.createElement('div'); root.className = 'hnd'; root.hidden = true;
  const box = document.createElement('div'); box.className = 'hnd-box';
  const gv = document.createElement('div'); gv.className = 'hnd-g v'; gv.hidden = true;
  const gh = document.createElement('div'); gh.className = 'hnd-g h'; gh.hidden = true;
  const corners = (['nw', 'ne', 'sw', 'se'] as const).map(c => { const e = document.createElement('i'); e.className = 'hnd-c c-' + c; e.dataset.c = c; box.appendChild(e); return e; });
  const lab = document.createElement('div'); lab.className = 'hnd-r'; lab.hidden = true;
  let label: string | null = null;
  root.append(gv, gh, box, lab); d.host.appendChild(root);

  // con lo zoom l'anteprima può scorrere: le maniglie seguono anche lo scorrimento
  const css = () => { const r = d.canvas.getBoundingClientRect(), h = d.host.getBoundingClientRect(); return { l: r.left - h.left + d.host.scrollLeft, t: r.top - h.top + d.host.scrollTop, w: r.width, h: r.height }; };

  const update = () => {
    const b = d.enabled() ? d.box() : null;
    if (!b) { root.hidden = true; return; }
    root.hidden = false;
    const c = css(), [W, H] = d.frame(), k = c.w / W;
    root.style.cssText = `left:${c.l}px;top:${c.t}px;width:${c.w}px;height:${c.h}px`;
    box.style.cssText = `left:${(b.cx - b.w / 2) * k}px;top:${(b.cy - b.h / 2) * k}px;width:${b.w * k}px;height:${b.h * k}px;transform:rotate(${b.rot || 0}deg)`;
    box.classList.toggle('static', !d.interactive());
    if (label) { lab.hidden = false; lab.textContent = label; lab.style.left = box.style.left; lab.style.top = Math.max(2, parseFloat(box.style.top) - 26) + 'px'; } else lab.hidden = true;
  };

  let drag: null | { mode: 'move' | 'scale'; x0: number; y0: number; start: Box; startDist: number } = null;
  const down = (e: PointerEvent, mode: 'move' | 'scale', cap?: Element) => {
    if (e.button !== 0 || !d.interactive()) return;
    const b = d.box(); if (!b) return;
    e.preventDefault(); e.stopPropagation(); d.onStart();
    const c = css(), [W] = d.frame(), k = c.w / W, h = d.host.getBoundingClientRect();
    const px = e.clientX - h.left - c.l, py = e.clientY - h.top - c.t;
    drag = { mode, x0: e.clientX, y0: e.clientY, start: b, startDist: Math.hypot(px - b.cx * k, py - b.cy * k) };
    (cap || (e.target as Element)).setPointerCapture(e.pointerId); document.body.classList.add('dragging');
  };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    const c = css(), frame = d.frame(), k = c.w / frame[0], h = d.host.getBoundingClientRect();
    if (drag.mode === 'move') {
      const r = dragCenter(drag.start, e.clientX - drag.x0, e.clientY - drag.y0, frame, [c.w, c.h], !e.altKey);
      const dl = offsetDelta(drag.start, r, frame);
      gv.hidden = r.guideX === null; gh.hidden = r.guideY === null;
      gv.style.left = c.w / 2 + 'px'; gh.style.top = c.h / 2 + 'px';
      label = d.onMove(dl.dx, dl.dy) ?? label; update();
    } else {
      const px = e.clientX - h.left - c.l, py = e.clientY - h.top - c.t;
      label = d.onScale(scaleFactor(drag.startDist, Math.hypot(px - drag.start.cx * k, py - drag.start.cy * k))) ?? label; update();
    }
  };
  const up = () => { if (!drag) return; drag = null; label = null; gv.hidden = gh.hidden = true; document.body.classList.remove('dragging'); d.onEnd(); update(); };
  box.addEventListener('pointerdown', e => down(e, (e.target as HTMLElement).dataset.c ? 'scale' : 'move'));
  box.addEventListener('pointermove', move); box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  void corners;
  /** Avvia uno spostamento a partire da un clic fatto sul quadro (seleziona e trascina con un unico gesto). */
  const beginMove = (e: PointerEvent) => { if (!root.hidden) down(e, 'move', box); };
  return { update, beginMove };
}
