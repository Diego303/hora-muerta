// Informe final del calentamiento (docs/MODOS.md 3.9): "N de 13", aciertos por bloque,
// cómo cambia cada técnica ("nivel 1 → 2"), la racha, un consejo para la próxima
// partida y las salidas.
import type { Level } from '../adapt';
import { TECHS } from '../content';
import { TIPS, type SessionSummary } from '../compose';
import type { GymProgress } from '../progress';
import type { Tech } from '../types';

export interface ReportActions {
  /** Ir a jugar un caso: la portada con el plano de casos desplegado. */
  onPlay: () => void;
  onAgain: () => void;
  onAcademy: () => void;
  /** Presente si se llegó desde un caso en curso ("Practicar remates"). */
  onResumeCase?: () => void;
}

function levelText([from, to]: [Level, Level]): string {
  return from === to ? `nivel ${to}` : `nivel ${from} → ${to}`;
}

export function renderGymReport(
  root: HTMLElement,
  summary: SessionSummary,
  levels: Partial<Record<Tech, [Level, Level]>>,
  streak: GymProgress['streak'],
  actions: ReportActions,
): () => void {
  const blocks = summary.blocks.map(([name, ok, n]) => `<li><span>${name}</span><b>${ok} de ${n}</b></li>`).join('');
  const techs = (Object.entries(summary.techs) as [Tech, { ok: number; n: number }][])
    .map(([t, v]) => {
      const lv = levels[t];
      const change = lv && lv[0] !== lv[1] ? ' class="up"' : '';
      return `<li${change}><span>${TECHS[t].name}${lv ? `: ${levelText(lv)}` : ''}</span><b>${v.ok} de ${v.n}</b></li>`;
    })
    .join('');
  const tip = summary.weakest
    ? `<p class="tip"><b>Para tu próxima partida:</b> ${TIPS[summary.weakest]}</p>`
    : '<p class="tip"><b>Todo bien.</b> Estás listo para un caso de verdad.</p>';
  const streakLine = streak.count > 0 ? `<p class="gym-streak">Racha: <b>${streak.count} día${streak.count === 1 ? '' : 's'}</b> seguidos calentando.</p>` : '';
  const main = actions.onResumeCase
    ? '<button class="btn" id="gResume" type="button">Volver a tu caso</button>'
    : '<button class="btn" id="gPlay" type="button">Ir a jugar un caso</button>';
  root.innerHTML = `<div class="wrap gym gym-play">
    <article class="gcard gym-end">
      <p class="gk">Calentamiento completado</p>
      <h1 class="score" tabindex="-1">${summary.ok} de ${summary.total}</h1>
      ${summary.blocks.length > 1 ? `<h2>Por bloque</h2><ul class="g-rows">${blocks}</ul>` : ''}
      <h2>Por técnica</h2>
      <ul class="g-rows">${techs}</ul>
      ${streakLine}
      ${tip}
      <div class="row">
        ${main}
        <button class="btn ghost" id="gAgain" type="button">Repetir el calentamiento</button>
        <button class="btn ghost" id="gMenu" type="button">Volver a la Academia</button>
      </div>
    </article></div>`;
  root.querySelector('#gPlay')?.addEventListener('click', () => actions.onPlay());
  root.querySelector('#gResume')?.addEventListener('click', () => actions.onResumeCase?.());
  root.querySelector('#gAgain')?.addEventListener('click', () => actions.onAgain());
  root.querySelector('#gMenu')?.addEventListener('click', () => actions.onAcademy());
  root.querySelector<HTMLHeadingElement>('.score')?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  return () => undefined;
}
