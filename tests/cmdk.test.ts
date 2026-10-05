// Prove sul punteggio della ricerca ovunque. npm test
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } };
const { scoreCommand } = await import('../src/ui/cmdk.ts');
const P = await import('../src/ui/prefs.ts');

const cmd = (title: string, group = 'Effetti', extra: object = {}) => ({ id: title, title, group, run() {}, ...extra });

test('tutte le parole cercate devono comparire', () => {
  assert.ok(scoreCommand(cmd('Entrata: Maschera'), 'entrata mas') > 0);
  assert.equal(scoreCommand(cmd('Entrata: Maschera'), 'entrata pop'), -1);
});

test('chi inizia con la parola cercata vince su chi la contiene a metà', () => {
  const a = scoreCommand(cmd('Entrata: Pop'), 'pop'), b = scoreCommand(cmd('Esporta frame corrente'), 'pop');
  assert.ok(b === -1 && a > 0);
  assert.ok(scoreCommand(cmd('Pop'), 'pop') > scoreCommand(cmd('Rimbalzo con pop'), 'pop'));
});

test('cerca anche nelle parole chiave e nel gruppo', () => {
  assert.ok(scoreCommand(cmd('Esporta video', 'Azioni', { keywords: 'mp4 render' }), 'mp4') > 0);
  assert.ok(scoreCommand(cmd('Salva preset', 'Azioni'), 'azioni') > 0);
});

test('un preferito passa avanti a parità di corrispondenza', () => {
  const a = cmd('Entrata: Pop', 'Effetti', { fav: { scope: 'fx', id: 'pop' } }), b = cmd('Uscita: Pop', 'Effetti');
  const prima = scoreCommand(a, 'pop') - scoreCommand(b, 'pop');
  P.toggleFav('fx', 'pop');
  assert.ok(scoreCommand(a, 'pop') - scoreCommand(b, 'pop') > prima);
});

test('senza testo non filtra', () => { assert.equal(scoreCommand(cmd('Qualsiasi'), ''), 0); });
