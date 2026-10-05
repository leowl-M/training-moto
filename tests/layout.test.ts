// Prove su larghezze dei pannelli, aree di lavoro, palette e maniglie. npm test
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } };
const L = await import('../src/ui/layout.ts');
const PAL = await import('../src/ui/palettes.ts');
const H = await import('../src/ui/handles.ts');
const P = await import('../src/ui/prefs.ts');

/* ---------------- pannelli e aree di lavoro */
test('trascinare un pannello sotto la soglia lo chiude', () => {
  assert.equal(L.clampWidth('lib', 60, 1400, 360), 0);
  assert.equal(L.clampWidth('lib', 109, 1400, 360), 0);
});
test('la larghezza resta entro i limiti', () => {
  assert.equal(L.clampWidth('lib', 150, 1400, 360), 200);
  assert.equal(L.clampWidth('lib', 900, 1800, 360), 520);
  assert.equal(L.clampWidth('insp', 900, 1800, 280), 560);
  assert.equal(L.clampWidth('insp', 320, 1400, 280), 320);
});
test('i pannelli non schiacciano l\'anteprima sotto il minimo', () => {
  const total = 1000, other = 360, w = L.clampWidth('lib', 520, total, other);
  assert.ok(total - other - w >= L.MIN_CENTER - 1 || w === L.LIMITS.lib.min);
});
test('le aree di lavoro hanno nomi unici e valori sensati', () => {
  const ids = L.WORKSPACES.map(w => w.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const w of L.WORKSPACES) { assert.ok(w.lib === 0 || w.lib >= L.LIMITS.lib.min); assert.ok(w.insp >= L.LIMITS.insp.min); assert.ok(['stile', 'anim', 'grafica', 'scena', 'tempo'].includes(w.tab)); }
  assert.equal(L.workspaceById('non-esiste').id, 'completo');
});
test('riaprire un pannello chiuso usa una larghezza utile', () => {
  const montaggio = L.workspaceById('montaggio');
  assert.ok(L.reopenWidth('lib', montaggio) >= L.LIMITS.lib.min);
  assert.equal(L.reopenWidth('insp', montaggio), 340);
});

/* ---------------- palette */
test('le palette di base sono valide e con id unici', () => {
  const ids = PAL.BASE_PALETTES.map((p: any) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of PAL.BASE_PALETTES) for (const c of [p.color, p.colorB, p.bg]) assert.match(c, /^#[0-9a-f]{6}$/i);
});
test('l\'id di una palette è univoco e senza accenti', () => {
  assert.equal(PAL.makeId('Città di notte', []), 'u:citta-di-notte');
  assert.equal(PAL.makeId('Città di notte', ['u:citta-di-notte']), 'u:citta-di-notte-2');
  assert.equal(PAL.makeId('!!!', []), 'u:palette');
});
test('ordine: preferiti, poi personali recenti, poi di base', () => {
  const custom = [{ id: 'u:a', name: 'A', color: '#111111', colorB: '#222222', bg: '#333333' }, { id: 'u:b', name: 'B', color: '#111111', colorB: '#222222', bg: '#333333' }];
  assert.deepEqual(PAL.orderPalettes(custom, []).slice(0, 3).map((p: any) => p.id), ['u:b', 'u:a', 'base:moto']);
  assert.deepEqual(PAL.orderPalettes(custom, ['base:mono', 'u:a']).slice(0, 3).map((p: any) => p.id), ['base:mono', 'u:a', 'u:b']);
  assert.equal(PAL.orderPalettes(custom, ['non-esiste']).length, custom.length + PAL.BASE_PALETTES.length);
});
test('si salva ed elimina una palette personale, togliendola anche dai preferiti', () => {
  const p = PAL.savePalette('  Prova  ', { color: '#ffffff', colorB: '#ff0000', bg: '#000000' });
  assert.equal(p.name, 'Prova');
  assert.equal(PAL.customPalettes().length, 1);
  P.toggleFav('palette', p.id);
  assert.ok(P.isFav('palette', p.id));
  PAL.deletePalette(p.id);
  assert.equal(PAL.customPalettes().length, 0);
  assert.equal(P.isFav('palette', p.id), false);
});
test('riconosce se i colori attuali coincidono con una palette', () => {
  assert.ok(PAL.sameColors(PAL.BASE_PALETTES[0], { color: '#EFECE6', colorB: '#ff4d00', bg: '#121212' }));
  assert.equal(PAL.sameColors(PAL.BASE_PALETTES[0], { color: '#efece6', colorB: '#ff4d01', bg: '#121212' }), false);
});

/* ---------------- maniglie */
test('l\'aggancio scatta solo entro la tolleranza', () => {
  assert.deepEqual(H.snap(965, [960], 8), { value: 960, hit: 960 });
  assert.deepEqual(H.snap(980, [960], 8), { value: 980, hit: null });
});
test('trascinando, il centro si aggancia al centro del quadro e si può disattivare', () => {
  const start = { cx: 900, cy: 500 }, frame = [1920, 1080] as [number, number], css = [960, 540] as [number, number];
  const r = H.dragCenter(start, 29, 20, frame, css);                 // 29 px schermo = 58 px quadro → 958: entro la tolleranza
  assert.equal(r.cx, 960); assert.equal(r.guideX, 960); assert.equal(r.cy, 540);
  const free = H.dragCenter(start, 29, 20, frame, css, false);
  assert.equal(free.cx, 958); assert.equal(free.guideX, null);
});
test('lo spostamento si traduce in percentuale del quadro', () => {
  const d = H.offsetDelta({ cx: 960, cy: 540 }, { cx: 1152, cy: 486 }, [1920, 1080]);
  assert.equal(d.dx, 10); assert.equal(d.dy, -5);
});
test('il fattore di scala segue la distanza dal centro e resta limitato', () => {
  assert.equal(H.scaleFactor(100, 150), 1.5);
  assert.equal(H.scaleFactor(100, 0.1), 0.05);
  assert.equal(H.scaleFactor(100, 99999), 20);
  assert.equal(H.scaleFactor(0.2, 50), 1);
});

/* ---------------- preferenze: valori dell'interfaccia e dati */
test('i valori dell\'interfaccia e i dati si ricordano dopo un ricaricamento', () => {
  P.setUI('w:lib', 310); P.setData('palettes', [{ id: 'u:x' }]);
  P.reloadPrefs();
  assert.equal(P.getUI('w:lib', 0), 310);
  assert.equal(P.getUI('non-esiste', 'def'), 'def');
  assert.deepEqual(P.getData('palettes', []), [{ id: 'u:x' }]);
});
test('la copia di sicurezza include anche pannelli e palette', () => {
  const copy = P.exportPrefs(); store.clear(); P.reloadPrefs();
  assert.equal(P.getUI('w:lib', 0), 0);
  P.importPrefs(copy);
  assert.equal(P.getUI('w:lib', 0), 310);
});
