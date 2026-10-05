// Prove sugli SVG animati: forme, riconoscimento di linee e cerchi, ruoli, tempi della costruzione. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeToD, lineFromD, isEllipseD, classify, roleOf, partOf, extendToRect, spansDoc } from '../src/svg/geom.ts';
import { stag, stagEnd, guideSeg, markState, moveT, animEnd, enterState } from '../src/svg/anim.ts';
import type { SvgAnim } from '../src/svg/anim.ts';

test('le forme diventano tracciati', () => {
  assert.equal(shapeToD('line', { x1: 0, y1: 1, x2: 5, y2: 6 }), 'M0 1L5 6');
  assert.equal(shapeToD('rect', { x: 1, y: 2, width: 3, height: 4 }), 'M1 2H4V6H1Z');
  assert.match(shapeToD('rect', { x: 0, y: 0, width: 10, height: 10, rx: 2 })!, /A2 2 0 0 1/);
  assert.match(shapeToD('circle', { cx: 10, cy: 10, r: 5 })!, /^M5 10A5 5 0 1 0 15 10A5 5/);
  assert.equal(shapeToD('polygon', { points: '0,0 10,0 10,10' }), 'M0 0L10 0L10 10Z');
  assert.equal(shapeToD('circle', { cx: 0, cy: 0, r: 0 }), null);
});

test('riconosce le linee dritte come le esporta Figma', () => {
  assert.deepEqual(lineFromD('M0 321.205H804'), [0, 321.205, 804, 321.205]);
  assert.deepEqual(lineFromD('M444.277 0V804'), [444.277, 0, 444.277, 804]);
  assert.deepEqual(lineFromD('M634.966 117.732L66.457 686.241'), [634.966, 117.732, 66.457, 686.241]);
  assert.deepEqual(lineFromD('M10 10l5 -5'), [10, 10, 15, 5]);
  assert.equal(lineFromD('M0 0H10V10'), null);
  assert.equal(lineFromD('M0 0C1 1 2 2 3 3'), null);
});

test('riconosce i cerchi (4 curve) e li distingue dalle forme', () => {
  const c = 'M400.449 692.739C540.59 692.739 654.198 579.131 654.198 438.99C654.198 298.848 540.59 185.24 400.449 185.24C260.307 185.24 146.699 298.848 146.699 438.99C146.699 579.131 260.307 692.739 400.449 692.739Z';
  assert.ok(isEllipseD(c));
  assert.ok(isEllipseD(shapeToD('circle', { cx: 0, cy: 0, r: 3 })!));
  assert.ok(!isEllipseD('M0 0H10V10Z'));
  assert.equal(classify({ tag: 'path', d: c, fill: false, stroke: true, w: 507, h: 507 }, 804), 'circle');
  assert.equal(classify({ tag: 'path', d: c, fill: false, stroke: true, w: 23, h: 23 }, 804), 'dot');
  assert.equal(classify({ tag: 'path', d: 'M0 1H5', fill: false, stroke: true, w: 5, h: 0 }, 804), 'line');
  assert.equal(classify({ tag: 'path', d: c, fill: true, stroke: false, w: 507, h: 507 }, 804), 'shape');
  assert.equal(classify({ tag: 'path', d: 'M0 0H10V10L3 4Z', fill: false, stroke: true, w: 10, h: 10 }, 804), 'outline');
});

test('ruoli: costruzione e marchio', () => {
  assert.equal(roleOf('line', true), 'guide');
  assert.equal(roleOf('outline', true), 'guide');
  assert.equal(roleOf('shape', true), 'mark');
  assert.equal(roleOf('outline', false), 'mark');                 // disegno di sole linee: si disegna e resta
  assert.equal(roleOf('shape', true, 'Griglia di costruzione'), 'guide');
  assert.equal(roleOf('outline', true, 'Logo'), 'mark');
  assert.equal(partOf('naming Group'), 'naming');
  assert.equal(partOf('payoff'), 'payoff');
  assert.equal(partOf('Claim'), 'payoff');
  assert.equal(partOf('marchio gruppo_marchio'), 'mark');
  assert.equal(partOf(''), 'mark');
});

test('allunga le linee fino ai bordi del quadro', () => {
  assert.deepEqual(extendToRect(10, 50, 20, 50, 100, 80), [0, 50, 100, 50]);
  assert.deepEqual(extendToRect(50, 10, 50, 0, 100, 80), [50, 80, 50, 0]);      // la direzione resta la stessa
  const d = extendToRect(10, 10, 20, 20, 100, 80)!;
  assert.deepEqual(d.map(v => Math.round(v)), [0, 0, 80, 80]);
  assert.equal(extendToRect(-10, 200, 10, 200, 100, 80), null);
  assert.ok(spansDoc([0, 321, 804, 321], [0, 0, 804, 804]));
  assert.ok(!spansDoc([634, 117, 66, 686], [0, 0, 804, 804]));
  assert.ok(spansDoc([0, 321, 804, 321], [0, 0, 2060, 804]));             // nel logo completo le guide partono dal bordo sinistro
});

const A: SvgAnim = { mode: 'build', gStart: 0, gDur: 2, gStag: .5, mStart: 1, mDur: 1, oMode: 'retract', oAt: 3, oDur: 1, fAt: 3.2, fDur: .6, mv: true, mvAt: 4, mvDur: 1 };

test('sfasamento: il primo parte subito, l\'ultimo finisce alla fine della finestra', () => {
  assert.equal(stag(0, 0, 2, .5, 0, 5), 0);
  assert.equal(stag(1, 0, 2, .5, 0, 5), 1);
  assert.equal(stag(1, 0, 2, .5, 4, 5), 0);
  assert.equal(stag(2, 0, 2, .5, 4, 5), 1);
  assert.equal(stagEnd(0, 2, .5, 4, 5), 2);
  assert.equal(stag(.5, 0, 2, 0, 3, 5), .25);
});

test('costruzione: le linee si disegnano, poi si ritirano e spariscono', () => {
  assert.deepEqual(guideSeg(A, 0, 3, 0), { a: 0, b: 0, op: 1 });
  const mid = guideSeg(A, 0, 3, .5); assert.ok(mid.b > 0 && mid.b < 1);
  assert.deepEqual(guideSeg(A, 2, 3, 2.5), { a: 0, b: 1, op: 1 });
  const out = guideSeg(A, 0, 3, 3.3); assert.ok(out.a > 0 && out.a < 1 && out.b === 1);
  assert.equal(guideSeg(A, 2, 3, 4.1).op, 0);
  const fade = guideSeg({ ...A, oMode: 'fade' }, 0, 3, 3.5); assert.ok(fade.op > 0 && fade.op < 1 && fade.a === 0);
  assert.equal(guideSeg({ ...A, oMode: 'none' }, 0, 3, 9).op, 1);
});

test('marchio: bozza, poi pieno; nel modo "draw" si riempie quando il contorno è chiuso', () => {
  assert.deepEqual(markState(A, 0, 1, 0), { sketch: 0, fill: 0, draw: 0 });
  assert.equal(markState(A, 0, 1, 2).sketch, 1);
  assert.equal(markState(A, 0, 1, 2).fill, 0);
  assert.equal(markState(A, 0, 1, 4).fill, 1);
  const D: SvgAnim = { ...A, mode: 'draw' };
  const s = markState(D, 0, 2, 1.1); assert.equal(s.draw, 1); assert.ok(s.fill > 0 && s.fill < 1);
  assert.equal(markState(D, 1, 2, 1.1).fill, 0);
  assert.deepEqual(markState({ ...A, mode: 'none' }, 0, 1, 0), { sketch: 1, fill: 1, draw: 0 });
});

test('spostamento e durata totale', () => {
  assert.equal(moveT(A, 3.9), 0);
  assert.equal(moveT(A, 4.5), .5);
  assert.equal(moveT(A, 6), 1);
  assert.equal(moveT({ ...A, mv: false }, 6), 0);
  assert.equal(animEnd(A), 5);
  assert.equal(animEnd({ ...A, mv: false }), 4);
  assert.equal(animEnd({ ...A, mode: 'draw', mv: false }), 2.6);
  assert.equal(animEnd({ ...A, lock: true, nAt: 4.6, nDur: 1, pAt: 5.4, pDur: .8, hold: 1.5 }), 7.7);
});

test('entrate di naming e payoff', () => {
  assert.equal(enterState('rise', 1, 1, .5, 0, 3, .9).p, 0);
  assert.equal(enterState('rise', 1, 1, .5, 2, 3, 2).p, 1);
  assert.ok(enterState('rise', 1, 1, .5, 0, 3, 1.3).p > enterState('rise', 1, 1, .5, 2, 3, 1.3).p);   // da sinistra a destra
  const w = enterState('wipe', 1, 1, .5, 2, 3, 1.5); assert.equal(w.p, .5);                         // la tendina è una sola per tutto il gruppo
  const d1 = enterState('draw', 0, 1, 0, 0, 1, .7); assert.equal(d1.draw, 1); assert.equal(d1.fill, 0);
  assert.equal(enterState('draw', 0, 1, 0, 0, 1, 1).fill, 1);
});

test('inquadrature: ferme, passaggio fra una e l\'altra, allargamento finale', async () => {
  const { shotPhase, newShots } = await import('../src/svg/anim.ts');
  const S = { ...newShots(), on: true, cut: false, tr: .5, list: [{ area: 'tl', at: 0, dur: 1, z: 1 }, { area: 'br', at: 1.4, dur: 1, z: 1 }] };
  assert.deepEqual(shotPhase(S, .5), { k: 0, kind: 'hold', f: 0, p: .5 });
  const mv = shotPhase(S, 1.2); assert.equal(mv.kind, 'move'); assert.ok(Math.abs(mv.f - .5) < 1e-9);
  assert.equal(shotPhase({ ...S, cut: true }, 1.2).kind, 'hold');            // taglio netto: resta sulla prima fino alla seconda
  assert.equal(shotPhase(S, 2).k, 1);
  assert.equal(shotPhase(S, 2.6).kind, 'out');
  assert.equal(shotPhase(S, 3).kind, 'done');
  assert.equal(shotPhase({ ...S, on: false }, .5).kind, 'done');
  assert.equal(shotPhase({ ...S, cut: true }, 2.6).kind, 'done');            // stacco netto anche verso il quadro intero
  const { shotsLen, animTime } = await import('../src/svg/anim.ts');
  assert.equal(shotsLen(S), 2.4);
  assert.equal(animTime(S, .5), .5);                                          // prima ripresa: dall'inizio
  assert.ok(Math.abs(animTime(S, 1.9) - .5) < 1e-9);                          // seconda ripresa: di nuovo dall'inizio
  assert.ok(Math.abs(animTime(S, 1.2) - 1.2) < 1e-9);                         // fra le due (senza stacco netto) continua la prima
  assert.ok(Math.abs(animTime(S, 3) - .6) < 1e-9);                            // sul quadro intero riparte da capo
  assert.equal(shotsLen({ ...S, restart: false }), 0);
  assert.equal(animTime({ ...S, on: false }, 3), 3);
});
