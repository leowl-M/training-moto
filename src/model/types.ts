// Modello dati di MOTO v2: Progetto → Scene → Livelli.
// Solo tipi (nessuna logica): descrivono tutto quello che il progetto deve poter contenere.
// Regole di base:
//  - i tempi sono in secondi; le posizioni di un livello sono percentuali del quadro (0–100), così il progetto vale per ogni formato;
//  - ogni valore animabile è un numero fisso oppure un elenco di keyframe;
//  - i file pesanti (video, audio) si collegano per percorso, non si copiano nel progetto.

export type Id = string;
export type Ease = string; // nome di una curva (vedi core/easing)

/* ---------------------------------------------------------------- valori animabili */
export interface Keyframe<T = number> { t: number; v: T; ease?: Ease }
export type Animated<T = number> = T | Keyframe<T>[];

export interface Transform {
  x: Animated;          // % del quadro, 50 = centro
  y: Animated;
  scale: Animated;      // 1 = dimensione naturale
  rotation: Animated;   // gradi
  opacity: Animated;    // 0–1
}

/* ---------------------------------------------------------------- effetti */
export interface EffectRef {
  fx: string;                                   // id di un effetto (src/effects)
  split?: 'char' | 'word' | 'line' | 'all';
  stagger?: number;
  order?: string;
  ease?: Ease | 'fx';
  params?: Record<string, any>;
  invert?: boolean;
}
export type Outro = { mirror: true } | EffectRef;   // specchio dell'entrata oppure effetto proprio

/* ---------------------------------------------------------------- risorse */
export type AssetRef =
  | { type: 'embedded'; dataUrl: string }             // piccoli file dentro il progetto (loghi, icone)
  | { type: 'file'; path: string };                   // file grandi, collegati dalla cartella del progetto
export interface Asset {
  id: Id;
  kind: 'svg' | 'image' | 'video' | 'audio' | 'font';
  name: string;
  ref: AssetRef;
  meta?: Record<string, any>;                         // durata, dimensioni, canali audio, ecc.
}

/* ---------------------------------------------------------------- disegno progressivo (SVG e linee di costruzione) */
export interface DrawSpec {
  mode: 'stroke' | 'outline';                          // 'outline' = traccia il contorno di forme piene
  order: 'file' | 'length' | 'x' | 'y' | 'radial';     // ordine con cui partono i tracciati
  stagger: number;
  strokeColor: string;
  strokeWidth: number;
  constantWidth?: boolean;                             // spessore costante a schermo, indipendente dallo zoom
  fillAfter?: { color: string; fade: number };         // riempimento che compare a fine disegno
  erase?: { at: number; duration: number; order?: DrawSpec['order'] };  // le linee si cancellano dopo
}

/* ---------------------------------------------------------------- livelli */
export interface LayerBase {
  id: Id;
  name: string;
  type: string;
  start: number;                 // secondi dall'inizio della scena
  duration: number;
  parent?: Id;                   // se presente il livello segue il genitore (gruppi, spostamento del marchio)
  hidden?: boolean;
  locked?: boolean;
  transform: Transform;
  intro?: EffectRef;
  outro?: Outro;
  loop?: EffectRef;
  slot?: Id;                     // punto del template a cui il livello appartiene
}

export interface TextStyle {
  font: string; weight: number; italic: boolean; size: number; fit: boolean; fitWidth: number;
  tracking: number; lineHeight: number; align: 'left' | 'center' | 'right'; textCase: 'none' | 'upper' | 'lower';
  color: string; colorB: string; stroke: boolean; strokeWidth: number; colorIn: boolean;
}
export interface TextLayer extends LayerBase {
  type: 'text';
  text: string;
  style: TextStyle;
  place: { anchor: string; margin: number; offX: number; offY: number };   // posizione nel quadro, come in MOTO v1
  motion?: Record<string, any>;                                             // movimento del blocco di MOTO v1 (libero, traiettoria, keyframe)
}
export interface SvgLayer extends LayerBase {
  type: 'svg';
  asset: Id;
  size: number;                                  // larghezza in % del quadro
  draw?: DrawSpec;
  fill?: string;                                 // colore del riempimento (per esempio grigio chiaro)
  zoomTargets?: ZoomTarget[];                    // zone da inquadrare, in coordinate relative al riquadro dell'SVG (0–1)
}
export interface ImageLayer extends LayerBase { type: 'image'; asset: Id; size: number; mode: 'free' | 'cover'; tint?: 'none' | 'A' | 'B'; z: 'above' | 'below' }
export interface VideoLayer extends LayerBase {
  type: 'video'; asset: Id;
  trim: { from: number; to: number };            // porzione del file usata
  speed: Animated;
  fit: 'cover' | 'contain';
  stabilize?: { smoothness: number; crop: number };
  audio?: AudioProps;
}
export interface AudioProps { gain: Animated; fadeIn: number; fadeOut: number; channels: 'stereo' | 'mono-left' | 'mono-right' | 'swap'; duckUnderVoice?: boolean }
export interface AudioLayer extends LayerBase { type: 'audio'; asset: Id; trim: { from: number; to: number }; audio: AudioProps }
export interface ShapeLayer extends LayerBase {    // linee di costruzione: linee, cerchi, archi, griglie
  type: 'shape';
  shape: 'line' | 'circle' | 'arc' | 'rect' | 'grid' | 'path';
  params: Record<string, number | string>;
  draw: DrawSpec;
}
export interface CursorLayer extends LayerBase {   // cursore del mouse per demo di interfacce
  type: 'cursor';
  style: 'arrow' | 'hand' | 'custom';
  path: { t: number; x: number; y: number; ease?: Ease }[];
  clicks: { t: number; kind: 'click' | 'press' | 'release' }[];
}
export interface GroupLayer extends LayerBase { type: 'group' }
export type Layer = TextLayer | SvgLayer | ImageLayer | VideoLayer | AudioLayer | ShapeLayer | CursorLayer | GroupLayer;

/* ---------------------------------------------------------------- camera */
export type CameraTarget =
  | { kind: 'layer'; layer: Id; point?: 'center' | 'penTip' | { x: number; y: number } }   // 'penTip' = punta del tracciato mentre si disegna
  | { kind: 'cursor'; layer: Id };
export interface CameraPose { x: number; y: number; zoom: number; rotation: number }
export interface CameraTrack {
  keys: { t: number; pose: CameraPose; ease?: Ease }[];
  follow?: { target: CameraTarget; smoothing: number; zoomOnClick?: number; from?: number; to?: number };
  shake?: { amount: number; speed: number };
}
export interface ZoomTarget { id: Id; label: string; x: number; y: number; zoom: number }

/* ---------------------------------------------------------------- stati di layout (stile "Smart Animate") */
export interface LayoutState { id: Id; name: string; layers: Record<Id, Partial<Record<keyof Transform, number>>> }
export interface StateTransition { from: Id; to: Id; at: number; duration: number; ease: Ease; stagger?: number }

/* ---------------------------------------------------------------- scena, marker, progetto */
export interface Marker { t: number; label: string; kind: 'beat' | 'cut' | 'note' }
export interface Scene {
  id: Id;
  name: string;
  duration: number | 'auto';
  layers: Layer[];
  camera: CameraTrack;
  markers: Marker[];
  states: LayoutState[];
  stateTransitions: StateTransition[];
  transitionIn?: { kind: string; duration: number; params?: Record<string, any> };
  template?: { id: Id; slotValues: Record<Id, Id | string> };
}
export interface Project {
  v: 3;
  name: string;
  format: '16:9' | '9:16' | '1:1' | '4:5';
  fps: 24 | 25 | 30 | 50 | 60;
  res: 1 | 2;
  background: { color: string; transparent: boolean };
  palette: { color: string; colorB: string };
  seed: number;
  assets: Record<Id, Asset>;
  scenes: Scene[];
}

/* ---------------------------------------------------------------- template di scena */
export interface Slot { id: Id; label: string; accepts: Asset['kind'][] | ['text']; required?: boolean }
export type AutoRule =
  | { kind: 'fit'; layer: Id; mode: 'contain' | 'cover'; margin: number }                                  // adatta il file al quadro
  | { kind: 'sequence'; layer: Id; by: DrawSpec['order'] }                                                // ordine di disegno dei tracciati
  | { kind: 'zoomTargets'; layer: Id; strategy: 'corners' | 'largest' | 'manual'; count: number };        // punti di zoom calcolati dall'SVG
export interface Template { id: Id; name: string; version: number; slots: Slot[]; scene: Scene; rules: AutoRule[] }
