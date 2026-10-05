// Prove sul calcolo delle righe scorrevoli. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { repsFor, wrapOffset, rowDir, buildMarquee, SEPS, MAX_REPS } from '../src/effects/marquee.ts';

const ctx = { measureText: (s: string) => ({ width: s.length * 10 }) };   // ogni carattere largo 10

test('le ripetizioni coprono la diagonale più due periodi e non superano il massimo', () => {
  assert.equal(repsFor(1000, 100), 12);
  assert.equal(repsFor(10, 1000), 3);
  assert.equal(repsFor(0, 1000), 2);
  assert.equal(repsFor(1e9, 1), MAX_REPS);
  assert.equal(repsFor(500, 0), 1);
});

test('lo scorrimento è periodico e resta nell\'intervallo', () => {
  const P = 200;
  for (const t of [0, .3, 1.7, 9.99, 123.456]) {
    const a = wrapOffset(150, t, P), b = wrapOffset(150, t + P / 150, P);   // dopo un periodo intero si torna allo stesso punto
    assert.ok(a >= -P / 2 && a < P / 2);
    assert.ok(Math.abs(a - b) < 1e-9);
  }
  assert.equal(wrapOffset(100, 0, P), 0);
});

test('la direzione negativa scorre al contrario e senza salti', () => {
  const P = 100, step = (v: number, t: number) => wrapOffset(v, t + .01, P) - wrapOffset(v, t, P);
  assert.ok(step(100, 0.2) > 0);
  assert.ok(step(-100, 0.2) < 0);
  assert.equal(wrapOffset(100, 5, 0), 0);
});

test('le direzioni: opposte, tutte a destra o tutte a sinistra', () => {
  assert.deepEqual([0, 1, 2, 3].map(r => rowDir('alt', r)), [1, -1, 1, -1]);
  assert.deepEqual([0, 1].map(r => rowDir('right', r)), [1, 1]);
  assert.deepEqual([0, 1].map(r => rowDir('left', r)), [-1, -1]);
});

test('le righe si costruiscono ripetendo il testo con il separatore e coprono il quadro', () => {
  const { lines, mqP } = buildMarquee(['CIAO'], { rows: 3, sep: 'dot' }, ctx, 1000, 500, 0);
  assert.equal(lines.length, 3);
  assert.equal(mqP.length, 3);
  const unit = 'CIAO' + SEPS.dot;
  assert.equal(mqP[0], unit.length * 10);                      // periodo = una ripetizione
  for (const l of lines) { assert.ok(l.startsWith(unit)); assert.ok(l.length * 10 >= Math.hypot(1000, 500) * 1.15 + 2 * mqP[0]); }
});

test('con più righe di testo si alternano, ciascuna con il suo periodo', () => {
  const { lines, mqP } = buildMarquee(['AB', 'CDEFG'], { rows: 4, sep: 'space' }, ctx, 800, 600, 0);
  assert.ok(lines[0].startsWith('AB') && lines[1].startsWith('CDEFG') && lines[2].startsWith('AB') && lines[3].startsWith('CDEFG'));
  assert.ok(mqP[1] > mqP[0]);
});

test('righe vuote e spaziatura tra le lettere', () => {
  const vuoto = buildMarquee(['', '  '], { rows: 2, sep: 'space' }, ctx, 100, 100, 0);
  assert.equal(vuoto.lines.length, 2);
  const conSpaz = buildMarquee(['AB'], { rows: 1, sep: 'dash' }, ctx, 500, 500, 2);
  const senza = buildMarquee(['AB'], { rows: 1, sep: 'dash' }, ctx, 500, 500, 0);
  assert.equal(conSpaz.mqP[0] - senza.mqP[0], Array.from('AB' + SEPS.dash).length * 2);
  assert.equal(buildMarquee(['A'], { rows: 999, sep: 'x' }, ctx, 100, 100, 0).lines.length, 60);
});
