// Prove sulle transizioni. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { prevAdjacent, trDur, trExt, transitionAt, activeExt } from '../src/seq/trans.ts';
import type { Seq, Clip } from '../src/seq/seq.ts';
import { splitClip } from '../src/seq/seq.ts';

const C = (id: string, start: number, dur: number, tr?: any, track = 'V1'): Clip => ({ id, kind: 'video', track, name: id, start, dur, inp: 0, media: 'm', ...(tr ? { tr } : {}) } as any);

test('transizione centrata sul taglio tra due clip attaccate', () => {
  const s: Seq = { clips: [C('a', 0, 4), C('b', 4, 3, { type: 'fade', dur: 1 }), C('c', 8, 2, { type: 'fade', dur: 1 })], markers: [] };
  assert.equal(prevAdjacent(s, s.clips[1])!.id, 'a');
  assert.equal(trDur(s, s.clips[1]), 1);
  assert.equal(trDur(s, s.clips[2]), 0);                 // c non è attaccata a b (buco di 1 s): niente transizione
  assert.deepEqual(trExt(s, s.clips[0]), { pre: 0, post: .5 });
  assert.deepEqual(trExt(s, s.clips[1]), { pre: .5, post: 0 });
  const t = transitionAt(s, 'V1', 4.25)!;
  assert.equal(t.a.id, 'a'); assert.equal(t.b.id, 'b'); assert.equal(t.p, .75);
  assert.equal(transitionAt(s, 'V1', 3.4), null);
  assert.ok(activeExt(s, s.clips[0], 4.3) && activeExt(s, s.clips[1], 3.6) && !activeExt(s, s.clips[1], 3.4));
});

test('la transizione non è più lunga delle clip', () => {
  const s: Seq = { clips: [C('a', 0, .4), C('b', .4, 3, { type: 'zoom', dur: 2 })], markers: [] };
  assert.equal(trDur(s, s.clips[1]), .4);
});

test('dividere una clip: la transizione resta sul primo pezzo', () => {
  const [a, b] = splitClip(C('b', 4, 3, { type: 'fade', dur: 1 }), 5, 'b2')!;
  assert.equal((a as any).tr.type, 'fade'); assert.equal((b as any).tr, undefined);
});
