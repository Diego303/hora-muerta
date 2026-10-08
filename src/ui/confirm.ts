// Diálogo de confirmación accesible: foco en la acción segura, Escape cancela y el
// foco vuelve a donde estaba. Devuelve cómo cerrarlo sin elegir (al salir de la vista).
export interface ConfirmOptions {
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function openConfirm(options: ConfirmOptions): () => void {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="confirmT" aria-describedby="confirmD">
      <h2 id="confirmT"></h2>
      <p id="confirmD"></p>
      <div class="confirm-actions">
        <button class="btn ghost" type="button" data-act="cancel"></button>
        <button class="btn danger" type="button" data-act="confirm"></button>
      </div>
    </div>`;
  const set = (sel: string, text: string): void => {
    const node = overlay.querySelector(sel);
    if (node) node.textContent = text;
  };
  set('#confirmT', options.title);
  set('#confirmD', options.text);
  set('[data-act="cancel"]', options.cancelLabel);
  set('[data-act="confirm"]', options.confirmLabel);
  document.body.appendChild(overlay);

  let open = true;
  function close(): void {
    if (!open) return;
    open = false;
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    previous?.focus();
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    close();
    options.onCancel?.();
  }
  document.addEventListener('keydown', onKey);
  overlay.querySelector('[data-act="cancel"]')?.addEventListener('click', () => {
    close();
    options.onCancel?.();
  });
  overlay.querySelector('[data-act="confirm"]')?.addEventListener('click', () => {
    close();
    options.onConfirm();
  });
  overlay.querySelector<HTMLButtonElement>('[data-act="cancel"]')?.focus();
  return close;
}
