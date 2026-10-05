// Sequenza (timeline completa): clip su tracce, marker, operazioni di montaggio. Funzioni pure, provate da terminale.
// Tempi in secondi. Una clip occupa [start, start + dur) sulla timeline e mostra la sorgente da "inp" in poi
// (per le clip di grafica la sorgente è la scena MOTO, per video e audio il file).

export type ClipKind = 'motion' | 'video' | 'audio';
export type FadeCurve = 'eq' | 'lin' | 'exp';
/** Forma della dissolvenza: x da 0 (silenzio) a 1 (volume pieno).
 *  eq = dolce, potenza costante (come in Premiere) · lin = lineare sul volume · exp = uniforme in decibel (da −60 dB), la più naturale per i finali di musica. */
export function fadeShape(x: number, curve: FadeCurve = 'eq'): number {
  x = Math.max(0, Math.min(1, x));
  if (curve === 'lin') return x;
  if (curve === 'exp') return x <= 0 ? 0 : (10 ** (-3 * (1 - x)) - .001) / .999;
  return Math.sin(x * Math.PI / 2);
}
export type TrackId = string;   // G1, G2… (grafica), V1, V2… (video), A1, A2… (audio)
export interface Clip {
  id: string; kind: ClipKind; track: TrackId; name: string;
  start: number; dur: number; inp: number;          // posizione sulla timeline, durata, punto d'ingresso nella sorgente
  media?: string;                                    // video e audio: id del file collegato
  vol?: number; fadeIn?: number; fadeOut?: number; mute?: boolean;   // audio (anche quello dei video)
  fadeCurve?: FadeCurve;                             // forma delle dissolvenze (predefinita: dolce)
  fit?: 'cover' | 'contain';                         // video: riempie il quadro o ci sta dentro
  frame?: Record<string, { x: number; y: number; z: number }>;   // video: inquadratura per formato ('16:9', '9:16'…): punto al centro e zoom
  speed?: number;                                    // velocità (1 = normale, 0,5 = rallentato al 50%, 2 = doppia); vale anche per la grafica
  keepPitch?: boolean;
  ch?: 'auto' | 'stereo' | 'left' | 'right' | 'mono';
  beatEvery?: number;                                // musica: marker dei battiti ogni N battiti (1, 2, 4 = misura, 8)  // canali audio: auto = riconosciuti dal file (voce su un lato, traccia di sicurezza…)                               // audio a velocità diversa: tono della voce mantenuto (predefinito sì)
  bg?: 'auto' | 'on' | 'off';                        // grafica: sfondo della scena (auto = no se sotto c'è un video)
  scene?: any;                                       // grafica: la scena MOTO (per la clip attiva la scena vera è quella nel pannello)
}
export interface Marker { id: string; t: number; label: string; beat?: 1 | 2; src?: string }   // beat: battito della musica (2 = primo tempo della misura), src = clip della musica
export interface Seq { clips: Clip[]; markers: Marker[]; tracks?: TrackId[] }
export interface Track { id: TrackId; kind: ClipKind; name: string }

/* --- tracce: quante se ne vuole per tipo. Si mostrano dall'alto: grafica (la più alta in cima), video, audio.
   Si disegnano dal basso: Video 1, Video 2…, poi Grafica 1, Grafica 2… (la grafica sta sempre sopra i video). */
const PREFIX: Record<ClipKind, string> = { motion: 'G', video: 'V', audio: 'A' };
const LABEL: Record<ClipKind, string> = { motion: 'Grafica', video: 'Video', audio: 'Audio' };
export const DEFAULT_TRACKS: TrackId[] = ['G2', 'G1', 'V1', 'A1'];
export const kindOfTrack = (id: TrackId): ClipKind => (id[0] === 'G' ? 'motion' : id[0] === 'V' ? 'video' : 'audio');
export const trackNum = (id: TrackId) => parseInt(id.slice(1), 10) || 1;
const KIND_POS: Record<ClipKind, number> = { motion: 0, video: 1, audio: 2 };
/** Tracce della sequenza nell'ordine in cui si mostrano (comprese quelle usate dalle clip). */
export function tracksOf(s: Seq): Track[] {
  const ids = new Set<TrackId>(s.tracks && s.tracks.length ? s.tracks : DEFAULT_TRACKS);
  for (const c of s.clips) ids.add(c.track);
  return [...ids].map(id => ({ id, kind: kindOfTrack(id), name: LABEL[kindOfTrack(id)] + ' ' + trackNum(id) }))
    .sort((a, b) => KIND_POS[a.kind] - KIND_POS[b.kind] || (a.kind === 'audio' ? trackNum(a.id) - trackNum(b.id) : trackNum(b.id) - trackNum(a.id)));
}
/** Aggiunge una traccia del tipo dato e ne restituisce l'id. */
export function addTrack(s: Seq, kind: ClipKind): TrackId {
  const cur = tracksOf(s), n = Math.max(0, ...cur.filter(t => t.kind === kind).map(t => trackNum(t.id))) + 1, id = PREFIX[kind] + n;
  s.tracks = [...cur.map(t => t.id), id];
  return id;
}
/** Toglie una traccia vuota (ne resta almeno una per tipo). */
export function removeTrack(s: Seq, id: TrackId): boolean {
  const cur = tracksOf(s);
  if (s.clips.some(c => c.track === id) || cur.filter(t => t.kind === kindOfTrack(id)).length < 2) return false;
  s.tracks = cur.map(t => t.id).filter(x => x !== id);
  return true;
}
/** Prima traccia (dal basso) di un tipo: dove vanno i file nuovi. */
export const firstTrack = (s: Seq, kind: ClipKind): TrackId => tracksOf(s).filter(t => t.kind === kind).sort((a, b) => trackNum(a.id) - trackNum(b.id))[0]?.id || PREFIX[kind] + 1;
export const drawRank = (id: TrackId) => (kindOfTrack(id) === 'video' ? 0 : 1000) + trackNum(id);

export const newSeq = (): Seq => ({ clips: [], markers: [] });
export const uid = (p: string) => p + Math.random().toString(36).slice(2, 8);
export const clipEnd = (c: Clip) => c.start + c.dur;
/** Durata della sequenza: fine dell'ultima clip. */
export const seqTotal = (s: Seq) => Math.max(0, ...s.clips.map(clipEnd));
/** Velocità della clip (1 se non impostata). */
export const spd = (c: Clip) => c.speed || 1;
/** Tempo nella sorgente della clip all'istante T della timeline. */
export const localT = (c: Clip, T: number) => c.inp + (T - c.start) * spd(c);
export const isActive = (c: Clip, T: number) => T >= c.start - 1e-9 && T < clipEnd(c) - 1e-9;

/** Clip visibili all'istante T, nell'ordine in cui si disegnano (video sotto, grafica 2 sopra). */
export function visibleAt(s: Seq, T: number): Clip[] {
  return s.clips.filter(c => c.kind !== 'audio' && isActive(c, T)).sort((a, b) => drawRank(a.track) - drawRank(b.track) || a.start - b.start);
}

/** Divide la clip all'istante T: restituisce le due parti (null se T non cade dentro la clip). */
export function splitClip(c: Clip, T: number, newId = uid('c')): [Clip, Clip] | null {
  if (T <= c.start + 1e-3 || T >= clipEnd(c) - 1e-3) return null;
  const a = { ...c, dur: T - c.start, fadeOut: 0 }, b = { ...c, id: newId, start: T, dur: clipEnd(c) - T, inp: c.inp + (T - c.start) * spd(c), fadeIn: 0 };
  if (c.scene) b.scene = JSON.parse(JSON.stringify(c.scene));
  delete (b as any).tr;                              // la transizione resta sul taglio di prima, non su quello nuovo
  return [a, b];
}

/** Accorcia o allunga l'inizio: la fine resta ferma, la sorgente scorre (non prima del suo inizio). */
export function trimStart(c: Clip, newStart: number, minDur = 1 / 30): Clip {
  const end = clipEnd(c), s = Math.min(end - minDur, Math.max(newStart, (c as any).adj ? 0 : c.start - c.inp / spd(c), 0));   // il livello di regolazione non ha una sorgente che finisce
  return { ...c, start: s, dur: end - s, inp: c.inp + (s - c.start) * spd(c) };
}
/** Accorcia o allunga la fine. maxSrc = durata della sorgente (video e audio non vanno oltre il file). */
export function trimEnd(c: Clip, newEnd: number, maxSrc = Infinity, minDur = 1 / 30): Clip {
  const lim = c.start + (maxSrc - c.inp) / spd(c);
  return { ...c, dur: Math.max(minDur, Math.min(newEnd, lim) - c.start) };
}

/** Cambia la velocità: la clip mostra lo stesso pezzo di sorgente, quindi la durata cambia (al 50% dura il doppio).
 *  Se diventa più lunga, le clip che seguono sulla stessa traccia si spostano quanto serve per non sovrapporsi. */
export function setSpeed(s: Seq, c: Clip, v: number) {
  v = Math.max(.05, Math.min(16, v));
  const k = spd(c) / v;
  c.dur *= k; c.fadeIn = c.fadeIn ? c.fadeIn * k : c.fadeIn; c.fadeOut = c.fadeOut ? c.fadeOut * k : c.fadeOut;
  if (Math.abs(v - 1) < 1e-9) delete c.speed; else c.speed = v;
  unoverlap(s, c.track);
}
/** Sulla traccia data (o su tutte), una clip che si sovrappone alla precedente si sposta dopo di lei (a catena). */
export function unoverlap(s: Seq, track?: TrackId) {
  const by = new Map<TrackId, Clip[]>();
  for (const o of s.clips) if (!track || o.track === track) { const l = by.get(o.track) || []; l.push(o); by.set(o.track, l); }
  for (const l of by.values()) { l.sort((x, y) => x.start - y.start); for (let i = 1; i < l.length; i++) if (l[i].start < clipEnd(l[i - 1]) - 1e-9) l[i].start = clipEnd(l[i - 1]); }
}

/** Aggancio: il valore più vicino tra i punti dati, se entro la tolleranza. */
export function snap(v: number, points: number[], tol: number): number {
  let best = v, d = tol;
  for (const p of points) { const e = Math.abs(p - v); if (e <= d) { d = e; best = p; } }
  return best;
}
/** Punti a cui agganciarsi: inizio e fine delle altre clip, marker, testina, zero. */
export function snapPoints(s: Seq, except: string | null, playhead?: number): number[] {
  const p = [0, ...s.markers.map(m => m.t)];
  for (const c of s.clips) if (c.id !== except) p.push(c.start, clipEnd(c));
  if (playhead != null) p.push(playhead);
  return p;
}

/** Spostamento senza sovrapporsi alle altre clip della stessa traccia: la clip si ferma contro la vicina. */
export function placeOnTrack(s: Seq, c: Clip, start: number): number {
  const others = s.clips.filter(o => o.id !== c.id && o.track === c.track).sort((a, b) => a.start - b.start);
  let x = Math.max(0, start);
  for (const o of others) {
    const oe = clipEnd(o);
    if (x < oe && x + c.dur > o.start) {           // si sovrappone: va dal lato più vicino, se c'è spazio
      const left = o.start - c.dur, right = oe;
      x = Math.abs(left - start) <= Math.abs(right - start) && left >= 0 ? left : right;
    }
  }
  // controllo finale: se si sovrappone ancora (spazio stretto), resta dov'era
  return others.some(o => x < clipEnd(o) - 1e-9 && x + c.dur > o.start + 1e-9) ? c.start : x;
}

/** Primo spazio libero sulla traccia a partire da "from" per una clip lunga dur. */
export function freeSlot(s: Seq, track: TrackId, from: number, dur: number): number {
  const others = s.clips.filter(o => o.track === track).sort((a, b) => a.start - b.start);
  let x = Math.max(0, from);
  for (const o of others) if (x < clipEnd(o) && x + dur > o.start) x = clipEnd(o);
  return x;
}

/** Volume (0–…) della clip all'istante T: volume per dissolvenze d'ingresso e d'uscita. */
export function clipGain(c: Clip, T: number): number {
  if (c.mute || !isActive(c, T)) return 0;
  const v = c.vol ?? 1, a = T - c.start, b = clipEnd(c) - T;
  let g = v;
  if (c.fadeIn && a < c.fadeIn) g *= fadeShape(a / c.fadeIn, c.fadeCurve);
  if (c.fadeOut && b < c.fadeOut) g *= fadeShape(b / c.fadeOut, c.fadeCurve);
  return g;
}

/** Riduce i picchi di un segnale a n colonne (massimo assoluto): serve a disegnare l'onda. */
export function peaks(data: Float32Array, n: number): Float32Array {
  const out = new Float32Array(Math.max(1, n)), step = data.length / out.length;
  for (let i = 0; i < out.length; i++) { let m = 0; const a = Math.floor(i * step), b = Math.min(data.length, Math.floor((i + 1) * step)); for (let j = a; j < b; j++) { const v = Math.abs(data[j]); if (v > m) m = v; } out[i] = m; }
  return out;
}
