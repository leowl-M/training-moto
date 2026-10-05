// Migrazione dei preset di MOTO v1 (campo v: 2) al nuovo modello. Best effort: conserva testi, tempi, effetti, immagini e posizioni.
import type { Project, Scene, TextLayer, ImageLayer, EffectRef, Outro, Asset, TextStyle } from './types.ts';
import { createProject, defaultTransform } from './project.ts';

const effectOf = (slot: any): EffectRef => ({
  fx: slot.fx, split: slot.split, stagger: slot.stagger, order: slot.order,
  ease: slot.ease, invert: !!slot.invert, params: { ...(slot.prms?.[slot.fx] || {}) },
});

const outroOf = (mode: string, slot: any): Outro | undefined =>
  mode === 'none' ? undefined : mode === 'mirror' ? { mirror: true } : effectOf(slot);

function textLayer(b: any, id: string, p: any): TextLayer {
  const dIn = b.dIn ?? 1.1, hold = b.hold ?? 1.4, dOut = b.dOut ?? .7, hasOut = b.outMode !== 'none';
  const style: TextStyle = {
    font: p.fontName ?? String(b.font ?? 0), weight: b.wght ?? 600, italic: !!b.italic, size: b.fs ?? 170, fit: !!b.fit, fitWidth: b.fitW ?? 74,
    tracking: b.track ?? 0, lineHeight: b.lh ?? 1, align: b.align ?? 'center', textCase: b.tcase ?? 'none',
    color: b.color ?? '#efece6', colorB: b.colorB ?? '#ff4d00', stroke: !!b.stroke, strokeWidth: b.strokeW ?? 2, colorIn: !!b.colorIn,
  };
  const L: TextLayer = {
    id, name: (String(b.text ?? '').split('\n')[0].trim() || 'Testo').slice(0, 40), type: 'text',
    start: b.delay ?? 0, duration: dIn + hold + (hasOut ? dOut : 0),
    transform: defaultTransform(), intro: effectOf(b.inS), outro: outroOf(b.outMode, b.outS),
    text: String(b.text ?? ''), style,
    place: { anchor: b.anchor ?? 'mm', margin: b.margin ?? 8, offX: b.offX ?? 0, offY: b.offY ?? 0 },
  };
  if (b.loop && b.loop.fx && b.loop.fx !== 'none') L.loop = { fx: b.loop.fx, params: { ...(b.loop.prms?.[b.loop.fx] || {}), when: b.loop.when } };
  if (b.block && b.block.mode && b.block.mode !== 'none') L.motion = { ...b.block };
  return L;
}

export function legacyPresetToProject(preset: any): Project {
  const proj = createProject();
  const fmt = ['16:9', '9:16', '1:1', '4:5'];
  proj.format = fmt.includes(preset.fmt) ? preset.fmt : '16:9';
  proj.fps = [24, 25, 30, 50, 60].includes(+preset.fps) ? (+preset.fps as Project['fps']) : 30;
  proj.res = preset.res === 2 ? 2 : 1;
  proj.background = { color: preset.bg ?? '#121212', transparent: !!preset.transparent };
  proj.palette = { color: preset.color ?? '#efece6', colorB: preset.colorB ?? '#ff4d00' };
  proj.seed = preset.seed ?? 7;
  proj.name = (String(preset.text ?? '').split('\n')[0].trim() || 'Progetto importato').slice(0, 60);

  for (const im of preset.images || []) {
    const kind: Asset['kind'] = /^data:image\/svg/.test(im.src) ? 'svg' : 'image';
    proj.assets[im.id] = { id: im.id, kind, name: im.name, ref: { type: 'embedded', dataUrl: im.src } };
  }

  const scene: Scene = proj.scenes[0];
  const blocks = Array.isArray(preset.blocks) && preset.blocks.length > 1 ? preset.blocks : [preset];
  blocks.forEach((b: any, i: number) => scene.layers.push(textLayer({ ...preset, ...b }, `testo-${i + 1}`, preset)));

  let tail = preset.tail ?? 0;
  for (const b of blocks) tail = Math.max(tail, b.tail ?? 0);
  const textEnd = scene.layers.reduce((m, l) => Math.max(m, l.start + l.duration), 0);

  (preset.layers || []).forEach((L: any, i: number) => {
    if (!proj.assets[L.img]) return;
    const start = L.start ?? 0, end = L.end > 0 ? L.end : textEnd;
    const img: ImageLayer = {
      id: L.id || `immagine-${i + 1}`, name: proj.assets[L.img].name, type: 'image', asset: L.img,
      start, duration: Math.max(0, end - start), hidden: !!L.hidden,
      transform: { x: L.x ?? 50, y: L.y ?? 50, scale: 1, rotation: L.rot ?? 0, opacity: L.op ?? 1 },
      size: L.size ?? 30, mode: L.mode === 'cover' ? 'cover' : 'free', tint: L.tint ?? 'none', z: L.z === 'below' ? 'below' : 'above',
      intro: { fx: L.fx, ease: L.ease, params: { ...(L.prms?.[L.fx] || {}) } },
      outro: L.outMode === 'none' ? undefined : { mirror: true },
    };
    scene.layers.push(img);
  });

  scene.duration = +(Math.max(textEnd, ...scene.layers.map(l => l.start + l.duration)) + tail).toFixed(4);
  return proj;
}
