// Prove sui battiti: tempo, posizione dei battiti, inizi di misura, su ritmi finti. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { findBeats } from '../src/seq/beats.ts';

/** Ritmo finto: un colpo (rumore che si spegne) a ogni battito, il primo di ogni misura più forte, un po' di rumore di fondo. */
function drums(bpm: number, dur: number, off: number, sr = 44100) {
  const x = new Float32Array(Math.round(sr * dur)), P = 60 / bpm;
  let s = 3;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < x.length; i++) x[i] = rnd() * .01;
  const truth: number[] = [];
  for (let k = 0, t = off; t < dur - .2; k++, t = off + k * P) {
    truth.push(t);
    const a = k % 4 === 0 ? .9 : .45, i0 = Math.round(t * sr);
    for (let i = 0; i < sr * .12 && i0 + i < x.length; i++) x[i0 + i] += a * rnd() * Math.exp(-i / (sr * .02)) + a * .6 * Math.sin(2 * Math.PI * 60 * i / sr) * Math.exp(-i / (sr * .05));
  }
  return { x, truth, sr };
}

for (const [bpm, off] of [[120, .3], [96, .1], [140, .55]] as const) {
  test(`ritmo a ${bpm} BPM: tempo, battiti e primo tempo della misura`, () => {
    const { x, truth, sr } = drums(bpm, 20, off);
    const r = findBeats([x], sr);
    assert.ok(Math.abs(r.bpm - bpm) <= 1.5, `bpm ${r.bpm}`);
    const inner = truth.filter(t => t > 2 && t < 18);
    const err = inner.map(t => Math.min(...r.beats.map(b => Math.abs(b - t))));
    assert.ok(Math.max(...err) < .012, `errore massimo ${Math.max(...err).toFixed(3)} s`);
    assert.ok(Math.abs(r.beats.length - truth.length) <= 2, `${r.beats.length} battiti su ${truth.length}`);
    const accents = truth.filter((_, k) => k % 4 === 0 && truth[k] > 2 && truth[k] < 18);
    for (const a of accents) assert.ok(r.downbeats.some(d => Math.abs(d - a) < .03), `primo tempo a ${a.toFixed(2)} s non trovato`);
  });
}

test('brano lungo a un tempo "storto" (119,7 BPM): i battiti non scivolano fino alla fine', () => {
  const { x, truth, sr } = drums(119.7, 130, .25);
  const r = findBeats([x], sr);
  assert.ok(Math.abs(r.bpm - 119.7) < .3, `bpm ${r.bpm}`);
  const err = truth.filter(t => t > 1).map(t => Math.min(...r.beats.map(b => Math.abs(b - t))));
  assert.ok(Math.max(...err) < .012, `errore massimo ${Math.max(...err).toFixed(3)} s`);
});
