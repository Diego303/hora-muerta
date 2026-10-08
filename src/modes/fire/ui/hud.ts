// Interfaz del Modo Incendio encima de un tablero ya montado (docs/MODOS.md 2.6, 2.7
// y 2.9): reloj y barra del edificio en la cabecera, línea de estado bajo las horas,
// capas de fuego, pistas que arden, anuncios para lectores de pantalla, chispas,
// pausa al ocultar la pestaña y derrumbe. Todo sale del tiempo consumido en cada tic;
// lo único que se recuerda es qué se ha anunciado ya. Todo lo que añade se quita al parar.
import type { GameStore } from '../../../game/store';
import type { BoardHandle } from '../../../ui/board';
import type { PlanHandle } from '../../../ui/plan';
import { FIRE_LAST_MINUTE_S, FIRE_TOTAL_S } from '../config';
import type { FirePlay } from '../play';
import { clockText, fireStatusText, roomIgnitedText } from '../status';
import { startEmbers } from '../theme/embers';
import { roomState } from '../timeline';
import { refreshFuses } from './clues';
import { openNight, verdictText } from './end';
import type { FireLayer } from './layer';

const TICK_MS = 250;

export interface FireHudActions {
  /** "Volver a entrar": el mismo edificio, todo desde cero. */
  onRestart: () => void;
  /** Volver a la lista de edificios. */
  onLobby: () => void;
}

export interface FireHud {
  /** Repinta ahora (p. ej. tras una penalización) y procesa el derrumbe si toca. */
  refresh(): void;
  announce(message: string): void;
  stop(): void;
}

export function attachFireHud(
  root: HTMLElement,
  play: FirePlay,
  store: GameStore,
  plan: PlanHandle,
  board: BoardHandle,
  layers: ReadonlySet<FireLayer>,
  actions: FireHudActions,
): FireHud {
  const { run, map, fire } = play;
  const ign = fire.fire.ign;
  const roomCount = map.rooms.length;
  const clueCount = fire.caseData.clues.length;
  const game = root.querySelector<HTMLElement>('.game') ?? root;

  // Reloj y barra del edificio (la barra va dentro de la cabecera para no
  // añadir una celda a la rejilla de la mesa de trabajo en tableta y escritorio).
  const bar = root.querySelector<HTMLElement>('.gbar');
  bar?.classList.add('fire-gbar');
  game.classList.add('fire-game');
  const clock = document.createElement('span');
  clock.className = 'fire-clock';
  clock.id = 'fireClock';
  clock.setAttribute('role', 'timer');
  clock.setAttribute('aria-label', 'Tiempo restante');
  bar?.appendChild(clock);
  const building = document.createElement('div');
  building.className = 'firebar';
  building.setAttribute('aria-hidden', 'true');
  building.innerHTML = '<i></i>';
  bar?.appendChild(building);
  const buildingFill = building.querySelector<HTMLElement>('i');

  // Línea de estado bajo las horas.
  const status = document.createElement('p');
  status.className = 'fire-status';
  status.id = 'fireStatus';
  root.querySelector('#times')?.after(status);

  // Anunciador: solo cambios importantes, nunca la cuenta atrás segundo a segundo.
  const announcer = document.createElement('div');
  announcer.className = 'sr-only';
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  game.appendChild(announcer);
  function announce(message: string): void {
    announcer.textContent = message;
  }

  // Capa "En pausa": el tiempo no vuelve a correr hasta pulsar Seguir.
  const pause = document.createElement('div');
  pause.className = 'fire-pause';
  pause.hidden = true;
  pause.innerHTML = `
    <div class="fire-pause-card" role="dialog" aria-modal="true" aria-labelledby="firePauseT">
      <h2 id="firePauseT">En pausa</h2>
      <p>El tiempo se ha detenido mientras no mirabas el edificio.</p>
      <button class="btn" id="firePauseGo" type="button">Seguir</button>
    </div>`;
  root.appendChild(pause);
  pause.querySelector('#firePauseGo')?.addEventListener('click', () => {
    run.resume();
    tick();
  });

  let collapse: HTMLDivElement | null = null;
  let closeNight: (() => void) | null = null;
  function showCollapse(): void {
    play.collapsed = true;
    run.pause();
    document.querySelector('.accuse-overlay')?.remove();
    collapse = document.createElement('div');
    collapse.className = 'fire-collapse';
    collapse.innerHTML = `
      <div class="fire-collapse-card" role="alertdialog" aria-modal="true" aria-labelledby="fireCollapseT">
        <h2 id="fireCollapseT">El edificio se ha derrumbado</h2>
        <p>Se acabó el tiempo. Si vuelves a entrar, el fuego arde exactamente igual.</p>
        <div class="fire-solution" id="fireSolution" hidden>
          <p class="closing"></p>
          <button class="btn ghost" id="fireNightBtn" type="button">Ver la noche en el plano</button>
        </div>
        <div class="fire-collapse-actions">
          <button class="btn danger" id="fireRestart" type="button">Volver a entrar</button>
          <button class="btn ghost" id="fireShowSolution" type="button">Ver la solución</button>
          <button class="btn ghost" id="fireBackLobby" type="button">Volver</button>
        </div>
      </div>`;
    root.appendChild(collapse);
    const solution = collapse.querySelector<HTMLElement>('#fireSolution');
    const verdict = solution?.querySelector('.closing');
    if (verdict) verdict.innerHTML = verdictText(play);
    collapse.querySelector('#fireShowSolution')?.addEventListener('click', (e) => {
      if (solution) solution.hidden = false;
      (e.currentTarget as HTMLButtonElement).hidden = true;
    });
    collapse.querySelector('#fireNightBtn')?.addEventListener('click', () => {
      closeNight?.();
      closeNight = openNight(play);
    });
    collapse.querySelector('#fireRestart')?.addEventListener('click', actions.onRestart);
    collapse.querySelector('#fireBackLobby')?.addEventListener('click', actions.onLobby);
    collapse.querySelector<HTMLButtonElement>('#fireRestart')?.focus();
    announce('El edificio se ha derrumbado.');
    board.refreshSheet();
  }

  // Lo único que se recuerda entre tics: qué estados se han visto ya, para anunciar
  // y repintar solo cuando algo cambia.
  const roomSeen: string[] = new Array<string>(roomCount).fill('cold');
  const clueSeen: string[] = Array.from({ length: clueCount }, (_, i) => play.clueState(i));
  let lastMinuteSaid = false;

  /** El plano ampliado tapa la cabecera: mientras está abierto lleva su propia copia
   * del reloj (solo visual; el anuncio para lectores de pantalla es el de siempre). */
  function mirrorClock(text: string, hot: boolean): void {
    const overlay = document.querySelector<HTMLElement>('.plan-overlay:not(.recon-overlay)');
    if (!overlay) return;
    let mini = overlay.querySelector<HTMLElement>('.fire-clock');
    if (!mini) {
      mini = document.createElement('span');
      mini.className = 'fire-clock';
      mini.setAttribute('aria-hidden', 'true');
      overlay.appendChild(mini);
    }
    mini.textContent = text;
    mini.classList.toggle('hot', hot);
  }

  function tick(): void {
    const t = run.consumed();
    const left = run.remaining();
    const hot = left <= FIRE_LAST_MINUTE_S && !play.solved;
    clock.textContent = clockText(left);
    clock.classList.toggle('hot', hot);
    mirrorClock(clock.textContent, hot);
    if (buildingFill) buildingFill.style.width = `${((left / FIRE_TOTAL_S) * 100).toFixed(2)}%`;
    status.textContent = fireStatusText(map.rooms, ign, t);
    for (const layer of layers) layer.update(t);

    for (let r = 0; r < roomCount; r++) {
      const state = roomState(ign, r, t);
      if (state === 'burning') {
        if (roomSeen[r] !== 'burning') announce(roomIgnitedText(map.rooms[r]));
        const hit = plan.hits[r];
        const label = hit?.getAttribute('aria-label') ?? '';
        if (hit && !label.endsWith(', en llamas')) hit.setAttribute('aria-label', `${label}, en llamas`);
      }
      roomSeen[r] = state;
    }

    let cluesChanged = false;
    for (let i = 0; i < clueCount; i++) {
      const state = play.clueState(i);
      if (state !== clueSeen[i]) {
        cluesChanged = true;
        if (state === 'burnt') {
          announce(`La pista ${i + 1} se ha quemado.`);
          if (store.getState().clueFocus === i) store.focusClue(null);
        }
        clueSeen[i] = state;
      }
    }
    if (cluesChanged) board.refreshSheet();
    else refreshFuses(root, play);

    if (!lastMinuteSaid && left <= FIRE_LAST_MINUTE_S && left > 0) {
      lastMinuteSaid = true;
      announce('Queda 1 minuto.');
    }
    if (run.collapsed() && !play.collapsed && !play.solved) showCollapse();
    const paused = run.paused() && !play.collapsed && !play.solved;
    // Al aparecer la pausa, el foco va a "Seguir" (con teclado o lector de pantalla).
    if (paused && pause.hidden) {
      pause.hidden = false;
      pause.querySelector<HTMLButtonElement>('#firePauseGo')?.focus();
    }
    pause.hidden = !paused;
  }

  const onVisibility = (): void => {
    if (document.hidden && !play.solved && !play.collapsed) run.pause();
  };
  document.addEventListener('visibilitychange', onVisibility);
  const stopEmbers = startEmbers(() => Math.min(1, run.consumed() / FIRE_TOTAL_S));
  const timer = window.setInterval(tick, TICK_MS);
  tick();

  return {
    refresh: tick,
    announce,
    stop() {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      stopEmbers();
      closeNight?.();
      bar?.classList.remove('fire-gbar');
      game.classList.remove('fire-game');
      clock.remove();
      building.remove();
      status.remove();
      announcer.remove();
      pause.remove();
      collapse?.remove();
    },
  };
}
