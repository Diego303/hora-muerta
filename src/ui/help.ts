// Ayuda (§17.2, pantalla 6): reglas y glosario. La portada conserva su propia
// sección "Tres reglas, nada más" (ilustrada, como en v1); esto es la
// referencia completa, con los términos que aparecen en el juego.
export interface HelpOptions {
  onBack: () => void;
}

const GLOSSARY: [string, string][] = [
  ['Deducción clave', 'El paso de la cadena que resuelve el caso con el nivel más alto: el que de verdad hacía falta para señalar al culpable o el arma.'],
  ['Cadena crítica', 'Los pasos de razonamiento realmente necesarios para llegar a la solución, sin atajos ni rodeos.'],
  ['Arquetipo', 'El patrón de razonamiento de la deducción clave (la coartada imposible, el paso obligado…). Cada caso se etiqueta con el suyo.'],
  ['Estela', 'En el plano, las marcas ✓ de la hora anterior y siguiente, más tenues, para ver de un vistazo por dónde se movió cada cual.'],
  ['Ayuda de movimiento', 'Con alguien seleccionado, raya las salas a las que no pudo llegar según sus propias marcas (no según la solución).'],
  ['Pista del inspector', 'Un empujón hacia el siguiente paso que puedes deducir ya, sin dar la respuesta. Cuesta una estrella la primera vez que la pides.'],
  ['Caso del día', 'El mismo caso para todo el mundo, cada día; no cuenta para "sin repetir" de los casos sueltos.'],
  ['Expediente', 'Tres noches seguidas con el mismo reparto y un presupuesto de errores compartido entre las tres.'],
  ['Modo infinito', 'Casos generados al momento en tu propio navegador, sin límite, cuando se te acaban los del banco.'],
  ['Rango', 'Sube con las estrellas acumuladas resolviendo casos; desbloquea nuevos escenarios.'],
];

export function renderHelp(root: HTMLElement, options: HelpOptions): () => void {
  const rules = `
    <ol class="help-rules">
      <li><b>Una puerta por hora.</b> Entre una hora y la siguiente, cada persona se queda donde está o cruza una sola puerta.</li>
      <li><b>A solas con la víctima.</b> El culpable fue la única persona que estuvo con la víctima a la hora de la muerte.</li>
      <li><b>Un objeto cada uno.</b> Cada sospechoso llevaba un objeto distinto toda la noche. El arma es el objeto del culpable.</li>
    </ol>
  `;

  const glossary = GLOSSARY.map(([term, def]) => `<dt>${term}</dt><dd>${def}</dd>`).join('');

  root.innerHTML = `
    <div class="gbar">
      <button class="icon-btn" id="back" aria-label="Volver a la portada">←</button>
      <div class="ttl"><b>Ayuda</b></div>
    </div>
    <div class="wrap help-view">
      <section class="sec">
        <h2>Tres reglas, nada más</h2>
        <p class="intro">Todo lo demás son pistas. Cada pista es verdad y, juntas, solo admiten una respuesta.</p>
        ${rules}
      </section>
      <section class="sec">
        <h2>Glosario</h2>
        <dl class="help-glossary">${glossary}</dl>
      </section>
    </div>
  `;

  root.querySelector('#back')?.addEventListener('click', () => options.onBack());

  return () => {
    /* nada que limpiar: la pantalla se sustituye entera al navegar */
  };
}
