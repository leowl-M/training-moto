// Prove della stabilizzazione: movimento trovato tra due immagini, percorso ammorbidito, correzioni e ritaglio. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { estimate, addMotion, smoothPath, corrections, corrAt, needZoom, shake } from '../src/seq/stab.ts';
import type { Track } from '../src/seq/stab.ts';

/** Immagine finta con tanti dettagli, spostata di (dx, dy) pixel (anche frazioni). */
function img(w: number, h: number, dx: number, dy: number) {
  const g = new Float32Array(w * h);
  const f = (x: number, y: number) => 128 + 60 * Math.sin(x * .37 + Math.sin(y * .11) * 3) * Math.cos(y * .29 + x * .05) + 40 * Math.sin((x + 2 * y) * .13);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = f(x - dx, y - dy);
  return g;
}

test('movimento tra due immagini, anche sotto il pixel', () => {
  const a = img(160, 240, 0, 0), b = img(160, 240, 2.5, -1.25), m = estimate(a, b, 160, 240);
  assert.ok(m.n >= 6, 'punti ' + m.n);
  assert.ok(Math.abs(m.tx - 2.5) < .2 && Math.abs(m.ty + 1.25) < .2, JSON.stringify(m));
  assert.ok(Math.abs(m.th) < .01 && Math.abs(m.ls) < .01);
});

test('percorso ammorbidito: la panoramica resta, il tremolio no', () => {
  const n = 200, pan = Array.from({ length: n }, (_, i) => i * .01), shaky = pan.map((v, i) => v + .02 * Math.sin(i * 2.1));
  const s = smoothPath(shaky, 6);
  assert.ok(Math.abs(s[100] - pan[100]) < .003);
  assert.ok(shake(s) < shake(shaky) * .2);
  assert.ok(smoothPath(pan, 6).every((v, i) => Math.abs(v - pan[i]) < 1e-6));   // una panoramica pulita non cambia
});

test('correzioni e zoom che nasconde i bordi', () => {
  const tr: Track = { v: 3, aspect: 9 / 16, t: [], x: [], y: [], a: [], s: [] };
  for (let i = 0; i < 100; i++) addMotion(tr, i / 25, i ? { tx: (i % 2 ? 1 : -1) * 2, ty: 0, th: 0, ls: 0, n: 20 } : null, 200);
  const r = corrections(tr, 'media', 0, 4);
  assert.equal(r.c.length, 100);
  assert.ok(r.zoom > 1 && r.zoom < 1.05, 'zoom ' + r.zoom);
  // dopo la correzione il percorso è quasi fermo
  const fixed = tr.x.map((x, i) => x + r.c[i].tx);
  assert.ok(shake(fixed) < shake(tr.x) * .2);
  // tra due fotogrammi la correzione si interpola; lo zoom è compreso
  const c = corrAt(tr, r, .02);
  assert.ok(Math.abs(c.tx - (r.c[0].tx + r.c[1].tx) / 2) < 1e-9 && c.sc >= r.zoom * .99);
  // camera ferma: tutto torna sul punto medio
  const f = corrections(tr, 'ferma', 0, 4);
  assert.ok(f.c.every((k, i) => Math.abs(tr.x[i] + k.tx - f.c[0].tx - tr.x[0]) < 1e-9));
  // troppo ritaglio: la correzione si riduce e lo zoom resta al massimo
  const big: Track = { v: 3, aspect: 1, t: [0, 1, 2], x: [0, .6, 0], y: [0, 0, 0], a: [0, 0, 0], s: [0, 0, 0] };
  assert.equal(corrections(big, 'ferma', 0, 2, true, 1.3).zoom, 1.3);
  assert.equal(needZoom({ tx: 0, ty: 0, th: 0, sc: 1 }, 1), 1);
  assert.ok(Math.abs(needZoom({ tx: .1, ty: 0, th: 0, sc: 1 }, 1) - 1.2) < 1e-9);
});
