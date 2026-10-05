// Libreria dei font caricati dall'utente, salvata nel browser (IndexedDB) così non si perdono al ricaricamento.
// I file restano sul computer: non vengono inviati da nessuna parte.

export interface StoredFont { name: string; label: string; file: string; data: ArrayBuffer; added: number }

const DB = 'moto', STORE = 'fonts';

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(STORE, { keyPath: 'name' }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((res, rej) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); res(r.result); };
    t.onerror = () => { db.close(); rej(t.error); };
    t.onabort = () => { db.close(); rej(t.error); };
  });
}

export async function saveFont(f: StoredFont): Promise<boolean> { try { await tx('readwrite', s => s.put(f)); return true; } catch { return false; } }
export async function listFonts(): Promise<StoredFont[]> { try { return ((await tx('readonly', s => s.getAll())) as StoredFont[]).sort((a, b) => a.added - b.added); } catch { return []; } }
export async function deleteFont(name: string): Promise<void> { try { await tx('readwrite', s => s.delete(name)); } catch { /* ignora */ } }
