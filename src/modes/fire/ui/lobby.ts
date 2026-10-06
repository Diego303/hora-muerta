// Lista de edificios del Modo Incendio. Provisional en F1: dos tarjetas con su
// botón de entrar. La sala del incendio completa (miniplano de calor, mejor marca,
// filtro por nivel) llega en F2.
import { MAPS } from '../../../engine/content/maps';
import type { FireCase } from '../types';

export interface FireLobbyActions {
  onEnter: (fire: FireCase) => void;
  onBack: () => void;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function card(fire: FireCase, index: number): string {
  const map = MAPS.find((m) => m.id === fire.caseData.map);
  const origin = map?.rooms[fire.fire.origin]?.name ?? '';
  const clues = fire.caseData.clues.length;
  return `
    <article class="fcard">
      <span class="lv">${esc(fire.fire.level)}</span>
      <h2>${esc(fire.fire.title)}</h2>
      <p>${esc(fire.fire.intro)}</p>
      <p class="meta">Foco: ${esc(origin)}. ${fire.caseData.N} sospechosos, ${fire.caseData.T} horas, ${clues} pistas.</p>
      <button class="btn danger" type="button" data-fire="${index}">Entrar en el edificio</button>
    </article>`;
}

export function renderFireLobby(root: HTMLElement, cases: FireCase[], actions: FireLobbyActions): () => void {
  root.innerHTML = `
    <div class="wrap fire-lobby">
      <header class="top">
        <button class="icon-btn" id="fireBack" type="button">← Volver al menú</button>
      </header>
      <section class="fire-hero">
        <h1 class="fire-title">Modo Incendio</h1>
        <p class="lead">Mismas reglas y los mismos planos, pero el edificio arde sala a sala y tienes cinco minutos para acusar antes de que se derrumbe.</p>
      </section>
      <div class="fire-cases">${cases.map(card).join('')}</div>
    </div>`;
  root.querySelector('#fireBack')?.addEventListener('click', () => actions.onBack());
  root.querySelectorAll<HTMLButtonElement>('[data-fire]').forEach((button) => {
    button.addEventListener('click', () => {
      const fire = cases[Number(button.dataset.fire)];
      if (fire) actions.onEnter(fire);
    });
  });
  return () => undefined;
}
