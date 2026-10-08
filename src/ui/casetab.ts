// Pestaña Caso (§17.8): informe completo, reparto con rol y botón Descartar
// (tacha el nombre, atenúa el chip, cuenta para las ayudas), reglas en corto.
import { VICTIMS } from '../engine/content/cast';
import { timeLabel } from '../engine/text';
import type { ClueTextContext } from '../engine/text';
import type { CaseDef, MapDef } from '../engine/types';
import type { GameStore } from '../game/store';
import { inkOn } from './ink';

export function renderCaseTab(container: HTMLElement, map: MapDef, caseData: CaseDef, ctx: ClueTextContext, store: GameStore): void {
  const state = store.getState();
  const victimName = VICTIMS[caseData.victim];
  const room = map.rooms[caseData.rv];

  const rows = ctx.suspects
    .map((s, i) => {
      const discarded = state.discarded.has(i);
      return (
        `<li class="${discarded ? 'discarded' : ''}">` +
        `<button class="discard-btn" data-c="${i}" aria-pressed="${discarded}">` +
        `<span class="chip" style="background:${s.color};color:${inkOn(s.color)}">${s.name[0]}</span>` +
        `<span class="name">${s.name}</span><span class="role">${s.role}</span>` +
        `</button></li>`
      );
    })
    .join('');

  container.innerHTML = `
    <p class="intro">${map.intro}</p>
    <p class="fact"><b>${victimName}</b> apareció sin vida en ${room.art} ${room.name}. Hora de la muerte: <b>${timeLabel(caseData.td)}</b>.</p>
    <ul class="cast">${rows}</ul>
    <p class="rules">Reglas: una puerta por hora. El culpable estaba a solas con la víctima a la hora de la muerte. Cada sospechoso llevaba un objeto distinto; el arma es el del culpable.</p>
  `;

  container.querySelectorAll<HTMLButtonElement>('.discard-btn').forEach((button) => {
    button.addEventListener('click', () => store.discardSuspect(Number(button.dataset.c)));
  });
}
