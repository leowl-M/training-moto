// Prove sugli stati di layout. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { stateDelta, stateProgress, mixDelta, statesEnd, ID, full, isId, newStates } from '../src/states/states.ts';
import type { States } from '../src/states/states.ts';

const lin = () => (x: number) => x, close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const S: States = { on: true, list: [
  { id: 'b', name: 'Stato 2', at: 1, dur: 1, ease: 'linear', stag: 0, d: { 'svg:a': { dx: -20, s: .5 }, 'block:0': { dx: 10, op: .5 } } },
  { id: 'c', name: 'Stato 3', at: 3, dur: 2, ease: 'linear', stag: 0, d: { 'svg:a': { dx: -20, s: .5, r: 90 } } },
] };
const order = ['block:0', 'svg:a'];

test('prima del primo passaggio la disposizione è quella iniziale', () => {
  assert.deepEqual(stateDelta(S, 'svg:a', order, .5, lin), ID);
  assert.deepEqual(stateDelta(newStates(), 'svg:a', order, 9, lin), ID);
  assert.deepEqual(stateDelta({ ...S, on: false }, 'svg:a', order, 9, lin), ID);
});

test('passaggio fluido verso uno stato, scala geometrica', () => {
  const m = stateDelta(S, 'svg:a', order, 1.5, lin);
  assert.ok(close(m.dx, -10) && close(m.s, Math.SQRT1_2));
  const e = stateDelta(S, 'svg:a', order, 2.5, lin);
  assert.ok(close(e.dx, -20) && close(e.s, .5));
});

test('gli stati si susseguono; un elemento non toccato da uno stato torna alla disposizione iniziale', () => {
  const r = stateDelta(S, 'svg:a', order, 4, lin); assert.ok(close(r.r, 45) && close(r.dx, -20));
  const b = stateDelta(S, 'block:0', order, 2.5, lin); assert.ok(close(b.dx, 10) && close(b.op, .5));
  const back = stateDelta(S, 'block:0', order, 5, lin); assert.ok(isId(back));      // lo stato 3 non lo nomina: torna al punto di partenza
});

test('sfasamento: il primo elemento parte prima dell\'ultimo', () => {
  const st = { ...S.list[0], stag: .5 };
  assert.ok(stateProgress(st, 0, 2, 1.3) > stateProgress(st, 1, 2, 1.3));
  assert.equal(stateProgress(st, 1, 2, 2), 1);
  assert.equal(stateProgress(st, 0, 2, 1.5), 1);
});

test('mescolare e completare', () => {
  assert.deepEqual(mixDelta(ID, full({ dx: 10 }), 0), ID);
  assert.deepEqual(full({ r: 5 }), { dx: 0, dy: 0, s: 1, r: 5, op: 1 });
  assert.equal(statesEnd(S), 5);
  assert.equal(statesEnd(newStates()), 0);
});
