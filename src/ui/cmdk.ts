// Ricerca ovunque (⌘K): azioni, effetti, font, sezioni, blocchi. I comandi si costruiscono ogni volta che si apre,
// così riflettono lo stato di quel momento.
import { isFav } from './prefs.ts';

export interface Command {
  id: string;
  title: string;
  group: string;
  hint?: string;
  keywords?: string;
  run: () => void;
  fav?: { scope: string; id: string };
}

export function scoreCommand(c: Command, q: string): number {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return 0;
  const title = c.title.toLowerCase();
  const hay = `${title} ${c.group.toLowerCase()} ${(c.keywords || '').toLowerCase()}`;
  let s = 0;
  for (const t of tokens) {
    const i = hay.indexOf(t);
    if (i < 0) return -1;
    s += i === 0 ? 30 : title.split(/[\s:·-]+/).some(w => w.startsWith(t)) ? 18 : title.includes(t) ? 10 : 4;
  }
  if (c.fav && isFav(c.fav.scope, c.fav.id)) s += 8;
  return s;
}

export function initPalette(getCommands: () => Command[]) {
  let root: HTMLDivElement | null = null, input: HTMLInputElement, list: HTMLDivElement;
  let cmds: Command[] = [], rows: { el: HTMLElement; c: Command }[] = [], hl = 0;

  const build = () => {
    root = document.createElement('div');
    root.className = 'cmdk';
    root.innerHTML = '<div class="cmdk-box" role="dialog" aria-label="Cerca ovunque"><input class="in cmdk-in" type="text" placeholder="Cerca un effetto, un comando, un font…" aria-label="Cerca ovunque" autocomplete="off" spellcheck="false"><div class="cmdk-l" role="listbox"></div><div class="cmdk-f"><span><kbd>↑</kbd> <kbd>↓</kbd> naviga</span><span><kbd>↵</kbd> esegui</span><span><kbd>esc</kbd> chiudi</span></div></div>';
    document.body.appendChild(root);
    input = root.querySelector('.cmdk-in') as HTMLInputElement;
    list = root.querySelector('.cmdk-l') as HTMLDivElement;
    root.addEventListener('pointerdown', e => { if (e.target === root) close(); });
    input.oninput = render;
    input.onkeydown = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); mark(Math.min(rows.length - 1, hl + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mark(Math.max(0, hl - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (rows[hl]) exec(rows[hl].c); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    };
  };

  const mark = (i: number) => { rows.forEach((r, j) => r.el.classList.toggle('hl', j === i)); hl = i; rows[i] && rows[i].el.scrollIntoView({ block: 'nearest' }); };

  const render = () => {
    const q = input.value.trim();
    let res: Command[];
    if (q) res = cmds.map(c => ({ c, s: scoreCommand(c, q) })).filter(x => x.s >= 0).sort((a, b) => b.s - a.s).slice(0, 60).map(x => x.c);
    else { const seen: Record<string, number> = {}; res = cmds.filter(c => (seen[c.group] = (seen[c.group] || 0) + 1) <= 6); }
    list.innerHTML = ''; rows = [];
    if (!res.length) { const e = document.createElement('div'); e.className = 'pk-e'; e.textContent = 'Nessun risultato'; list.appendChild(e); return; }
    let g = '';
    for (const c of res) {
      if (!q && c.group !== g) { g = c.group; const h = document.createElement('div'); h.className = 'pk-h'; h.textContent = g; list.appendChild(h); }
      const d = document.createElement('div'); d.className = 'pk-i'; d.setAttribute('role', 'option');
      const n = document.createElement('span'); n.className = 'pk-n'; n.textContent = c.title; d.appendChild(n);
      if (q) { const gr = document.createElement('span'); gr.className = 'cmdk-g'; gr.textContent = c.group; d.appendChild(gr); }
      if (c.hint) { const k = document.createElement('kbd'); k.textContent = c.hint; d.appendChild(k); }
      d.onclick = () => exec(c);
      d.onpointermove = () => { const i = rows.findIndex(x => x.el === d); if (i !== hl) mark(i); };
      list.appendChild(d); rows.push({ el: d, c });
    }
    mark(0);
  };

  const exec = (c: Command) => { close(); try { c.run(); } catch (e) { console.error(e); } };
  const open = () => { if (!root) build(); cmds = getCommands(); root!.classList.add('on'); input.value = ''; render(); input.focus(); };
  const close = () => { root && root.classList.remove('on'); };
  const isOpen = () => !!root && root.classList.contains('on');
  return { open, close, toggle: () => (isOpen() ? close() : open()), isOpen };
}
