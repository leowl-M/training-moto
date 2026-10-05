// Camera 2D della scena: inquadratura (punto al centro del quadro, zoom, rotazione) in funzione del tempo.
// Funzioni pure. La posa è in % del quadro: x = 50, y = 50, z = 1, r = 0 è l'inquadratura normale.
//  - keyframe liberi (x, y, zoom, rotazione) oppure "inquadra" (un riquadro da far stare nel quadro con un margine);
//  - "segui": per un tratto di tempo la camera segue un punto (per esempio la punta della penna che disegna), con morbidezza;
//  - tremolio: piccole oscillazioni ripetibili, come una camera a mano.

export interface CamPose { x: number; y: number; z: number; r: number }
export interface CamKey {
  t: number; ease?: string;                 // curva per arrivare a questo keyframe
  mode?: 'free' | 'fit';                    // free: valori fissi; fit: inquadra target
  x?: number; y?: number; z?: number; r?: number;
  target?: string; margin?: number;         // fit: cosa inquadrare (risolto dal motore) e margine in % del quadro
}
export interface CamFollow { on: boolean; target: string; from: number; to: number; z: number; smooth: number; ramp: number }
export interface CamShake { amt: number; hz: number; rot: number }
export interface Camera { on: boolean; keys: CamKey[]; follow: CamFollow; shake: CamShake }
/** Riquadro in pixel del quadro: x, y, larghezza, altezza. */
export type Box = [number, number, number, number];
/** Il motore risolve i target ("svg:<id>:mark", "block:0", "pen:<id>"): un riquadro (fit) o un punto (follow, riquadro di lato 0). */
export type Resolve = (target: string, t: number) => Box | null;

export const IDENT: CamPose = { x: 50, y: 50, z: 1, r: 0 };
export const newCamera = (): Camera => ({ on: false, keys: [], follow: { on: false, target: '', from: 0, to: 4, z: 2, smooth: .35, ramp: .5 }, shake: { amt: 0, hz: 1.2, rot: 0 } });

const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sstep = (t: number) => t * t * (3 - 2 * t);

/** Posa che fa stare il riquadro nel quadro con un margine (in % del lato), senza rotazione. */
export function fitPose(b: Box, W: number, H: number, margin = 8): CamPose {
  const m = Math.min(45, Math.max(0, margin)) / 100, w = Math.max(1, b[2]), h = Math.max(1, b[3]);
  const z = Math.min(W * (1 - 2 * m) / w, H * (1 - 2 * m) / h);
  return { x: (b[0] + w / 2) / W * 100, y: (b[1] + h / 2) / H * 100, z: Math.max(.05, Math.min(40, z)), r: 0 };
}

function keyPose(k: CamKey, W: number, H: number, res: Resolve): CamPose {
  if (k.mode === 'fit' && k.target) { const b = res(k.target, k.t); if (b) return { ...fitPose(b, W, H, k.margin ?? 8), r: k.r ?? 0 }; }
  return { x: k.x ?? 50, y: k.y ?? 50, z: k.z ?? 1, r: k.r ?? 0 };
}

/** Interpolazione tra due pose: lo zoom è geometrico (avvicinarsi sembra uniforme) e il centro segue lo zoom,
 *  così uno zoom tra due inquadrature non "sbanda" lateralmente. */
export function mixPose(a: CamPose, b: CamPose, e: number): CamPose {
  const z = a.z * Math.pow(b.z / a.z, e), w = Math.abs(b.z - a.z) > 1e-6 ? (1 / a.z - 1 / z) / (1 / a.z - 1 / b.z) : e;
  return { x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w), z, r: lerp(a.r, b.r, e) };
}

/** Posa dai keyframe all'istante t. Prima del primo e dopo l'ultimo resta ferma. */
export function keysPose(keys: CamKey[], t: number, W: number, H: number, res: Resolve, ease: (name: string | undefined) => (x: number) => number): CamPose {
  if (!keys.length) return { ...IDENT };
  const K = [...keys].sort((a, b) => a.t - b.t);
  if (t <= K[0].t) return keyPose(K[0], W, H, res);
  const last = K[K.length - 1];
  if (t >= last.t) return keyPose(last, W, H, res);
  let i = 1; while (K[i].t < t) i++;
  const a = K[i - 1], b = K[i], f = ease(b.ease)(cl((t - a.t) / Math.max(1e-6, b.t - a.t)));
  return mixPose(keyPose(a, W, H, res), keyPose(b, W, H, res), f);
}

/** Punto seguito, ammorbidito: media pesata del punto negli istanti precedenti (ripetibile, niente stato tra un frame e l'altro). */
export function followPoint(target: string, t: number, smooth: number, res: Resolve): [number, number] | null {
  const n = smooth > 0 ? 12 : 1;
  let sx = 0, sy = 0, sw = 0;
  for (let k = 0; k < n; k++) {
    const dt = n > 1 ? (k / (n - 1)) * smooth * 2 : 0, w = Math.exp(-dt / Math.max(1e-3, smooth)), b = res(target, Math.max(0, t - dt));
    if (!b) continue;
    sx += (b[0] + b[2] / 2) * w; sy += (b[1] + b[3] / 2) * w; sw += w;
  }
  return sw ? [sx / sw, sy / sw] : null;
}

/** Tremolio ripetibile (somma di sinusoidi con fasi fisse). */
export function shake(s: CamShake, t: number): { dx: number; dy: number; dr: number } {
  if (!s || s.amt <= 0) return { dx: 0, dy: 0, dr: 0 };
  const w = 2 * Math.PI * s.hz, n = (a: number, b: number, c: number) => (Math.sin(w * t * a + b) + .5 * Math.sin(w * t * a * 2.13 + c)) / 1.5;
  return { dx: n(1, .3, 1.7) * s.amt, dy: n(.87, 2.1, .4) * s.amt, dr: n(.61, 4.2, 2.9) * (s.rot || 0) };
}

/** Posa della camera all'istante t. */
export function camPose(c: Camera | undefined, t: number, W: number, H: number, res: Resolve, ease: (name: string | undefined) => (x: number) => number): CamPose {
  if (!c || !c.on) return { ...IDENT };
  let p = keysPose(c.keys || [], t, W, H, res, ease);
  const f = c.follow;
  if (f && f.on && f.target && f.to > f.from) {
    const r = Math.max(1e-3, f.ramp), w = sstep(cl((t - f.from) / r)) * sstep(cl((f.to - t) / r));
    if (w > 0) {
      const pt = followPoint(f.target, t, f.smooth, res);
      if (pt) p = mixPose(p, { x: pt[0] / W * 100, y: pt[1] / H * 100, z: f.z, r: p.r }, w);
    }
  }
  const s = shake(c.shake, t);
  return { x: p.x + s.dx, y: p.y + s.dy, z: p.z, r: p.r + s.dr };
}

export const isIdent = (p: CamPose) => Math.abs(p.x - 50) < 1e-6 && Math.abs(p.y - 50) < 1e-6 && Math.abs(p.z - 1) < 1e-6 && Math.abs(p.r) < 1e-6;

/** Matrice (a, b, c, d, e, f) che porta le coordinate del quadro in quelle inquadrate: il punto (x, y) va al centro, poi zoom e rotazione. */
export function camMatrix(p: CamPose, W: number, H: number): [number, number, number, number, number, number] {
  const r = p.r * Math.PI / 180, c = Math.cos(r) * p.z, s = Math.sin(r) * p.z, px = p.x / 100 * W, py = p.y / 100 * H;
  return [c, s, -s, c, W / 2 - (c * px - s * py), H / 2 - (s * px + c * py)];
}
