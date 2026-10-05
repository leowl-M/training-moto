// Prove sulla sequenza: tagli, rifilature, aggancio, posizionamento, volumi. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { seqTotal, localT, visibleAt, splitClip, trimStart, trimEnd, snap, snapPoints, placeOnTrack, freeSlot, clipGain, fadeShape, peaks, newSeq, tracksOf, addTrack, removeTrack, firstTrack } from '../src/seq/seq.ts';
import type { Clip, Seq } from '../src/seq/seq.ts';

const V: Clip = { id: 'v', kind: 'video', track: 'V1', name: 'parlato', start: 2, dur: 10, inp: 5, media: 'm1' };
const G: Clip = { id: 'g', kind: 'motion', track: 'G1', name: 'titolo', start: 0, dur: 4, inp: 0, scene: { text: 'ciao' } };
const A: Clip = { id: 'a', kind: 'audio', track: 'A1', name: 'musica', start: 0, dur: 20, inp: 0, media: 'm2', vol: .8, fadeIn: 2, fadeOut: 4 };
const S: Seq = { clips: [V, G, A], markers: [{ id: 'k', t: 7, label: 'drop' }] };

test('durata, tempo locale, clip visibili nell\'ordine giusto', () => {
  assert.equal(seqTotal(S), 20);
  assert.equal(seqTotal(newSeq()), 0);
  assert.equal(localT(V, 3), 6);
  assert.deepEqual(visibleAt(S, 3).map(c => c.id), ['v', 'g']);      // il video sotto, la grafica sopra; l'audio non si disegna
  assert.deepEqual(visibleAt(S, 13).map(c => c.id), []);
});

test('dividere: due parti contigue, la seconda prosegue la sorgente', () => {
  const [a, b] = splitClip(V, 6, 'v2')!;
  assert.deepEqual([a.start, a.dur, a.inp], [2, 4, 5]);
  assert.deepEqual([b.start, b.dur, b.inp, b.id], [6, 6, 9, 'v2']);
  assert.equal(splitClip(V, 2), null);
  const [, g2] = splitClip(G, 1)!; assert.notEqual(g2.scene, G.scene); assert.deepEqual(g2.scene, G.scene);   // scena copiata, non condivisa
});

test('rifilare: l\'inizio sposta la sorgente, la fine non supera il file', () => {
  const s = trimStart(V, 4); assert.deepEqual([s.start, s.dur, s.inp], [4, 8, 7]);
  const s2 = trimStart(V, -10); assert.deepEqual([s2.start, s2.inp], [0, 3]);           // non prima dell'inizio della sorgente (inp ≥ 0)
  const e = trimEnd(V, 30, 12); assert.equal(e.dur, 7);                                   // file di 12 s, entrata a 5 s: restano 7 s
  assert.ok(trimEnd(V, 1).dur > 0);
});

test('aggancio ai punti vicini', () => {
  assert.equal(snap(6.95, snapPoints(S, null), .1), 7);
  assert.equal(snap(6.5, snapPoints(S, null), .1), 6.5);
  assert.ok(snapPoints(S, 'v', 3.3).includes(3.3) && !snapPoints(S, 'v').includes(12));
});

test('le clip sulla stessa traccia non si sovrappongono', () => {
  const S2: Seq = { clips: [{ ...V, id: 'x', start: 0, dur: 5 }, { ...V, id: 'y', start: 10, dur: 5 }], markers: [] };
  const c = { ...V, id: 'z', start: 20, dur: 3 };
  assert.equal(placeOnTrack(S2, c, 4), 5);          // contro la fine della prima
  assert.equal(placeOnTrack(S2, c, 8.5), 7);        // si ferma prima della seconda
  assert.equal(placeOnTrack(S2, c, 30), 30);
  assert.equal(freeSlot(S2, 'V1', 1, 3), 5);
  assert.equal(freeSlot(S2, 'V1', 2, 6), 15);
});

test('volume con dissolvenze', () => {
  const Al = { ...A, fadeCurve: 'lin' as const };
  assert.ok(Math.abs(clipGain(Al, 1) - .4) < 1e-9);
  assert.ok(Math.abs(clipGain(Al, 19) - .2) < 1e-9);
  assert.ok(Math.abs(clipGain(A, 1) - .8 * Math.SQRT1_2) < 1e-9);                       // dolce: a metà dissolvenza −3 dB
  assert.ok(Math.abs(20 * Math.log10(fadeShape(.5, 'exp')) - -30) < .5);               // in decibel: a metà circa −30 dB
  assert.deepEqual([fadeShape(0, 'exp'), fadeShape(1, 'exp'), fadeShape(0), fadeShape(1, 'lin')], [0, 1, 0, 1]);
  assert.equal(clipGain(A, 5), .8);
  assert.equal(clipGain({ ...A, mute: true }, 5), 0);
  assert.equal(clipGain(A, 25), 0);
});

test('tracce: si aggiungono e si tolgono, ordine di disegno', () => {
  const s: Seq = { clips: [{ ...V }, { ...G }], markers: [] };
  assert.deepEqual(tracksOf(s).map(t => t.id), ['G2', 'G1', 'V1', 'A1']);
  const v2 = addTrack(s, 'video'); assert.equal(v2, 'V2');
  assert.deepEqual(tracksOf(s).map(t => t.id), ['G2', 'G1', 'V2', 'V1', 'A1']);
  assert.equal(addTrack(s, 'audio'), 'A2');
  assert.equal(tracksOf(s).at(-1)!.id, 'A2');
  s.clips.push({ ...V, id: 'v2', track: 'V2', start: 2 });
  assert.deepEqual(visibleAt(s, 3).map(c => c.id), ['v', 'v2', 'g']);       // Video 2 sopra Video 1, la grafica sopra tutti
  assert.equal(removeTrack(s, 'V2'), false);                                 // non vuota
  assert.equal(removeTrack(s, 'A2'), true);
  assert.equal(removeTrack(s, 'A1'), false);                                 // l'ultima del suo tipo resta
  assert.equal(firstTrack(s, 'video'), 'V1');
  assert.equal(tracksOf(s).find(t => t.id === 'G2')!.name, 'Grafica 2');
});

test('onda: picchi per colonna', () => {
  const p = peaks(new Float32Array([0, .5, -1, .2, .1, -.3]), 3);
  assert.deepEqual([...p].map(v => +v.toFixed(2)), [.5, 1, .3]);
});

test('altezza della timeline: le tracce crescono fino a 2,5 volte, poi scorrono', async () => {
  const { trackHeights } = await import('../src/seq/timeline.ts');
  assert.deepEqual(trackHeights([30, 40, 34], 0), [30, 40, 34]);          // altezza automatica
  assert.deepEqual(trackHeights([30, 40, 34], 208), [60, 80, 68]);        // il doppio dello spazio
  assert.deepEqual(trackHeights([30, 40, 34], 2000), [75, 100, 85]);      // non oltre 2,5 volte
  assert.deepEqual(trackHeights([30, 40, 34], 60), [30, 40, 34]);         // meno spazio: restano piene, la timeline scorre
});
