// Prove sulle traiettorie. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathPoint, pathAngle, pathOffset } from '../src/effects/paths.ts';
import type { PathShape } from '../src/effects/paths.ts';

const O = { D: 10, amp: 2, cyc: 2, R: 1.5, loops: 1 };
const shapes: PathShape[] = ['arc', 'wave', 'loop', 's', 'zig'];
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('ogni traiettoria arriva a riposo (0, 0) e parte a distanza D dietro', () => {
  for (const s of shapes) {
    const e = pathPoint(s, 1, O), b = pathPoint(s, 0, O);
    near(e.a, 0); near(e.b, 0);
    near(b.a, -O.D); near(b.b, 0);
  }
});

test('l\'arco si gonfia a metà percorso di ampiezza amp', () => {
  const m = pathPoint('arc', .5, O);
  near(m.b, O.amp); near(m.a, -O.D / 2);
  assert.equal(pathPoint('arc', .5, { ...O, amp: -2 }).b, -2);
});

test('l\'onda fa cyc oscillazioni e la curva a S ne fa una', () => {
  const crossings = (s: PathShape, cyc: number) => { let n = 0, prev = 0; for (let i = 1; i < 2000; i++) { const b = pathPoint(s, i / 2000, { ...O, cyc }).b; if (prev !== 0 && Math.sign(b) !== 0 && Math.sign(b) !== Math.sign(prev)) n++; if (b !== 0) prev = b; } return n; };
  assert.ok(crossings('wave', 3) > crossings('wave', 1));
  assert.ok(crossings('s', 1) >= 1);
});

test('lo zigzag ha tratti dritti e punte tra -amp e amp', () => {
  let max = 0; for (let i = 0; i <= 1000; i++) max = Math.max(max, Math.abs(pathPoint('zig', i / 1000, O).b));
  assert.ok(max <= O.amp + 1e-9 && max > O.amp * .9);
});

test('l\'anello torna indietro (fa un cerchio) quando il raggio è abbastanza grande', () => {
  const big = { ...O, R: 3 }; let backwards = false, prev = pathPoint('loop', 0, big).a;
  for (let i = 1; i <= 1000; i++) { const a = pathPoint('loop', i / 1000, big).a; if (a < prev - 1e-9) backwards = true; prev = a; }
  assert.ok(backwards);
  prev = pathPoint('loop', 0, { ...O, R: .2 }).a; let mono = true;
  for (let i = 1; i <= 1000; i++) { const a = pathPoint('loop', i / 1000, { ...O, R: .2 }).a; if (a < prev - 1e-9) mono = false; prev = a; }
  assert.ok(mono);
});

test('l\'angolo lungo la curva: 0 su un rettilineo, diverso nelle curve', () => {
  near(pathAngle('arc', .5, { ...O, amp: 0 }), 0, 1e-6);
  assert.ok(Math.abs(pathAngle('arc', .1, O)) > 5);
  assert.ok(pathAngle('arc', .1, O) > 0 && pathAngle('arc', .9, O) < 0);   // sale e poi scende
});

test('l\'offset ruota con la direzione di marcia e col lato', () => {
  const r = pathOffset('arc', 0, O, 1, 0, 1, 100);              // marcia verso destra: parte a sinistra
  near(r.x, -1000); near(r.y, 0);
  const d = pathOffset('arc', 0, O, 0, 1, 1, 100);              // marcia verso il basso: parte in alto
  near(d.x, 0); near(d.y, -1000);
  const m1 = pathOffset('arc', .5, O, 1, 0, 1, 100), m2 = pathOffset('arc', .5, O, 1, 0, -1, 100);
  near(m1.y, -m2.y); assert.notEqual(m1.y, 0);
  const fine = pathOffset('wave', 1, O, .6, .8, 1, 50); near(fine.x, 0); near(fine.y, 0);
});

test('il progresso fuori da 0..1 non rompe niente', () => {
  for (const s of shapes) { const a = pathPoint(s, -3, O), b = pathPoint(s, 7, O); assert.ok(Number.isFinite(a.a + a.b + b.a + b.b)); }
});
