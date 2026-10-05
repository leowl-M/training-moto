// Prove di "Elimina pause": voce trovata nei punti giusti, pause tagliate con margine, resto della timeline ricompattato. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { energy, voiceRuns, keepRanges, pausesIn, mapTime, removePauses, PAUSE_PRESETS } from '../src/seq/silence.ts';
import type { Seq } from '../src/seq/seq.ts';

const SR = 8000;
/** Audio finto: voce (rumore forte) negli intervalli dati, fruscio leggero altrove; il secondo canale è vuoto come nel DJI. */
function fake(dur: number, voice: [number, number][]) {
  const L = new Float32Array(dur * SR), R = new Float32Array(dur * SR);
  let s = 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < L.length; i++) { const t = i / SR, on = voice.some(([a, b]) => t >= a && t < b); L[i] = rnd() * (on ? .3 : .003); }
  return [L, R];
}
const near = (a: number, b: number, tol = .04) => Math.abs(a - b) <= tol;

test('la voce si trova dove c\'è, anche con un canale vuoto', () => {
  const runs = voiceRuns(energy(fake(6, [[1, 2], [2.2, 3], [4, 5]]), SR));
  assert.equal(runs.length, 3);
  assert.ok(near(runs[0][0], 1) && near(runs[0][1], 2) && near(runs[2][0], 4) && near(runs[2][1], 5), JSON.stringify(runs));
});

test('solo le pause lunghe si tagliano, con margine attorno alla voce', () => {
  const runs: [number, number][] = [[1, 2], [2.2, 3], [4, 5]];
  const k = keepRanges(runs, 6, PAUSE_PRESETS.media);            // 0,2 s tra le prime due: resta; 1 s: si taglia
  assert.deepEqual(k.map(r => r.map(v => +v.toFixed(2))), [[.85, 3.15], [3.85, 5.15]]);
  assert.deepEqual(pausesIn(k, 0, 6).map(r => r.map(v => +v.toFixed(2))), [[0, .85], [3.15, 3.85], [5.15, 6]]);
  assert.deepEqual(keepRanges(runs, 6, { minPause: 2, pad: .1 }).map(r => r.map(v => +v.toFixed(2))), [[.9, 5.1]]);
  assert.deepEqual(keepRanges([], 6, PAUSE_PRESETS.media), [[0, 6]]);
});

test('tempo dopo i tagli', () => {
  const cuts: [number, number][] = [[1, 2], [5, 6]];
  assert.equal(mapTime(.5, cuts), .5);
  assert.equal(mapTime(1.5, cuts), 1);         // dentro un taglio: al punto del taglio
  assert.equal(mapTime(3, cuts), 2);
  assert.equal(mapTime(10, cuts), 8);
});

test('taglio della clip: pezzi contigui, il resto si sposta, niente sovrapposizioni', () => {
  const s: Seq = { clips: [
    { id: 'p', kind: 'video', track: 'V1', name: 'parlato', start: 2, dur: 6, inp: 0, media: 'm', fadeIn: .5, fadeOut: .5 },
    { id: 'g', kind: 'motion', track: 'G1', name: 'titolo', start: 6, dur: 2, inp: 0 },
    { id: 'b1', kind: 'video', track: 'V2', name: 'a', start: 3, dur: 2, inp: 0, media: 'b' },
    { id: 'b2', kind: 'video', track: 'V2', name: 'b', start: 5, dur: 2, inp: 0, media: 'b' },
    { id: 'm', kind: 'audio', track: 'A1', name: 'musica', start: 0, dur: 20, inp: 0, media: 'mu' },
  ], markers: [{ id: 'k', t: 7, label: '' }] };
  let n = 0;
  const r = removePauses(s, 'p', [[1, 2], [3, 4.5]], () => 'n' + ++n)!;
  assert.equal(r.cuts, 3); assert.ok(near(r.removed, 3.5, 1e-9));
  const P = s.clips.filter(c => c.media === 'm').map(c => [c.id, c.start, c.inp, c.dur, c.fadeIn, c.fadeOut]);
  assert.deepEqual(P, [['p', 2, 1, 1, .5, 0], ['n1', 3, 3, 1.5, 0, .5]]);
  const at = (id: string) => s.clips.find(c => c.id === id)!.start;
  assert.equal(at('g'), 4);                   // prima di lei due tagli da 1 s
  assert.equal(at('b1'), 2);                  // cadeva nel primo taglio (2–3)
  assert.equal(at('b2'), 4);                  // spostata, ma aspetta la fine di b1 sulla stessa traccia
  assert.equal(at('m'), 0);                   // la musica resta intera
  assert.equal(s.markers[0].t, 4.5);           // cadeva nell'ultimo taglio: va al punto del taglio
  assert.equal(removePauses(s, 'zzz', [[0, 1]], () => 'x'), null);
});

test('respiri e schiocchi isolati non contano come voce', () => {
  const ch = fake(6, [[1, 2], [4, 5]]);
  const blip = (amp: number) => { const c = fake(6, [[1, 2], [4, 5]]); for (let i = 3 * SR; i < 3.08 * SR; i++) c[0][i] = c[0][i] / .003 * amp; return voiceRuns(energy(c, SR)); };
  assert.equal(blip(.06).length, 2);          // scatto di 80 ms, 14 dB sotto la voce: rumore
  assert.equal(blip(.3).length, 3);           // breve ma forte come la voce: resta
});
