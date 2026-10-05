// Stile dei sottotitoli: come compaiono (frase intera, parola evidenziata, parole che si aggiungono, una parola alla volta),
// carattere, colori, contorno, ombra, riquadro, posizione per formato, animazione di comparsa. Stili pronti e salvabili.

export type SubMode = 'frase' | 'karaoke' | 'accumula' | 'parola';
export type SubAnim = 'nessuna' | 'dissolvenza' | 'pop' | 'sale' | 'scala';
export interface SubStyle {
  mode: SubMode; lines: number; maxChars: number;
  font: string; wght: number; upper: boolean; size: number;        // size: % del lato corto del quadro
  color: string; hl: string; hlMode: 'colore' | 'box' | 'nessuna'; hlText: string; hlScale: number;
  stroke: number; strokeCol: string; shadow: number;                // contorno: frazione della dimensione del testo · ombra 0–1
  box: 'no' | 'riga' | 'frase'; boxCol: string; boxOp: number;
  y: Record<string, number>; width: number;                         // altezza del centro (% del quadro) per formato · larghezza massima (%)
  anim: SubAnim; animDur: number;
}

export const SUB_DEF: SubStyle = {
  mode: 'karaoke', lines: 2, maxChars: 22,
  font: 'Inter Tight', wght: 800, upper: false, size: 5.6,
  color: '#ffffff', hl: '#ffd400', hlMode: 'colore', hlText: '#111111', hlScale: 1,
  stroke: .1, strokeCol: '#000000', shadow: .6,
  box: 'no', boxCol: '#000000', boxOp: .65,
  y: { '9:16': 70, '4:5': 78, '1:1': 80, '16:9': 84 }, width: 84,
  anim: 'pop', animDur: .16,
};

/** Stili pronti. */
export const SUB_PRESETS: { id: string; n: string; s: Partial<SubStyle> }[] = [
  { id: 'reel', n: 'Reel (parola evidenziata)', s: {} },
  { id: 'pulito', n: 'Pulito', s: { mode: 'frase', wght: 600, size: 4.8, maxChars: 30, stroke: 0, shadow: .9, anim: 'dissolvenza', hlMode: 'nessuna' } },
  { id: 'parola', n: 'Una parola alla volta', s: { mode: 'parola', font: 'Anton', wght: 400, upper: true, size: 9, stroke: .08, shadow: .7, anim: 'pop', animDur: .12, hlMode: 'nessuna' } },
  { id: 'accumula', n: 'Parole che si aggiungono', s: { mode: 'accumula', upper: true, size: 6, maxChars: 16, anim: 'sale', hl: '#7c5cff', hlMode: 'box', hlText: '#ffffff', stroke: 0, shadow: .5 } },
  { id: 'riquadro', n: 'Riquadro scuro', s: { mode: 'frase', wght: 600, size: 4.4, maxChars: 32, stroke: 0, shadow: 0, box: 'riga', boxOp: .7, anim: 'dissolvenza', hlMode: 'nessuna' } },
];

export const styleOf = (p: Partial<SubStyle> | undefined): SubStyle => ({ ...SUB_DEF, ...(p || {}), y: { ...SUB_DEF.y, ...((p && p.y) || {}) } });
/** Altezza del centro dei sottotitoli nel formato dato (% del quadro). */
export const yFor = (s: SubStyle, fmt: string) => s.y[fmt] ?? (fmt.split(':').map(Number).reduce((a, b) => a / b) < 1 ? 72 : 84);
