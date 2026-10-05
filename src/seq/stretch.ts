// Velocità dell'audio senza cambiare il tono (WSOLA): l'audio si ricompone a pezzi di 40 ms sovrapposti,
// scegliendo ogni pezzo nel punto in cui continua meglio il precedente, così la voce resta naturale anche più veloce o più lenta.

/** Audio a velocità "speed" (2 = metà durata, 0,5 = doppia) con lo stesso tono. Restituisce un canale per ogni canale d'ingresso. */
export function stretch(chs: Float32Array[], sr: number, speed: number): Float32Array[] {
  const len = chs[0]?.length || 0;
  if (!len || Math.abs(speed - 1) < 1e-6) return chs.map(c => c.slice());
  const N = Math.max(64, Math.round(sr * .04) & ~1), Hs = N / 2, tol = Math.round(sr * .012), L = Hs;
  const outLen = Math.max(1, Math.floor(len / speed));
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = .5 - .5 * Math.cos(2 * Math.PI * i / N);
  // una traccia sola per scegliere i punti (la media dei canali): i canali restano allineati tra loro
  const mono = new Float32Array(len);
  for (const c of chs) for (let i = 0; i < len; i++) mono[i] += c[i] / chs.length;
  const out = chs.map(() => new Float32Array(outLen + N)), norm = new Float32Array(outLen + N);
  const corr = (a: number, b: number, step: number) => { let s = 0; for (let i = 0; i < L; i += step) s += mono[a + i] * mono[b + i]; return s; };
  let prev = 0;
  for (let os = 0, k = 0; os < outLen; os += Hs, k++) {
    const ideal = Math.min(len - N, Math.max(0, Math.round(os * speed)));
    let best = ideal;
    const nat = prev + Hs;                                  // dove continuerebbe il pezzo precedente
    if (k > 0 && nat + L <= len) {
      const lo = Math.max(0, ideal - tol), hi = Math.min(len - N, ideal + tol);
      let bv = -Infinity;
      for (let p = lo; p <= hi; p += 4) { const v = corr(p, nat, 4); if (v > bv) { bv = v; best = p; } }      // ricerca grossolana
      const c0 = best; bv = -Infinity;
      for (let p = Math.max(lo, c0 - 4); p <= Math.min(hi, c0 + 4); p++) { const v = corr(p, nat, 2); if (v > bv) { bv = v; best = p; } }   // rifinitura
    }
    for (let ch = 0; ch < chs.length; ch++) { const src = chs[ch], dst = out[ch]; for (let i = 0; i < N && best + i < len; i++) dst[os + i] += src[best + i] * win[i]; }
    for (let i = 0; i < N; i++) norm[os + i] += win[i];
    prev = best;
  }
  return out.map(d => { const r = new Float32Array(outLen); for (let i = 0; i < outLen; i++) r[i] = norm[i] > 1e-3 ? d[i] / norm[i] : d[i]; return r; });
}
