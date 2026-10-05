// Prove sulla camera 2D: keyframe, inquadrature, inseguimento, tremolio, matrice. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { fitPose, mixPose, keysPose, followPoint, shake, camPose, camMatrix, isIdent, newCamera, IDENT } from '../src/camera/camera.ts';
import type { Camera, Box } from '../src/camera/camera.ts';

const W = 1920, H = 1080, lin = () => (x: number) => x, close = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;
const none = () => null;

test('inquadrare un riquadro: centro e zoom con il margine', () => {
  const p = fitPose([860, 440, 200, 200], W, H, 10);
  assert.ok(close(p.x, 50) && close(p.y, 50));
  assert.ok(close(p.z, H * .8 / 200));
  const q = fitPose([0, 0, W, H], W, H, 0); assert.ok(close(q.z, 1));
});

test('keyframe: fermi prima e dopo, interpolati in mezzo, zoom geometrico', () => {
  const keys = [{ t: 1, x: 50, y: 50, z: 1 }, { t: 3, x: 70, y: 40, z: 4, r: 10 }];
  assert.deepEqual(keysPose(keys, 0, W, H, none, lin), { x: 50, y: 50, z: 1, r: 0 });
  assert.deepEqual(keysPose(keys, 9, W, H, none, lin), { x: 70, y: 40, z: 4, r: 10 });
  const m = keysPose(keys, 2, W, H, none, lin);
  assert.ok(close(m.z, 2));                 // a metà tempo lo zoom è la media geometrica
  assert.ok(close(m.r, 5));
  assert.ok(m.x > 50 && m.x < 70);
  assert.deepEqual(keysPose([], 2, W, H, none, lin), IDENT);
});

test('mescolare due pose: agli estremi si ottengono le pose stesse', () => {
  const a = { x: 30, y: 30, z: 1, r: 0 }, b = { x: 60, y: 70, z: 3, r: 0 };
  assert.deepEqual(mixPose(a, b, 0), a);
  const e = mixPose(a, b, 1); assert.ok(close(e.x, 60) && close(e.y, 70) && close(e.z, 3));
  const same = mixPose(a, { ...b, z: 1 }, .5); assert.ok(close(same.x, 45));
});

test('keyframe "inquadra" risolti dal motore', () => {
  const res = (t: string): Box | null => (t === 'marchio' ? [100, 100, 200, 200] : null);
  const p = keysPose([{ t: 0, mode: 'fit', target: 'marchio', margin: 0 }], 0, W, H, res, lin);
  assert.ok(close(p.x, 200 / W * 100) && close(p.z, H / 200));
  const q = keysPose([{ t: 0, mode: 'fit', target: 'manca', x: 40 }], 0, W, H, res, lin);
  assert.equal(q.x, 40);                    // target mancante: valori liberi
});

test('inseguimento ammorbidito: resta un po\' indietro rispetto al punto che si muove', () => {
  const res = (_: string, t: number): Box => [t * 100, 0, 0, 0];
  const p = followPoint('pen', 2, .3, res)!;
  assert.ok(p[0] < 200 && p[0] > 140);
  const q = followPoint('pen', 2, 0, res)!;
  assert.equal(q[0], 200);
});

test('camera: spenta = inquadratura normale; inseguimento con entrata e uscita morbide', () => {
  const c: Camera = newCamera();
  assert.ok(isIdent(camPose(c, 1, W, H, none, lin)));
  c.on = true; c.follow = { on: true, target: 'p', from: 1, to: 3, z: 2, smooth: 0, ramp: .5 };
  const res = (): Box => [W * .75, H * .25, 0, 0];
  assert.ok(isIdent(camPose(c, .9, W, H, res, lin)));
  const mid = camPose(c, 2, W, H, res, lin); assert.ok(close(mid.x, 75) && close(mid.y, 25) && close(mid.z, 2));
  const ramp = camPose(c, 1.25, W, H, res, lin); assert.ok(ramp.z > 1 && ramp.z < 2);
  assert.ok(isIdent(camPose(c, 3.1, W, H, res, lin)));
});

test('tremolio: ripetibile, nullo se spento, entro l\'ampiezza', () => {
  assert.deepEqual(shake({ amt: 0, hz: 1, rot: 0 }, 3), { dx: 0, dy: 0, dr: 0 });
  const a = shake({ amt: .5, hz: 1.2, rot: .3 }, 2.7), b = shake({ amt: .5, hz: 1.2, rot: .3 }, 2.7);
  assert.deepEqual(a, b);
  assert.ok(Math.abs(a.dx) <= .5 + 1e-9 && Math.abs(a.dr) <= .3 + 1e-9);
});

test('matrice: il punto inquadrato finisce al centro del quadro', () => {
  const m = camMatrix({ x: 25, y: 25, z: 2, r: 30 }, W, H), px = W * .25, py = H * .25;
  assert.ok(close(m[0] * px + m[2] * py + m[4], W / 2) && close(m[1] * px + m[3] * py + m[5], H / 2));
  assert.deepEqual(camMatrix(IDENT, W, H).map(v => Math.round(v * 1e9) / 1e9 + 0), [1, 0, 0, 1, 0, 0]);
});
