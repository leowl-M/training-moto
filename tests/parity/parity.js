// Test di parità visiva: renderizza frame deterministici e ne calcola l'impronta (hash dei pixel).
// Si esegue su due versioni dell'app (per esempio originale e nuova) e si confrontano le impronte.
// Uso: eval del file, poi `await window.runParity(api)`, dove api = { renderFrame, layout, defaults, mkSlot, clipTotal, loadFonts, FX, LOOPS }.
window.runParity = async function runParity(api) {
  await document.fonts.ready; await api.loadFonts(); await Promise.all([...document.fonts].map(f => f.load().catch(() => { }))); await document.fonts.ready;
  const W = 480, H = 270;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const hashPx = () => { const d = ctx.getImageData(0, 0, W, H).data; let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
  const base = () => { const T = api.defaults(); T.text = 'Ogni dettaglio\nconta'; T.fit = false; T.fs = 44; T.fps = 30; T.seed = 7; T.delay = .1; T.dIn = 1.2; T.hold = .6; T.dOut = 1.0; T.tail = .2; T.outMode = 'custom'; return T; };
  const frames = {};
  const shoot = (key, T, times) => {
    const L = api.layout(T, ctx, W, H); const tot = api.clipTotal(T);
    times.forEach((f, k) => { api.renderFrame(ctx, T, L, tot * f, W, H, 1, {}); frames[`${key}|${k}`] = hashPx(); });
  };
  const T10 = [0, .11, .22, .33, .44, .55, .66, .77, .88, 1];
  for (const fx of api.FX) for (const split of ['char', 'word']) {
    const T = base(); T.inS = api.mkSlot(fx.id, { split, stagger: .4, ease: 'fx' }); T.outS = api.mkSlot(fx.id, { split, stagger: .4, ease: 'fx' });
    shoot(`fx:${fx.id}:${split}`, T, T10);
  }
  for (const lp of api.LOOPS) {
    if (lp.id === 'none') continue;
    const T = base(); T.inS = api.mkSlot('fade', { split: 'char', stagger: 0 }); T.dIn = .1; T.delay = 0; T.hold = 3; T.outMode = 'none'; T.loop = { fx: lp.id, when: 'always', prms: {} };
    shoot(`loop:${lp.id}`, T, [.1, .3, .5, .8]);
  }
  // SVG di prova per i livelli "Grafica SVG": linee da bordo a bordo, un cerchio, un cerchietto, una forma piena in un gruppo semitrasparente
  const SVG = '<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 30H100" stroke="#de5266"/><path d="M60 0V100" stroke="#de5266"/><circle cx="50" cy="50" r="30" stroke="#de5266"/><circle cx="30" cy="30" r="3" stroke="#de5266"/><g opacity=".1"><path d="M30 30H70V70H30Z" fill="#000"/></g></svg>';
  // logo completo di prova: marchio, una linea guida, naming (due lettere) e payoff, con i nomi dei gruppi come li esporta Figma
  const SVG2 = '<svg viewBox="0 0 300 100" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="marchio"><path d="M10 10H90V90H10Z" fill="#e47724"/></g><g id="linee"><path d="M0 50H100" stroke="#de5266"/></g><g id="naming"><path d="M120 20H160V60H120Z" fill="#004d43"/><path d="M170 20H210V60H170Z" fill="#004d43"/></g><g id="payoff"><path d="M120 70H280V85H120Z" fill="#004d43"/></g></svg>';
  const variants = {
    stroke: T => { T.stroke = true; }, colorIn: T => { T.colorIn = true; }, transparent: T => { T.transparent = true; },
    italic_upper_left: T => { T.italic = true; T.tcase = 'upper'; T.align = 'left'; T.anchor = 'tl'; },
    track_lh: T => { T.track = 120; T.lh = 1.4; T.align = 'right'; T.anchor = 'br'; },
    free_block: T => { Object.assign(T.block, { mode: 'free', fx: -20, fy: 0, tx: 10, ty: 5, s0: 1, s1: 1.2, r0: 0, r1: 15, ease: 'inOutSine' }); },
    path_block: T => { Object.assign(T.block, { mode: 'path', from: 'tl', to: 'br', rotm: 'follow', pace: 'slow', s0: 1, s1: 1, spin: 0, arc: 10 }); },
    keys_block: T => { Object.assign(T.block, { mode: 'keys', keys: [{ t: 0, x: -20, y: 0, s: 1, r: 0, op: 0, ease: 'linear' }, { t: 1, x: 0, y: 0, s: 1.1, r: 5, op: 1, ease: 'outExpo' }, { t: 2.5, x: 10, y: -5, s: 1, r: -5, op: 1, ease: 'inOutCubic' }] }); },
    path_mask: T => { T.loop = { fx: 'tp_wave', when: 'always', prms: {} }; },
    path_dwipe: T => { T.loop = { fx: 'tp_circle', when: 'always', prms: {} }; T.inS = api.mkSlot('diagwipe', { split: 'char', stagger: .35, ease: 'fx' }); },
    path_glow_stroke: T => { T.loop = { fx: 'tp_arc', when: 'always', prms: {} }; T.inS = api.mkSlot('glowin', { split: 'word', stagger: .3, ease: 'fx' }); T.stroke = true; },
    svg_build: T => { const L = api.mkSvgLayer(SVG, 'prova'); Object.assign(L, { mode: 'build', mv: true, x2: 30, y2: 50, size2: 20 }); T.layers = [L]; },
    svg_draw: T => { const L = api.mkSvgLayer(SVG, 'prova'); Object.assign(L, { mode: 'draw', cMark: 'svg', cGuide: 'svg', z: 'below' }); T.layers = [L]; },
    svg_lockup: T => { T.text = ''; T.layers = [api.mkSvgLayer(SVG2, 'logo')]; },
    cam_keys: T => { T.cam = { on: true, keys: [{ t: 0, mode: 'free', x: 50, y: 50, z: 1, r: 0 }, { t: 2, mode: 'free', x: 40, y: 45, z: 1.8, r: 5, ease: 'inOutCubic' }], follow: { on: false, target: '', from: 0, to: 1, z: 2, smooth: .3, ramp: .5 }, shake: { amt: .5, hz: 1.2, rot: .3 } }; },
    cam_fit_follow: T => { const L = api.mkSvgLayer(SVG, 'prova'); T.layers = [L]; T.cam = { on: true, keys: [{ t: 0, mode: 'fit', target: 'block:0', margin: 10 }, { t: 3, mode: 'fit', target: 'svg:' + L.id + ':all', margin: 5 }], follow: { on: true, target: 'pen:' + L.id, from: .2, to: 1.8, z: 2.5, smooth: .3, ramp: .4 }, shake: { amt: 0, hz: 1, rot: 0 } }; },
    svg_shots: T => { const L = api.mkSvgLayer(SVG, 'prova'); L.shots = { on: true, cut: true, tr: .5, push: .06, list: [{ area: 'tl', at: 0, dur: 1, z: 1 }, { area: 'br', at: 1, dur: 1, z: 1.2 }] }; T.layers = [L]; },
    states: T => { const L = api.mkSvgLayer(SVG, 'prova'); L.mode = 'none'; L.size = 20; T.layers = [L]; T.states = { on: true, list: [{ id: 'a', name: 'Stato 2', at: .8, dur: 1, ease: 'inOutCubic', stag: .4, d: { 'block:0': { dx: 15, dy: -10, s: .7, r: 5, op: 1 }, ['svg:' + L.id]: { dx: -25, dy: 5, s: 1.4, r: 45, op: .7 } } }] }; },
    path_walk_hold: T => { T.loop = { fx: 'tp_heart', when: 'hold', prms: { tp_heart: { speed: 2 } } }; T.inS = api.mkSlot('walkin', { split: 'char', stagger: .35, order: 'end', ease: 'fx' }); },
  };
  for (const [name, fn] of Object.entries(variants)) {
    const T = base(); T.inS = api.mkSlot('mask', { split: 'char', stagger: .35, ease: 'fx' }); fn(T); shoot(`var:${name}`, T, T10);
  }
  const keys = Object.keys(frames); let dig = 2166136261; for (const k of keys) { const s = k + frames[k]; for (let i = 0; i < s.length; i++) { dig ^= s.charCodeAt(i); dig = Math.imul(dig, 16777619); } }
  return { n: keys.length, digest: (dig >>> 0).toString(16), frames };
};
