// Prove delle preferenze (preferiti, recenti, sezioni aperte). npm test
import test from 'node:test';
import assert from 'node:assert/strict';

// finto localStorage, prima di caricare il modulo
const store = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } };
const P = await import('../src/ui/prefs.ts');

test('i preferiti si aggiungono, si tolgono e restano nell\'ordine di inserimento', () => {
  assert.equal(P.isFav('fx', 'mask'), false);
  assert.equal(P.toggleFav('fx', 'mask'), true);
  assert.equal(P.toggleFav('fx', 'pop'), true);
  assert.deepEqual(P.favs('fx'), ['mask', 'pop']);
  assert.equal(P.toggleFav('fx', 'mask'), false);
  assert.deepEqual(P.favs('fx'), ['pop']);
});

test('gli ambiti sono separati', () => {
  P.toggleFav('font', 'Anton');
  assert.deepEqual(P.favs('font'), ['Anton']);
  assert.equal(P.isFav('fx', 'Anton'), false);
});

test('i recenti mettono in cima l\'ultimo usato, senza doppioni, fino a 8', () => {
  for (const id of ['a', 'b', 'c', 'a']) P.pushRecent('fx', id);
  assert.deepEqual(P.recents('fx'), ['a', 'c', 'b']);
  for (let i = 0; i < 12; i++) P.pushRecent('ease', 'e' + i);
  assert.equal(P.recents('ease').length, 8);
  assert.equal(P.recents('ease')[0], 'e11');
});

test('le sezioni sono chiuse di default e si ricorda la scelta', () => {
  assert.equal(P.isOpen('insp:Colore'), false);
  P.setOpen('insp:Colore', true);
  assert.equal(P.isOpen('insp:Colore'), true);
});

test('tutto sopravvive a un ricaricamento', () => {
  P.reloadPrefs();
  assert.deepEqual(P.favs('fx'), ['pop']);
  assert.equal(P.isOpen('insp:Colore'), true);
  assert.equal(P.recents('fx')[0], 'a');
});

test('avvisa chi ascolta quando cambiano i preferiti', () => {
  let n = 0; const off = P.onPrefsChange(() => n++);
  P.toggleFav('fx', 'glitch'); P.pushRecent('fx', 'glitch');
  off(); P.toggleFav('fx', 'glitch');
  assert.equal(n, 2);
});

test('esporta e reimporta una copia di sicurezza', () => {
  const copy = P.exportPrefs();
  store.clear(); P.reloadPrefs();
  assert.deepEqual(P.favs('fx'), []);
  P.importPrefs(copy);
  assert.deepEqual(P.favs('fx'), ['pop']);
  assert.throws(() => P.importPrefs('null'));
});
