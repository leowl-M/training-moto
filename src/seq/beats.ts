// Battiti della musica: dove cadono, il tempo (BPM) e gli inizi di misura. Funzioni pure, provate da terminale.
// 1) "attacchi": quanto cresce lo spettro da un istante al successivo (flusso spettrale), ogni ~11 ms;
// 2) tempo: l'intervallo che si ripete di più negli attacchi (autocorrelazione), preferendo i tempi da 80 a 160 BPM;
// 3) battiti: la sequenza più regolare che passa per gli attacchi più forti (programmazione dinamica, metodo di Ellis);
// 4) misure da 4: il gruppo di battiti con gli attacchi più forti segna il primo tempo.

export interface Beats { bpm: number; beats: number[]; strength: number[]; downbeats: number[] }

const SR = 22050, N = 1024, HOP = 256, FPS = SR / HOP;

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const p = i + k, q = p + len / 2, tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

/** Audio mono a 22 050 Hz (media dei canali, ricampionamento lineare con un filtro semplice contro l'aliasing). */
export function toMono22k(chs: Float32Array[], sr: number): Float32Array {
  const n = chs[0].length, m = new Float32Array(n);
  for (const c of chs) for (let i = 0; i < n; i++) m[i] += c[i] / chs.length;
  if (Math.abs(sr - SR) < 1) return m;
  const k = sr / SR, out = new Float32Array(Math.floor(n / k)), w = Math.max(1, Math.round(k));
  for (let i = 0; i < out.length; i++) { const x = i * k, a = Math.floor(x); let s = 0, c = 0; for (let j = a - (w >> 1); j <= a + (w >> 1); j++) if (j >= 0 && j < n) { s += m[j]; c++; } out[i] = c ? s / c : 0; }
  return out;
}

/** Forza degli attacchi (una per fotogramma di analisi), normalizzata. */
export function onsets(x: Float32Array): Float32Array {
  const frames = Math.max(0, Math.floor((x.length - N) / HOP) + 1), out = new Float32Array(frames), win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = .5 - .5 * Math.cos(2 * Math.PI * i / N);
  let prev = new Float64Array(N / 2);
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < N; i++) { re[i] = x[f * HOP + i] * win[i]; im[i] = 0; }
    fft(re, im);
    const mag = new Float64Array(N / 2);
    let flux = 0;
    for (let b = 1; b < N / 2; b++) { mag[b] = Math.log1p(1000 * Math.hypot(re[b], im[b])); const d = mag[b] - prev[b]; if (d > 0) flux += d; }
    out[f] = f ? flux : 0; prev = mag;
  }
  // tolgo l'andamento lento (media mobile su ~0,5 s) e normalizzo
  const w = Math.round(FPS * .25), o2 = new Float32Array(frames);
  let mx = 0;
  for (let f = 0; f < frames; f++) { let s = 0, c = 0; for (let j = Math.max(0, f - w); j <= Math.min(frames - 1, f + w); j++) { s += out[j]; c++; } o2[f] = Math.max(0, out[f] - s / c); if (o2[f] > mx) mx = o2[f]; }
  if (mx > 0) for (let f = 0; f < frames; f++) o2[f] /= mx;
  return o2;
}

/** Tempo in BPM dagli attacchi: autocorrelazione pesata attorno a 120 BPM (si evitano i "doppi" e i "mezzi" tempi). */
export function tempo(on: Float32Array, lo = 60, hi = 200): number {
  let best = 120, bv = -Infinity;
  const ac = (lag: number) => { let s = 0; for (let i = lag; i < on.length; i++) s += on[i] * on[i - lag]; return s / (on.length - lag); };
  for (let bpm = lo; bpm <= hi; bpm += .5) {
    const lag = FPS * 60 / bpm, l0 = Math.floor(lag), r = lag - l0;
    const v = (ac(l0) * (1 - r) + ac(l0 + 1) * r) + .5 * (ac(Math.round(lag * 2)) || 0);
    const w = Math.exp(-.5 * (Math.log2(bpm / 120) / .9) ** 2);
    if (v * w > bv) { bv = v * w; best = bpm; }
  }
  return best;
}

/** Battiti: la sequenza con passo vicino al tempo che raccoglie più attacchi. */
export function track(on: Float32Array, bpm: number, tight = 100): number[] {
  const P = FPS * 60 / bpm, n = on.length, score = new Float64Array(n), from = new Int32Array(n).fill(-1);
  for (let t = 0; t < n; t++) {
    let best = 0, arg = -1;
    for (let p = Math.max(0, Math.floor(t - 2 * P)); p <= t - Math.round(P / 2); p++) {
      const v = score[p] - tight * Math.log((t - p) / P) ** 2;
      if (v > best || arg < 0) { best = v; arg = p; }
    }
    score[t] = on[t] + (arg >= 0 ? Math.max(0, best) : 0); from[t] = arg >= 0 && best > 0 ? arg : -1;
  }
  // partenza dall'ultimo tratto con punteggio alto, poi all'indietro
  let t = n - 1, top = -Infinity;
  for (let i = Math.max(0, n - Math.ceil(P * 2)); i < n; i++) if (score[i] > top) { top = score[i]; t = i; }
  const out: number[] = [];
  while (t >= 0) { out.push(t); t = from[t]; }
  return out.reverse().map(f => (f * HOP + N / 2) / SR);
}

/** Rifinitura al millisecondo: ogni battito si sposta sul colpo vero più vicino (entro ±40 ms), cioè dove l'energia degli acuti
 *  cresce di più; dove non c'è un colpo chiaro il battito si ricava dai vicini. Così la griglia non "scivola" sui brani
 *  che non sono esattamente al tempo trovato (l'analisi grossolana lavora a passi di 11,6 ms). */
export function refine(x: Float32Array, beats: number[]): number[] {
  const W = Math.round(SR / 1000), n = Math.floor(x.length / W), e = new Float32Array(n), rise = new Float32Array(n);
  for (let k = 0; k < n; k++) { let s = 0; for (let i = Math.max(1, k * W); i < (k + 1) * W; i++) { const d = x[i] - x[i - 1]; s += d * d; } e[k] = Math.log10(s + 1e-10); }
  for (let k = 3; k < n; k++) rise[k] = Math.max(0, e[k] - e[k - 3]);
  const u = W / SR, R = Math.round(.04 / u);              // durata di un blocco (circa 1 ms) e raggio di ricerca
  const pos = beats.map(t => { const c = Math.round(t / u); let best = 0, bk = -1; for (let k = c - R; k <= c + R; k++) if (k > 3 && k < n && rise[k] > best) { best = rise[k]; bk = k; } return { t: bk >= 0 ? (bk - 1.5) * u : t, s: best }; });
  const ss = pos.map(p => p.s).sort((a, b) => a - b), thr = ss[Math.floor(ss.length * .5)] * .6;
  const ok = pos.map(p => p.s >= thr);
  // dove il colpo è debole: retta sui vicini affidabili (fino a 8 per lato)
  return pos.map((p, i) => {
    if (ok[i]) return p.t;
    const xs: number[] = [], ys: number[] = [];
    for (let j = Math.max(0, i - 8); j <= Math.min(pos.length - 1, i + 8); j++) if (ok[j]) { xs.push(j); ys.push(pos[j].t); }
    if (xs.length < 2) return beats[i];
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0, den = 0; for (let k = 0; k < xs.length; k++) { num += (xs[k] - mx) * (ys[k] - my); den += (xs[k] - mx) ** 2; }
    return my + (den ? num / den : 0) * (i - mx);
  });
}

/** Tutto insieme: battiti, BPM, forza di ogni battito, inizi di misura (gruppi da 4). */
export function findBeats(chs: Float32Array[], sr: number): Beats {
  const x = toMono22k(chs, sr), on = onsets(x);
  if (on.length < FPS * 2) return { bpm: 0, beats: [], strength: [], downbeats: [] };
  const bpm = tempo(on), beats = track(on, bpm), P = 60 / bpm;
  // la griglia continua all'indietro fino all'inizio (il primo colpo, a 0, l'analisi non lo vede)
  while (beats.length && beats[0] - P > -.03) beats.unshift(Math.max(0, beats[0] - P));
  const fine = refine(x, beats);
  for (let i = 0; i < beats.length; i++) beats[i] = Math.max(0, fine[i]);
  const iv = beats.slice(1).map((b, i) => b - beats[i]).sort((a, b) => a - b), bpmFine = iv.length ? 60 / iv[iv.length >> 1] : bpm;
  const at = (s: number) => { const f = Math.round(s * SR / HOP - N / 2 / HOP); let m = 0; for (let j = f - 2; j <= f + 2; j++) if (j >= 0 && j < on.length && on[j] > m) m = on[j]; return m; };
  const strength = beats.map(at);
  // primo tempo della misura: dove la cassa (bassi) è più forte e dove cominciano le sezioni (l'energia cresce di colpo);
  // la sola forza dei colpi non basta, perché il rullante sul 2 e sul 4 spesso è il colpo più forte
  const lp = new Float32Array(x.length); let a = 0; for (let i = 0; i < x.length; i++) { a += (x[i] - a) * .04; lp[i] = a; }
  const en = (sig: Float32Array, t: number, w: number) => { const i0 = Math.max(0, Math.round(t * SR)), n = Math.max(1, Math.round(w * SR)); let s = 0; for (let i = i0; i < i0 + n && i < sig.length; i++) s += sig[i] * sig[i]; return s / n; };
  const dB = (v: number) => 10 * Math.log10(v + 1e-12), sc = [0, 0, 0, 0], cn = [0, 0, 0, 0];
  beats.forEach((t, i) => { sc[i % 4] += dB(en(lp, t, .05)) + 3 * strength[i]; cn[i % 4]++; });
  for (let k = 0; k < 4; k++) sc[k] = cn[k] ? sc[k] / cn[k] : -Infinity;
  const rises = beats.map((t, i) => [i, t > 2 ? dB(en(x, t, 2) / (en(x, t - 2, 2) + 1e-12)) : 0] as [number, number]).filter(r => r[1] > 2).sort((p, q) => q[1] - p[1]).slice(0, 8);
  for (const [i, d] of rises) sc[i % 4] += .5 * d;
  let ph = 0; for (let k = 1; k < 4; k++) if (sc[k] > sc[ph]) ph = k;
  return { bpm: Math.round(bpmFine * 10) / 10, beats, strength, downbeats: beats.filter((_, i) => i % 4 === ph) };
}
