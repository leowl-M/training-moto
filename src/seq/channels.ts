// Canali audio: riconosce come è stato registrato il microfono (DJI e simili) e prepara due canali giusti per il montaggio.
// Casi tipici: voce solo su un lato (ricevitore in stereo con un solo trasmettitore), traccia di sicurezza (stessa voce più bassa
// sull'altro canale), mono vero, stereo vero (microfono della camera, musica).

export type ChanMode = 'auto' | 'stereo' | 'left' | 'right' | 'mono';
export interface ChanInfo { dbL: number; dbR: number; corr: number; kind: 'mono' | 'one-side' | 'safety' | 'stereo'; use: Exclude<ChanMode, 'auto'> }

const db = (x: number) => 10 * Math.log10(x + 1e-12);

/** Misura i canali: livello medio (dB), somiglianza tra i due (correlazione) e cosa conviene usare. */
export function analyzeChannels(chs: Float32Array[]): ChanInfo {
  const L = chs[0], R = chs[1];
  if (!R) { const e = L.reduce((s, v) => s + v * v, 0) / Math.max(1, L.length); return { dbL: db(e), dbR: db(e), corr: 1, kind: 'mono', use: 'stereo' }; }
  let ll = 0, rr = 0, lr = 0;
  const n = Math.min(L.length, R.length), step = n > 4e6 ? 4 : 1;
  for (let i = 0; i < n; i += step) { ll += L[i] * L[i]; rr += R[i] * R[i]; lr += L[i] * R[i]; }
  const m = Math.ceil(n / step), dbL = db(ll / m), dbR = db(rr / m), corr = lr / Math.sqrt(ll * rr + 1e-20), diff = dbL - dbR;
  const louder = diff >= 0 ? 'left' : 'right';
  let kind: ChanInfo['kind'], use: ChanInfo['use'];
  if (Math.abs(diff) > 20) { kind = 'one-side'; use = louder; }                     // un canale vuoto
  else if (corr > .9 && Math.abs(diff) >= 3) { kind = 'safety'; use = louder; }       // stessa voce, una copia più bassa
  else if (corr > .98) { kind = 'mono'; use = 'stereo'; }                             // già uguale sui due lati
  else { kind = 'stereo'; use = 'stereo'; }
  return { dbL, dbR, corr, kind, use };
}

/** I due canali da suonare con la modalità scelta (left/right: quel canale su entrambi i lati; mono: la media dei due). */
export function applyChannels(chs: Float32Array[], mode: Exclude<ChanMode, 'auto'>): Float32Array[] {
  const L = chs[0], R = chs[1] || chs[0];
  if (mode === 'left') return [L, L];
  if (mode === 'right') return [R, R];
  if (mode === 'mono') { const m = new Float32Array(L.length); for (let i = 0; i < m.length; i++) m[i] = (L[i] + R[i]) / 2; return [m, m]; }
  return [L, R];
}

/** Descrizione per il pannello. */
export function describe(i: ChanInfo): string {
  const f = (v: number) => (v < -90 ? 'vuoto' : Math.round(v) + ' dB');
  if (i.kind === 'one-side') return `Voce solo sul canale ${i.use === 'left' ? 'sinistro' : 'destro'} (l'altro: ${f(i.use === 'left' ? i.dbR : i.dbL)}): si copia su entrambi i lati.`;
  if (i.kind === 'safety') return `Traccia di sicurezza: stessa voce ${Math.abs(Math.round(i.dbL - i.dbR))} dB più bassa sul canale ${i.use === 'left' ? 'destro' : 'sinistro'}. Si usa quella principale su entrambi i lati.`;
  if (i.kind === 'mono') return 'Audio mono: uguale sui due lati.';
  return 'Stereo vero (per esempio il microfono della camera o la musica): resta com\'è.';
}
