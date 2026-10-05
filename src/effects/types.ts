// Tipi condivisi dagli effetti. Descrivono i dati che il motore già usa: nessuna logica.

/** Definizione di un parametro: genera da sola il controllo nel pannello (r = cursore, s = menu, b = interruttore, c = colore). */
export interface ParamDef {
  k: string;
  l: string;
  t: string;
  v: any;
  min?: number;
  max?: number;
  st?: number;
  un?: string;
  o?: any[];
  layout?: boolean;   // se cambia la disposizione del testo, il layout va ricalcolato
}

/** Stato di un'unità (lettera, parola, riga o tutto) in un dato istante: gli effetti lo modificano, il motore lo disegna. */
export interface RenderState {
  x: number; y: number;
  sx: number; sy: number;
  rot: number; skx: number;
  op: number; blur: number; mix: number;
  px: number; py: number;
  clip: number;
  reveal?: any;               // maschere Studio del progetto training-motion
  wipe: any; slices: any; vs: any; frag: any; roll: any; bar: any; echo: any;
  dwipe: any; hroll: any; glow: any; ext: any; dash: any;
  ul?: number;                 // avanzamento della sottolineatura (assente = completa)
  pth?: any;                   // testo su tracciato: tracciato, scorrimento e quanto è piegato (assente = testo dritto)
  rgb: number; rgbA?: string; rgbB?: string;
  wght: number | null;
  hooks: { fn: Function; p: any; o: any }[];
  outl: number; outlW: number;
}

/** Un'unità di testo calcolata dal layout. Posizioni relative al centro del blocco. */
export interface Unit {
  i: number; n: number;
  cx: number; cy: number; w: number;
  line: number;
  by0: number; by1: number;
  fx: number; fy: number;
  chars: any[];
}

/** Effetto di entrata/uscita. p va da 0 (nascosto) a 1 (a riposo) e può superare 1 con curve elastiche. */
export interface EffectDef {
  id: string;
  n: string;
  c: string;
  d: string;
  exit?: boolean;
  rec: { split?: string; stagger?: number; ease?: string; order?: string };
  p: ParamDef[];
  f: (s: RenderState, p: number, u: Unit, o: Record<string, any>, inf: { L: number }) => void;
  post?: (ctx: CanvasRenderingContext2D, arr: any[], o: any, S: any, Lay: any, t: number, cols: any) => void;
}

/** Movimento continuo, applicato sopra la transizione. */
export interface LoopDef {
  id: string;
  n: string;
  d?: string;
  c?: string;   // categoria nella libreria (assente = Movimento continuo)
  p: ParamDef[];
  f: (s: RenderState, t: number, u: Unit, o: Record<string, any>, env: number) => void;
  /** Trasformazione dell'intero blocco prima di disegnare le unità (per esempio la rotazione delle righe scorrevoli). */
  xf?: (ctx: CanvasRenderingContext2D, o: Record<string, any>, t: number, env: number) => void;
}
