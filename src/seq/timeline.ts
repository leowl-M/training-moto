// Timeline a tracce: righello con marker, tracce (Grafica 2, Grafica 1, Video, Musica), clip da spostare, rifilare e selezionare.
// Il modulo disegna e gestisce i gesti; il resto dell'app decide cosa succede (tramite deps).
import { tracksOf, kindOfTrack, clipEnd, snap, snapPoints, placeOnTrack, trimStart, trimEnd, spd, fadeShape } from './seq.ts';
import type { Seq, Clip, TrackId, ClipKind } from './seq.ts';
import { getUI, setUI } from '../ui/prefs.ts';
import { trDur } from './trans.ts';

export interface TimelineDeps {
  host: HTMLElement;
  seq: () => Seq;
  total: () => number;
  T: () => number;
  setT: (T: number) => void;
  fps: () => number;
  isSelected: (id: string) => boolean;
  selection: () => string[];
  select: (id: string | null, mode?: 'only' | 'toggle') => void;   // seleziona (e, se è grafica, la apre nel pannello)
  selectMany: (ids: string[], add: boolean) => void;               // selezione con il riquadro
  tool: () => 'select' | 'razor';
  razor: (id: string, T: number) => void;                          // lama: taglia la clip in quel punto
  activeMotion: () => string | null;
  label: (c: Clip) => string;
  peaks: (c: Clip, n: number) => Float32Array | null;
  srcDur: (c: Clip) => number;                     // durata della sorgente (Infinity per la grafica)
  newMotion: (track: TrackId, T: number) => void;
  commit: () => void;                               // modifica conclusa (cronologia, ricalcoli)
  live: () => void;                                 // durante un trascinamento (ridisegna l'anteprima)
  snapOn: () => boolean;
  selMarker: () => string | null;
  selectMarker: (id: string | null) => void;
  renameMarker: (id: string) => void;
  removeTrack: (id: TrackId) => void;                // toglie una traccia vuota
  canRemove: (id: TrackId) => boolean;
  dropFiles: (dt: DataTransfer, track: TrackId, T: number) => void;   // file trascinati su una traccia
  grip?: HTMLElement | null;
  pauses?: (c: Clip) => [number, number][] | null;
  dupNow?: (ids: string[]) => string[];               // ⌥ + trascina: copie create subito al posto delle clip prese (restituisce i loro id)
  dupEnd?: (copies: string[]) => void;               // fine del trascinamento: tiene le copie che non si sovrappongono
  subs?: SubLane;                                     // corsia dei sottotitoli (in cima, solo se ci sono)
}
/** Corsia dei sottotitoli: le frasi come blocchi da spostare e rifilare (i tempi veri li tiene l'app, qui solo i gesti). */
export interface SubLane {
  segs: () => { id: string; key: string; start: number; end: number; text: string; k: number }[];   // k = velocità della clip sotto (secondi di file per secondo di timeline)
  isSel: (id: string) => boolean;
  select: (id: string | null, mode?: 'only' | 'toggle' | 'range') => void;   // ⌘ clic aggiunge o toglie, ⇧ clic seleziona fino a lì
  selectMany: (ids: string[], add: boolean) => void;                       // riquadro di selezione nel vuoto della corsia
  drag: (id: string, mode: 'l' | 'r' | 'move', dt: number, phase: 'start' | 'move' | 'end') => void;   // dt in secondi di timeline dall'inizio del gesto
  edit: (id: string) => void;                         // doppio clic: modifica il testo
}

const RULER = 22, SUB_H = 26, TRACK_H: Record<ClipKind, number> = { motion: 30, video: 40, audio: 34 };
export const TL_MIN = RULER + 60, GROW_MAX = 2.5;

/** Altezze delle tracce dentro uno spazio dato: se c'è posto crescono insieme (fino a 2,5 volte), se non c'è restano piene e la timeline scorre. */
export function trackHeights(base: number[], avail: number): number[] {
  const sum = base.reduce((a, b) => a + b, 0);
  const k = avail > 0 && sum > 0 ? Math.max(1, Math.min(GROW_MAX, avail / sum)) : 1;
  return base.map(h => Math.floor(h * k));
}

export function initTimeline(d: TimelineDeps) {
  let pps = 60;                                     // pixel per secondo
  const root = document.createElement('div'); root.className = 'stl';
  const heads = document.createElement('div'); heads.className = 'stl-heads';
  const scroll = document.createElement('div'); scroll.className = 'stl-scroll';
  const inner = document.createElement('div'); inner.className = 'stl-inner';
  const ruler = document.createElement('div'); ruler.className = 'stl-ruler';
  const ph = document.createElement('div'); ph.className = 'stl-ph';
  const cut = document.createElement('div'); cut.className = 'stl-cut'; cut.appendChild(document.createElement('span'));
  scroll.appendChild(inner); root.append(heads, scroll); d.host.appendChild(root);
  let tlH = getUI('tlH', 0);                         // altezza scelta dall'utente (0 = quanto serve alle tracce)
  const rows: Record<string, HTMLDivElement> = {};

  const xOf = (t: number) => t * pps, tOf = (x: number) => x / pps;
  const tAt = (e: PointerEvent | MouseEvent) => { const r = inner.getBoundingClientRect(); return Math.max(0, tOf(e.clientX - r.left)); };
  const tol = () => 8 / pps;
  const snapT = (v: number, except: string | null, e: { altKey: boolean }) => (d.snapOn() && !e.altKey ? snap(v, snapPoints(d.seq(), except, d.T()), tol()) : v);
  const frameRound = (v: number) => Math.round(v * d.fps()) / d.fps();

  function render() {
    const seq = d.seq(), total = Math.max(d.total(), 1), w = Math.max(scroll.clientWidth - 2, xOf(total + 4));
    inner.style.width = w + 'px';
    inner.innerHTML = ''; heads.innerHTML = '';
    // righello
    ruler.innerHTML = '';
    const lab = pps > 120 ? .5 : pps > 50 ? 1 : pps > 20 ? 2 : pps > 8 ? 5 : 10;
    for (let s = 0; s * pps <= w; s += lab) { const b = document.createElement('b'); b.style.left = xOf(s) + 'px'; b.textContent = fmt(s); ruler.appendChild(b); }
    for (const m of seq.markers) {
      // battiti della musica: tacche sottili (più alte sul primo tempo), solo per agganciarsi
      if (m.beat) { const b = document.createElement('i'); b.className = 'stl-bt' + (m.beat === 2 ? ' bar' : ''); b.style.left = xOf(m.t) + 'px'; ruler.appendChild(b); continue; }
      const k = document.createElement('i'); k.className = 'stl-mk' + (d.selMarker() === m.id ? ' sel' : ''); k.style.left = xOf(m.t) + 'px'; k.title = (m.label || 'Marker') + ' · ' + m.t.toFixed(2) + ' s · trascina, doppio clic per rinominare';
      if (m.label) { const s = document.createElement('span'); s.textContent = m.label; k.appendChild(s); }
      k.addEventListener('pointerdown', e => dragMarker(e, m.id));
      k.addEventListener('dblclick', e => { e.stopPropagation(); d.renameMarker(m.id); });
      ruler.appendChild(k);
    }
    inner.appendChild(ruler);
    const hr = document.createElement('div'); hr.className = 'stl-hd'; hr.style.height = RULER + 'px'; heads.appendChild(hr);
    // tracce: con un'altezza scelta crescono a riempirla, o scorrono se non ci stanno
    const trs = tracksOf(seq), segs = d.subs ? d.subs.segs() : [];
    root.style.height = tlH ? tlH + 'px' : '';
    const hs = trackHeights([...(segs.length ? [SUB_H] : []), ...trs.map(tr => TRACK_H[tr.kind])], tlH ? tlH - RULER - 2 - (scroll.offsetHeight - scroll.clientHeight) : 0);
    if (segs.length) subRow(segs, hs.shift()!);
    for (const [i, tr] of trs.entries()) {
      const h = hs[i], row = document.createElement('div'); row.className = 'stl-row k-' + tr.kind; row.style.height = h + 'px'; row.dataset.track = tr.id;
      const hd = document.createElement('div'); hd.className = 'stl-hd'; hd.style.height = h + 'px'; hd.textContent = tr.name; heads.appendChild(hd);
      if (d.canRemove(tr.id)) { const x = document.createElement('button'); x.type = 'button'; x.className = 'stl-del'; x.textContent = '×'; x.title = 'Togli questa traccia (è vuota)'; x.onclick = () => d.removeTrack(tr.id); hd.appendChild(x); }
      row.addEventListener('dblclick', e => { if (e.target !== row || tr.kind !== 'motion') return; d.newMotion(tr.id, frameRound(tAt(e))); });
      // file trascinati dal Finder: vanno su questa traccia, dove li rilasci
      row.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.items].some(i => i.kind === 'file')) { e.preventDefault(); row.classList.add('drop'); } });
      row.addEventListener('dragleave', () => row.classList.remove('drop'));
      row.addEventListener('drop', e => { row.classList.remove('drop'); if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); e.stopPropagation(); d.dropFiles(e.dataTransfer, tr.id, frameRound(tAt(e))); });
      row.addEventListener('pointerdown', e => { if (e.target === row) { d.selectMarker(null); marquee(e); } });
      for (const c of seq.clips.filter(c => c.track === tr.id)) row.appendChild(clipEl(c, h));
      // transizioni: un segno centrato sul taglio, largo quanto dura; clic = apre la clip che entra
      for (const c of seq.clips.filter(c => c.track === tr.id)) { const dd = trDur(seq, c); if (!dd) continue; const m = document.createElement('i'); m.className = 'stl-tr'; m.style.left = xOf(c.start - dd / 2) + 'px'; m.style.width = Math.max(6, xOf(dd)) + 'px'; m.style.height = (h - 6) + 'px'; m.title = 'Transizione: ' + ((c as any).tr.type) + ' · ' + dd.toFixed(2) + ' s'; m.addEventListener('pointerdown', e => { e.stopPropagation(); d.select(c.id, 'only'); render(); }); row.appendChild(m); }
      rows[tr.id] = row; inner.appendChild(row);
    }
    // primi tempi della musica: linee leggere su tutte le tracce
    for (const m of seq.markers) if (m.beat === 2) { const l = document.createElement('i'); l.className = 'stl-bl'; l.style.left = xOf(m.t) + 'px'; inner.appendChild(l); }
    inner.append(ph, cut);
    root.classList.toggle('razor', d.tool() === 'razor');
    heads.scrollTop = scroll.scrollTop;
    ruler.addEventListener('pointerdown', e => { if ((e.target as HTMLElement).closest('.stl-mk')) return; d.selectMarker(null); scrub(e); });
    head();
  }

  function subRow(segs: ReturnType<SubLane['segs']>, h: number) {
    const L = d.subs!, row = document.createElement('div'); row.className = 'stl-row k-sub'; row.style.height = h + 'px';
    const hd = document.createElement('div'); hd.className = 'stl-hd'; hd.style.height = h + 'px'; hd.textContent = 'Sottotitoli'; heads.appendChild(hd);
    // nel vuoto: riquadro di selezione (le frasi che tocca); un clic senza trascinare deseleziona
    row.addEventListener('pointerdown', e => {
      if (e.target !== row || e.button !== 0) return;
      const add = e.shiftKey || e.metaKey, x0 = tAt(e), box = document.createElement('div'); box.className = 'stl-mq'; box.style.top = row.offsetTop + 'px'; box.style.height = h + 'px';
      let moved = false;
      follow(ev => {
        const x1 = tAt(ev); if (!moved && Math.abs(x1 - x0) * pps < 4) return;
        if (!moved) { moved = true; inner.appendChild(box); }
        const a = Math.min(x0, x1), b = Math.max(x0, x1);
        Object.assign(box.style, { left: xOf(a) + 'px', width: xOf(b - a) + 'px' });
        L.selectMany(segs.filter(g => g.start < b && g.end > a).map(g => g.id), add);
        row.querySelectorAll<HTMLElement>('.stl-sub').forEach(el => el.classList.toggle('sel', L.isSel(el.dataset.id!)));
      }, () => { box.remove(); if (!moved && !add) L.select(null); render(); });
    });
    for (const g of segs) {
      const el = document.createElement('div'); el.className = 'stl-sub' + (L.isSel(g.id) ? ' sel' : ''); el.dataset.id = g.id;
      el.style.left = xOf(g.start) + 'px'; el.style.width = Math.max(3, xOf(g.end - g.start)) + 'px'; el.style.height = (h - 6) + 'px';
      el.textContent = g.text; el.title = g.text + ' · trascina per spostare, i bordi per l\'inizio e la fine, doppio clic per correggere';
      const l = document.createElement('i'); l.className = 'stl-edge l'; const r = document.createElement('i'); r.className = 'stl-edge r'; el.append(l, r);
      el.addEventListener('pointerdown', e => {
        if (e.button !== 0) return; e.stopPropagation(); d.selectMarker(null);
        const cl = (e.target as HTMLElement).classList, mode = cl.contains('l') ? 'l' : cl.contains('r') ? 'r' : 'move', t0 = tAt(e);
        if (e.metaKey || e.shiftKey) { L.select(g.id, e.metaKey ? 'toggle' : 'range'); render(); return; }
        const was = L.isSel(g.id);
        if (!was) { L.select(g.id); render(); }                     // presa una frase già selezionata: si sposta tutto il gruppo
        let moved = false;
        follow(ev => { const dt = tAt(ev) - t0; if (!moved && Math.abs(dt * pps) < 3) return; if (!moved) L.drag(g.id, mode, 0, 'start'); moved = true; L.drag(g.id, mode, dt, 'move'); render(); d.live(); },
          () => { document.body.classList.remove('dragging'); if (moved) L.drag(g.id, mode, 0, 'end'); else if (was) { L.select(g.id); render(); } });
        document.body.classList.add('dragging');
      });
      el.addEventListener('dblclick', e => { e.stopPropagation(); L.edit(g.id); });
      row.appendChild(el);
    }
    inner.appendChild(row);
  }

  function clipEl(c: Clip, h: number) {
    const el = document.createElement('div'); el.dataset.id = c.id;
    const sel = d.isSelected(c.id), act = d.activeMotion() === c.id;
    el.className = `stl-clip k-${c.kind}` + ((c as any).adj ? ' adj' : '') + (sel ? ' sel' : '') + (act ? ' act' : '') + (c.mute ? ' mute' : '');
    el.style.left = xOf(c.start) + 'px'; el.style.width = Math.max(4, xOf(c.dur)) + 'px'; el.style.height = (h - 6) + 'px';
    el.title = d.label(c);
    if (c.kind !== 'motion') {
      // onda nitida: disegnata alla densità dello schermo, ogni colonna prende il picco di tutto il suo tratto di audio
      // (200 valori al secondo), contorno pieno e simmetrico; segue volume e dissolvenze della clip
      const dpr = Math.min(3, window.devicePixelRatio || 1), cv = document.createElement('canvas'), W = Math.max(2, xOf(c.dur) - 2), H = h - 8;   // dentro il bordo della clip: niente stiramento
      cv.width = Math.min(16000, Math.round(W * dpr)); cv.height = Math.round(H * dpr); cv.className = 'stl-wave';
      const src = d.srcDur(c), n = isFinite(src) && src > 0 ? Math.min(120000, Math.max(2000, Math.ceil(src * 200))) : 0, pk = n ? d.peaks(c, n) : null;
      if (pk) {
        const g = cv.getContext('2d')!, cw = cv.width, mid = cv.height / 2, amp = cv.height * .47, sp = spd(c), vol = c.vol ?? 1, fi = c.fadeIn || 0, fo = c.fadeOut || 0;
        const top = new Float32Array(cw);
        for (let x = 0; x < cw; x++) {
          const t0 = (x / cw) * c.dur, t1 = ((x + 1) / cw) * c.dur;
          let i0 = Math.floor((c.inp + t0 * sp) / src * n), i1 = Math.ceil((c.inp + t1 * sp) / src * n), m = 0;
          i0 = Math.max(0, Math.min(n - 1, i0)); i1 = Math.max(i0 + 1, Math.min(n, i1));
          for (let i = i0; i < i1; i++) if (pk[i] > m) m = pk[i];
          const tm = (t0 + t1) / 2, f = (fi && tm < fi ? fadeShape(tm / fi, c.fadeCurve) : 1) * (fo && c.dur - tm < fo ? fadeShape((c.dur - tm) / fo, c.fadeCurve) : 1);
          top[x] = Math.min(1, m * vol * f) * amp;
        }
        g.fillStyle = c.kind === 'audio' ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.4)';
        g.beginPath(); g.moveTo(0, mid);
        for (let x = 0; x < cw; x++) g.lineTo(x + .5, mid - Math.max(.5 * dpr, top[x]));
        for (let x = cw - 1; x >= 0; x--) g.lineTo(x + .5, mid + Math.max(.5 * dpr, top[x]));
        g.closePath(); g.fill();
      }
      // dissolvenze: zona scura sopra la curva e la curva stessa (con la forma scelta)
      const g2 = cv.getContext('2d')!, cw = cv.width, ch = cv.height, fi = c.fadeIn || 0, fo = c.fadeOut || 0;
      const fade = (from: number, to: number, out: boolean) => {
        const a = from / c.dur * cw, b = to / c.dur * cw, yAt = (x: number) => { const p = (x - a) / Math.max(1, b - a); return ch - fadeShape(out ? 1 - p : p, c.fadeCurve) * ch; };
        g2.beginPath(); g2.moveTo(a, 0);
        for (let x = a; x <= b; x += 2) g2.lineTo(x, yAt(x));
        g2.lineTo(b, yAt(b)); g2.lineTo(b, 0); g2.closePath(); g2.fillStyle = 'rgba(0,0,0,.42)'; g2.fill();
        g2.beginPath(); for (let x = a; x <= b; x += 2) x === a ? g2.moveTo(x, yAt(x)) : g2.lineTo(x, yAt(x)); g2.lineTo(b, yAt(b));
        g2.strokeStyle = 'rgba(255,255,255,.8)'; g2.lineWidth = Math.max(1, dpr); g2.stroke();
      };
      if (fi) fade(0, Math.min(fi, c.dur), false);
      if (fo) fade(Math.max(0, c.dur - fo), c.dur, true);
      el.appendChild(cv);
    }
    const nm = document.createElement('span'); nm.className = 'stl-name'; nm.textContent = d.label(c) + (spd(c) !== 1 ? ` · ${Math.round(spd(c) * 100)}%` : ''); el.appendChild(nm);
    // maniglie delle dissolvenze (angoli in alto): si trascinano verso l'interno della clip
    if (c.kind !== 'motion') for (const side of ['in', 'out'] as const) {
      const k = side === 'in' ? 'fadeIn' : 'fadeOut', hd = document.createElement('i'); hd.className = 'stl-fh ' + side;
      hd.style[side === 'in' ? 'left' : 'right'] = xOf(c[k] || 0) + 'px';
      hd.title = (side === 'in' ? 'Dissolvenza in entrata' : 'Dissolvenza in uscita') + ': ' + (c[k] || 0).toFixed(2) + ' s · trascina';
      hd.addEventListener('pointerdown', e => dragFade(e, c.id, k));
      el.appendChild(hd);
    }
    const pz = d.pauses?.(c);
    if (pz) for (const [a, b] of pz) { const z = document.createElement('i'); z.className = 'stl-pz'; z.style.left = xOf((a - c.inp) / spd(c)) + 'px'; z.style.width = Math.max(1, xOf((b - a) / spd(c))) + 'px'; el.appendChild(z); }
    const l = document.createElement('i'); l.className = 'stl-edge l'; const r = document.createElement('i'); r.className = 'stl-edge r'; el.append(l, r);
    el.addEventListener('pointerdown', e => dragClip(e, c.id, (e.target as HTMLElement).classList.contains('l') ? 'l' : (e.target as HTMLElement).classList.contains('r') ? 'r' : 'move'));
    return el;
  }

  function scrub(e: PointerEvent) {
    if (e.button !== 0) return;
    const go = (ev: PointerEvent) => { d.setT(frameRound(snapT(tAt(ev), null, ev))); head(); };
    go(e);
    follow(ev => go(ev));
  }

  /** Riquadro di selezione nel vuoto delle tracce: seleziona le clip che tocca (⇧ o ⌘ aggiungono). Un clic senza trascinare deseleziona. */
  function marquee(e: PointerEvent) {
    if (e.button !== 0) return;
    const add = e.shiftKey || e.metaKey, r0 = inner.getBoundingClientRect(), x0 = e.clientX - r0.left, y0 = e.clientY - r0.top;
    const box = document.createElement('div'); box.className = 'stl-mq';
    let moved = false;
    follow(ev => {
      const r = inner.getBoundingClientRect(), x1 = ev.clientX - r.left, y1 = ev.clientY - r.top;
      if (!moved && Math.hypot(x1 - x0, y1 - y0) < 4) return;
      if (!moved) { moved = true; inner.appendChild(box); }
      const L = Math.min(x0, x1), T = Math.min(y0, y1), W = Math.abs(x1 - x0), H = Math.abs(y1 - y0);
      Object.assign(box.style, { left: L + 'px', top: T + 'px', width: W + 'px', height: H + 'px' });
      const hit: string[] = [];
      for (const el of inner.querySelectorAll<HTMLElement>('.stl-clip')) {
        const b = el.getBoundingClientRect(), bl = b.left - r.left, bt = b.top - r.top;
        if (bl < L + W && bl + b.width > L && bt < T + H && bt + b.height > T) hit.push(el.dataset.id!);
      }
      d.selectMany(hit, add);
      inner.querySelectorAll<HTMLElement>('.stl-clip').forEach(el => el.classList.toggle('sel', d.isSelected(el.dataset.id!)));
    }, () => { box.remove(); if (!moved && !add) d.select(null); render(); });
  }

  function dragClip(e: PointerEvent, id: string, mode: 'l' | 'r' | 'move') {
    if (e.button !== 0) return;
    e.stopPropagation(); d.selectMarker(null);
    // lama: taglia qui, niente trascinamento
    if (d.tool() === 'razor') { d.razor(id, frameRound(snapT(tAt(e), null, e))); return; }
    if (e.shiftKey || e.metaKey) { d.select(id, 'toggle'); render(); return; }
    if (!d.isSelected(id) || mode !== 'move') d.select(id, 'only');
    const seq = d.seq(), c0 = seq.clips.find(c => c.id === id);
    if (!c0) return;
    const orig = { ...c0 }, t0 = tAt(e), dup = mode === 'move' && e.altKey && !!d.dupNow;   // ⌥: duplica (l'aggancio resta attivo)
    // più clip selezionate: si spostano insieme
    const group = mode === 'move' ? d.selection().map(x => seq.clips.find(c => c.id === x)).filter(Boolean) as Clip[] : [c0];
    const starts = new Map(group.map(c => [c.id, c.start]));
    // ⌥: la copia compare subito al posto dell'originale; mentre si trascina le copie non fanno da ostacolo
    const ghosts = new Set(dup ? d.dupNow!(group.map(c => c.id)) : []);
    const view = ghosts.size ? { ...seq, clips: seq.clips.filter(c => !ghosts.has(c.id)) } : seq;
    if (ghosts.size) render();
    let moved = false;
    const mv = (ev0: PointerEvent) => {
      const ev = dup ? ({ altKey: false, clientX: ev0.clientX, clientY: ev0.clientY } as PointerEvent) : ev0;   // con ⌥ (duplica) l'aggancio resta attivo
      const c = seq.clips.find(x => x.id === id); if (!c) return;
      const dt = tAt(ev) - t0;
      if (!moved && Math.abs(dt * pps) < 3) return;
      moved = true;
      const T0 = d.T();                                 // la testina resta dov'è anche se si sposta la clip aperta nel pannello
      if (mode === 'move' && group.length > 1) {
        // spostamento di gruppo: stesso scarto per tutte, agganciato alla clip presa; non si sovrappone alle altre
        let s = orig.start + dt;
        const ss = snapT(s, id, ev), se = snapT(s + orig.dur, id, ev) - orig.dur;
        s = Math.abs(ss - s) <= Math.abs(se - s) ? ss : se;
        let k = frameRound(s - orig.start);
        k = Math.max(k, -Math.min(...group.map(c => starts.get(c.id)!)));
        const ids = new Set(group.map(c => c.id));
        const clash = group.some(c => { const ns = starts.get(c.id)! + k; return view.clips.some(o => !ids.has(o.id) && o.track === c.track && ns < clipEnd(o) - 1e-9 && ns + c.dur > o.start + 1e-9); });
        if (!clash) for (const c of group) c.start = starts.get(c.id)! + k;
      } else if (mode === 'move') {
        // traccia: si può passare tra le tracce che accettano lo stesso tipo (Grafica 1 ↔ Grafica 2)
        const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.stl-row') as HTMLElement | null;
        const tid = over?.dataset.track as TrackId | undefined;
        if (tid && tid !== c.track && kindOfTrack(tid) === c.kind) c.track = tid;
        let s = orig.start + dt;
        const ss = snapT(s, id, ev), se = snapT(s + c.dur, id, ev) - c.dur;
        s = Math.abs(ss - s) <= Math.abs(se - s) ? ss : se;
        c.start = frameRound(placeOnTrack(seq, c, Math.max(0, s)));   // anche la copia fa da ostacolo: la clip si ferma accanto
      } else if (mode === 'l') {
        const n = trimStart(orig, frameRound(snapT(orig.start + dt, id, ev)));
        const s = placeOnTrack(seq, { ...c, start: n.start, dur: n.dur }, n.start);
        if (Math.abs(s - n.start) < 1e-6) Object.assign(c, { start: n.start, dur: n.dur, inp: n.inp });
      } else {
        const n = trimEnd(orig, frameRound(snapT(clipEnd(orig) + dt, id, ev)), d.srcDur(orig));
        const s = placeOnTrack(seq, { ...c, dur: n.dur }, c.start);
        if (Math.abs(s - c.start) < 1e-6) c.dur = n.dur;
        if (c.kind === 'motion') (c as any).auto = false;     // la durata ora la decide chi monta
      }
      if (Math.abs(d.T() - T0) > 1e-9) d.setT(T0);
      render(); d.live();
    };
    follow(mv, () => { document.body.classList.remove('dragging'); if (ghosts.size) d.dupEnd!([...ghosts]); else if (moved) d.commit(); });
    document.body.classList.add('dragging');
  }

  function dragFade(e: PointerEvent, id: string, k: 'fadeIn' | 'fadeOut') {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    if (!d.isSelected(id)) d.select(id, 'only');
    let moved = false;
    follow(ev => {
      const c = d.seq().clips.find(x => x.id === id); if (!c) return;
      const other = k === 'fadeIn' ? c.fadeOut || 0 : c.fadeIn || 0, t = tAt(ev);
      const v = frameRound(Math.max(0, Math.min(c.dur - other, k === 'fadeIn' ? t - c.start : clipEnd(c) - t)));
      if (v !== (c[k] || 0)) { c[k] = v; moved = true; render(); d.live(); }
    }, () => { document.body.classList.remove('dragging'); if (moved) d.commit(); });
    document.body.classList.add('dragging');
  }

  function dragMarker(e: PointerEvent, id: string) {
    if (e.button !== 0) return;
    e.stopPropagation(); d.selectMarker(id);
    const m = d.seq().markers.find(x => x.id === id); if (!m) return;
    let moved = false;
    follow(ev => { moved = true; m.t = frameRound(Math.max(0, snapT(tAt(ev), null, ev))); render(); }, () => { if (moved) d.commit(); else { d.setT(m.t); render(); } });
  }

  /** Segue il puntatore su tutta la finestra fino al rilascio (gli elementi della timeline possono essere ridisegnati nel frattempo). */
  function follow(mv: (e: PointerEvent) => void, end?: () => void) {
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); end && end(); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  /** Aggiorna solo la testina (a ogni fotogramma), facendo scorrere la vista se esce dallo schermo durante la riproduzione. */
  function head(follow = false) {
    const x = xOf(d.T());
    ph.style.left = x + 'px';
    if (follow && (x < scroll.scrollLeft || x > scroll.scrollLeft + scroll.clientWidth - 40)) scroll.scrollLeft = Math.max(0, x - 60);
  }
  function setZoom(v: number, anchorT = d.T()) {
    const before = xOf(anchorT) - scroll.scrollLeft;
    pps = Math.max(4, Math.min(600, v)); render();
    scroll.scrollLeft = Math.max(0, xOf(anchorT) - before);
  }
  function zoomFit() { setZoom((scroll.clientWidth - 40) / Math.max(1, d.total())); scroll.scrollLeft = 0; }
  scroll.addEventListener('wheel', e => { if (e.metaKey || e.ctrlKey) { e.preventDefault(); const r = inner.getBoundingClientRect(); setZoom(pps * Math.exp(-e.deltaY * .002), Math.max(0, (e.clientX - r.left) / pps)); } }, { passive: false });
  // lama: una linea verticale mostra dove taglierà il clic (agganciata come il taglio)
  inner.addEventListener('pointermove', e => {
    if (d.tool() !== 'razor' || document.body.classList.contains('dragging')) { cut.style.display = ''; return; }
    const T = frameRound(snapT(tAt(e), null, e));
    cut.style.display = 'block'; cut.style.left = xOf(T) + 'px'; (cut.firstChild as HTMLElement).textContent = fmtTC(T, d.fps());
  });
  inner.addEventListener('pointerleave', () => { cut.style.display = ''; });
  scroll.addEventListener('scroll', () => { heads.scrollTop = scroll.scrollTop; });
  // altezza: si trascina la maniglia sopra la timeline (doppio clic torna all'altezza automatica)
  const setH = (v: number, save: boolean) => { tlH = v ? Math.round(Math.max(TL_MIN, Math.min(innerHeight * .75, v))) : 0; render(); if (save) setUI('tlH', tlH); };
  if (d.grip) {
    const g = d.grip;
    g.addEventListener('pointerdown', e => {
      if (e.button !== 0) return; e.preventDefault(); g.classList.add('on'); document.body.classList.add('resizing-v');
      const y0 = e.clientY, h0 = root.offsetHeight;
      follow(ev => setH(h0 + (y0 - ev.clientY), false), () => { g.classList.remove('on'); document.body.classList.remove('resizing-v'); setUI('tlH', tlH); });
    });
    g.addEventListener('dblclick', () => setH(0, true));
    g.addEventListener('keydown', e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); setH(root.offsetHeight + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 60 : 20), true); } });
  }
  new ResizeObserver(() => render()).observe(scroll);
  render();
  return { render, head, zoomFit, setZoom, zoom: () => pps };
}

function fmtTC(s: number, fps: number) { const f = Math.round(s * fps), m = Math.floor(f / fps / 60), r = Math.floor(f / fps) % 60; return `${m}:${String(r).padStart(2, '0')}:${String(f % fps).padStart(2, '0')}`; }
function fmt(s: number) { const m = Math.floor(s / 60), r = s - m * 60; return m ? `${m}:${String(Math.floor(r)).padStart(2, '0')}` : (r % 1 ? r.toFixed(1) : String(r)) + 's'; }
