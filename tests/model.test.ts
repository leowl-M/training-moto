// Prove del modello dati. Si eseguono con: npm test  (usa il test runner di Node, nessuna installazione extra)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, validateProject, sceneDuration, projectDuration, serializeProject, parseProject, legacyPresetToProject } from '../src/model/index.ts';

test('un progetto nuovo è valido e ha una scena vuota', () => {
  const p = createProject('Prova');
  assert.deepEqual(validateProject(p), []);
  assert.equal(p.scenes.length, 1);
  assert.equal(sceneDuration(p.scenes[0]), 0);
});

test('serializza e rilegge senza perdere nulla', () => {
  const p = createProject('Giro completo');
  assert.deepEqual(parseProject(serializeProject(p)), p);
});

test('segnala un genitore mancante, un ciclo e una risorsa inesistente', () => {
  const p = createProject();
  const base = { start: 0, duration: 1, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 } };
  p.scenes[0].layers.push(
    { ...base, id: 'a', name: 'A', type: 'group', parent: 'b' } as any,
    { ...base, id: 'b', name: 'B', type: 'group', parent: 'a' } as any,
    { ...base, id: 'c', name: 'C', type: 'group', parent: 'zzz' } as any,
    { ...base, id: 'd', name: 'D', type: 'svg', asset: 'logo', size: 40 } as any,
  );
  const problems = validateProject(p).join(' | ');
  assert.match(problems, /ciclo/);
  assert.match(problems, /genitore inesistente "zzz"/);
  assert.match(problems, /risorsa mancante "logo"/);
});

test('la durata della scena segue il livello che finisce per ultimo', () => {
  const p = createProject();
  const base = { start: 0, duration: 1, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 } };
  p.scenes[0].layers.push({ ...base, id: 'a', name: 'A', type: 'group', duration: 2 } as any, { ...base, id: 'b', name: 'B', type: 'group', start: 1.5, duration: 2 } as any);
  assert.equal(sceneDuration(p.scenes[0]), 3.5);
  assert.equal(projectDuration(p), 3.5);
});

test('migrazione di un preset di MOTO v1: testi, tempi, effetti e immagini', () => {
  const slot = (fx: string, extra = {}) => ({ fx, split: 'char', stagger: .35, order: 'start', ease: 'fx', invert: false, prms: { [fx]: { dist: .9 } }, ...extra });
  const preset = {
    v: 2, fmt: '9:16', res: 1, fps: 25, fontName: 'Inter Tight', text: 'Ogni dettaglio\nconta', font: 0, wght: 600, fs: 170, fit: true, fitW: 74,
    color: '#efece6', colorB: '#ff4d00', bg: '#121212', transparent: false, anchor: 'mm', margin: 8, offX: 0, offY: 0,
    delay: .25, dIn: 1.1, hold: 1.4, dOut: .7, tail: .35, seed: 7,
    inS: slot('mask'), outMode: 'mirror', outS: slot('fade'), loop: { fx: 'wave', when: 'hold', prms: { wave: { amp: .1 } } },
    block: { mode: 'none' },
    images: [{ id: 'i1', name: 'logo.svg', src: 'data:image/svg+xml;base64,AAAA' }],
    layers: [{ id: 'l1', img: 'i1', mode: 'free', x: 80, y: 20, size: 25, rot: 0, op: 1, z: 'above', tint: 'none', start: 0, end: 0, fx: 'pop', dIn: .7, dOut: .5, outMode: 'mirror', ease: 'fx', prms: {} }],
    blocks: [{ text: 'Secondo', delay: 1, dIn: 1, hold: 1, dOut: .5, inS: slot('slide'), outMode: 'none', outS: slot('fade'), loop: { fx: 'none', prms: {} } }],
  };
  const two = { ...preset, blocks: [{ ...preset, text: 'Ogni dettaglio\nconta' }, { ...preset, text: 'Secondo', delay: 1, dIn: 1, hold: 1, dOut: .5, outMode: 'none', inS: slot('slide') }] };
  const p = legacyPresetToProject(two);
  assert.deepEqual(validateProject(p), []);
  assert.equal(p.format, '9:16');
  assert.equal(p.fps, 25);
  assert.equal(p.assets['i1'].kind, 'svg');
  const text = p.scenes[0].layers.filter(l => l.type === 'text');
  const img = p.scenes[0].layers.filter(l => l.type === 'image');
  assert.equal(text.length, 2);
  assert.equal(img.length, 1);
  assert.equal(text[0].start, .25);
  assert.equal(+text[0].duration.toFixed(2), 3.2);                       // 1.1 + 1.4 + 0.7
  assert.deepEqual(text[0].outro, { mirror: true });
  assert.equal(text[1].outro, undefined);                                // uscita "nessuna"
  assert.equal((text[0].intro as any).fx, 'mask');
  assert.equal((text[0].intro as any).params.dist, .9);
  assert.equal((text[0].loop as any).fx, 'wave');
  assert.equal(+sceneDuration(p.scenes[0]).toFixed(2), 3.8);             // fine del primo testo (3.45) + coda (0.35)
});
