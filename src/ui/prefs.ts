// Preferenze dell'interfaccia: preferiti, recenti, sezioni aperte/chiuse, larghezza dei pannelli e dati personali (palette).
// Si salvano nel browser, per indirizzo (per questo la porta del server è fissa: localhost:5173).

export interface Prefs {
  fav: Record<string, string[]>;      // per ambito (effetti, loop, curve, font, palette…): elenco di id, nell'ordine in cui sono stati aggiunti
  recent: Record<string, string[]>;   // ultimi usati, il più recente per primo
  open: Record<string, boolean>;      // sezioni aperte (tutte chiuse di default)
  ui: Record<string, any>;            // valori semplici dell'interfaccia: larghezza pannelli, area di lavoro, scheda attiva…
  data: Record<string, any>;          // dati dell'utente: palette salvate…
}

const KEY = 'moto:prefs';
const MAX_RECENT = 8;
const listeners = new Set<() => void>();

const empty = (): Prefs => ({ fav: {}, recent: {}, open: {}, ui: {}, data: {} });
const shape = (j: any): Prefs => ({ fav: j.fav || {}, recent: j.recent || {}, open: j.open || {}, ui: j.ui || {}, data: j.data || {} });

function read(): Prefs {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (j && typeof j === 'object') return shape(j);
  } catch { /* storage non disponibile: si parte da zero */ }
  return empty();
}

let P: Prefs = read();

function save(notify: boolean) {
  try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* ignora */ }
  if (notify) listeners.forEach(f => f());
}

/** Rilegge le preferenze dal browser (usato dopo un'importazione e nei test). */
export function reloadPrefs() { P = read(); listeners.forEach(f => f()); }

/** Si avvisa quando cambiano preferiti, recenti o dati. */
export function onPrefsChange(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }

/* ---------------------------------------------------------------- preferiti */
export const favs = (scope: string): string[] => P.fav[scope] || [];
export const isFav = (scope: string, id: string) => favs(scope).includes(id);
export function toggleFav(scope: string, id: string): boolean {
  const list = (P.fav[scope] ||= []);
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1); else list.push(id);
  save(true);
  return i < 0;
}

/* ---------------------------------------------------------------- recenti */
export const recents = (scope: string): string[] => P.recent[scope] || [];
export function pushRecent(scope: string, id: string) {
  const list = (P.recent[scope] ||= []);
  if (list[0] === id) return;
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  list.unshift(id);
  if (list.length > MAX_RECENT) list.length = MAX_RECENT;
  save(true);
}

/* ---------------------------------------------------------------- sezioni aperte */
export const isOpen = (key: string, def = false) => (key in P.open ? P.open[key] : def);
export function setOpen(key: string, open: boolean) { P.open[key] = open; save(false); }

/* ---------------------------------------------------------------- valori dell'interfaccia (non avvisano chi ascolta) */
export function getUI<T>(key: string, def: T): T { return key in P.ui ? (P.ui[key] as T) : def; }
export function setUI(key: string, value: any) { P.ui[key] = value; save(false); }

/* ---------------------------------------------------------------- dati dell'utente (avvisano chi ascolta) */
export function getData<T>(key: string, def: T): T { return key in P.data ? (P.data[key] as T) : def; }
export function setData(key: string, value: any) { P.data[key] = value; save(true); }

/* ---------------------------------------------------------------- copia di sicurezza */
export const exportPrefs = () => JSON.stringify(P, null, 2);
export function importPrefs(text: string) {
  const j = JSON.parse(text);
  if (!j || typeof j !== 'object') throw new Error('Preferenze non valide');
  P = shape(j);
  save(true);
}
