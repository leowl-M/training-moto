// Stati di layout (come lo "Smart Animate" di Figma): la scena ha una disposizione iniziale (le proprietà normali degli elementi)
// e una serie di stati; ogni stato sposta, scala, ruota o attenua alcuni elementi rispetto alla disposizione iniziale.
// A un certo tempo la scena passa dallo stato precedente al successivo con una curva e, volendo, uno sfasamento fra gli elementi.
// Funzioni pure. Gli elementi hanno una chiave: "block:<i>" (testo), "svg:<id>", "img:<id>".

export interface Delta { dx: number; dy: number; s: number; r: number; op: number }   // spostamento in % del quadro, scala, gradi, opacità
export interface LState { id: string; name: string; at: number; dur: number; ease: string; stag: number; d: Record<string, Partial<Delta>> }
export interface States { on: boolean; list: LState[] }

export const ID: Delta = { dx: 0, dy: 0, s: 1, r: 0, op: 1 };
export const newStates = (): States => ({ on: false, list: [] });
export const full = (p?: Partial<Delta>): Delta => ({ ...ID, ...(p || {}) });
export const isId = (d: Delta) => !d.dx && !d.dy && d.s === 1 && !d.r && d.op === 1;

const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Mescola due disposizioni: la scala in modo geometrico, il resto lineare. */
export function mixDelta(a: Delta, b: Delta, f: number): Delta {
  return { dx: a.dx + (b.dx - a.dx) * f, dy: a.dy + (b.dy - a.dy) * f, s: a.s * Math.pow(b.s / a.s, f), r: a.r + (b.r - a.r) * f, op: a.op + (b.op - a.op) * f };
}

/** Avanzamento (0–1, con la curva) del passaggio verso lo stato st per l'elemento j di n: con lo sfasamento gli elementi partono uno dopo l'altro. */
export function stateProgress(st: LState, j: number, n: number, t: number, ease: (x: number) => number = x => x): number {
  const sg = Math.min(.95, Math.max(0, st.stag || 0)), L = Math.max(1e-6, st.dur * (1 - sg)), off = n > 1 ? (j / (n - 1)) * st.dur * sg : 0;
  return ease(cl((t - st.at - off) / L));
}

/** Disposizione dell'elemento key all'istante t. order = elenco delle chiavi nell'ordine dello sfasamento. */
export function stateDelta(S: States | undefined | null, key: string, order: string[], t: number, ease: (name: string) => (x: number) => number): Delta {
  if (!S || !S.on || !S.list.length) return ID;
  const list = [...S.list].sort((a, b) => a.at - b.at), j = Math.max(0, order.indexOf(key)), n = Math.max(1, order.length);
  let cur = ID;
  for (const st of list) {
    if (t < st.at) break;
    const f = stateProgress(st, j, n, t, ease(st.ease));
    cur = mixDelta(cur, full(st.d[key]), f);
    if (f < 1) break;
  }
  return cur;
}

/** Istante in cui lo stato è raggiunto del tutto (per mostrarlo mentre lo si modifica). */
export const stateEnd = (st: LState) => st.at + st.dur;
/** Fine dell'ultimo passaggio (serve ad allungare la clip). */
export const statesEnd = (S?: States | null) => (S && S.on && S.list.length ? Math.max(...S.list.map(stateEnd)) : 0);
