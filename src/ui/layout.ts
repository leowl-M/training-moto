// Disposizione dei pannelli: larghezze ridimensionabili, pannelli richiudibili e aree di lavoro.
// Le funzioni di calcolo sono pure (si provano da terminale); initLayout collega tutto al documento.
import { getUI, setUI } from './prefs.ts';

export type Panel = 'lib' | 'insp';
export type Tab = 'stile' | 'anim' | 'grafica' | 'scena' | 'tempo';

export interface Workspace { id: string; name: string; lib: number; insp: number; tab: Tab; hint: string }

/** Aree di lavoro disponibili. Larghezza 0 = pannello chiuso. L'id "motion" resta per le preferenze già salvate (ora si chiama Testo). */
export const WORKSPACES: Workspace[] = [
  { id: 'completo', name: 'Completo', lib: 280, insp: 360, tab: 'stile', hint: 'Tutto a vista' },
  { id: 'motion', name: 'Testo', lib: 340, insp: 380, tab: 'anim', hint: 'Libreria degli effetti larga e animazioni del testo' },
  { id: 'grafica', name: 'Grafica', lib: 0, insp: 420, tab: 'grafica', hint: 'Libreria chiusa, SVG e anteprima grande' },
  { id: 'montaggio', name: 'Montaggio', lib: 0, insp: 340, tab: 'tempo', hint: 'Libreria chiusa, tempi in primo piano' },
];

export const LIMITS: Record<Panel, { min: number; max: number }> = { lib: { min: 200, max: 520 }, insp: { min: 260, max: 560 } };
export const COLLAPSE_BELOW = 110;      // trascinando sotto questa larghezza il pannello si chiude
export const MIN_CENTER = 360;          // larghezza minima dell'anteprima

export const workspaceById = (id: string) => WORKSPACES.find(w => w.id === id) || WORKSPACES[0];

/** Larghezza finale di un pannello dopo un trascinamento: 0 se è stato spinto quasi a zero, altrimenti entro i limiti e senza schiacciare l'anteprima. */
export function clampWidth(panel: Panel, px: number, total: number, other: number): number {
  if (px < COLLAPSE_BELOW) return 0;
  const { min, max } = LIMITS[panel];
  const room = Math.max(min, total - other - MIN_CENTER);
  return Math.round(Math.max(min, Math.min(max, room, px)));
}

/** Larghezza da usare quando si riapre un pannello chiuso. */
export const reopenWidth = (panel: Panel, ws: Workspace) => (ws[panel] > 0 ? ws[panel] : Math.round((LIMITS[panel].min + 280) / 2 + 40));

export interface LayoutDeps { main: HTMLElement; onTab: (t: Tab) => void; onResize: () => void }

export function initLayout(d: LayoutDeps) {
  const { main } = d;
  const widths: Record<Panel, number> = { lib: getUI('w:lib', -1), insp: getUI('w:insp', -1) };
  let wsId = getUI('ws', 'completo');
  if (widths.lib < 0 || widths.insp < 0) { const w = workspaceById(wsId); widths.lib = w.lib; widths.insp = w.insp; }
  const listeners = new Set<() => void>();
  // adatta le larghezze allo spazio disponibile: l'anteprima non scende sotto il minimo
  const fit = () => {
    const total = main.clientWidth;
    widths.insp = widths.insp ? clampWidth('insp', widths.insp, total, widths.lib) : 0;
    widths.lib = widths.lib ? clampWidth('lib', widths.lib, total, widths.insp) : 0;
  };

  const apply = () => {
    main.style.setProperty('--libw', widths.lib + 'px');
    main.style.setProperty('--inspw', widths.insp + 'px');
    main.classList.toggle('lib-closed', widths.lib === 0);
    main.classList.toggle('insp-closed', widths.insp === 0);
    document.getElementById('bPL')?.setAttribute('aria-pressed', String(widths.lib > 0));
    document.getElementById('bPR')?.setAttribute('aria-pressed', String(widths.insp > 0));
    document.getElementById('bPL')?.classList.toggle('on', widths.lib > 0);
    document.getElementById('bPR')?.classList.toggle('on', widths.insp > 0);
    listeners.forEach(f => f());
    d.onResize();
  };
  const persist = () => { setUI('w:lib', widths.lib); setUI('w:insp', widths.insp); };
  const markWs = () => document.querySelectorAll('#wsSeg button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.ws === wsId));

  const set = (panel: Panel, px: number, save = true) => {
    const other = widths[panel === 'lib' ? 'insp' : 'lib'];
    widths[panel] = clampWidth(panel, px, main.clientWidth, other);
    apply(); if (save) persist();
  };
  const toggle = (panel: Panel) => set(panel, widths[panel] > 0 ? 0 : reopenWidth(panel, workspaceById(wsId)));

  function setWorkspace(id: string) {
    const w = workspaceById(id); wsId = w.id; setUI('ws', wsId);
    widths.lib = w.lib; widths.insp = w.insp; fit(); persist(); apply(); d.onTab(w.tab); markWs();
  }

  function bindGutter(el: HTMLElement, panel: Panel) {
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return; e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('on'); document.body.classList.add('resizing');
      const rect = main.getBoundingClientRect();
      const mv = (ev: PointerEvent) => set(panel, panel === 'lib' ? ev.clientX - rect.left : rect.right - ev.clientX, false);
      const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.classList.remove('on'); document.body.classList.remove('resizing'); persist(); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
    el.addEventListener('dblclick', () => set(panel, widths[panel] > 0 && widths[panel] === workspaceById(wsId)[panel] ? 0 : reopenWidth(panel, workspaceById(wsId))));
    el.addEventListener('keydown', e => {
      const step = e.shiftKey ? 48 : 16, sign = panel === 'lib' ? 1 : -1;
      if (e.key === 'ArrowLeft') { e.preventDefault(); set(panel, (widths[panel] || 0) - sign * step); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); set(panel, (widths[panel] || 0) + sign * step); }
      else if (e.key === 'Enter') { e.preventDefault(); toggle(panel); }
    });
  }

  bindGutter(document.getElementById('gLib') as HTMLElement, 'lib');
  bindGutter(document.getElementById('gInsp') as HTMLElement, 'insp');
  document.querySelectorAll('#wsSeg button').forEach(b => b.addEventListener('click', () => setWorkspace((b as HTMLElement).dataset.ws!)));
  document.getElementById('bPL')?.addEventListener('click', () => toggle('lib'));
  document.getElementById('bPR')?.addEventListener('click', () => toggle('insp'));
  addEventListener('resize', () => { if (widths.lib || widths.insp) set(widths.lib ? 'lib' : 'insp', widths[widths.lib ? 'lib' : 'insp'], false); });

  fit(); apply(); markWs();
  return { toggle, setWorkspace, current: () => wsId, widths: () => ({ ...widths }) };
}
