// Prove dei sottotitoli: frasi dalle parole, righe, tempi dall'audio compresso al file, posizione sulla timeline, modifiche. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupCues, splitLines, compressMap, mapWords, joinPieces, cueSegments, subAt, retext, splitBefore, mergeNext, shiftCue, shiftCues, mergeCues, trimCue, removeCue, usedRanges, toSrt } from '../src/subs/model.ts';
import type { Word } from '../src/subs/model.ts';
import type { Seq } from '../src/seq/seq.ts';

let n = 0;
const W = (t: string, s: number, e: number, m = 'M'): Word => ({ id: 'w' + n++, m, t, s, e });
const sentence = (txt: string, s0: number, step = .3) => txt.split(' ').map((t, i) => W(t, s0 + i * step, s0 + i * step + step * .9));

test('frasi: si va a capo sul punto, sulle pause lunghe e quando non ci sta', () => {
  const ws = [...sentence('Ciao, sono Sebastiano.', 0), ...sentence('Faccio video per i brand', 1.2), ...sentence('dopo una pausa', 4)];
  const q = groupCues(ws, { maxChars: 20, lines: 2 });
  assert.deepEqual(q.map(c => c.w.map(w => w.t).join(' ')), ['Ciao, sono Sebastiano.', 'Faccio video per i brand', 'dopo una pausa']);
  // la frase resta un po' dopo l'ultima parola, ma non oltre l'inizio della successiva
  assert.ok(q[0].e > q[0].w[2].e && q[0].e <= q[1].s);
  // una riga corta: frasi più piccole
  const q1 = groupCues(ws, { maxChars: 10, lines: 1 });
  assert.ok(q1.every(c => c.w.map(w => w.t).join(' ').length <= 10 || c.w.length === 1));
});

test('frasi: segni messi a mano (dividi e unisci) contano anche dopo aver cambiato lo stile', () => {
  const ws = sentence('uno due tre quattro cinque sei', 0);
  splitBefore(ws, ws[3].id);
  let q = groupCues(ws, { maxChars: 40 });
  assert.equal(q.length, 2);
  assert.ok(mergeNext(ws, q, q[0].id));
  q = groupCues(ws, { maxChars: 40 });
  assert.equal(q.length, 1);
  // "nb" tiene unito anche dove si andrebbe a capo per la lunghezza
  q = groupCues(ws, { maxChars: 6, lines: 1 });
  assert.ok(q.some(c => c.w.some(w => w.id === ws[3].id) && c.w[0].id !== ws[3].id));
});

test('righe equilibrate', () => {
  const l = splitLines('questa è una frase da due righe'.split(' ').map(t => ({ t })), 2, 18);
  assert.equal(l.length, 2);
  const a = l[0].map(x => x.t).join(' ').length, b = l[1].map(x => x.t).join(' ').length;
  assert.ok(Math.abs(a - b) <= 6, `${a} vs ${b}`);
  assert.equal(splitLines([{ t: 'corta' }], 2, 18).length, 1);
});

test('dall\'audio compresso ai tempi del file', () => {
  // voce a 1–2 s e a 5–6 s: nel compresso diventano [0, 1.2] e [1.45, 2.65] (margine 0,1, silenzio 0,25)
  const map = compressMap([[1, 2], [5, 6]], .1, 10, .25);
  assert.equal(map.length, 2);
  assert.ok(Math.abs(map[1].cs - 1.45) < 1e-9 && Math.abs(map[1].os - 4.9) < 1e-9);
  const w = mapWords([{ t: 'a', s: .2, e: .6 }, { t: 'b', s: .7, e: 1.1 }, { t: 'c', s: 1.5, e: 1.9 }], map);
  assert.ok(Math.abs(w[0].s - 1.1) < 1e-6 && Math.abs(w[2].s - 4.95) < 1e-6);
  // una parola che comincia alla fine del primo tratto e finisce dentro il secondo va nel secondo
  const w2 = mapWords([{ t: 'x', s: 1.15, e: 2.0 }], map);
  assert.ok(w2[0].s >= 4.9 && w2[0].e <= 6.1, JSON.stringify(w2));
  // una parola che comincia nel silenzio aggiunto va nel tratto dopo
  const w3 = mapWords([{ t: 'y', s: 1.3, e: 1.7 }], map);
  assert.ok(w3[0].s >= 4.9, JSON.stringify(w3));
  // niente parole accavallate, nessuna troppo lunga
  const w4 = mapWords([{ t: 'p', s: 0, e: 1.2 }, { t: 'q', s: .5, e: .9 }], compressMap([[0, 5]], 0, 5, .25));
  assert.ok(w4[0].e <= w4[1].s + 1e-9);
});

const seqOf = (): Seq => ({ clips: [
  { id: 'a', kind: 'video', track: 'V1', name: 'a', start: 0, dur: 2, inp: 0, media: 'M' },
  { id: 'b', kind: 'video', track: 'V1', name: 'b', start: 2, dur: 2, inp: 3, media: 'M', speed: 2 },
], markers: [] });

test('sulla timeline: le frasi seguono i tagli e la velocità', () => {
  const ws = [...sentence('prima frase.', .5), ...sentence('seconda frase.', 3.2)];
  const q = groupCues(ws), seq = seqOf();
  const sg = cueSegments(seq, q);
  assert.equal(sg.length, 2);
  assert.ok(Math.abs(sg[1].start - (2 + (3.2 - 3) / 2)) < 1e-9);
  const at = subAt(seq, q, 2.2);
  assert.ok(at && at.cue === q[1] && Math.abs(at.src - 3.4) < 1e-9 && at.word === 0);
  assert.equal(subAt(seq, q, 4.5), null);
  assert.deepEqual(usedRanges(seq, 'M', 0), [[0, 2], [3, 7]]);
  assert.match(toSrt(seq, q, 2, 30), /^1\n00:00:00,500 --> .*\nprima frase\.\n/);
});

test('modifiche: testo, spostamento, rifilatura, eliminazione', () => {
  let ws = sentence('ciao a tutti', 1);
  let q = groupCues(ws);
  // stesso numero di parole: tempi invariati
  ws = retext(ws, q[0], 'Ciao a voi', () => 'n' + n++);
  assert.deepEqual(ws.map(w => [w.t, w.s]), [['Ciao', 1], ['a', 1.3], ['voi', 1.6]]);
  // parole diverse: tempi ridistribuiti tra inizio e fine
  q = groupCues(ws);
  ws = retext(ws, q[0], 'Ciao a tutti quanti voi', () => 'n' + n++);
  assert.equal(ws.length, 5);
  assert.ok(ws[0].s === 1 && Math.abs(ws[4].e - 1.87) < 1e-6);
  q = groupCues([...ws, ...sentence('dopo', 5)]);
  const all = q.flatMap(c => c.w);
  assert.equal(shiftCue(q, q[0].id, 10), 5 - 1.87);   // si ferma contro la frase dopo
  trimCue(q, q[1].id, 'l', 4.2);
  assert.ok(Math.abs(q[1].w[0].s - 4.2) < 1e-9 || q[1].w[0].s >= all[4].e);
  assert.equal(removeCue(all, q[0]).length, 1);
});

test('pezzi di parola uniti', () => {
  const w = [{ t: 'dall', s: 0, e: .2 }, { t: "'idea", s: .2, e: .5 }, { t: 'bella', s: .6, e: .9 }, { t: '!', s: .9, e: 1 }];
  assert.deepEqual(joinPieces(w).map(x => [x.t, x.s, x.e]), [["dall'idea", 0, .5], ['bella!', .6, 1]]);
});

test('più frasi insieme: spostamento contro le vicine non selezionate, unione', () => {
  const ws = [...sentence('uno.', 0), ...sentence('due.', 2), ...sentence('tre.', 4), ...sentence('quattro.', 6)];
  const q = groupCues(ws);
  assert.equal(q.length, 4);
  const ids = new Set([q[1].id, q[2].id]);
  // a destra si fermano contro "quattro" (inizia a 6; "tre" finisce a 4,27)
  assert.ok(Math.abs(shiftCues(q, ids, 5) - (6 - 4.27)) < 1e-9);
  assert.ok(q[2].w[0].e <= q[3].w[0].s + 1e-9 && q[1].w[0].s > 2);
  assert.ok(mergeCues(ws, groupCues(ws), new Set([groupCues(ws)[1].id, groupCues(ws)[2].id])));
  assert.equal(groupCues(ws).length, 3);
  // non consecutive: niente unione
  const q2 = groupCues(ws);
  assert.equal(mergeCues(ws, q2, new Set([q2[0].id, q2[2].id])), false);
});
