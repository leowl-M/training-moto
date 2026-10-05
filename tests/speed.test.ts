// Prove su velocità delle clip, audio a tono costante e tempo scritto a mano. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { localT, splitClip, trimStart, trimEnd, setSpeed, spd } from '../src/seq/seq.ts';
import type { Clip, Seq } from '../src/seq/seq.ts';
import { removePauses } from '../src/seq/silence.ts';
import { stretch } from '../src/seq/stretch.ts';
import { parseTC } from '../src/core/timecode.ts';

const V = (o: Partial<Clip> = {}): Clip => ({ id: 'v', kind: 'video', track: 'V1', name: 'broll', start: 2, dur: 4, inp: 10, media: 'm', ...o });

test('velocità: tempo nella sorgente, divisione, rifilature', () => {
  const c = V({ speed: .5 });
  assert.equal(localT(c, 4), 11);                    // 2 s di timeline = 1 s di sorgente
  const [, b] = splitClip(c, 4, 'b')!; assert.equal(b.inp, 11); assert.equal(b.speed, .5);
  const t = trimStart(c, 3); assert.deepEqual([t.start, t.dur, t.inp], [3, 3, 10.5]);
  assert.equal(trimStart(c, -100).start, 0);          // non prima di 0
  assert.equal(trimEnd(c, 100, 12).dur, 4);           // file di 12 s, entrata a 10: 2 s di sorgente = 4 s al 50%
});

test('cambiare velocità: stesso pezzo di sorgente, le clip dopo si spostano solo se serve', () => {
  const s: Seq = { clips: [V({ fadeIn: 1 }), V({ id: 'w', start: 7, dur: 2 }), V({ id: 'x', start: 20, dur: 1 })], markers: [] };
  const c = s.clips[0];
  setSpeed(s, c, .5);
  assert.deepEqual([c.dur, c.fadeIn, c.speed], [8, 2, .5]);
  assert.equal(s.clips[1].start, 10);                 // spinta dopo la fine (2 + 8)
  assert.equal(s.clips[2].start, 20);                 // c'era spazio: resta
  setSpeed(s, c, 1);
  assert.equal(c.dur, 4); assert.equal(c.speed, undefined); assert.equal(spd(c), 1);
  assert.equal(s.clips[1].start, 10);                 // accorciando non si tira indietro nulla
});

test('elimina pause su una clip rallentata', () => {
  const s: Seq = { clips: [V({ start: 0, dur: 8, inp: 0, speed: .5 })], markers: [] };
  const r = removePauses(s, 'v', [[0, 1], [3, 4]], () => 'n')!;
  assert.equal(r.removed, 4);                          // 2 s di sorgente tolti = 4 s di timeline
  assert.deepEqual(s.clips.map(c => [c.start, c.inp, c.dur]), [[0, 0, 2], [2, 3, 2]]);
});

test('audio più veloce o più lento con lo stesso tono', () => {
  const sr = 8000, f = 220, x = new Float32Array(sr * 2);
  for (let i = 0; i < x.length; i++) x[i] = .5 * Math.sin(2 * Math.PI * f * i / sr);
  const freq = (y: Float32Array) => { let z = 0; for (let i = 1; i < y.length; i++) if (y[i - 1] < 0 && y[i] >= 0) z++; return z / (y.length / sr); };
  const rms = (y: Float32Array) => Math.sqrt(y.reduce((s, v) => s + v * v, 0) / y.length);
  for (const sp of [1.5, .5]) {
    const [y] = stretch([x], sr, sp);
    assert.equal(y.length, Math.floor(x.length / sp));
    assert.ok(Math.abs(freq(y) - f) < 4, `velocità ${sp}: ${freq(y)} Hz`);
    assert.ok(Math.abs(rms(y) - rms(x)) < .05, `velocità ${sp}: volume ${rms(y)}`);
  }
});

test('tempo scritto a mano', () => {
  assert.equal(parseTC('0:04:20', 30), 4 + 20 / 30);
  assert.equal(parseTC('4:20', 30), 4 + 20 / 30);
  assert.equal(parseTC('1:02:15', 30), 62.5);
  assert.equal(parseTC('420', 30), 4 + 20 / 30);      // come in Premiere
  assert.equal(parseTC('10000', 25), 60);             // 1:00:00
  assert.equal(parseTC('4,5', 30), 4.5);
  assert.equal(parseTC('4.5s', 30), 4.5);
  assert.equal(parseTC('+1:00', 30, 3), 4);
  assert.equal(parseTC('-10', 30, 3), 3 - 10 / 30);
  assert.equal(parseTC('-5:00', 30, 3), 0);
  assert.equal(parseTC('ciao', 30), null);
  assert.equal(parseTC('', 30), null);
});
