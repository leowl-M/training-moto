// Mix: volume percepito (LUFS, come lo misurano Instagram, YouTube e Spotify), limitatore, musica che si abbassa sotto la voce.
// Funzioni pure, provate da terminale.

/* ---------- volume percepito (ITU-R BS.1770 / EBU R128) ---------- */
type Bq = [number, number, number, number, number];     // b0 b1 b2 a1 a2 (a0 = 1)
/** Filtri di "pesatura K" per la frequenza di campionamento data (stesse formule di libebur128: a 48 kHz danno i coefficienti della norma). */
function kFilters(sr: number): Bq[] {
  let f0 = 1681.974450955533, G = 3.999843853973347, Q = .7071752369554196, K = Math.tan(Math.PI * f0 / sr);
  const Vh = 10 ** (G / 20), Vb = Vh ** .4996667741545416, a0 = 1 + K / Q + K * K;
  const shelf: Bq = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  f0 = 38.13547087602444; Q = .5003270373238773; K = Math.tan(Math.PI * f0 / sr);
  const d = 1 + K / Q + K * K, hp: Bq = [1, -2, 1, 2 * (K * K - 1) / d, (1 - K / Q + K * K) / d];
  return [shelf, hp];
}
function filt(x: Float32Array, [b0, b1, b2, a1, a2]: Bq): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
/** Volume percepito integrato in LUFS (blocchi da 400 ms, soglie assoluta −70 e relativa −10). −Infinity se è silenzio. */
export function loudness(chs: Float32Array[], sr: number): number {
  const F = kFilters(sr), w = chs.map(c => filt(filt(c, F[0]), F[1]));
  const blk = Math.round(sr * .4), hop = Math.round(sr * .1), n = w[0].length, z: number[] = [];
  // somme cumulative dei quadrati: ogni blocco costa uguale
  const cum = w.map(c => { const s = new Float64Array(c.length + 1); for (let i = 0; i < c.length; i++) s[i + 1] = s[i] + c[i] * c[i]; return s; });
  for (let a = 0; a + blk <= n; a += hop) { let e = 0; for (const s of cum) e += (s[a + blk] - s[a]) / blk; z.push(e); }
  if (!z.length) { let e = 0; for (const s of cum) e += s[n] / Math.max(1, n); z.push(e); }
  const L = (e: number) => -0.691 + 10 * Math.log10(e + 1e-20);
  const abs = z.filter(e => L(e) > -70);
  if (!abs.length) return -Infinity;
  const rel = L(abs.reduce((s, e) => s + e, 0) / abs.length) - 10, g = abs.filter(e => L(e) > rel);
  return L(g.reduce((s, e) => s + e, 0) / g.length);
}
/** Guadagno (moltiplicatore) per portare un volume misurato al bersaglio, entro ±maxDb. */
export function gainTo(measured: number, target: number, maxDb = 20): number {
  if (!isFinite(measured)) return 1;
  return 10 ** (Math.max(-maxDb, Math.min(maxDb, target - measured)) / 20);
}

/* ---------- limitatore ---------- */
/** Limitatore con anticipo: nessun campione supera ceilingDb; la riduzione arriva un attimo prima del picco e se ne va dolcemente. */
export function limit(chs: Float32Array[], sr: number, ceilingDb = -1, releaseS = .08, lookS = .005): Float32Array[] {
  const n = chs[0]?.length || 0, c = 10 ** (ceilingDb / 20), la = Math.max(1, Math.round(sr * lookS));
  const req = new Float32Array(n);
  for (let i = 0; i < n; i++) { let p = 0; for (const ch of chs) { const v = Math.abs(ch[i]); if (v > p) p = v; } req[i] = p > c ? c / p : 1; }
  // minimo sulla finestra in avanti (coda monotona)
  const g = new Float32Array(n), dq = new Int32Array(n);
  let h = 0, t = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (t > h && req[dq[t - 1]] >= req[i]) t--;
    dq[t++] = i;
    while (dq[h] > i + la) h++;
    g[i] = req[dq[h]];
  }
  // risalita lenta, poi media sugli ultimi "la" campioni: al picco la riduzione è già completa
  const k = 1 - Math.exp(-1 / (sr * releaseS));
  for (let i = 1; i < n; i++) g[i] = Math.min(g[i], g[i - 1] + (1 - g[i - 1]) * k);
  const out = chs.map(() => new Float32Array(n));
  let acc = la;                                           // prima dell'inizio il guadagno è 1
  for (let i = 0; i < n; i++) {
    acc += g[i] - (i >= la ? g[i - la] : 1);
    const gs = Math.min(g[i], acc / la);
    for (let j = 0; j < chs.length; j++) out[j][i] = chs[j][i] * gs;
  }
  return out;
}

/* ---------- musica sotto la voce ---------- */
export type Range = [number, number];
/** Unisce i tratti di voce vicini (sotto "hold" secondi di pausa la musica resta bassa, così non sale e scende tra le parole). */
export function voiceRegions(runs: Range[], hold = .8): Range[] {
  const r = [...runs].sort((a, b) => a[0] - b[0]), out: Range[] = [];
  for (const [a, b] of r) { const l = out[out.length - 1]; if (l && a - l[1] < hold) l[1] = Math.max(l[1], b); else out.push([a, b]); }
  return out;
}
export interface DuckOpts { depthDb: number; attack: number; release: number }
/** Guadagno della musica all'istante t: 1 lontano dalla voce, giù di depthDb mentre si parla, con discesa prima e risalita dopo. */
export function duckAt(regions: Range[], o: DuckOpts, t: number): number {
  const d = 10 ** (-o.depthDb / 20);
  let g = 1;
  for (const [a, b] of regions) {
    let v = 1;
    if (t >= a && t <= b) v = d;
    else if (t < a && t > a - o.attack) v = 1 + (d - 1) * (t - (a - o.attack)) / o.attack;
    else if (t > b && t < b + o.release) v = d + (1 - d) * (t - b) / o.release;
    if (v < g) g = v;
  }
  return g;
}
/** Punti (tempo, guadagno) da collegare con rampe lineari tra from e to. */
export function duckPoints(regions: Range[], o: DuckOpts, from: number, to: number): [number, number][] {
  const ts = new Set<number>([from, to]);
  for (const [a, b] of regions) for (const x of [a - o.attack, a, b, b + o.release]) if (x > from && x < to) ts.add(x);
  return [...ts].sort((x, y) => x - y).map(x => [x, duckAt(regions, o, x)]);
}
