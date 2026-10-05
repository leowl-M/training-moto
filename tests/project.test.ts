// Prove sui file di progetto: media ritrovati nella cartella, font per nome, riconoscimento del file. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { matchMedia, kindOfFile, fontsToNames, namesToFonts, toB64, fromB64, projectName } from '../src/project/file.ts';

test('i media si ritrovano: stesso percorso, cartella sopra o sotto, nome e dimensione', () => {
  const files = [{ path: 'Video/parlato.mp4', name: 'parlato.mp4', size: 100 }, { path: 'Video/broll.mp4', name: 'broll.mp4', size: 50 }, { path: 'Audio/musica.mp3', name: 'musica.mp3', size: 7 }, { path: 'Altro/musica.mp3', name: 'musica.mp3', size: 9 }];
  const m = matchMedia([
    { id: 'a', name: 'parlato.mp4', size: 100, path: 'Video/parlato.mp4' },
    { id: 'b', name: 'broll.mp4', size: 50, path: 'Reel/Video/broll.mp4' },       // la cartella scelta ora è quella dentro
    { id: 'c', name: 'musica.mp3', size: 9, path: 'Vecchia/musica.mp3' },         // spostato: nome e dimensione
    { id: 'd', name: 'manca.wav', size: 1, path: 'x/manca.wav' },
  ], files);
  assert.equal(m.get('a')!.path, 'Video/parlato.mp4');
  assert.equal(m.get('b')!.path, 'Video/broll.mp4');
  assert.equal(m.get('c')!.path, 'Altro/musica.mp3');
  assert.equal(m.has('d'), false);
});

test('font per nome in tutte le scene, andata e ritorno', () => {
  const names = ['Inter', 'Anton', 'Mio font'];
  const st = { font: 2, blocks: [{ font: 1 }], seq: { clips: [{ scene: { font: 2, blocks: [{ font: 0 }] } }, { kind: 'video' }] } };
  fontsToNames(st, i => names[i]);
  assert.equal((st as any).fontName, 'Mio font'); assert.equal((st.seq.clips[0].scene as any).fontName, 'Mio font');
  const other = ['Inter', 'Mio font', 'Anton'];                                  // su un altro computer gli indici cambiano
  namesToFonts(st, n => other.indexOf(n));
  assert.equal(st.blocks[0].font, 2); assert.equal(st.seq.clips[0].scene!.font, 1); assert.equal(st.seq.clips[0].scene!.blocks[0].font, 0);
});

test('riconoscimento del file e utilità', () => {
  assert.equal(kindOfFile({ format: 'moto-project', version: 1, state: {} }), 'project');
  assert.equal(kindOfFile({ text: 'ciao', inS: {} }), 'preset');
  assert.equal(kindOfFile({ foo: 1 }), null);
  const b = new Uint8Array([0, 1, 250, 255]).buffer; assert.deepEqual([...new Uint8Array(fromB64(toB64(b)))], [0, 1, 250, 255]);
  assert.equal(projectName('Reel ottobre.moto'), 'Reel ottobre');
});
