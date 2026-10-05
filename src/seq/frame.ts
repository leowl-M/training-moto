// Inquadratura per formato: quale parte di un video si vede in ogni formato (16:9, 9:16, 1:1, 4:5).
// x, y = punto del video (0–1) che sta al centro del quadro; z = zoom (1 = il video riempie o sta dentro il quadro, come oggi).
// Con "Riempie" il video non lascia mai bordi vuoti: il punto si ferma quando il bordo del video arriva al bordo del quadro.

export interface Frame { x: number; y: number; z: number }
export const FRAME0: Frame = { x: .5, y: .5, z: 1 };

/** Inquadratura di una clip in un formato (quella di partenza se non è stata toccata). */
export function frameFor(c: { frame?: Record<string, Frame> }, fmt: string): Frame {
  return { ...FRAME0, ...(c.frame && c.frame[fmt]) };
}

/** Dove disegnare un video vw×vh nel quadro W×H: scala k e angolo in alto a sinistra (x0, y0); fx, fy = punto davvero al centro (dopo i limiti). */
export function framedRect(vw: number, vh: number, W: number, H: number, fit: 'cover' | 'contain', f: Frame) {
  const z = Math.max(.1, f.z || 1), k = (fit === 'cover' ? Math.max(W / vw, H / vh) : Math.min(W / vw, H / vh)) * z, rw = vw * k, rh = vh * k;
  let x0 = W / 2 - f.x * rw, y0 = H / 2 - f.y * rh;
  // più grande del quadro: niente bordi vuoti; più piccolo (Intero): resta dentro il quadro
  x0 = rw >= W ? Math.min(0, Math.max(W - rw, x0)) : Math.max(0, Math.min(W - rw, x0));
  y0 = rh >= H ? Math.min(0, Math.max(H - rh, y0)) : Math.max(0, Math.min(H - rh, y0));
  return { k, x0, y0, rw, rh, fx: (W / 2 - x0) / rw, fy: (H / 2 - y0) / rh };
}
