// Engancha el Modo Incendio a un tablero ya montado (docs/MODOS.md 2.2, 2.6 y 2.9):
// el reloj de la cabecera, la capa de fuego, la pausa al ocultar la pestaña, la
// capa "En pausa" y el derrumbe. Todo lo que añade se quita al salir.
import type { PlanHandle } from '../../../ui/plan';
import { FIRE_LAST_MINUTE_S } from '../config';
import type { FireRun } from '../session';
import { clockText, mountFireLayer, type FireLayer } from './layer';

const TICK_MS = 250;

export interface FireAttachActions {
  /** "Volver a entrar": el mismo edificio, todo desde cero (MODOS 2.9). */
  onRestart: () => void;
  /** Volver al menú. */
  onExit: () => void;
  /** El derrumbe se acaba de procesar: desde aquí el tablero queda congelado. */
  onCollapse: () => void;
}

export interface FireAttachment {
  /** Vuelve a pintar reloj y capa ahora (p. ej. tras una penalización) y procesa el derrumbe si toca. */
  refresh(): void;
  stop(): void;
}

export function attachFire(root: HTMLElement, plan: PlanHandle, roomCount: number, run: FireRun, ign: readonly number[], actions: FireAttachActions): FireAttachment {
  const svg = root.querySelector<SVGSVGElement>('#mapSvg');
  const layer: FireLayer | null = svg ? mountFireLayer(svg, plan, roomCount, run, ign) : null;

  const bar = root.querySelector('.gbar');
  const clock = document.createElement('span');
  clock.className = 'fire-clock';
  clock.id = 'fireClock';
  clock.setAttribute('role', 'timer');
  clock.setAttribute('aria-label', 'Tiempo restante');
  bar?.appendChild(clock);

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
  const pauseGo = pause.querySelector<HTMLButtonElement>('#firePauseGo');
  const onPauseGo = (): void => {
    run.resume();
    tick();
  };
  pauseGo?.addEventListener('click', onPauseGo);

  let collapseShown = false;
  let collapse: HTMLDivElement | null = null;
  function showCollapse(): void {
    collapseShown = true;
    run.pause();
    actions.onCollapse();
    document.querySelector('.accuse-overlay')?.remove();
    collapse = document.createElement('div');
    collapse.className = 'fire-collapse';
    collapse.innerHTML = `
      <div class="fire-collapse-card" role="alertdialog" aria-modal="true" aria-labelledby="fireCollapseT">
        <h2 id="fireCollapseT">El edificio se ha derrumbado</h2>
        <p>Se acabó el tiempo. El fuego arde igual si vuelves a entrar.</p>
        <div class="fire-collapse-actions">
          <button class="btn" id="fireRestart" type="button">Volver a entrar</button>
          <button class="btn ghost" id="fireBackMenu" type="button">Volver al menú</button>
        </div>
      </div>`;
    root.appendChild(collapse);
    collapse.querySelector('#fireRestart')?.addEventListener('click', actions.onRestart);
    collapse.querySelector('#fireBackMenu')?.addEventListener('click', actions.onExit);
  }

  function tick(): void {
    const remaining = run.remaining();
    clock.textContent = clockText(remaining);
    clock.classList.toggle('hot', remaining <= FIRE_LAST_MINUTE_S);
    layer?.update();
    if (run.collapsed() && !collapseShown) showCollapse();
    const showPause = run.paused() && !run.collapsed();
    pause.hidden = !showPause;
  }

  const onVisibility = (): void => {
    if (document.hidden) run.pause();
  };
  document.addEventListener('visibilitychange', onVisibility);
  const timer = window.setInterval(tick, TICK_MS);
  tick();

  return {
    refresh: tick,
    stop: () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      pauseGo?.removeEventListener('click', onPauseGo);
      layer?.destroy();
      clock.remove();
      pause.remove();
      collapse?.remove();
    },
  };
}
