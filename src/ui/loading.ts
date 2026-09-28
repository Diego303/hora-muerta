// Pantalla de espera para el modo infinito (§13): generar un caso puede tardar
// hasta el presupuesto de 8 s del generador, sobre todo en Comisario.
export function renderLoading(root: HTMLElement, message: string): () => void {
  root.innerHTML = `
    <div class="loading">
      <p>${message}</p>
    </div>
  `;
  return () => {
    /* nada que limpiar: la pantalla se sustituye entera al navegar */
  };
}
