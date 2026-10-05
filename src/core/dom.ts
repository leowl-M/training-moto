// Utilità DOM (copiate dall'originale)
export const $ = (s: string, r: ParentNode = document) => r.querySelector(s) as any;
let toastTimer: any;
export function toast(m: string) {
  const t = $('#toast');
  t.textContent = m;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
