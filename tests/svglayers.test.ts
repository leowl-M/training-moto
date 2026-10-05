// Prove sui livelli del file SVG. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileLayers } from '../src/svg/layers.ts';

const E = (i: number, name: string, group: string, x = i * 10) => ({ i, name, group, bb: [x, 0, 5, 5] as [number, number, number, number], role: 'mark' });

test('i gruppi con nome diventano un livello; il contenitore di tutto no', () => {
  const L = fileLayers([E(0, '', 'cerchio'), E(1, 'Vector', 'freccia'), E(2, 'Vector_2', 'freccia'), E(3, 'punto', 'icona'), E(4, 'linea', 'icona')]);
  assert.deepEqual(L.map(l => [l.key, l.els]), [['cerchio', [0]], ['freccia', [1, 2]], ['icona', [3, 4]]]);
  const L1 = fileLayers([E(0, '', 'cerchio'), E(1, 'Vector', 'freccia'), E(2, 'Vector_2', 'freccia'), E(3, 'punto', 'icona')]);   // una forma sola nel gruppo esterno: il suo nome
  assert.deepEqual(L1.map(l => l.key), ['cerchio', 'freccia', 'punto']);
  const L2 = fileLayers([E(0, 'cerchio', 'icona'), E(1, 'freccia', 'icona'), E(2, 'linea', 'icona')]);        // tutto in un gruppo solo
  assert.deepEqual(L2.map(l => l.key), ['cerchio', 'freccia', 'linea']);
  assert.deepEqual(L2[1].bb, [10, 0, 5, 5]);
});

test('con la catena dei gruppi: il contenitore di tutto non conta, le forme dirette prendono il loro nome', () => {
  const A = (i: number, name: string, anc: string[]) => ({ ...E(i, name, anc[0] || ''), anc });
  const L = fileLayers([A(0, '', ['cerchio', 'icona']), A(1, 'Vector', ['freccia', 'icona']), A(2, 'Vector_2', ['freccia', 'icona']), A(3, 'punto', ['icona']), A(4, 'linea', ['icona'])]);
  assert.deepEqual(L.map(l => l.key), ['cerchio', 'freccia', 'punto', 'linea']);
});

test('forme senza nome o con lo stesso nome restano separate; le linee di costruzione non contano', () => {
  const L = fileLayers([E(0, '', ''), E(1, 'path', ''), E(2, 'path', ''), { ...E(3, 'guida', ''), role: 'guide' }]);
  assert.deepEqual(L.map(l => l.key), ['Forma 1', 'path', 'path 2']);
});
