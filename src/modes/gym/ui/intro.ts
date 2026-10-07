// Entrada de la Academia (#academia, docs/MODOS.md 3.9): presentación, el botón de
// empezar, los tres bloques con la técnica del día y su motivo, y la ficha de detective.
import { TECHS } from '../content';
import type { DayTech } from '../compose';
import { techProgress, type GymProgress } from '../progress';
import type { Tech } from '../types';

export interface IntroActions {
  onStart: () => void;
  onBack: () => void;
}

const FICHA_ORDER: Tech[] = ['alcance', 'seguro', 'tabla', 'remate'];

export function renderGymIntro(root: HTMLElement, progress: GymProgress, today: { tech: DayTech; why: string }, actions: IntroActions): () => void {
  const ficha = FICHA_ORDER.map((t) => {
    const p = techProgress(progress, t);
    const pct = p.n ? Math.round((p.ok / p.n) * 100) : 0;
    return `<li>
      <b>${TECHS[t].name}</b>
      <span>${TECHS[t].desc}</span>
      <div class="gbarra" role="img" aria-label="${p.n ? `${pct} % de aciertos` : 'Sin practicar'}"><i style="width:${pct}%"></i></div>
      <small>${p.n ? `${p.ok} de ${p.n} bien (${pct} %)` : 'Sin practicar'}</small>
    </li>`;
  }).join('');

  root.innerHTML = `<div class="wrap gym">
    <header class="top"><button class="icon-btn" id="gymBack" type="button">← Volver al menú</button></header>
    <section class="gym-hero">
      <div>
        <p class="gym-place">Academia de Policía de Valdeniebla</p>
        <h1>Prácticas en la Academia</h1>
        <p class="lead">Un calentamiento de 5 a 8 minutos antes de jugar. Sin reloj y sin castigo: cada fallo te explica qué no viste.</p>
        <button class="btn" id="gymGo" type="button">Empezar el calentamiento</button>
      </div>
      <ol class="gym-blocks">
        <li><b>Activación</b><span class="dur">1-2 min</span><p>Cinco deducciones rápidas para arrancar.</p></li>
        <li><b>Técnica del día</b><span class="dur">3-4 min</span><p><span class="today">${TECHS[today.tech].name}.</span> ${today.why}</p></li>
        <li><b>Remate</b><span class="dur">1-2 min</span><p>Tres finales de caso: quedan dos y hay que desempatar sin adivinar.</p></li>
      </ol>
    </section>
    <section class="gym-ficha"><h2>Tu ficha de detective</h2><ul>${ficha}</ul></section>
  </div>`;
  root.querySelector('#gymBack')?.addEventListener('click', () => actions.onBack());
  root.querySelector('#gymGo')?.addEventListener('click', () => actions.onStart());
  return () => undefined;
}
