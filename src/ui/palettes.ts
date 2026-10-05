// Palette di colori salvabili (testo, colore B, sfondo), con preferiti. La logica è pura e si prova da terminale;
// paletteRow costruisce il blocco nel pannello Colore.
import { favs, isFav, toggleFav, getData, setData, onPrefsChange } from './prefs.ts';
import { starButton } from './star.ts';

export interface Palette { id: string; name: string; color: string; colorB: string; bg: string; base?: boolean }
export type Colors = { color: string; colorB: string; bg: string };

/** Palette di partenza (non si possono eliminare, ma si possono mettere tra i preferiti). */
export const BASE_PALETTES: Palette[] = [
  { id: 'base:moto', name: 'MOTO', color: '#efece6', colorB: '#ff4d00', bg: '#121212', base: true },
  { id: 'base:carta', name: 'Carta e inchiostro', color: '#111111', colorB: '#e63946', bg: '#f4f1ea', base: true },
  { id: 'base:notte', name: 'Notte elettrica', color: '#f5f5f5', colorB: '#00e1ff', bg: '#0b0f1a', base: true },
  { id: 'base:menta', name: 'Menta', color: '#0f2a24', colorB: '#0f9d77', bg: '#eefaf5', base: true },
  { id: 'base:mono', name: 'Mono chiaro', color: '#ffffff', colorB: '#a3a3a3', bg: '#0a0a0a', base: true },
  { id: 'base:sabbia', name: 'Sabbia', color: '#2b2118', colorB: '#c2410c', bg: '#f3e9d8', base: true },
];

const DATA_KEY = 'palettes';
const norm = (h: string) => (h || '').trim().toLowerCase();
export const sameColors = (p: Colors, c: Colors) => norm(p.color) === norm(c.color) && norm(p.colorB) === norm(c.colorB) && norm(p.bg) === norm(c.bg);

/** Id nuovo, univoco, a partire dal nome. */
export function makeId(name: string, existing: string[]): string {
  const slug = (name || 'palette').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'palette';
  let id = 'u:' + slug, n = 2;
  while (existing.includes(id)) id = `u:${slug}-${n++}`;
  return id;
}

/** Ordine di visualizzazione: preferiti (nell'ordine in cui sono stati aggiunti), poi le personali (le più recenti prima), poi quelle di base. */
export function orderPalettes(custom: Palette[], favIds: string[]): Palette[] {
  const all = [...custom.slice().reverse(), ...BASE_PALETTES];
  const byId = new Map(all.map(p => [p.id, p]));
  const fav = favIds.map(id => byId.get(id)).filter((p): p is Palette => !!p);
  return [...fav, ...all.filter(p => !favIds.includes(p.id))];
}

export const customPalettes = (): Palette[] => (getData<Palette[]>(DATA_KEY, []) || []).filter(p => p && p.id && p.color);
export function savePalette(name: string, c: Colors): Palette {
  const list = customPalettes();
  const p: Palette = { id: makeId(name, [...list.map(x => x.id), ...BASE_PALETTES.map(x => x.id)]), name: name.trim().slice(0, 40) || 'Palette', color: c.color, colorB: c.colorB, bg: c.bg };
  setData(DATA_KEY, [...list, p]);
  return p;
}
export function deletePalette(id: string) {
  setData(DATA_KEY, customPalettes().filter(p => p.id !== id));
  if (isFav('palette', id)) toggleFav('palette', id);
}

export interface PaletteDeps { current: () => Colors; apply: (p: Palette) => void }

export function paletteRow(d: PaletteDeps): HTMLElement {
  const root = document.createElement('div');
  root.className = 'pals';
  const head = document.createElement('div'); head.className = 'pals-h';
  const lab = document.createElement('span'); lab.textContent = 'Palette';
  const add = document.createElement('button'); add.type = 'button'; add.className = 'btn sm'; add.textContent = 'Salva palette';
  head.append(lab, add);
  const form = document.createElement('div'); form.className = 'pals-f'; form.hidden = true;
  const name = document.createElement('input'); name.type = 'text'; name.className = 'in'; name.placeholder = 'Nome della palette'; name.maxLength = 40; name.setAttribute('aria-label', 'Nome della palette');
  const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'btn sm pri'; ok.textContent = 'Salva';
  const no = document.createElement('button'); no.type = 'button'; no.className = 'btn sm'; no.textContent = 'Annulla';
  form.append(name, ok, no);
  const list = document.createElement('div'); list.className = 'pals-l';
  root.append(head, form, list);

  const render = () => {
    const cur = d.current();
    list.innerHTML = '';
    for (const p of orderPalettes(customPalettes(), favs('palette'))) {
      const chip = document.createElement('div');
      chip.className = 'pal' + (sameColors(p, cur) ? ' cur' : '');
      chip.setAttribute('role', 'button'); chip.tabIndex = 0; chip.title = p.name;
      const sw = document.createElement('span'); sw.className = 'pal-sw';
      for (const c of [p.bg, p.color, p.colorB]) { const i = document.createElement('i'); i.style.background = c; sw.appendChild(i); }
      const nm = document.createElement('span'); nm.className = 'pal-n'; nm.textContent = p.name;
      chip.append(sw, nm);
      const st = starButton(isFav('palette', p.id), () => toggleFav('palette', p.id), 'Preferita: ' + p.name); st.classList.add('pal-s'); chip.appendChild(st);
      if (!p.base) { const x = document.createElement('button'); x.type = 'button'; x.className = 'pk-x pal-x'; x.textContent = '×'; x.title = 'Elimina la palette'; x.setAttribute('aria-label', 'Elimina ' + p.name); x.onclick = e => { e.stopPropagation(); deletePalette(p.id); }; chip.appendChild(x); }
      chip.onclick = () => d.apply(p);
      chip.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === chip) { e.preventDefault(); d.apply(p); } };
      list.appendChild(chip);
    }
  };
  const hideForm = () => { form.hidden = true; add.hidden = false; name.value = ''; };
  add.onclick = () => { form.hidden = false; add.hidden = true; name.focus(); };
  no.onclick = hideForm;
  const commit = () => { const n = name.value.trim(); if (!n) { name.focus(); return; } savePalette(n, d.current()); hideForm(); };
  ok.onclick = commit;
  name.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hideForm(); } };
  const off = onPrefsChange(() => { if (root.isConnected) render(); else off(); });
  render();
  (root as any)._refresh = render;
  return root;
}
