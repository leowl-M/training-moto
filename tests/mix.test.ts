// Prove sul mix: volume percepito (LUFS), limitatore, musica sotto la voce. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { loudness, gainTo, limit, voiceRegions, duckAt, duckPoints } from '../src/seq/mix.ts';

const sine = (sr: number, f: number, dur: number, amp: number) => { const a = new Float32Array(Math.round(sr * dur)); for (let i = 0; i < a.length; i++) a[i] = amp * Math.sin(2 * Math.PI * f * i / sr); return a; };

test('volume percepito come da norma EBU (sinusoide 1 kHz a −23 dBFS su due canali = −23 LUFS)', () => {
  for (const sr of [48000, 44100]) {
    const s = sine(sr, 1000, 5, 10 ** (-23 / 20));
    assert.ok(Math.abs(loudness([s, s], sr) - -23) < .1, `${sr}: ${loudness([s, s], sr)}`);
  }
  const s = sine(48000, 1000, 5, 10 ** (-20 / 20));
  assert.ok(Math.abs(loudness([s, s], 48000) - -20) < .1);
  assert.equal(loudness([new Float32Array(48000)], 48000), -Infinity);       // silenzio
  // le pause non abbassano la misura (soglia relativa): metà voce e metà quasi-silenzio leggono come la sola voce
  const half = new Float32Array(48000 * 10); half.set(sine(48000, 1000, 5, 10 ** (-23 / 20)));
  assert.ok(Math.abs(loudness([half, half], 48000) - -23) < .3);
  assert.ok(Math.abs(20 * Math.log10(gainTo(-20, -14)) - 6) < 1e-9);
  assert.equal(gainTo(-60, -14), 10);                                          // non oltre +20 dB
});

test('limitatore: niente oltre il tetto, il resto intatto', () => {
  const sr = 48000, x = sine(sr, 200, 1, .5);
  for (let i = 24000; i < 24480; i++) x[i] *= 3;                               // un colpo forte a metà
  const [y] = limit([x], sr, -1);
  const max = y.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  assert.ok(max <= 10 ** (-1 / 20) + 1e-6, String(max));
  assert.ok(Math.abs(y[4800] - x[4800]) < 1e-6);                               // lontano dal colpo non cambia
});

test('musica sotto la voce', () => {
  const R = voiceRegions([[1, 2], [2.5, 3], [6, 7]], .8);
  assert.deepEqual(R, [[1, 3], [6, 7]]);                                       // 0,5 s tra due frasi: resta giù
  const o = { depthDb: 12, attack: .2, release: .5 }, d = 10 ** (-12 / 20);
  assert.equal(duckAt(R, o, 0), 1);
  assert.ok(Math.abs(duckAt(R, o, 2) - d) < 1e-9);
  assert.ok(Math.abs(duckAt(R, o, .9) - (1 + d) / 2) < 1e-9);                 // a metà discesa
  assert.ok(Math.abs(duckAt(R, o, 3.25) - (1 + d) / 2) < 1e-9);               // a metà risalita
  const P = duckPoints(R, o, 0, 10);
  assert.deepEqual(P.map(p => p[0]), [0, .8, 1, 3, 3.5, 5.8, 6, 7, 7.5, 10]);
});
