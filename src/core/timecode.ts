// Tempo scritto a mano (campo del tempo sopra la timeline): come in Premiere, senza dover essere precisi sul formato.

/** Legge un tempo scritto dall'utente e restituisce i secondi (null se non si capisce).
 *  "0:04:20" = minuti:secondi:fotogrammi · "4:20" = secondi:fotogrammi · "420" = 4 s e 20 fotogrammi (cifre lette da destra, come in Premiere)
 *  "4.5" o "4,5" o "4.5s" = secondi · "1:02:03:04" = ore:minuti:secondi:fotogrammi. Un "+" o "−" davanti sposta rispetto a "from". */
export function parseTC(input: string, fps: number, from = 0): number | null {
  let s = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  let rel = 0;
  if (s[0] === '+' || s[0] === '-' || s[0] === '−') { rel = s[0] === '+' ? 1 : -1; s = s.slice(1); }
  let v: number | null = null;
  if (/^\d+([.,]\d+)?s$/.test(s) || /^\d*[.,]\d+$/.test(s)) v = parseFloat(s.replace(',', '.'));
  else if (/^\d+(:\d+){1,3}$/.test(s)) {
    const p = s.split(':').map(Number);
    const f = p.pop()!, sec = p.pop() || 0, min = p.pop() || 0, h = p.pop() || 0;
    v = h * 3600 + min * 60 + sec + f / fps;
  } else if (/^\d+$/.test(s)) {
    const d = s.padStart(8, '0'), h = +d.slice(0, -6), m = +d.slice(-6, -4), sec = +d.slice(-4, -2), f = +d.slice(-2);
    v = h * 3600 + m * 60 + sec + f / fps;
  }
  if (v == null || !isFinite(v)) return null;
  return Math.max(0, rel ? from + rel * v : v);
}
