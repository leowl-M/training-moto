// Prove sul testo su tracciato (forme, campionamento, cammino). npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTable, sampleTable, warpAt, walkOffset, passOffset, repeatLines } from '../src/effects/textpath.ts';
import type { TpShape, Pt } from '../src/effects/textpath.ts';

const L = 1000, E = 100, P = (): Pt => ({ x: 0, y: 0, a: 0 });
const SHAPES: TpShape[] = ['arc', 'circle', 'wave', 'zig', 'spiral', 'loop', 'eight', 'heart', 'pill'];

test('la linea retta lascia il testo dov\'è', () => {
  const tb = buildTable('line', { L, E }), o = P();
  for (const [X, Y] of [[0, 0], [-300, 12], [450, -40], [2000, 5]]) {
    warpAt(tb, 0, 1, 1, X, Y, o);
    assert.ok(Math.abs(o.x - X) < 1e-6 && Math.abs(o.y - Y) < 1e-6 && Math.abs(o.a) < 1e-9, `${X},${Y}`);
  }
});

test('il cerchio con dimensione 100% fa un giro intero: raggio L/2π, centrato, parte dall\'alto verso destra', () => {
  const R = L / (2 * Math.PI), tb = buildTable('circle', { L, E, size: 100 }), o = P();
  for (let s = -500; s <= 500; s += 25) { sampleTable(tb, s, o); assert.ok(Math.abs(Math.hypot(o.x, o.y) - R) < R * .01, `s=${s}`); }
  sampleTable(tb, 0, o);
  assert.ok(Math.abs(o.x) < 1 && Math.abs(o.y + R) < 1 && Math.abs(o.a) < .02);
  // un quarto di giro più avanti: a destra, direzione verso il basso
  sampleTable(tb, L / 4, o);
  assert.ok(Math.abs(o.x - R) < 2 && Math.abs(o.y) < 2 && Math.abs(o.a - Math.PI / 2) < .02);
});

test('la distanza lungo il tracciato è costante: passi uguali coprono spazi uguali', () => {
  for (const shape of SHAPES) {
    const tb = buildTable(shape, { L, E, curve: 90, size: 100, amp: .5, cyc: 1.5, turns: 2, inner: 15, n: 2, rr: 1.6, asp: 3 }), a = P(), b = P();
    let worst = 0;
    for (let s = -450; s < 450; s += 7) { sampleTable(tb, s, a); sampleTable(tb, s + 2, b); worst = Math.max(worst, Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - 2)); }
    assert.ok(worst < (shape === 'heart' ? 1.3 : .25), `${shape} scarto ${worst.toFixed(3)}`);   // il cuore ha due punte: lì la corda è più corta dell'arco
  }
});

test('su un cerchio, spostarsi lungo Y avvicina o allontana dal centro', () => {
  const R = L / (2 * Math.PI), tb = buildTable('circle', { L, E, size: 100 }), o = P();
  warpAt(tb, 0, 1, 1, 0, 30, o);       // 30 px sotto la linea di base: verso il centro
  assert.ok(Math.abs(Math.hypot(o.x, o.y) - (R - 30)) < 1.5);
  warpAt(tb, 0, 1, 1, 0, -30, o);
  assert.ok(Math.abs(Math.hypot(o.x, o.y) - (R + 30)) < 1.5);
});

test('l\'arco: positivo verso l\'alto, negativo verso il basso, e prosegue dritto oltre la fine', () => {
  const up = buildTable('arc', { L, E, curve: 140 }), dn = buildTable('arc', { L, E, curve: -140 }), a = P(), b = P();
  sampleTable(up, 0, a); sampleTable(up, 500, b);
  assert.ok(b.y > a.y);                                  // i bordi stanno più in basso del centro
  sampleTable(dn, 0, a); sampleTable(dn, 500, b);
  assert.ok(b.y < a.y);
  sampleTable(up, 500, a); sampleTable(up, 800, b);      // oltre la fine: stessa direzione, 300 px dritti
  assert.ok(Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - 300) < .5 && Math.abs(a.a - b.a) < 1e-9);
});

test('le forme periodiche si ripetono e quelle chiuse si richiudono', () => {
  const w = buildTable('wave', { L, E, amp: .5, cyc: 2 }), a = P(), b = P();
  sampleTable(w, 130, a); sampleTable(w, 130 + w.len, b);
  assert.ok(Math.abs(b.x - a.x - w.dx) < 1e-6 && Math.abs(b.y - a.y) < 1e-6 && w.dx > 0);
  assert.ok(Math.abs(w.dx - L / 2) < 1e-6);              // 2 onde sul testo
  for (const sh of ['circle', 'eight', 'heart', 'pill'] as TpShape[]) {
    const c = buildTable(sh, { L, E, size: 100, asp: 3 });
    sampleTable(c, 77, a); sampleTable(c, 77 + c.len, b);
    assert.ok(Math.hypot(b.x - a.x, b.y - a.y) < 1e-6, sh);
    assert.ok(Math.abs(c.len - L) < 1e-6, `${sh} perimetro`);
  }
});

test('rovesciare e ruotare il tracciato', () => {
  const up = buildTable('arc', { L, E, curve: 120 }), fl = buildTable('arc', { L, E, curve: 120, flip: true }), a = P(), b = P();
  sampleTable(up, 450, a); sampleTable(fl, 450, b);
  assert.ok(Math.abs(a.y + b.y) < 1e-6 && Math.abs(a.x - b.x) < 1e-6);
  const r = buildTable('wave', { L, E, amp: .4, cyc: 1, rot: 90 });
  sampleTable(r, 100, a);                                // onda ruotata di 90°: avanza in verticale
  assert.ok(Math.abs(a.y) > Math.abs(a.x));
});

test('con env = 0 il testo resta dritto, con valori intermedi si piega a metà', () => {
  const tb = buildTable('arc', { L, E, curve: 180 }), o = P();
  warpAt(tb, 0, 0, 1, 300, 10, o);
  assert.ok(Math.abs(o.x - 300) < 1e-9 && Math.abs(o.y - 10) < 1e-9 && o.a === 0);
  const full = warpAt(tb, 0, 1, 1, 300, 10, P());
  warpAt(tb, 0, .5, 1, 300, 10, o);
  assert.ok(Math.abs(o.x - (300 + full.x) / 2) < 1e-9 && Math.abs(o.a - full.a / 2) < 1e-9);
  warpAt(tb, 0, 1, 0, 300, 10, o);                       // rotazione lettere a 0: restano dritte ma seguono la posizione
  assert.equal(o.a, 0);
});

test('il cammino: velocità, partenza, avanti e indietro, ripartenza sulle forme aperte', () => {
  assert.equal(walkOffset({ speed: 2, start: 0 }, 3, L, E, 'closed', 0), 600);
  assert.equal(walkOffset({ speed: 0, start: 10 }, 5, L, E, 'closed', 0), 100);
  assert.ok(Math.abs(walkOffset({ speed: 1, pp: true }, 1e4, L, E, 'closed', 0)) <= L * .5 + 1e-9);
  const span = 5000;
  for (const t of [0, 1.3, 9, 77]) { const w = walkOffset({ speed: 3 }, t, L, E, 'open', span); assert.ok(w >= -span / 2 && w < span / 2); }
  assert.equal(walkOffset({ speed: 1 }, 0, L, E, 'open', span), 0);
});

test('con il cammino le lettere salgono sull\'arco e poi scendono dall\'altra parte', () => {
  const tb = buildTable('arc', { L, E, curve: 140 }), a = P(), b = P(), c = P();
  warpAt(tb, -500, 1, 1, 0, 0, a);     // a metà prima dell'inizio dell'arco
  warpAt(tb, 0, 1, 1, 0, 0, b);        // in cima
  warpAt(tb, 500, 1, 1, 0, 0, c);
  assert.ok(a.y > b.y && c.y > b.y && a.x < b.x && b.x < c.x);
});

test('il passaggio: parte dietro, a metà è a riposo, finisce davanti, ed è più lento al centro', () => {
  const o = { slow: 3, dist: 1.5, pass: 1 }, T = 4;
  assert.ok(Math.abs(passOffset(o, 0, T, L) + 1.5 * L) < 1e-9);
  assert.ok(Math.abs(passOffset(o, T / 2, T, L)) < 1e-9);
  assert.ok(Math.abs(passOffset(o, T, T, L) - 1.5 * L) < 1e-9);
  const v = (t: number) => Math.abs(passOffset(o, t + .01, T, L) - passOffset(o, t, T, L));
  assert.ok(v(0.2) > 4 * v(T / 2 - .005) && v(T - .2) > 4 * v(T / 2 - .005));   // veloce ai lati, lento al centro
  const lin = { slow: 1, dist: 1, pass: 1 };
  assert.ok(Math.abs(v2(lin, 1) - v2(lin, 3)) < 1e-6);                          // slow = 1: velocità costante
  assert.ok(passOffset({ ...o, rev: true }, 0, T, L) > 0);                      // verso opposto
  const two = { slow: 3, dist: 1, pass: 2 };
  assert.ok(Math.abs(passOffset(two, T / 4, T, L)) < 1e-9 && Math.abs(passOffset(two, 3 * T / 4, T, L)) < 1e-9);   // due passaggi: a riposo a un quarto e a tre quarti
  function v2(q: any, t: number) { return passOffset(q, t + .01, 4, L) - passOffset(q, t, 4, L); }
});

test('la parola si ripete con il separatore scelto', () => {
  assert.deepEqual(repeatLines(['MOTO'], 3, 'dot'), ['MOTO  •  MOTO  •  MOTO']);
  assert.deepEqual(repeatLines(['A', '', 'B'], 2, 'dash'), ['A  —  A', '', 'B  —  B']);
  assert.deepEqual(repeatLines(['A'], 1, 'dot'), ['A']);
  assert.equal(repeatLines(['A'], 999, 'space')[0].split('A').length - 1, 40);
});
