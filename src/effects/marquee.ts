// Righe scorrevoli: il testo si ripete su più righe che scorrono in senso opposto.
// Qui c'è la parte di calcolo (si prova da terminale); il disegno resta nel motore.

export const SEPS: Record<string, string> = { space: '   ', dot: '  •  ', dash: '  —  ', slash: '  /  ', star: '  ✶  ' };
export const MAX_REPS = 80;

/** Ripetizioni necessarie perché la riga copra la diagonale del quadro anche durante lo scorrimento. */
export function repsFor(span: number, period: number): number {
  if (!(period > 0)) return 1;
  return Math.min(MAX_REPS, Math.max(2, Math.ceil((span + 2 * period) / period)));
}

/** Spostamento di una riga al tempo t con velocità v (pixel al secondo, con segno), riportato in [-P/2, P/2): lo scorrimento è senza fine e senza salti. */
export function wrapOffset(v: number, t: number, P: number): number {
  if (!(P > 0)) return 0;
  const x = v * t;
  return ((((x + P / 2) % P) + P) % P) - P / 2;
}

/** Verso della riga: 1 verso destra, -1 verso sinistra. 'alt' = opposte (pari a destra, dispari a sinistra). */
export const rowDir = (mode: string, row: number): number => (mode === 'right' ? 1 : mode === 'left' ? -1 : row % 2 === 0 ? 1 : -1);

export interface MarqueeOpts { rows: number; sep: string }

/**
 * Costruisce le righe: ogni riga di testo (a turno, se ce n'è più di una) si ripete con il separatore finché non copre il quadro.
 * Restituisce le righe e il periodo (larghezza di una ripetizione) di ciascuna.
 */
export function buildMarquee(lines: string[], mq: MarqueeOpts, ctx: { measureText(s: string): { width: number } }, W: number, H: number, tr: number) {
  const base = lines.map(l => l.trim()).filter(Boolean);
  const src = base.length ? base : [' '];
  const sep = SEPS[mq.sep] ?? SEPS.space;
  const rows = Math.max(1, Math.min(60, Math.round(mq.rows) || 1));
  const span = Math.hypot(W, H) * 1.15;
  const unit = src.map(l => l + sep);
  // periodo = larghezza di una ripetizione, misurata come differenza tra due e una ripetizione (tiene conto della spaziatura tra le coppie di lettere)
  const per = unit.map(u => Math.max(1, ctx.measureText(u + u).width - ctx.measureText(u).width + Array.from(u).length * tr));
  const out: string[] = [], P: number[] = [];
  for (let r = 0; r < rows; r++) { const k = r % src.length; out.push(unit[k].repeat(repsFor(span, per[k]))); P.push(per[k]); }
  return { lines: out, mqP: P };
}
