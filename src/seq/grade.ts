// Correzione colore delle clip video: esposizione, bilanciamento del bianco (temperatura e tinta), contrasto, luci, ombre,
// saturazione e vividezza. Il calcolo vero si fa sulla scheda video (WebGL) a ogni fotogramma; gradePixel è la stessa formula
// in JavaScript, usata dalle prove e per controllare che lo shader dia lo stesso risultato.

export interface Grade { exp: number; con: number; hi: number; sh: number; temp: number; tint: number; sat: number; vib: number }
// exp in stop (−3…+3); gli altri da −100 a +100 (0 = invariato)
export const GRADE0: Grade = { exp: 0, con: 0, hi: 0, sh: 0, temp: 0, tint: 0, sat: 0, vib: 0 };
export const isNeutral = (g: Partial<Grade> | null | undefined) => !g || (Object.keys(GRADE0) as (keyof Grade)[]).every(k => Math.abs(+(g[k] || 0)) < 1e-6);

/** Look pronti (valori di partenza, poi si ritoccano). */
export const LOOKS: { id: string; n: string; g: Partial<Grade> }[] = [
  { id: 'neutro', n: 'Neutro (azzera)', g: {} },
  { id: 'luminoso', n: 'Luminoso e pulito', g: { exp: .25, con: 8, sh: 15, hi: -10, vib: 15 } },
  { id: 'caldo', n: 'Caldo', g: { temp: 25, tint: 4, sat: 5, vib: 10, con: 6 } },
  { id: 'freddo', n: 'Freddo', g: { temp: -22, tint: -3, con: 10, sat: -5 } },
  { id: 'contrasto', n: 'Contrastato', g: { con: 28, hi: -15, sh: -12, vib: 12 } },
  { id: 'morbido', n: 'Morbido (pastello)', g: { con: -22, sh: 25, hi: -20, sat: -18, exp: .15 } },
  { id: 'cinema', n: 'Cinema (ombre fredde, pelle calda)', g: { con: 18, temp: 8, tint: -4, sat: -10, vib: 14, sh: -8, hi: -12 } },
  { id: 'bn', n: 'Bianco e nero', g: { sat: -100, con: 22, hi: -8 } },
];

const toLin = (c: number) => (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= .0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - .055);
const cl = (x: number) => Math.max(0, Math.min(1, x));

/** Un colore (0–1, sRGB) corretto. Esposizione e bilanciamento si fanno sulla luce vera (lineare), il resto sui valori visti. */
export function gradePixel(rgb: [number, number, number], g: Grade): [number, number, number] {
  let [r, gg, b] = rgb.map(toLin);
  const e = 2 ** g.exp, t = g.temp / 100, n = g.tint / 100;
  r *= e * (1 + .25 * t) * (1 + .1 * n); gg *= e * (1 - .2 * n); b *= e * (1 - .25 * t) * (1 + .1 * n);
  r = cl(toSrgb(cl(r))); gg = cl(toSrgb(cl(gg))); b = cl(toSrgb(cl(b)));
  // luci e ombre: curva sulla luminosità, il colore si scala con lei (la tinta non cambia)
  const y = .2126 * r + .7152 * gg + .0722 * b, S = g.sh / 100, H = g.hi / 100;
  const fy = cl(y + 1.2 * S * y * (1 - y) ** 2 + 1.2 * H * y * y * (1 - y)), k = y > 1e-5 ? fy / y : 1;
  r *= k; gg *= k; b *= k;
  // contrasto attorno al grigio medio
  const c = 1 + g.con / 100;
  r = .5 + (r - .5) * c; gg = .5 + (gg - .5) * c; b = .5 + (b - .5) * c;
  // saturazione e vividezza (la vividezza spinge di più i colori spenti e meno quelli già saturi)
  const y2 = .2126 * r + .7152 * gg + .0722 * b, s = Math.max(r, gg, b) - Math.min(r, gg, b);
  const ks = Math.max(0, (1 + g.sat / 100) * (1 + (g.vib / 100) * (1 - cl(s))));
  r = y2 + (r - y2) * ks; gg = y2 + (gg - y2) * ks; b = y2 + (b - y2) * ks;
  return [cl(r), cl(gg), cl(b)];
}

const FS = `precision highp float;
varying vec2 uv; uniform sampler2D tex; uniform float exp_, con, hi, sh, temp, tint, sat, vib;
vec3 toLin(vec3 c){ return mix(c/12.92, pow((c+.055)/1.055, vec3(2.4)), step(.04045, c)); }
vec3 toSrgb(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1./2.4))-.055, step(.0031308, c)); }
void main(){
  vec4 src = texture2D(tex, uv); vec3 c = toLin(src.rgb);
  float e = exp2(exp_), t = temp/100., n = tint/100.;
  c *= e * vec3((1.+.25*t)*(1.+.1*n), 1.-.2*n, (1.-.25*t)*(1.+.1*n));
  c = clamp(toSrgb(clamp(c, 0., 1.)), 0., 1.);
  float y = dot(c, vec3(.2126,.7152,.0722)), S = sh/100., H = hi/100.;
  float fy = clamp(y + 1.2*S*y*(1.-y)*(1.-y) + 1.2*H*y*y*(1.-y), 0., 1.);
  c *= y > 1e-5 ? fy/y : 1.;
  c = .5 + (c-.5)*(1.+con/100.);
  float y2 = dot(c, vec3(.2126,.7152,.0722)), s = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  float ks = max(0., (1.+sat/100.)*(1.+(vib/100.)*(1.-clamp(s,0.,1.))));
  gl_FragColor = vec4(clamp(y2 + (c-y2)*ks, 0., 1.), src.a);   // la trasparenza resta (livello di regolazione su zone vuote)
}`;
const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x*.5+.5, .5-p.y*.5); gl_Position = vec4(p, 0., 1.); }`;

/** Applica la correzione con WebGL: restituisce un canvas (al massimo maxSide px sul lato lungo) con il fotogramma corretto. */
export class Grader {
  cv: HTMLCanvasElement; gl: WebGLRenderingContext | null; private prog: WebGLProgram | null = null; private tex: WebGLTexture | null = null; private loc: Record<string, WebGLUniformLocation | null> = {};
  constructor() {
    this.cv = document.createElement('canvas');
    this.gl = this.cv.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
    const gl = this.gl; if (!gl) return;
    const sh = (t: number, s: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, s); gl.compileShader(o); return o; };
    const p = gl.createProgram()!; gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { this.gl = null; return; }
    this.prog = p; gl.useProgram(p);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.tex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    for (const k of ['exp_', 'con', 'hi', 'sh', 'temp', 'tint', 'sat', 'vib']) this.loc[k] = gl.getUniformLocation(p, k);
  }
  get ok() { return !!this.gl; }
  apply(src: TexImageSource, sw: number, sh: number, g: Grade, maxSide = 1920): HTMLCanvasElement | null {
    const gl = this.gl; if (!gl || !sw || !sh) return null;
    const k = Math.min(1, maxSide / Math.max(sw, sh)), w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
    gl.viewport(0, 0, w, h); gl.bindTexture(gl.TEXTURE_2D, this.tex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } catch { return null; }
    gl.uniform1f(this.loc.exp_, g.exp || 0);
    for (const n of ['con', 'hi', 'sh', 'temp', 'tint', 'sat', 'vib'] as const) gl.uniform1f(this.loc[n], g[n] || 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.cv;
  }
}
