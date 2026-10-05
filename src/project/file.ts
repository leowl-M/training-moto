// File di progetto .moto: tutto il progetto in un file JSON (scene, sequenza, immagini e SVG dentro, font caricati dentro),
// mentre video e audio restano nella loro cartella e si ritrovano dal percorso relativo alla cartella collegata
// (o, se la cartella è stata riorganizzata, dal nome e dalla dimensione del file).

export const FORMAT = 'moto-project', VERSION = 1;
export interface MediaRef { id: string; name: string; size?: number; path?: string | null }
export interface FolderEntry { path: string; name: string; size: number }

/** Il file trovato nella cartella per ogni media: prima lo stesso percorso, poi stesso nome e dimensione, poi solo lo stesso nome (se unico). */
export function matchMedia(media: MediaRef[], files: FolderEntry[]): Map<string, FolderEntry> {
  const out = new Map<string, FolderEntry>(), byPath = new Map(files.map(f => [f.path, f]));
  const strip = (p: string) => p.split('/').slice(1).join('/');          // la cartella scelta può essere quella sopra o quella dentro
  for (const m of media) {
    let f = m.path ? byPath.get(m.path) || files.find(x => strip(x.path) === m.path || x.path === strip(m.path!)) : undefined;
    if (!f) f = files.find(x => x.name === m.name && (m.size == null || x.size === m.size));
    if (!f) { const same = files.filter(x => x.name === m.name); if (same.length === 1) f = same[0]; }
    if (f) out.set(m.id, f);
  }
  return out;
}

/** Riconosce un file di progetto (o un vecchio preset .json, che si apre come prima). */
export function kindOfFile(d: any): 'project' | 'preset' | null {
  if (d && d.format === FORMAT && d.state && typeof d.state === 'object') return 'project';
  if (d && typeof d === 'object' && ('text' in d || 'inS' in d || 'seq' in d)) return 'preset';
  return null;
}

/** I font nelle scene vanno per nome (l'indice cambia da un computer all'altro). */
export function fontsToNames(st: any, nameOf: (i: number) => string | undefined) {
  const one = (o: any) => { if (o && typeof o.font === 'number') o.fontName = nameOf(o.font); };
  one(st); (st.blocks || []).forEach(one);
  for (const c of st.seq?.clips || []) if (c.scene) { one(c.scene); (c.scene.blocks || []).forEach(one); }
  return st;
}
export function namesToFonts(st: any, indexOf: (name: string) => number) {
  const one = (o: any) => { if (o && o.fontName) { const i = indexOf(o.fontName); if (i >= 0) o.font = i; } };
  (st.blocks || []).forEach(one);
  for (const c of st.seq?.clips || []) if (c.scene) { one(c.scene); (c.scene.blocks || []).forEach(one); delete c.scene.fontName; }
  return st;
}

export const toB64 = (buf: ArrayBuffer) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
export const fromB64 = (b: string) => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
export const projectName = (fileName: string) => fileName.replace(/\.moto$/i, '').replace(/\.json$/i, '') || 'Senza titolo';

/* ---------- progetti recenti (le "maniglie" dei file restano in questo browser) ---------- */
const DB = 'moto-projects', ST = 'recent';
function db(): Promise<IDBDatabase> { return new Promise((ok, ko) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'key' }); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }); }
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((ok, ko) => { const tx = d.transaction(ST, mode), rq = fn(tx.objectStore(ST)); rq.onsuccess = () => ok(rq.result); rq.onerror = () => ko(rq.error); });
}
export interface Recent { key: string; name: string; when: number; handle: any }
export async function addRecent(handle: any, key?: string): Promise<string> {
  const all = await listRecent();
  for (const r of all) if (await handle.isSameEntry?.(r.handle).catch?.(() => false)) key = key || r.key;
  const k = key || 'p' + Date.now().toString(36);
  await idb('readwrite', s => s.put({ key: k, name: projectName(handle.name), when: Date.now(), handle })).catch(() => null);
  return k;
}
export async function listRecent(): Promise<Recent[]> { try { return ((await idb<Recent[]>('readonly', s => s.getAll())) || []).sort((a, b) => b.when - a.when); } catch { return []; } }
export async function getRecent(key: string): Promise<Recent | null> { try { return (await idb<Recent>('readonly', s => s.get(key))) || null; } catch { return null; } }
export async function removeRecent(key: string) { await idb('readwrite', s => s.delete(key)).catch(() => null); }
