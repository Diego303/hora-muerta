// Cierre del caso (§14.4): resultado y estrellas, frase de cierre, la clave,
// cadena de deducción desplegable, siguiente caso y acciones secundarias.
import { closingText, keyDeductionText, stepExplanation } from '../engine/text';
import type { ClueTextContext } from '../engine/text';
import type { CaseDef, MapDef } from '../engine/types';
import { computeStars } from '../game/scoring';
import type { GameStore } from '../game/store';
import type { SuspectView } from './plan';
import { openReconstruction } from './reconstruct';
import { toast } from './toast';

export interface ClosureOptions {
  onNext: () => void;
  onBackToLanding: () => void;
}

function starsText(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

export function renderClosure(
  root: HTMLElement,
  map: MapDef,
  caseData: CaseDef,
  ctx: ClueTextContext,
  suspects: SuspectView[],
  store: GameStore,
  options: ClosureOptions,
): () => void {
  const state = store.getState();
  const stars = computeStars(state.errors, state.hintsUsed);
  const solved = state.result === 'solved';
  const nextLabel = caseData.mode === 'expediente' ? 'Siguiente noche' : 'Siguiente caso';

  const chain = caseData.solve.steps.map((step, i) => `<li>${stepExplanation(step, i, caseData.solve.steps, caseData, ctx)}</li>`).join('');

  const errorsPhrase = state.errors ? `${state.errors} error${state.errors === 1 ? '' : 'es'}` : 'sin errores';
  const hintsPhrase = state.hintsUsed ? `, ${state.hintsUsed} pista${state.hintsUsed === 1 ? '' : 's'}` : '';
  const shareText = solved ? `Hora Muerta: caso resuelto ${starsText(stars)}, ${errorsPhrase}${hintsPhrase}.` : 'Hora Muerta: caso archivado sin resolver.';
  // #caso=<id> para casos del banco; #gen=<semilla>&n=<nivel>&m=<mapa> para
  // modo infinito (§12.5), reconocible por el prefijo INF- que le pone
  // draftToCaseDef(). El expediente no tiene enlace propio (§12.5 no define
  // uno para series): se oculta el botón en vez de copiar un enlace roto.
  const base = `${location.origin}${import.meta.env.BASE_URL}`;
  const caseLink = caseData.id.startsWith('INF-')
    ? `${base}#gen=${caseData.id.slice('INF-'.length)}&n=${caseData.diff}&m=${caseData.map}`
    : `${base}#caso=${caseData.id}`;
  const showLink = caseData.mode !== 'expediente';

  root.innerHTML = `
    <div class="closure-sheet">
      <h1>${solved ? 'Caso resuelto' : 'Caso archivado sin resolver'}</h1>
      ${solved ? `<p class="stars">${starsText(stars)}</p>` : ''}
      <p class="closing">${closingText(caseData, ctx)}</p>
      <p class="keydeduction">${keyDeductionText(caseData, ctx)}</p>
      <details class="chain">
        <summary>Cadena de deducción</summary>
        <ol>${chain}</ol>
      </details>
      <button class="btn" id="nextCase">${nextLabel}</button>
      <div class="closure-actions">
        <button class="btn ghost" id="reconBtn">Ver la noche en el plano</button>
        <button class="btn ghost" id="shareBtn">Copiar resultado</button>
        ${showLink ? '<button class="btn ghost" id="linkBtn">Copiar enlace a este caso</button>' : ''}
        <button class="btn ghost" id="backBtn">Volver a la portada</button>
      </div>
    </div>
  `;

  let reconCleanup: (() => void) | null = null;

  root.querySelector('#nextCase')?.addEventListener('click', () => {
    reconCleanup?.();
    options.onNext();
  });
  root.querySelector('#backBtn')?.addEventListener('click', () => {
    reconCleanup?.();
    options.onBackToLanding();
  });
  root.querySelector('#reconBtn')?.addEventListener('click', () => {
    reconCleanup?.();
    reconCleanup = openReconstruction(map, caseData, suspects);
  });
  root.querySelector('#shareBtn')?.addEventListener('click', () => {
    navigator.clipboard
      ?.writeText(shareText)
      .then(() => toast('Copiado.'))
      .catch(() => toast('No se pudo copiar.'));
  });
  root.querySelector('#linkBtn')?.addEventListener('click', () => {
    navigator.clipboard
      ?.writeText(caseLink)
      .then(() => toast('Enlace copiado.'))
      .catch(() => toast('No se pudo copiar.'));
  });

  return () => reconCleanup?.();
}
