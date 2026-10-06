// Pantalla provisional para las vistas que todavía no tienen contenido (Incendio
// y Academia hasta sus fases). Solo texto y un botón para volver al menú; no
// arranca temporizadores.
export interface PendingOptions {
  title: string;
  text: string;
  onBack: () => void;
}

export function renderPendingView(root: HTMLElement, options: PendingOptions): () => void {
  root.innerHTML = `
    <div class="wrap pending">
      <header class="top">
        <button class="icon-btn" id="pendingBack" type="button">← Volver al menú</button>
      </header>
      <main class="pending-body">
        <h1>${options.title}</h1>
        <p>${options.text}</p>
      </main>
    </div>
  `;
  const back = root.querySelector<HTMLButtonElement>('#pendingBack');
  const onClick = (): void => options.onBack();
  back?.addEventListener('click', onClick);
  return () => back?.removeEventListener('click', onClick);
}
