// Prove della correzione colore (la formula di riferimento, uguale a quella sulla scheda video). npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { gradePixel, GRADE0, isNeutral, LOOKS } from '../src/seq/grade.ts';

const G = (o: object) => ({ ...GRADE0, ...o });
const near = (a: number[], b: number[], e = 1e-6) => a.every((x, i) => Math.abs(x - b[i]) < e);

test('a zero non cambia niente', () => {
  for (const c of [[0, 0, 0], [1, 1, 1], [.2, .5, .8], [.9, .1, .3]] as [number, number, number][]) assert.ok(near(gradePixel(c, GRADE0), c, 1e-6));
  assert.ok(isNeutral({}) && isNeutral(GRADE0) && !isNeutral({ exp: .1 }));
});

test('esposizione: +1 stop raddoppia la luce vera', () => {
  const [r] = gradePixel([.5, .5, .5], G({ exp: 1 })), lin = ((.5 + .055) / 1.055) ** 2.4 * 2, exp = 1.055 * lin ** (1 / 2.4) - .055;
  assert.ok(Math.abs(r - exp) < 1e-6);
  assert.ok(gradePixel([.5, .5, .5], G({ exp: -1 }))[0] < .5);
});

test('temperatura e tinta: caldo = più rosso e meno blu, il grigio resta grigio a zero', () => {
  const [r, g, b] = gradePixel([.5, .5, .5], G({ temp: 50 }));
  assert.ok(r > .5 && b < .5 && Math.abs(g - .5) < 1e-6);
  const t = gradePixel([.5, .5, .5], G({ tint: 50 }));
  assert.ok(t[1] < .5 && t[0] > .5);
});

test('contrasto, luci, ombre, saturazione', () => {
  assert.ok(gradePixel([.8, .8, .8], G({ con: 50 }))[0] > .8 && gradePixel([.2, .2, .2], G({ con: 50 }))[0] < .2);
  assert.ok(gradePixel([.15, .15, .15], G({ sh: 60 }))[0] > .15);           // ombre aperte
  assert.ok(gradePixel([.85, .85, .85], G({ hi: -60 }))[0] < .85);          // luci abbassate
  assert.ok(Math.abs(gradePixel([.85, .85, .85], G({ sh: 60 }))[0] - .85) < .05);   // le ombre toccano poco le luci
  const bw = gradePixel([.9, .2, .1], G({ sat: -100 }));
  assert.ok(Math.abs(bw[0] - bw[1]) < 1e-9 && Math.abs(bw[1] - bw[2]) < 1e-9);
  // vividezza: spinge di più un colore spento che uno già saturo
  const dull = gradePixel([.55, .5, .45], G({ vib: 80 })), vivid = gradePixel([.9, .2, .1], G({ vib: 80 }));
  assert.ok((dull[0] - dull[2]) / .1 > (vivid[0] - vivid[2]) / .8);
  for (const l of LOOKS) for (const c of [[.1, .4, .7], [.95, .9, .2]] as [number, number, number][]) assert.ok(gradePixel(c, G(l.g)).every(v => v >= 0 && v <= 1));
});
