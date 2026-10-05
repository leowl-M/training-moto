// Stabilizzazione 2D delle riprese a mano. Funzioni pure, provate da terminale.
// 1) movimento tra due fotogrammi (in piccolo, in grigio): tanti quadratini cercati nel fotogramma dopo (block matching),
//    poi lo spostamento, la rotazione e lo zoom che li spiegano meglio, scartando quelli che si muovono per conto loro (persone, foglie);
// 2) percorso della camera = somma dei movimenti; percorso voluto = lo stesso ammorbidito (le panoramiche restano, il tremolio no);
// 3) correzione di ogni fotogramma = differenza tra i due, più lo zoom minimo che nasconde i bordi su tutta la clip.

export interface Motion { tx: number; ty: number; th: number; ls: number; n: number }
/** Percorso analizzato di un file: tempi dei fotogrammi (s) e posizione cumulata (x, y in frazione della larghezza, a = rotazione, s = log dello zoom). */
export interface Track { v: 3; aspect: number; t: number[]; x: number[]; y: number[]; a: number[]; s: number[] }
export interface Corr { tx: number; ty: number; th: number; sc: number }
export type StabAmount = 'leggera' | 'media' | 'forte' | 'ferma';
// secondi; misurati sul b-roll: con 0,4 s si toglie il 74% del tremolio (il massimo che l'analisi permette), oltre cresce solo il ritaglio
export const STAB_SIGMA: Record<Exclude<StabAmount, 'ferma'>, number> = { leggera: .25, media: .4, forte: .7 };

const P = 24;

/** Grigio da RGBA (dimensioni w×h). */
export function grayOf(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = rgba[j] * .299 + rgba[j + 1] * .587 + rgba[j + 2] * .114;
  return g;
}

/** Movimento globale da a a b (immagini in grigio w×h): un punto p di a sta in A·p + t in b (A = rotazione e zoom).
 *  La ricerca si fa attorno a uno spostamento previsto (gx, gy) entro r pixel: nelle panoramiche veloci l'immagine si sposta
 *  più del raggio, quindi si parte da quello del fotogramma prima o da una stima più grossolana. */
export function estimate(a: Float32Array, b: Float32Array, w: number, h: number, o: { gx?: number; gy?: number; r?: number } = {}): Motion {
  const RNG = o.r ?? 8, gx = Math.round(o.gx || 0), gy = Math.round(o.gy || 0);
  const pts: { x: number; y: number; dx: number; dy: number }[] = [], step = Math.max(24, Math.round(Math.min(w, h) / 7));
  const mx = P / 2 + RNG + 2 + Math.abs(gx), my = P / 2 + RNG + 2 + Math.abs(gy);
  for (let cy = my; cy <= h - my; cy += step) for (let cx = mx; cx <= w - mx; cx += step) {
    const px0 = cx - P / 2, py0 = cy - P / 2;
    let mean = 0, n = 0;
    for (let y = 0; y < P; y += 2) for (let x = 0; x < P; x += 2) { mean += a[(py0 + y) * w + px0 + x]; n++; }
    mean /= n; let v = 0;
    for (let y = 0; y < P; y += 2) for (let x = 0; x < P; x += 2) { const d = a[(py0 + y) * w + px0 + x] - mean; v += d * d; }
    if (v / n < 25) continue;                         // zona liscia (cielo, muro): non dice niente
    const N = 2 * RNG + 1, sad = new Float32Array(N * N); let best = 1e30, bi = 0;
    for (let oy = -RNG; oy <= RNG; oy++) for (let ox = -RNG; ox <= RNG; ox++) {
      let s = 0;
      for (let y = 0; y < P; y += 2) { const ra = (py0 + y) * w + px0, rb = (py0 + y + oy + gy) * w + px0 + ox + gx; for (let x = 0; x < P; x += 2) s += Math.abs(a[ra + x] - b[rb + x]); }
      const i = (oy + RNG) * N + ox + RNG; sad[i] = s; if (s < best) { best = s; bi = i; }
    }
    const bx = bi % N, by = (bi / N) | 0; let dx = bx - RNG + gx, dy = by - RNG + gy;
    if (bx === 0 || by === 0 || bx === N - 1 || by === N - 1) continue;   // sul bordo della ricerca: il punto vero è più in là
    // sotto il pixel: parabola sui vicini
    { const l = sad[bi - 1], c = sad[bi], r = sad[bi + 1], den = l - 2 * c + r; if (den > 1e-6) dx += .5 * (l - r) / den; }
    { const u = sad[bi - N], c = sad[bi], d = sad[bi + N], den = u - 2 * c + d; if (den > 1e-6) dy += .5 * (u - d) / den; }
    pts.push({ x: cx - w / 2, y: cy - h / 2, dx, dy });
  }
  let use = pts, fit: Motion | null = null;
  for (let it = 0; it < 3; it++) {
    if (use.length < 4) break;
    let px = 0, py = 0, qx = 0, qy = 0;
    for (const p of use) { px += p.x; py += p.y; qx += p.x + p.dx; qy += p.y + p.dy; }
    const k = use.length; px /= k; py /= k; qx /= k; qy /= k;
    let nu = 0, nb = 0, de = 0;
    for (const p of use) { const ax = p.x - px, ay = p.y - py, bx = p.x + p.dx - qx, by = p.y + p.dy - qy; nu += ax * bx + ay * by; nb += ax * by - ay * bx; de += ax * ax + ay * ay; }
    if (de < 1e-9) break;
    const A = nu / de, B = nb / de, tx = qx - (A * px - B * py), ty = qy - (B * px + A * py);
    fit = { tx, ty, th: Math.atan2(B, A), ls: .5 * Math.log(A * A + B * B), n: k };
    const res = pts.map(p => Math.hypot(p.x + p.dx - (A * p.x - B * p.y + tx), p.y + p.dy - (B * p.x + A * p.y + ty)));
    const med = [...res].sort((u, v) => u - v)[res.length >> 1], thr = Math.max(.4, 2.5 * med);
    use = pts.filter((_, i) => res[i] <= thr);
  }
  return fit || { tx: 0, ty: 0, th: 0, ls: 0, n: 0 };
}

/** Immagini sempre più piccole (metà per volta), dalla più grande: servono a cercare prima in grande e poi nel dettaglio. */
export function pyramid(g: Float32Array, w: number, h: number, levels = 3): { g: Float32Array; w: number; h: number }[] {
  const out = [{ g, w, h }];
  for (let l = 1; l < levels; l++) {
    const p = out[l - 1], W = p.w >> 1, H = p.h >> 1, o = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = 2 * y * p.w + 2 * x; o[y * W + x] = (p.g[i] + p.g[i + 1] + p.g[i + p.w] + p.g[i + p.w + 1]) / 4; }
    out.push({ g: o, w: W, h: H });
  }
  return out;
}
/** Movimento tra due piramidi: dalla più piccola (partendo dallo spostamento previsto) alla più grande, affinando ogni volta. */
export function estimatePyr(a: ReturnType<typeof pyramid>, b: ReturnType<typeof pyramid>, guess: { tx: number; ty: number } = { tx: 0, ty: 0 }): Motion {
  const L = a.length - 1, k = a[0].w / a[L].w;
  let m = estimate(a[L].g, b[L].g, a[L].w, a[L].h, { gx: guess.tx / k, gy: guess.ty / k, r: 8 });
  if (m.n < 6) m = estimate(a[L].g, b[L].g, a[L].w, a[L].h, { r: 10 });            // previsione sbagliata (cambio di direzione): da capo
  for (let l = L - 1; l >= 0; l--) {
    const f = a[l].w / a[l + 1].w, r = estimate(a[l].g, b[l].g, a[l].w, a[l].h, { gx: m.tx * f, gy: m.ty * f, r: 3 });
    m = r.n >= 6 ? r : { ...m, tx: m.tx * f, ty: m.ty * f };
  }
  return m;
}

/** Somma i movimenti in un percorso (x, y in frazione della larghezza). Dove i punti affidabili sono pochi il movimento non conta. */
export function addMotion(tr: Track, t: number, m: Motion | null, w: number) {
  const i = tr.t.length, ok = m && m.n >= 6;
  tr.t.push(t);
  tr.x.push(i ? tr.x[i - 1] + (ok ? m!.tx / w : 0) : 0); tr.y.push(i ? tr.y[i - 1] + (ok ? m!.ty / w : 0) : 0);
  tr.a.push(i ? tr.a[i - 1] + (ok ? m!.th : 0) : 0); tr.s.push(i ? tr.s[i - 1] + (ok ? m!.ls : 0) : 0);
}

/** Ammorbidisce con una regressione locale quadratica (pesi gaussiani): velocità e accelerazione costanti restano
 *  (le panoramiche volute), il tremolio no. Ai bordi il percorso si prolunga in modo simmetrico. */
export function smoothPath(arr: number[], sigma: number): number[] {
  const n = arr.length;
  if (n < 3 || sigma < .5) return arr.slice();
  const r = Math.ceil(sigma * 3), w: number[] = [];
  for (let j = -r; j <= r; j++) w.push(Math.exp(-j * j / (2 * sigma * sigma)));
  const at = (q: number) => q < 0 ? 2 * arr[0] - arr[Math.min(n - 1, -q)] : q >= n ? 2 * arr[n - 1] - arr[Math.max(0, 2 * (n - 1) - q)] : arr[q];
  let S0 = 0, S2 = 0, S4 = 0;
  for (let j = -r; j <= r; j++) { const k = w[j + r]; S0 += k; S2 += k * j * j; S4 += k * j ** 4; }
  const den = S0 * S4 - S2 * S2;
  return arr.map((_, i) => { let T0 = 0, T2 = 0; for (let j = -r; j <= r; j++) { const y = at(i + j), k = w[j + r]; T0 += k * y; T2 += k * j * j * y; } return (T0 * S4 - S2 * T2) / den; });
}

/** Indici dei fotogrammi dentro [a, b] (secondi nel file). */
function span(tr: Track, a: number, b: number): [number, number] {
  let i0 = 0, i1 = tr.t.length - 1;
  while (i0 < i1 && tr.t[i0 + 1] <= a) i0++;
  while (i1 > i0 && tr.t[i1 - 1] >= b) i1--;
  return [i0, i1];
}

/** Correzioni dei fotogrammi in [a, b] e zoom che nasconde i bordi. "ferma" = camera immobile (sul punto medio del pezzo).
 *  rot = true: si corregge anche la rotazione (utile solo se la ripresa ruota parecchio: su riprese normali la misura è rumore). Restituisce anche il primo indice, per leggere le correzioni per tempo. */
export function corrections(tr: Track, amount: StabAmount, a: number, b: number, rot = false, maxZoom = 1.5): { i0: number; c: Corr[]; zoom: number; crop: number } {
  const [i0, i1] = span(tr, a, b), sl = (v: number[]) => v.slice(i0, i1 + 1);
  const X = sl(tr.x), Y = sl(tr.y), A = sl(tr.a);
  let sx: number[], sy: number[], sa: number[];
  if (amount === 'ferma') { const m = (v: number[]) => { const k = v.reduce((p, q) => p + q, 0) / (v.length || 1); return v.map(() => k); }; sx = m(X); sy = m(Y); sa = m(A); }
  else {
    const n = tr.t.length, dt = n > 1 ? (tr.t[n - 1] - tr.t[0]) / (n - 1) : 1 / 30, sg = STAB_SIGMA[amount] / Math.max(1e-3, dt);
    // il percorso si ammorbidisce su un tratto più largo del pezzo, così ai suoi bordi la camera non si "ferma" di colpo
    const r = Math.ceil(sg * 3), j0 = Math.max(0, i0 - r), j1 = Math.min(n - 1, i1 + r), sm = (v: number[]) => smoothPath(v.slice(j0, j1 + 1), sg).slice(i0 - j0, i1 - j0 + 1);
    sx = sm(tr.x); sy = sm(tr.y); sa = sm(tr.a);
  }
  // lo zoom della mano non si corregge: la sua misura è quasi solo rumore e correggerla aggiunge tremolio (verificato rianalizzando il video corretto)
  const c: Corr[] = X.map((_, i) => ({ tx: sx[i] - X[i], ty: sy[i] - Y[i], th: rot ? sa[i] - A[i] : 0, sc: 1 }));
  let zoom = 1;
  for (const k of c) zoom = Math.max(zoom, needZoom(k, tr.aspect));
  if (zoom > maxZoom) {
    // troppo ritaglio: si riduce la correzione in proporzione (meglio un po' di tremolio che un'immagine sgranata)
    const f = (maxZoom - 1) / (zoom - 1);
    for (const k of c) { k.tx *= f; k.ty *= f; k.th *= f; k.sc = Math.exp(Math.log(k.sc) * f); }
    zoom = maxZoom;
  }
  return { i0, c, zoom, crop: 1 - 1 / zoom };
}

/** Zoom minimo perché il fotogramma corretto copra tutto il quadro (larghezza 1, altezza 1/aspect). */
export function needZoom(k: Corr, aspect: number): number {
  const W = 1, H = 1 / aspect, co = Math.cos(k.th), si = Math.sin(k.th);
  let z = 1;
  // ogni angolo del quadro, riportato nel fotogramma, deve cadere dentro il fotogramma
  for (const [ox, oy] of [[-W / 2, -H / 2], [W / 2, -H / 2], [-W / 2, H / 2], [W / 2, H / 2]]) {
    const dx = ox - k.tx, dy = oy - k.ty, sx = (co * dx + si * dy) / k.sc, sy = (-si * dx + co * dy) / k.sc;
    z = Math.max(z, Math.abs(sx) / (W / 2), Math.abs(sy) / (H / 2));
  }
  return z;
}

/** Correzione all'istante t del file (interpolata tra i fotogrammi). */
export function corrAt(tr: Track, r: { i0: number; c: Corr[]; zoom: number }, t: number): Corr {
  const c = r.c;
  if (!c.length) return { tx: 0, ty: 0, th: 0, sc: r.zoom };
  let lo = r.i0, hi = r.i0 + c.length - 1;
  if (t <= tr.t[lo]) return { ...c[0], sc: c[0].sc * r.zoom };
  if (t >= tr.t[hi]) return { ...c[c.length - 1], sc: c[c.length - 1].sc * r.zoom };
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tr.t[m] <= t) lo = m; else hi = m; }
  const u = (t - tr.t[lo]) / Math.max(1e-6, tr.t[hi] - tr.t[lo]), p = c[lo - r.i0], q = c[hi - r.i0];
  return { tx: p.tx + (q.tx - p.tx) * u, ty: p.ty + (q.ty - p.ty) * u, th: p.th + (q.th - p.th) * u, sc: (p.sc + (q.sc - p.sc) * u) * r.zoom };
}

/** Tremolio: ampiezza delle variazioni rapide del percorso (per misurare quanto si è tolto). */
export function shake(v: number[]): number {
  const s = smoothPath(v, 12);
  return Math.sqrt(v.reduce((q, x, i) => q + (x - s[i]) ** 2, 0) / (v.length || 1));
}
