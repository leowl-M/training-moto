// File collegati (video e audio): restano nella loro cartella, MOTO li legge senza copiarli.
// L'accesso passa per il File System Access del browser: i "permessi" (handle) si ricordano in IndexedDB,
// ma a ogni nuova sessione il browser chiede un clic per riattivarli (requestPermission vuole un gesto dell'utente).

import { matchMedia } from '../project/file.ts';

export interface MediaInfo { id: string; name: string; kind: 'video' | 'audio'; dur: number; w: number; h: number; size: number; hasAudio: boolean }

const VIDEO_EXT = /\.(mp4|mov|m4v)$/i, AUDIO_EXT = /\.(mp3|wav|m4a|aac|aif|aiff|flac|ogg)$/i;
export const isMediaName = (n: string) => VIDEO_EXT.test(n) || AUDIO_EXT.test(n);
export const kindOf = (n: string): 'video' | 'audio' => (VIDEO_EXT.test(n) ? 'video' : 'audio');
/** Id stabile per lo stesso file: nome, dimensione e data di modifica. */
export const mediaId = (f: { name: string; size: number; lastModified: number }) => 'm' + Math.abs([...`${f.name}|${f.size}|${f.lastModified}`].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)).toString(36);

/* ---------- handle ricordati in IndexedDB ---------- */
const DB = 'moto-media', ST = 'h';
function db(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
}
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((ok, ko) => { const tx = d.transaction(ST, mode), rq = fn(tx.objectStore(ST)); rq.onsuccess = () => ok(rq.result); rq.onerror = () => ko(rq.error); });
}
const putH = (k: string, h: any) => idb('readwrite', s => s.put(h, k)).catch(() => null);
const getH = (k: string) => idb<any>('readonly', s => s.get(k)).catch(() => null);

/* ---------- stato della sessione ---------- */
const files = new Map<string, File>(), urls = new Map<string, string>(), vids = new Map<string, HTMLVideoElement>();
const bufs = new Map<string, Promise<AudioBuffer | null>>(), done = new Map<string, AudioBuffer | null>(), pk = new Map<string, Float32Array>();
let root: any = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(f => f());
export const onMediaChange = (f: () => void) => listeners.add(f);

export const hasFile = (id: string) => files.has(id);
export const fileOf = (id: string) => files.get(id) || null;
export const folderName = () => (root ? root.name : null);
export const canLink = () => typeof (window as any).showDirectoryPicker === 'function';

/** Scheda di un file: durata e dimensioni lette dal lettore del browser (che applica anche la rotazione dei video verticali). */
export async function probe(f: File): Promise<MediaInfo> {
  const kind = kindOf(f.name), id = mediaId(f), url = URL.createObjectURL(f);
  const el = document.createElement(kind === 'video' ? 'video' : 'audio') as HTMLVideoElement;
  el.preload = 'metadata'; el.muted = true; el.src = url;
  await new Promise<void>(r => { el.onloadedmetadata = () => r(); el.onerror = () => r(); setTimeout(r, 8000); });
  const info: MediaInfo = { id, name: f.name, kind, dur: isFinite(el.duration) ? el.duration : 0, w: el.videoWidth || 0, h: el.videoHeight || 0, size: f.size, hasAudio: true };
  URL.revokeObjectURL(url);
  return info;
}

/** Registra un file per questa sessione (e ricorda il suo handle, se c'è). */
export async function addFile(f: File, handle?: any): Promise<MediaInfo> {
  const info = await probe(f);
  files.set(info.id, f);
  if (handle) await putH(info.id, handle);
  changed();
  return info;
}

/** Collega una cartella: la sceglie l'utente, MOTO ricorda l'accesso. */
export async function linkFolder(): Promise<string | null> {
  const pick = (window as any).showDirectoryPicker;
  if (!pick) return null;
  root = await pick({ id: 'moto-media', mode: 'read' });
  await putH('root', root);
  changed();
  return root.name;
}
/** File audio e video della cartella collegata (anche nelle sottocartelle, fino a 2 livelli). */
export async function listFolder(): Promise<{ name: string; path: string; handle: any }[]> {
  if (!root) return [];
  const out: { name: string; path: string; handle: any }[] = [];
  const walk = async (dir: any, pre: string, depth: number) => {
    for await (const [name, h] of dir.entries()) {
      if (h.kind === 'file' && isMediaName(name)) out.push({ name, path: pre + name, handle: h });
      else if (h.kind === 'directory' && depth < 2 && !name.startsWith('.')) await walk(h, pre + name + '/', depth + 1);
    }
  };
  await walk(root, '', 0);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/** All'apertura: riprende la cartella e i file del progetto dagli handle ricordati. Restituisce gli id che chiedono un clic per riattivare l'accesso. */
export async function restore(ids: string[]): Promise<{ needsGrant: boolean; missing: string[] }> {
  root = root || await getH('root');
  let needsGrant = false;
  const missing: string[] = [];
  for (const id of ids) {
    if (files.has(id)) continue;
    const h = await getH(id);
    if (!h) { missing.push(id); continue; }
    const p = await h.queryPermission?.({ mode: 'read' });
    if (p === 'granted') { try { files.set(id, await h.getFile()); } catch { missing.push(id); } }
    else { needsGrant = true; missing.push(id); }
  }
  if (root && (await root.queryPermission?.({ mode: 'read' })) !== 'granted') needsGrant = true;
  changed();
  return { needsGrant, missing };
}
/** Riattiva l'accesso (va chiamata da un clic). */
export async function regrant(ids: string[]): Promise<number> {
  let n = 0;
  if (root) await root.requestPermission?.({ mode: 'read' }).catch(() => null);
  for (const id of ids) {
    if (files.has(id)) continue;
    const h = await getH(id);
    if (!h) continue;
    if ((await h.requestPermission?.({ mode: 'read' })) === 'granted') { try { files.set(id, await h.getFile()); n++; } catch { /* file spostato */ } }
  }
  changed();
  return n;
}

/* ---------- anteprima: un lettore per file ---------- */
export function urlOf(id: string): string | null {
  const f = files.get(id);
  if (!f) return null;
  let u = urls.get(id);
  if (!u) { u = URL.createObjectURL(f); urls.set(id, u); }
  return u;
}
/** Lettore video (muto: l'audio passa da WebAudio, così si sincronizza e si mixa).
 *  slot: se nello stesso istante si vedono due pezzi dello stesso file (per esempio su due tracce), ognuno ha il suo lettore. */
export function videoOf(id: string, slot = 0): HTMLVideoElement | null {
  const k = id + '#' + slot;
  let v = vids.get(k);
  if (v) return v;
  const u = urlOf(id);
  if (!u) return null;
  v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = u;
  // tempo del fotogramma annunciato (serve a "keepFrame"); per la stabilizzazione si legge il tempo dal fotogramma stesso, al disegno
  const rv = (v as any).requestVideoFrameCallback?.bind(v);
  if (rv) { const cb = (_n: number, m: any) => { (v as any)._mt = m.mediaTime; rv(cb); }; rv(cb); }
  vids.set(k, v);
  return v;
}
/** Tutti i lettori aperti, con la loro chiave (file#slot). */
export const allVideos = () => [...vids.entries()];

/* ---------- audio decodificato e onda ---------- */
export function audioOf(id: string, ac: BaseAudioContext): Promise<AudioBuffer | null> {
  let p = bufs.get(id);
  if (p) return p;
  const f = files.get(id);
  if (!f) return Promise.resolve(null);
  p = f.arrayBuffer().then(b => ac.decodeAudioData(b)).then(buf => { done.set(id, buf); changed(); return buf; }).catch(() => { done.set(id, null); changed(); return null; });
  bufs.set(id, p);
  return p;
}
/** Audio già pronto (senza aspettare): serve alla riproduzione e al disegno dell'onda. */
export const audioReady = (id: string) => done.get(id) || null;
/** Picchi dell'onda (n colonne su tutto il file), calcolati una volta. */
export function peaksOf(id: string, n = 2000): Float32Array | null {
  const k = id + '|' + n;
  if (pk.has(k)) return pk.get(k)!;
  const b = done.get(id);
  if (!b) return null;
  const ch = [...Array(b.numberOfChannels)].map((_, i) => b.getChannelData(i)), out = new Float32Array(n), step = b.length / n;
  for (let i = 0; i < n; i++) { let m = 0; const a = Math.floor(i * step), e = Math.min(b.length, Math.floor((i + 1) * step)); for (const c of ch) for (let j = a; j < e; j += 4) { const v = Math.abs(c[j]); if (v > m) m = v; } out[i] = m; }
  pk.set(k, out);
  return out;
}

/* ---------- file di progetto: percorso nella cartella e ricollegamento ---------- */
/** Percorso del file dentro la cartella collegata, con il nome della cartella davanti ("Reel/Video/parlato.mp4"); null se il file è fuori. */
export async function pathOf(id: string): Promise<string | null> {
  const h = await getH(id);
  if (!h || !root || !root.resolve) return null;
  try { const p = await root.resolve(h); return p ? [root.name, ...p].join('/') : null; } catch { return null; }
}
/** Dopo aver aperto un progetto su un altro computer (o spostato i file): si sceglie la cartella e i file mancanti si ritrovano
 *  dal percorso, oppure da nome e dimensione. Restituisce quanti sono stati trovati e quanti mancano ancora. */
export async function relinkFolder(media: { id: string; name: string; size?: number; path?: string | null }[]): Promise<{ found: number; missing: number } | null> {
  const pick = (window as any).showDirectoryPicker;
  if (!pick) return null;
  const dir = await pick({ id: 'moto-media', mode: 'read' });
  root = dir; await putH('root', dir);
  const want = media.filter(m => !files.has(m.id));
  const entries: { path: string; name: string; size: number; handle: any }[] = [];
  const walk = async (d: any, pre: string, depth: number) => {
    for await (const [name, h] of d.entries()) {
      if (h.kind === 'file' && isMediaName(name)) { try { const f = await h.getFile(); entries.push({ path: pre + name, name, size: f.size, handle: h }); } catch { /* illeggibile */ } }
      else if (h.kind === 'directory' && depth < 4 && !name.startsWith('.')) await walk(h, pre + name + '/', depth + 1);
    }
  };
  await walk(dir, '', 0);
  const hit = matchMedia(want, entries);
  for (const [id, e] of hit) { try { files.set(id, await (e as any).handle.getFile()); await putH(id, (e as any).handle); } catch { /* */ } }
  changed();
  return { found: hit.size, missing: want.length - hit.size };
}
