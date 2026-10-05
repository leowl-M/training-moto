// Selettore con ricerca, preferiti e recenti. Sostituisce l'aspetto di un <select> senza toccarne la logica:
// il <select> resta nel documento (nascosto) e riceve value e evento "change", così il codice esistente continua a funzionare.
import { favs, isFav, toggleFav, recents, pushRecent } from './prefs';
import { starButton } from './star';

export interface PickerOpts {
  /** Ambito dei preferiti e dei recenti (es. 'fx', 'ease', 'font', 'loop'). */
  scope: string;
  /** Identificatore stabile di un'opzione (default: il value). Per i font è il nome, perché gli indici cambiano. */
  key?: (o: HTMLOptionElement) => string;
  /** Famiglia di font con cui scrivere l'opzione (anteprima dei font). */
  preview?: (o: HTMLOptionElement) => string | undefined;
  /** Opzioni che si possono rimuovere (es. font caricati). */
  removable?: (o: HTMLOptionElement) => boolean;
  onRemove?: (o: HTMLOptionElement) => void;
}
export interface Picker { sync(): void; close(): void }

interface Item { o: HTMLOptionElement; k: string; label: string; group: string }
let current: { close(): void } | null = null;

export function enhanceSelect(sel: HTMLSelectElement, opts: PickerOpts): Picker {
  const keyOf = opts.key || ((o: HTMLOptionElement) => o.value);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pk';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  const label = sel.getAttribute('aria-label') || sel.closest('.row')?.querySelector('label')?.textContent || opts.scope;
  btn.setAttribute('aria-label', label);
  const labelledBy = sel.getAttribute('aria-labelledby');
  if (labelledBy) btn.setAttribute('aria-labelledby', labelledBy);
  const txt = document.createElement('span'); txt.className = 'pk-t';
  const caret = document.createElement('i'); caret.className = 'pk-c';
  btn.append(txt, caret);
  sel.style.display = 'none';
  sel.after(btn);

  const sync = () => {
    const o = sel.selectedOptions[0];
    txt.textContent = o ? (o.textContent || '').trim() : '';
    txt.style.fontFamily = (o && opts.preview && opts.preview(o)) || '';
  };
  sync();

  const items = (): Item[] => [...sel.querySelectorAll('option')].map(o => ({
    o: o as HTMLOptionElement, k: keyOf(o as HTMLOptionElement), label: (o.textContent || '').trim(),
    group: o.parentElement instanceof HTMLOptGroupElement ? o.parentElement.label : '',
  }));

  let pop: HTMLDivElement | null = null;
  let offDoc: (() => void) | null = null;

  const close = () => {
    if (!pop) return;
    pop.remove(); pop = null; offDoc && offDoc(); offDoc = null;
    btn.setAttribute('aria-expanded', 'false');
    if (current && current.close === close) current = null;
  };

  const choose = (it: Item) => {
    sel.value = it.o.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    pushRecent(opts.scope, it.k);
    sync(); close(); btn.focus();
  };

  const open = () => {
    if (pop) return close();
    current && current.close();
    current = { close };
    pop = document.createElement('div');
    pop.className = 'pkpop';
    pop.setAttribute('role', 'listbox');
    const input = document.createElement('input');
    input.type = 'text'; input.className = 'in pk-q'; input.placeholder = 'Cerca'; input.setAttribute('aria-label', 'Cerca');
    const list = document.createElement('div'); list.className = 'pk-l';
    pop.append(input, list);
    document.body.appendChild(pop);
    btn.setAttribute('aria-expanded', 'true');

    const r = btn.getBoundingClientRect();
    const w = Math.max(r.width, 260);
    pop.style.width = w + 'px';
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
    const below = innerHeight - r.bottom - 12, above = r.top - 12;
    const up = below < 220 && above > below;
    pop.style.maxHeight = Math.min(380, up ? above : below) + 'px';
    if (up) pop.style.bottom = (innerHeight - r.top + 4) + 'px'; else pop.style.top = (r.bottom + 4) + 'px';

    let hl = -1; let rows: { el: HTMLElement; it: Item }[] = [];
    const highlight = (i: number) => {
      rows.forEach((x, j) => x.el.classList.toggle('hl', j === i));
      hl = i; if (rows[i]) rows[i].el.scrollIntoView({ block: 'nearest' });
    };

    const render = () => {
      const q = input.value.trim().toLowerCase();
      const all = items(); const curVal = sel.value;
      const byKey = new Map(all.map(i => [i.k, i]));
      const fav = favs(opts.scope).map(k => byKey.get(k)).filter(Boolean) as Item[];
      const rec = recents(opts.scope).map(k => byKey.get(k)).filter((i): i is Item => !!i && !isFav(opts.scope, i.k)).slice(0, 5);
      list.innerHTML = ''; rows = [];
      const head = (t: string, star = false) => { const h = document.createElement('div'); h.className = 'pk-h' + (star ? ' fav' : ''); h.textContent = t; list.appendChild(h); };
      const row = (it: Item) => {
        const d = document.createElement('div');
        d.className = 'pk-i' + (it.o.value === curVal ? ' cur' : '');
        d.setAttribute('role', 'option'); d.setAttribute('aria-selected', String(it.o.value === curVal));
        const name = document.createElement('span'); name.className = 'pk-n'; name.textContent = it.label;
        const ff = opts.preview && opts.preview(it.o); if (ff) name.style.fontFamily = ff;
        d.appendChild(name);
        if (opts.removable && opts.removable(it.o)) {
          const x = document.createElement('button'); x.type = 'button'; x.className = 'pk-x'; x.textContent = '×'; x.title = 'Rimuovi dalla libreria'; x.setAttribute('aria-label', 'Rimuovi');
          x.onclick = e => { e.stopPropagation(); opts.onRemove && opts.onRemove(it.o); render(); };
          d.appendChild(x);
        }
        d.appendChild(starButton(isFav(opts.scope, it.k), () => { toggleFav(opts.scope, it.k); const s = list.scrollTop; render(); list.scrollTop = s; }));
        d.onclick = () => choose(it);
        d.onpointermove = () => { const i = rows.findIndex(x => x.el === d); if (i !== hl) highlight(i); };
        list.appendChild(d); rows.push({ el: d, it });
      };
      if (q) {
        const hit = all.filter(i => (i.label + ' ' + i.group).toLowerCase().includes(q));
        hit.sort((a, b) => Number(isFav(opts.scope, b.k)) - Number(isFav(opts.scope, a.k)));
        if (!hit.length) { const e = document.createElement('div'); e.className = 'pk-e'; e.textContent = 'Nessun risultato'; list.appendChild(e); }
        hit.forEach(row);
      } else {
        if (fav.length) { head('Preferiti', true); fav.forEach(row); }
        if (rec.length) { head('Recenti'); rec.forEach(row); }
        let g: string | null = null;
        for (const it of all) { if (it.group !== g) { g = it.group; if (g) head(g); } row(it); }
      }
      const ci = rows.findIndex(x => x.it.o.value === curVal);
      highlight(q ? 0 : Math.max(0, ci));
    };
    render();
    input.oninput = render;
    input.onkeydown = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); highlight(Math.min(rows.length - 1, hl + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(Math.max(0, hl - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (rows[hl]) choose(rows[hl].it); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); btn.focus(); }
    };
    const onDown = (e: Event) => { if (pop && !pop.contains(e.target as Node) && !btn.contains(e.target as Node)) close(); };
    const onScroll = (e: Event) => { if (pop && !pop.contains(e.target as Node)) close(); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('scroll', onScroll, true);
    addEventListener('resize', close);
    offDoc = () => { document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('scroll', onScroll, true); removeEventListener('resize', close); };
    input.focus();
    const sc = list.querySelector('.cur'); if (sc) (sc as HTMLElement).scrollIntoView({ block: 'center' });
  };

  btn.onclick = open;
  btn.onkeydown = e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); } };
  const p: Picker = { sync, close };
  (sel as any)._pk = p;
  return p;
}
