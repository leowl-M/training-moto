// Prove sui canali audio: voce su un lato, traccia di sicurezza, mono, stereo. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeChannels, applyChannels } from '../src/seq/channels.ts';

let s = 7;
const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
const voice = (n: number) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = .3 * Math.sin(i / 9) * (1 + .5 * rnd()); return a; };
const scale = (a: Float32Array, k: number) => a.map(v => v * k);

test('riconosce come è stato registrato', () => {
  const v = voice(48000), quiet = voice(48000).map(() => rnd() * 1e-4);
  const one = analyzeChannels([v, quiet]); assert.equal(one.kind, 'one-side'); assert.equal(one.use, 'left');
  const oneR = analyzeChannels([quiet, v]); assert.equal(oneR.use, 'right');
  const safe = analyzeChannels([scale(v, .5), v]); assert.equal(safe.kind, 'safety'); assert.equal(safe.use, 'right');   // la principale è la più forte
  assert.equal(analyzeChannels([v, v]).kind, 'mono');
  assert.equal(analyzeChannels([voice(48000), voice(48000)]).kind, 'stereo');
  assert.equal(analyzeChannels([v]).kind, 'mono');
});

test('prepara i due canali', () => {
  const L = new Float32Array([1, 2]), R = new Float32Array([3, 4]);
  assert.deepEqual(applyChannels([L, R], 'left').map(a => [...a]), [[1, 2], [1, 2]]);
  assert.deepEqual(applyChannels([L, R], 'right').map(a => [...a]), [[3, 4], [3, 4]]);
  assert.deepEqual(applyChannels([L, R], 'mono').map(a => [...a]), [[2, 3], [2, 3]]);
  assert.deepEqual(applyChannels([L, R], 'stereo').map(a => [...a]), [[1, 2], [3, 4]]);
  assert.deepEqual(applyChannels([L], 'left').map(a => [...a]), [[1, 2], [1, 2]]);
});
