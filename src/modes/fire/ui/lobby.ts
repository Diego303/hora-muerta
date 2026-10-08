// Sala del incendio (#incendio, docs/MODOS.md 2.6): título, presentación, las cinco
// reglas, filtro por nivel y, por nivel, el siguiente edificio sin resolver (servicio
// sin repetir) más los ya resueltos para mejorar la marca. Cada tarjeta lleva el
// miniplano de calor, nivel, título, presentación, datos del caso y tu mejor marca.
import { MAPS } from '../../../engine/content/maps';
import { buildGraph } from '../../../engine/graph';
import { planLiteMarkup, planLiteRoomCenter, planLiteSize } from '../../../ui/planlite';
import { recordOf, type FireRecords } from '../records';
import { clockText } from '../status';
import { doorDistances, previewHeat } from '../timeline';
import type { FireOffer } from '../serve';
import type { FireCase, FireData } from '../types';

export interface FireLobbyActions {
  onEnter: (fire: FireCase) => void;
  onBack: () => void;
}

type LevelFilter = 'all' | FireData['level'];

const ICO = {
  clock:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9v4l3 2M9 2h6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  door: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V4h8v17M13 21V4h8v17" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 16c1.5-1.2 1-3 0-4 2 0 3 1.6 2.4 3.6" fill="currentColor"/></svg>',
  pen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4-1 11-11-3-3L5 16z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2"/></svg>',
  cam: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.4" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
};

const RULES = `
  <ul class="fire-rules">
    <li>${ICO.clock}<span><b>Cinco minutos.</b> Al llegar a cero, el edificio se derrumba. Al entrar tienes 45 segundos de humo para leer.</span></li>
    <li>${ICO.door}<span><b>El fuego sigue las puertas.</b> Prende en una sala y cruza una puerta cada 45 segundos. Las salas a punto de arder se tiñen de naranja.</span></li>
    <li>${ICO.pen}<span><b>Las salas en llamas no se anotan.</b> Tus marcas y tus trazos sobreviven, así que anota pronto.</span></li>
    <li>${ICO.cam}<span><b>Las pistas arden</b> 45 segundos después que la sala que nombran. Las que no nombran sala arden cuando queda 1:00. Tienes 2 fotos para salvar las que quieras.</span></li>
    <li>${ICO.shield}<span><b>La escena del crimen aguanta</b> hasta que queda 1:00. Cada acusación que no encaja te cuesta 30 segundos.</span></li>
  </ul>`;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Miniplano del edificio con el calor por distancia al foco y una llama en el foco. */
export function heatPreview(fire: FireCase): string {
  const map = MAPS.find((m) => m.id === fire.caseData.map);
  if (!map) return '';
  const heat = previewHeat(doorDistances(buildGraph(map).adj, fire.fire.origin));
  const { width, height } = planLiteSize(map);
  const c = planLiteRoomCenter(map, fire.fire.origin);
  const flame = `<g class="fl-preview-flame" transform="translate(${c.x},${c.y + 14}) scale(1.4)"><path d="M0,0C-9,-5 -9,-15 -2,-27C-1,-19 4,-17 3,-24C9,-15 10,-5 0,0Z"/></g>`;
  return `<svg class="planlite fire-preview" viewBox="0 0 ${width} ${height}" aria-hidden="true">${planLiteMarkup(map, { heat })}${flame}</svg>`;
}

function card(fire: FireCase, records: FireRecords): string {
  const map = MAPS.find((m) => m.id === fire.caseData.map);
  const origin = map?.rooms[fire.fire.origin]?.name ?? '';
  const record = recordOf(records, fire.caseData.id);
  const best = record.bestLeft !== null ? `Tu mejor marca: te sobraron <b>${clockText(record.bestLeft)}</b>.` : 'Todavía sin resolver.';
  return `
    <article class="fcard">
      ${heatPreview(fire)}
      <div class="fcard-body">
        <span class="lv">${esc(fire.fire.level)}</span>
        <h4>${esc(fire.fire.title)}</h4>
        <p>${esc(fire.fire.intro)}</p>
        <p class="meta">Foco: ${esc(origin)}. ${fire.caseData.N} sospechosos, ${fire.caseData.T} horas, ${fire.caseData.clues.length} pistas.</p>
        <p class="best">${best}</p>
        <button class="btn danger" type="button" data-case-id="${esc(fire.caseData.id)}">Entrar en el edificio</button>
      </div>
    </article>`;
}

function levelSection(offer: FireOffer, records: FireRecords, index: number): string {
  const solvedCount = offer.solved.length;
  const next = offer.next
    ? card(offer.next, records)
    : `<p class="fire-done">Has resuelto los ${offer.total} edificios de este nivel. Puedes volver a entrar en cualquiera para mejorar tu marca.</p>`;
  const solved =
    solvedCount > 0
      ? `<details class="fire-solved"><summary>Edificios resueltos (${solvedCount})</summary><div class="fire-cases">${offer.solved.map((c) => card(c, records)).join('')}</div></details>`
      : '';
  return `
    <section class="fire-level" data-level="${esc(offer.level)}" aria-labelledby="fireLevel${index}">
      <h3 class="fire-level-h" id="fireLevel${index}">${esc(offer.level)} <span>Resueltos: ${solvedCount} de ${offer.total}</span></h3>
      ${next}
      ${solved}
    </section>`;
}

export function renderFireLobby(root: HTMLElement, offers: FireOffer[], records: FireRecords, actions: FireLobbyActions): () => void {
  const filters: { id: LevelFilter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'Novato', label: 'Novato' },
    { id: 'Inspector exprés', label: 'Inspector exprés' },
  ];
  const byId = new Map<string, FireCase>();
  for (const offer of offers) for (const c of [offer.next, ...offer.solved]) if (c) byId.set(c.caseData.id, c);

  root.innerHTML = `
    <div class="wrap fire-lobby">
      <header class="top">
        <button class="icon-btn" id="fireBack" type="button">← Volver al menú</button>
      </header>
      <section class="fire-hero">
        <div>
          <h1 class="fire-title">Modo Incendio</h1>
          <p class="lead">Mismas reglas, mismos planos. Pero el edificio arde sala a sala y tienes cinco minutos para acusar antes de que se derrumbe.</p>
        </div>
        ${RULES}
      </section>
      <h2 class="fire-h2">Elige el edificio</h2>
      <div class="pick fire-filter" role="group" aria-label="Nivel">
        ${filters.map((f) => `<button class="chip" type="button" data-filter="${esc(f.id)}" aria-pressed="${f.id === 'all'}">${f.label}</button>`).join('')}
      </div>
      <div class="fire-offers">${offers.map((o, i) => levelSection(o, records, i)).join('')}</div>
    </div>`;

  root.querySelector('#fireBack')?.addEventListener('click', () => actions.onBack());
  root.querySelectorAll<HTMLButtonElement>('[data-case-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const fire = byId.get(button.dataset.caseId ?? '');
      if (fire) actions.onEnter(fire);
    });
  });
  const chips = Array.from(root.querySelectorAll<HTMLButtonElement>('.fire-filter [data-filter]'));
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const level = chip.dataset.filter ?? 'all';
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      root.querySelectorAll<HTMLElement>('.fire-level').forEach((section) => {
        section.hidden = level !== 'all' && section.dataset.level !== level;
      });
    });
  });
  return () => undefined;
}
