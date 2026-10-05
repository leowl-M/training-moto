// Prove sull'inquadratura per formato. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { framedRect, frameFor } from '../src/seq/frame.ts';

test('video orizzontale in un quadro 9:16: centro, spostamento fino al bordo, zoom', () => {
  const c = framedRect(1920, 1080, 1080, 1920, 'cover', { x: .5, y: .5, z: 1 });
  assert.ok(Math.abs(c.rw - 3413.33) < .1 && c.rh === 1920);
  assert.ok(Math.abs(c.x0 - (1080 - c.rw) / 2) < 1e-9);                    // centrato
  const l = framedRect(1920, 1080, 1080, 1920, 'cover', { x: .2, y: .5, z: 1 });
  assert.ok(Math.abs(l.fx - .2) < 1e-9);                                     // soggetto a sinistra: si vede la parte sinistra
  const edge = framedRect(1920, 1080, 1080, 1920, 'cover', { x: 0, y: .5, z: 1 });
  assert.equal(edge.x0, 0); assert.ok(Math.abs(edge.fx - 1080 / 2 / edge.rw) < 1e-9);   // fermo al bordo: niente vuoto
  const z = framedRect(1920, 1080, 1080, 1920, 'cover', { x: .5, y: .3, z: 2 });
  assert.equal(z.rh, 3840); assert.ok(Math.abs(z.fy - .3) < 1e-9);          // con lo zoom anche in verticale si può spostare
});

test('Intero: resta dentro il quadro; inquadratura di partenza per formato', () => {
  const c = framedRect(1920, 1080, 1080, 1920, 'contain', { x: .9, y: .5, z: 1 });
  assert.equal(c.x0, 0); assert.equal(c.rw, 1080);
  assert.deepEqual(frameFor({}, '9:16'), { x: .5, y: .5, z: 1 });
  assert.deepEqual(frameFor({ frame: { '9:16': { x: .3, y: .5, z: 1.2 } } }, '9:16'), { x: .3, y: .5, z: 1.2 });
  assert.deepEqual(frameFor({ frame: { '9:16': { x: .3, y: .5, z: 1.2 } } }, '16:9'), { x: .5, y: .5, z: 1 });
});
