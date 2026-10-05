// Creazione, durata e controllo di un progetto. Nessuna dipendenza dal browser: si può provare da terminale.
import type { Project, Scene, Transform, Layer } from './types.ts';

export const defaultTransform = (): Transform => ({ x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 });

export function emptyScene(id = 'scena-1', name = 'Scena 1'): Scene {
  return {
    id, name, duration: 'auto', layers: [],
    camera: { keys: [{ t: 0, pose: { x: 50, y: 50, zoom: 1, rotation: 0 } }] },
    markers: [], states: [], stateTransitions: [],
  };
}

export function createProject(name = 'Senza titolo'): Project {
  return {
    v: 3, name, format: '9:16', fps: 25, res: 1,
    background: { color: '#121212', transparent: false },
    palette: { color: '#efece6', colorB: '#ff4d00' },
    seed: 7, assets: {}, scenes: [emptyScene()],
  };
}

/** Fine di un livello, in secondi dall'inizio della scena. */
export const layerEnd = (l: Layer) => l.start + l.duration;

/** Durata di una scena: quella indicata, oppure la fine del livello che finisce per ultimo. */
export function sceneDuration(scene: Scene): number {
  if (typeof scene.duration === 'number') return scene.duration;
  return scene.layers.reduce((m, l) => Math.max(m, layerEnd(l)), 0);
}

export const projectDuration = (p: Project) => p.scenes.reduce((s, sc) => s + sceneDuration(sc), 0);

/** Elenco dei problemi trovati (vuoto = progetto coerente). */
export function validateProject(p: any): string[] {
  const err: string[] = [];
  if (!p || typeof p !== 'object') return ['il progetto non è un oggetto'];
  if (p.v !== 3) err.push(`versione non supportata: ${p.v}`);
  if (!Array.isArray(p.scenes) || !p.scenes.length) { err.push('nessuna scena'); return err; }
  const assets = p.assets || {};
  for (const sc of p.scenes as Scene[]) {
    const ids = new Set<string>();
    for (const l of sc.layers || []) {
      if (ids.has(l.id)) err.push(`${sc.id}: id livello duplicato "${l.id}"`);
      ids.add(l.id);
      if (!(l.duration >= 0)) err.push(`${sc.id}/${l.id}: durata non valida`);
      if (!(l.start >= 0)) err.push(`${sc.id}/${l.id}: inizio non valido`);
      const a = (l as any).asset;
      if (a && !assets[a]) err.push(`${sc.id}/${l.id}: risorsa mancante "${a}"`);
    }
    for (const l of sc.layers || []) {
      if (l.parent && !ids.has(l.parent)) err.push(`${sc.id}/${l.id}: genitore inesistente "${l.parent}"`);
      let cur: Layer | undefined = l; const seen = new Set<string>();
      while (cur && cur.parent) {
        if (seen.has(cur.id)) { err.push(`${sc.id}/${l.id}: genitori in ciclo`); break; }
        seen.add(cur.id); cur = sc.layers.find(x => x.id === cur!.parent);
      }
    }
    for (const st of sc.states || []) for (const id of Object.keys(st.layers)) if (!ids.has(id)) err.push(`${sc.id}: lo stato "${st.id}" cita un livello inesistente "${id}"`);
    for (const tr of sc.stateTransitions || []) for (const s of [tr.from, tr.to]) if (!(sc.states || []).some(x => x.id === s)) err.push(`${sc.id}: transizione verso uno stato inesistente "${s}"`);
    const f = sc.camera && sc.camera.follow;
    if (f && f.target && (f.target as any).layer && !ids.has((f.target as any).layer)) err.push(`${sc.id}: la camera segue un livello inesistente`);
  }
  return err;
}

export const serializeProject = (p: Project) => JSON.stringify(p, null, 2);

export function parseProject(text: string): Project {
  const p = JSON.parse(text);
  const problems = validateProject(p);
  if (problems.length) throw new Error('Progetto non valido: ' + problems.join('; '));
  return p as Project;
}
