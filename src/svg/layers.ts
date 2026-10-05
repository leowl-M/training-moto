// Livelli del file SVG: le parti che si possono animare ciascuna per conto suo (i gruppi e le forme con il loro nome di Figma).
// Un gruppo con un nome diventa un livello solo, a meno che non contenga tutto il disegno (è il contenitore: allora contano le forme).
type Box = [number, number, number, number];
const unionBox = (bs: Box[]): Box => { const x0 = Math.min(...bs.map(b => b[0])), y0 = Math.min(...bs.map(b => b[1])), x1 = Math.max(...bs.map(b => b[0] + b[2])), y1 = Math.max(...bs.map(b => b[1] + b[3])); return [x0, y0, x1 - x0, y1 - y0]; };

interface ElLike { i: number; name: string; group: string; bb: Box; role: string; anc?: string[] }
export interface FileLayer { key: string; els: number[]; bb: Box }

export function fileLayers(els: ElLike[]): FileLayer[] {
  const list = els.filter(e => e.role !== 'guide'), count = new Map<string, number>();
  // contenitori: gruppi che contengono tutto il disegno (l'icona intera): non sono livelli. Per ogni forma conta il gruppo più vicino che non lo è.
  const cont = new Set<string>();
  if (list.length && list.every(e => e.anc)) for (const g of list[0].anc!) if (list.every(e => e.anc!.includes(g))) cont.add(g);
  const near = (e: ElLike) => (e.anc ? e.anc.find(g => !cont.has(g)) || '' : e.group);
  for (const e of list) { const g = near(e); if (g) count.set(g, (count.get(g) || 0) + 1); }
  const out = new Map<string, number[]>(), used = new Map<string, number>();
  for (const e of list) {
    // il gruppo conta se raccoglie più forme (ma non tutto il disegno); una forma sola in un gruppo usa il suo nome, o quello del gruppo se non ne ha
    const g = near(e), grp = !!g && count.get(g)! > 1 && count.get(g)! < list.length;
    let key = grp ? g : e.name || g || '';
    if (!key) key = 'Forma ' + (e.i + 1);
    // forme diverse con lo stesso nome (senza gruppo comune): restano separate
    if (!grp && out.has(key)) { const k = (used.get(key) || 1) + 1; used.set(key, k); key = `${key} ${k}`; }
    if (!out.has(key)) out.set(key, []);
    out.get(key)!.push(e.i);
  }
  const byI = new Map(list.map(e => [e.i, e]));
  return [...out.entries()].map(([key, ids]) => ({ key, els: ids, bb: unionBox(ids.map(i => byI.get(i)!.bb)) }));
}
