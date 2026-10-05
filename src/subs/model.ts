// Sottotitoli: parole con i loro tempi e frasi (gruppi di parole che compaiono insieme). Funzioni pure, provate da terminale.
// Le parole stanno nel tempo del FILE (media + secondi dall'inizio del file), non della timeline: così seguono i tagli,
// gli spostamenti e "Elimina pause" senza ricalcoli. Le frasi non si salvano: si ricavano dalle parole e dallo stile
// (caratteri per riga, righe), più due segni messi a mano sulle parole (br = qui comincia una frase, nb = qui no).
import { isActive, localT, spd } from '../seq/seq.ts';
import type { Seq, Clip } from '../seq/seq.ts';

export interface Word { id: string; m: string; t: string; s: number; e: number; br?: boolean; nb?: boolean }
export interface Cue { id: string; m: string; w: Word[]; s: number; e: number }   // e = fine di visualizzazione (anche dopo l'ultima parola)
export interface GroupOpts { maxChars: number; lines: number; gap: number; hold: number; maxDur: number }
export const GROUP_DEF: GroupOpts = { maxChars: 28, lines: 2, gap: .7, hold: .5, maxDur: 5 };

const STRONG = /[.!?…]["»”']?$/, SOFT = /[,;:]["»”']?$/;
// parole che non chiudono bene una frase (articoli, preposizioni, congiunzioni): meglio che passino alla frase dopo
const WEAK = new Set('e ed o od a ad di da in con su per tra fra il lo la l i gli le un uno una un\' che ma se non né del dello della dei degli delle al allo alla ai agli alle nel nello nella nei negli nelle sul sullo sulla sui dal dallo dalla dai col mi ti si ci vi ne come quando dove perché the a an and or of to in on at for with but that is my your our'.split(' '));
const bare = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

/** Frasi dalle parole. Si va a capo (frase nuova) quando la frase non ci sta più nelle righe (nel punto migliore: dopo una virgola,
 *  mai dopo un articolo o una preposizione), dopo un punto, su una pausa lunga se la frase ha già un po' di testo (o se la pausa
 *  è molto lunga), e dove è stato deciso a mano. */
export function groupCues(words: Word[], o: Partial<GroupOpts> = {}): Cue[] {
  const g = { ...GROUP_DEF, ...o }, cap = g.maxChars * g.lines, out: Cue[] = [];
  const ws = [...words].sort((a, b) => (a.m < b.m ? -1 : a.m > b.m ? 1 : a.s - b.s));
  let cur: Word[] = [];
  const len = (l: Word[]) => l.reduce((n, w) => n + w.t.length, 0) + Math.max(0, l.length - 1);
  const flush = (k = cur.length) => { const a = cur.slice(0, k); if (a.length) out.push({ id: a[0].id, m: a[0].m, w: a, s: a[0].s, e: a[a.length - 1].e }); cur = cur.slice(k); };
  /** Dove dividere una frase troppo lunga: il punto con il punteggio migliore tra quelli che lasciano la prima parte piena per almeno metà. */
  const bestSplit = () => {
    let best = cur.length, bv = -Infinity;
    for (let k = 1; k <= cur.length; k++) {
      if (cur.slice(k).some(w => w.nb)) continue;
      const a = cur.slice(0, k), n = len(a), last = a[a.length - 1];
      if (k < cur.length && cur[k].nb) continue;
      if (n > cap && k > 1) continue;                              // la prima parte deve starci
      let v = n / cap;                                             // più piena è meglio
      if (SOFT.test(last.t) || STRONG.test(last.t)) v += .6;
      if (WEAK.has(bare(last.t))) v -= 1;
      if (k < cur.length && cur[k].s - last.e > .25) v += .3;     // una piccola pausa
      if (n < cap * .4) v -= 1;
      if (v > bv) { bv = v; best = k; }
    }
    return best;
  };
  for (const w of ws) {
    if (cur.length) {
      const last = cur[cur.length - 1], n = len(cur), gap = w.s - last.e;
      if (w.m !== last.m || w.br) flush();
      else if (!w.nb) {
        if (STRONG.test(last.t) || (SOFT.test(last.t) && n > cap * .6) || (gap > g.gap && (n > cap * .35 || gap > 2.5) && !WEAK.has(bare(last.t)))) flush();
        else if (n + 1 + w.t.length > cap || w.e - cur[0].s > g.maxDur) { cur.push(w); do flush(bestSplit()); while (len(cur) > cap && cur.length > 1); continue; }
      }
    }
    cur.push(w);
  }
  while (cur.length) { if (len(cur) > cap && cur.length > 1) flush(bestSplit()); else flush(); }
  // ogni frase resta un po' dopo l'ultima parola, ma non oltre l'inizio della successiva
  for (let i = 0; i < out.length; i++) {
    const nx = out[i + 1], lim = nx && nx.m === out[i].m ? nx.s : Infinity;
    out[i].e = Math.max(out[i].e, Math.min(out[i].e + g.hold, lim));
  }
  return out;
}

/** Le righe di una frase: si dividono in modo equilibrato (la prima un po' più corta se non tornano pari). */
export function splitLines<T extends { t: string }>(w: T[], lines: number, maxChars: number): T[][] {
  const len = (l: T[]) => l.reduce((n, x) => n + x.t.length, 0) + Math.max(0, l.length - 1);
  if (lines < 2 || w.length < 2 || len(w) <= maxChars) return [w];
  let best = 1, bv = Infinity;
  for (let k = 1; k < w.length; k++) {
    const a = len(w.slice(0, k)), b = len(w.slice(k)), last = w[k - 1].t;
    // righe pari, ma meglio andare a capo dopo una virgola e mai dopo un articolo o una preposizione
    const v = Math.max(a, b) + (a > b ? .5 : 0) + (Math.max(a, b) > maxChars ? 100 : 0) - (SOFT.test(last) || STRONG.test(last) ? 6 : 0) + (WEAK.has(bare(last)) ? 8 : 0);
    if (v < bv) { bv = v; best = k; }
  }
  return [w.slice(0, best), w.slice(best)];
}

/* --- dall'audio compresso (senza pause) ai tempi del file --- */
export interface Piece { cs: number; ce: number; os: number }   // un tratto di voce: dove sta nell'audio compresso e dove comincia nel file

/** Tratti di voce → mappa per l'audio compresso: ogni tratto col suo margine, separati da un breve silenzio (sil). */
export function compressMap(runs: [number, number][], pad: number, dur: number, sil: number): Piece[] {
  const r: [number, number][] = [];
  for (const [a, b] of runs) { const x = Math.max(0, a - pad), y = Math.min(dur, b + pad); if (r.length && x <= r[r.length - 1][1]) r[r.length - 1][1] = Math.max(r[r.length - 1][1], y); else r.push([x, y]); }
  const out: Piece[] = [];
  let c = 0;
  for (const [a, b] of r) { out.push({ cs: c, ce: c + (b - a), os: a }); c += b - a + sil; }
  return out;
}

/** Parole trovate nell'audio compresso → tempi nel file. Ogni parola appartiene al tratto dove comincia; se finisce oltre il tratto
 *  (o comincia nel silenzio aggiunto tra due tratti) si sposta nel tratto giusto. Le parole non si accavallano e non durano troppo. */
export function mapWords(ws: { t: string; s: number; e: number }[], map: Piece[], maxWord = 1.2): { t: string; s: number; e: number }[] {
  if (!map.length) return [];
  const pieceOf = (x: number) => { let k = map.findIndex(p => x < p.ce - 1e-6); return k < 0 ? map.length - 1 : k; };
  const out: { t: string; s: number; e: number; k: number }[] = [];
  ws.forEach((w, i) => {
    let k = pieceOf(w.s), p = map[k];                                 // se comincia nel silenzio tra due tratti, va nel tratto dopo
    let s = Math.max(w.s, p.cs), e = Math.min(w.e, p.ce);
    if (w.e > p.ce + .05 && k + 1 < map.length) {
      // a cavallo tra due tratti: va dove ne cade la parte più lunga
      const q = map[k + 1], inA = p.ce - s, inB = Math.max(0, w.e - q.cs);
      if (inB > inA) { k++; p = q; s = q.cs; const nx = ws[i + 1]; e = Math.min(w.e, q.ce, nx && nx.s > s ? nx.s : Infinity); }
    }
    // troppo lunga: se comincia dove riprende la voce l'inizio è sicuro e si accorcia la fine, altrimenti il contrario
    if (e - s > maxWord) { if (s - p.cs < .2) e = s + maxWord; else s = e - maxWord; }
    e = Math.max(e, s + .04);
    out.push({ t: w.t, s: p.os + (s - p.cs), e: p.os + (e - p.cs), k });
  });
  for (let i = 1; i < out.length; i++) if (out[i].s < out[i - 1].e) { const mid = Math.max(out[i - 1].s + .04, Math.min(out[i].s, out[i - 1].e)); out[i - 1].e = mid; out[i].s = Math.max(out[i].s, mid); if (out[i].e < out[i].s + .04) out[i].e = out[i].s + .04; }
  return out.map(({ t, s, e }) => ({ t, s: +s.toFixed(3), e: +e.toFixed(3) }));
}

/** Pezzi staccati da Whisper che sono una parola sola: "dall" + "'idea" → "dall'idea", punteggiatura isolata attaccata alla parola prima. */
export function joinPieces<T extends { t: string; s: number; e: number }>(ws: T[]): T[] {
  const out: T[] = [];
  for (const w of ws) {
    const pv = out[out.length - 1];
    if (pv && (/^['’]/.test(w.t) || /['’]$/.test(pv.t) || /^[^\p{L}\p{N}]+$/u.test(w.t))) { pv.t += w.t; pv.e = Math.max(pv.e, w.e); }
    else out.push({ ...w });
  }
  return out;
}

/* --- sulla timeline --- */
/** Clip che portano i sottotitoli di un file: video e audio con quel file. */
export const carriers = (seq: Seq, m: string) => seq.clips.filter(c => c.kind !== 'motion' && c.media === m);
/** Pezzi di file usati dalla timeline (uniti), con un margine: è ciò che si trascrive. */
export function usedRanges(seq: Seq, m: string, pad = .5, dur = Infinity): [number, number][] {
  const r = carriers(seq, m).map(c => [Math.max(0, c.inp - pad), Math.min(dur, c.inp + c.dur * spd(c) + pad)] as [number, number]).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const x of r) { if (out.length && x[0] <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], x[1]); else out.push([...x]); }
  return out;
}

export interface CueSeg { cue: Cue; clip: Clip; start: number; end: number }
/** Dove si vede ogni frase sulla timeline (una frase può comparire spezzata se c'è un taglio in mezzo, o più volte se il pezzo è ripetuto). */
export function cueSegments(seq: Seq, cues: Cue[]): CueSeg[] {
  const out: CueSeg[] = [];
  for (const c of seq.clips) {
    if (c.kind === 'motion' || !c.media) continue;
    const a = c.inp, b = c.inp + c.dur * spd(c);
    for (const q of cues) {
      if (q.m !== c.media || q.e <= a || q.s >= b) continue;
      out.push({ cue: q, clip: c, start: c.start + (Math.max(a, q.s) - a) / spd(c), end: c.start + (Math.min(b, q.e) - a) / spd(c) });
    }
  }
  return out.sort((x, y) => x.start - y.start);
}

/** Cosa si vede all'istante T: la frase, il tempo nel file e la parola che si sta dicendo (−1 tra due parole). */
export function subAt(seq: Seq, cues: Cue[], T: number): { cue: Cue; src: number; word: number } | null {
  // la clip più in alto che porta sottotitoli (le tracce video più alte coprono le altre, l'audio per ultimo)
  const act = seq.clips.filter(c => c.kind !== 'motion' && c.media && isActive(c, T)).sort((a, b) => (a.kind === 'audio' ? 1 : 0) - (b.kind === 'audio' ? 1 : 0));
  for (const c of act) {
    const src = localT(c, T), q = cues.find(x => x.m === c.media && src >= x.s - 1e-6 && src < x.e);
    if (!q) continue;
    let word = -1;
    for (let i = 0; i < q.w.length; i++) if (src >= q.w[i].s - 1e-6) word = i;
    return { cue: q, src, word };
  }
  return null;
}

/* --- modifiche --- */
/** Nuovo testo di una frase: se il numero di parole non cambia restano i tempi di prima, altrimenti si ridistribuiscono
 *  tra inizio e fine della frase in proporzione alla lunghezza delle parole. Restituisce le parole nuove (con id). */
export function retext(words: Word[], cue: Cue, text: string, mkId: () => string): Word[] {
  const toks = text.trim().split(/\s+/).filter(Boolean), ids = new Set(cue.w.map(w => w.id));
  const keepFlags = { br: cue.w[0].br, nb: cue.w[0].nb };
  let nw: Word[];
  if (toks.length === cue.w.length) nw = cue.w.map((w, i) => ({ ...w, t: toks[i] }));
  else {
    const s = cue.w[0].s, e = cue.w[cue.w.length - 1].e, tot = toks.reduce((n, t) => n + t.length + 1, 0) || 1;
    let x = s;
    nw = toks.map((t, i) => { const d = (e - s) * (t.length + 1) / tot, w: Word = { id: i === 0 ? cue.w[0].id : mkId(), m: cue.m, t, s: +x.toFixed(3), e: +(x + d).toFixed(3) }; x += d; return w; });
    if (nw[0]) Object.assign(nw[0], keepFlags);
  }
  const at = words.findIndex(w => ids.has(w.id));
  const rest = words.filter(w => !ids.has(w.id));
  rest.splice(at < 0 ? rest.length : Math.min(at, rest.length), 0, ...nw);
  return rest;
}
/** Divide la frase prima della parola data. */
export function splitBefore(words: Word[], id: string) { const w = words.find(x => x.id === id); if (w) { w.br = true; delete w.nb; } }
/** Unisce la frase alla successiva (la prima parola della successiva non comincia più una frase). */
export function mergeNext(words: Word[], cues: Cue[], cueId: string) {
  const i = cues.findIndex(q => q.id === cueId), nx = cues[i + 1];
  if (i < 0 || !nx || nx.m !== cues[i].m) return false;
  const w = words.find(x => x.id === nx.w[0].id); if (!w) return false;
  delete w.br; w.nb = true;
  return true;
}
/** Sposta tutte le parole della frase di dt secondi (nel file), senza superare le frasi vicine. */
export function shiftCue(cues: Cue[], cueId: string, dt: number): number {
  const i = cues.findIndex(q => q.id === cueId), q = cues[i]; if (!q) return 0;
  const pv = cues[i - 1], nx = cues[i + 1], a = q.w[0].s, b = q.w[q.w.length - 1].e;
  const lo = pv && pv.m === q.m ? pv.w[pv.w.length - 1].e - a : -a, hi = nx && nx.m === q.m ? nx.w[0].s - b : Infinity;
  dt = Math.max(lo, Math.min(hi, dt));
  for (const w of q.w) { w.s = +(w.s + dt).toFixed(3); w.e = +(w.e + dt).toFixed(3); }
  return dt;
}
/** Sposta insieme più frasi (ids) di dt secondi: si fermano contro le frasi non selezionate più vicine e non vanno prima di 0. */
export function shiftCues(cues: Cue[], ids: Set<string>, dt: number): number {
  let lo = -Infinity, hi = Infinity;
  cues.forEach((q, i) => {
    if (!ids.has(q.id)) return;
    const a = q.w[0].s, b = q.w[q.w.length - 1].e;
    lo = Math.max(lo, -a);
    for (let j = i - 1; j >= 0 && cues[j].m === q.m; j--) if (!ids.has(cues[j].id)) { lo = Math.max(lo, cues[j].w[cues[j].w.length - 1].e - a); break; }
    for (let j = i + 1; j < cues.length && cues[j].m === q.m; j++) if (!ids.has(cues[j].id)) { hi = Math.min(hi, cues[j].w[0].s - b); break; }
  });
  if (lo > hi) return 0;
  dt = Math.max(lo, Math.min(hi, dt));
  if (!isFinite(dt)) return 0;
  for (const q of cues) if (ids.has(q.id)) for (const w of q.w) { w.s = +(w.s + dt).toFixed(3); w.e = +(w.e + dt).toFixed(3); }
  return dt;
}
/** Unisce in una frase sola le frasi date, se sono una dopo l'altra (stesso file). */
export function mergeCues(words: Word[], cues: Cue[], ids: Set<string>): boolean {
  const idx = cues.map((q, i) => (ids.has(q.id) ? i : -1)).filter(i => i >= 0);
  if (idx.length < 2 || idx.some((v, k) => k && (v !== idx[k - 1] + 1 || cues[v].m !== cues[idx[0]].m))) return false;
  for (const i of idx.slice(1)) { const w = words.find(x => x.id === cues[i].w[0].id); if (w) { delete w.br; w.nb = true; } }
  return true;
}
/** Sposta l'inizio (prima parola) o la fine (ultima parola) della frase al tempo dato del file; le parole in mezzo si riproporzionano. */
export function trimCue(cues: Cue[], cueId: string, side: 'l' | 'r', x: number) {
  const i = cues.findIndex(q => q.id === cueId), q = cues[i]; if (!q) return;
  const pv = cues[i - 1], nx = cues[i + 1], a = q.w[0].s, b = q.w[q.w.length - 1].e;
  let na = a, nb = b;
  if (side === 'l') na = Math.max(pv && pv.m === q.m ? pv.w[pv.w.length - 1].e : 0, Math.min(b - .1 * q.w.length, x));
  else nb = Math.min(nx && nx.m === q.m ? nx.w[0].s : Infinity, Math.max(a + .1 * q.w.length, x));
  const k = (nb - na) / Math.max(1e-6, b - a);
  for (const w of q.w) { w.s = +(na + (w.s - a) * k).toFixed(3); w.e = +(na + (w.e - a) * k).toFixed(3); }
}
/** Toglie la frase (le sue parole). */
export const removeCue = (words: Word[], cue: Cue) => { const ids = new Set(cue.w.map(w => w.id)); return words.filter(w => !ids.has(w.id)); };

/** Testo da esportare come file .srt (tempi della timeline). */
export function toSrt(seq: Seq, cues: Cue[], lines: number, maxChars: number): string {
  const tc = (s: number) => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, ss = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  return cueSegments(seq, cues).filter(g => g.end - g.start > .05).map((g, i) => `${i + 1}\n${tc(g.start)} --> ${tc(g.end)}\n${splitLines(g.cue.w, lines, maxChars).map(l => l.map(w => w.t).join(' ')).join('\n')}\n`).join('\n');
}
