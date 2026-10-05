// Comportamento da tastiera condiviso fra i pannelli e le finestre modali.
export function initAccessibility() {
  const app = document.querySelector<HTMLElement>('.app')!;
  let active: HTMLElement | null = null;
  let returnFocus: HTMLElement | null = null;
  const focusables = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(
    'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]'
  )].filter(el => !!el.getClientRects().length && !el.closest('[hidden]'));

  const syncDialog = () => {
    const next = document.querySelector<HTMLElement>('.modal.on .mbox');
    if (next === active) return;
    if (next) {
      if (!active) returnFocus = document.activeElement as HTMLElement;
      active = next;
      app.inert = true;
      next.tabIndex = -1;
      (focusables(next)[0] || next).focus();
    } else {
      active = null;
      app.inert = false;
      if (returnFocus?.isConnected) returnFocus.focus();
      returnFocus = null;
    }
  };
  document.querySelectorAll('.modal').forEach(el => {
    new MutationObserver(syncDialog).observe(el, { attributes: true, attributeFilter: ['class'] });
  });

  document.addEventListener('keydown', e => {
    if (active) {
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopImmediatePropagation();
        const modal = active.closest('.modal');
        if (modal?.id === 'help') modal.classList.remove('on');
        else document.getElementById('mCancel')?.click();
      } else if (e.key === 'Tab') {
        const items = focusables(active), index = items.indexOf(document.activeElement as HTMLElement);
        e.preventDefault(); e.stopImmediatePropagation();
        (items[(index + (e.shiftKey ? -1 : 1) + items.length) % items.length] || active).focus();
      } else if (!/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName)) {
        // I tasti della finestra non devono azionare la riproduzione sullo sfondo.
        e.stopPropagation();
      }
      return;
    }
    const target = e.target as HTMLElement;
    const tabs = target.closest('[role="tablist"]');
    if (!tabs || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const buttons = [...tabs.querySelectorAll<HTMLButtonElement>('button')];
    const index = buttons.indexOf(target as HTMLButtonElement);
    if (index < 0) return;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 :
      (index + (e.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length;
    e.preventDefault(); e.stopImmediatePropagation();
    buttons[next]?.click(); buttons[next]?.focus();
  }, true);

  const exportButton = document.getElementById('bExport')!;
  const exportMenu = document.getElementById('expMenu')!;
  exportButton.setAttribute('aria-haspopup', 'true');
  exportButton.setAttribute('aria-controls', 'expMenu');
  const syncMenu = () => exportButton.setAttribute('aria-expanded', String(exportMenu.classList.contains('on')));
  new MutationObserver(syncMenu).observe(exportMenu, { attributes: true, attributeFilter: ['class'] });
  syncMenu(); syncDialog();
}
