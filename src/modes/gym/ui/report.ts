// Informe final del calentamiento (docs/MODOS.md 3.9): "N de 13", aciertos por bloque
// y por técnica, un consejo para la próxima partida y tres salidas.
import { TECHS } from '../content';
import { TIPS, type SessionSummary } from '../compose';
import type { Tech } from '../types';

export interface ReportActions {
  /** Ir a jugar un caso: la portada con el plano de casos desplegado. */
  onPlay: () => void;
  onAgain: () => void;
  onAcademy: () => void;
}

export function renderGymReport(root: HTMLElement, summary: SessionSummary, actions: ReportActions): () => void {
  const blocks = summary.blocks.map(([name, ok, n]) => `<li><span>${name}</span><b>${ok} de ${n}</b></li>`).join('');
  const techs = (Object.entries(summary.techs) as [Tech, { ok: number; n: number }][])
    .map(([t, v]) => `<li><span>${TECHS[t].name}</span><b>${v.ok} de ${v.n}</b></li>`)
    .join('');
  const tip = summary.weakest
    ? `<p class="tip"><b>Para tu próxima partida:</b> ${TIPS[summary.weakest]}</p>`
    : '<p class="tip"><b>Todo bien.</b> Estás listo para un caso de verdad.</p>';
  root.innerHTML = `<div class="wrap gym gym-play">
    <article class="gcard gym-end">
      <p class="gk">Calentamiento completado</p>
      <h1 class="score" tabindex="-1">${summary.ok} de ${summary.total}</h1>
      <h2>Por bloque</h2>
      <ul class="g-rows">${blocks}</ul>
      <h2>Por técnica</h2>
      <ul class="g-rows">${techs}</ul>
      ${tip}
      <div class="row">
        <button class="btn" id="gPlay" type="button">Ir a jugar un caso</button>
        <button class="btn ghost" id="gAgain" type="button">Repetir el calentamiento</button>
        <button class="btn ghost" id="gMenu" type="button">Volver a la Academia</button>
      </div>
    </article></div>`;
  root.querySelector('#gPlay')?.addEventListener('click', () => actions.onPlay());
  root.querySelector('#gAgain')?.addEventListener('click', () => actions.onAgain());
  root.querySelector('#gMenu')?.addEventListener('click', () => actions.onAcademy());
  root.querySelector<HTMLHeadingElement>('.score')?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  return () => undefined;
}
