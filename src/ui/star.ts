// Stella dei preferiti (stessa grafica delle icone Lucide già usate nell'interfaccia).
const SVG = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

/** Crea il pulsante stella. `on` è lo stato iniziale; `onToggle` riceve il click (senza propagarlo al contenitore). */
export function starButton(on: boolean, onToggle: () => void, label = 'Aggiungi ai preferiti'): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'star' + (on ? ' on' : '');
  b.innerHTML = SVG;
  b.setAttribute('aria-label', label);
  b.setAttribute('aria-pressed', String(on));
  b.title = on ? 'Togli dai preferiti' : 'Aggiungi ai preferiti';
  b.onclick = e => { e.stopPropagation(); e.preventDefault(); onToggle(); };
  b.onkeydown = e => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation(); };
  return b;
}

/** Aggiorna l'aspetto di una stella già creata. */
export function setStar(b: HTMLElement, on: boolean) {
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', String(on));
  b.title = on ? 'Togli dai preferiti' : 'Aggiungi ai preferiti';
}
