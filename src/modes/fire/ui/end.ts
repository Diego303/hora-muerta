// Cierres del Modo Incendio (docs/MODOS.md 2.6): "Resuelto entre las llamas" con
// medallas y tiempo sobrante, y la solución que se puede ver tras un derrumbe.
import { buildTextContext } from '../../../engine/generate';
import { closingText } from '../../../engine/text';
import type { ClueTextContext } from '../../../engine/text';
import type { SuspectView } from '../../../ui/plan';
import { openReconstruction } from '../../../ui/reconstruct';
import type { FirePlay } from '../play';
import { FIRE_PHOTOS } from '../config';
import { MEDAL_NAME, type FireMedal } from '../records';
import { clockText } from '../status';

const ALL_MEDALS: FireMedal[] = ['sin-fotos', 'a-tiempo', 'sin-errores'];

export function fireTextContext(play: FirePlay): { ctx: ClueTextContext; suspects: SuspectView[] } {
  const ctx = buildTextContext(play.map, play.fire.caseData.cast, play.fire.caseData.objects);
  const suspects = ctx.suspects.map((s) => ({ name: s.name, init: s.name[0], color: s.color }));
  return { ctx, suspects };
}

/** El veredicto del caso (quién, dónde, con qué y por qué), con el mismo texto que el cierre normal. */
export function verdictText(play: FirePlay): string {
  return closingText(play.fire.caseData, fireTextContext(play).ctx);
}

/** Abre la reconstrucción de la noche. Devuelve cómo cerrarla. */
export function openNight(play: FirePlay): () => void {
  return openReconstruction(play.map, play.fire.caseData, fireTextContext(play).suspects);
}

export interface FireSolvedInfo {
  secondsLeft: number;
  medals: FireMedal[];
  starsGained: number;
  newBest: boolean;
}

export interface FireEndActions {
  onRetry: () => void;
  onLobby: () => void;
}

function medalReason(medal: FireMedal, play: FirePlay, info: FireSolvedInfo): string {
  if (medal === 'sin-fotos') {
    const used = FIRE_PHOTOS - play.photosLeft;
    return used === 0 ? 'No usaste ninguna foto.' : `Usaste ${used} foto${used === 1 ? '' : 's'}.`;
  }
  if (medal === 'a-tiempo') return info.medals.includes('a-tiempo') ? 'Te sobraron más de 2:00.' : 'Hacía falta que sobraran más de 2:00.';
  const wrong = play.wrongAccusations;
  return wrong === 0 ? 'Ninguna acusación errónea.' : `${wrong} acusación${wrong === 1 ? '' : 'es'} errónea${wrong === 1 ? '' : 's'}.`;
}

export function renderFireSolved(root: HTMLElement, play: FirePlay, info: FireSolvedInfo, actions: FireEndActions): () => void {
  const medals = ALL_MEDALS.map((m) => {
    const got = info.medals.includes(m);
    const reason = medalReason(m, play, info);
    return `<li class="medal${got ? ' got' : ''}"><span class="medal-mark" aria-hidden="true">${got ? '✓' : '—'}</span><span><b>${MEDAL_NAME[m]}</b> <span class="medal-state">${got ? 'conseguida' : 'no conseguida'}</span>. ${reason}</span></li>`;
  }).join('');
  const stars = info.starsGained > 0 ? `<p class="fire-stars">+${info.starsGained} estrella${info.starsGained === 1 ? '' : 's'} de rango.</p>` : '';
  root.innerHTML = `
    <div class="wrap fire-end">
      <main class="fire-end-card">
        <p class="fire-end-kicker">${play.fire.fire.title}</p>
        <h1 tabindex="-1">Resuelto entre las llamas</h1>
        <p class="closing">${verdictText(play)}</p>
        <p class="fire-left">Te sobraron <b>${clockText(info.secondsLeft)}</b>.${info.newBest ? ' Es tu mejor marca en este edificio.' : ''}</p>
        <ul class="medals">${medals}</ul>
        ${stars}
        <div class="fire-end-actions">
          <button class="btn" id="fireNight" type="button">Ver la noche</button>
          <button class="btn danger" id="fireRetry" type="button">Mejorar mi tiempo</button>
          <button class="btn ghost" id="fireLobby" type="button">Volver al Modo Incendio</button>
        </div>
      </main>
    </div>`;
  let closeNight: (() => void) | null = null;
  root.querySelector('#fireNight')?.addEventListener('click', () => {
    closeNight?.();
    closeNight = openNight(play);
  });
  root.querySelector('#fireRetry')?.addEventListener('click', () => actions.onRetry());
  root.querySelector('#fireLobby')?.addEventListener('click', () => actions.onLobby());
  root.querySelector<HTMLHeadingElement>('h1')?.focus();
  return () => closeNight?.();
}
