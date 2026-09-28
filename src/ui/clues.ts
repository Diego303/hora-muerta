// Lista de pistas (§17.6): agrupada por categoría, con casilla para tachar y
// texto para enfocar (cambia la hora, resalta las salas implicadas).
import { clueCategory } from '../engine/clues';
import { clueText } from '../engine/text';
import type { ClueTextContext } from '../engine/text';
import type { Clue, Hour, Room } from '../engine/types';
import type { GameStore } from '../game/store';

/** Salas y hora implicadas por una pista, para enfocarla en el plano (§17.6). */
export function clueFocusTarget(clue: Clue): { rooms: Room[]; hour: Hour | null } {
  switch (clue.k) {
    case 'at':
    case 'notat':
      return { rooms: [clue.r], hour: clue.t };
    case 'never':
    case 'visited':
      return { rooms: [clue.r], hour: null };
    case 'count':
    case 'cat':
      return { rooms: [clue.r], hour: clue.t };
    case 'feat':
    case 'cfeat':
    case 'moved':
    case 'still':
    case 'together':
    case 'adj':
    case 'cwith':
      return { rooms: [], hour: clue.t };
    case 'stayed':
    case 'apart':
    case 'ncarry':
      return { rooms: [], hour: null };
  }
}

export function renderClueList(container: HTMLElement, clues: Clue[], ctx: ClueTextContext, store: GameStore): void {
  const state = store.getState();
  let currentCategory = '';
  const parts: string[] = [];
  clues.forEach((clue, i) => {
    const category = clueCategory(clue);
    if (category !== currentCategory) {
      currentCategory = category;
      parts.push(`<h3>${category}</h3>`);
    }
    const struck = state.struck.has(i);
    const focused = state.clueFocus === i;
    parts.push(
      `<p class="clue-row${struck ? ' struck' : ''}${focused ? ' focused' : ''}" data-i="${i}">` +
        `<button class="clue-check" data-strike="${i}" aria-label="${struck ? 'Destachar' : 'Tachar'} la pista ${i + 1}" aria-pressed="${struck}"></button>` +
        `<button class="clue-text" data-focus="${i}"><span class="n">${i + 1}</span> ${clueText(clue, ctx)}</button>` +
        `</p>`,
    );
  });
  container.innerHTML = parts.join('');

  container.querySelectorAll<HTMLButtonElement>('[data-strike]').forEach((button) => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      store.toggleStrike(Number(button.dataset.strike));
    });
  });
  container.querySelectorAll<HTMLButtonElement>('[data-focus]').forEach((button) => {
    button.addEventListener('click', () => {
      const i = Number(button.dataset.focus);
      store.focusClue(state.clueFocus === i ? null : i);
      const target = clueFocusTarget(clues[i]);
      if (state.clueFocus !== i && target.hour !== null) store.setHour(target.hour);
    });
  });
}
