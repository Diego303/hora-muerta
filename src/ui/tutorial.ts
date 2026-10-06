// Tutorial guiado ("coach"): un panel flotante que va marcando pasos sobre la
// mesa de trabajo real, resaltando lo que toca tocar y comprobando en vivo
// (contra el store de verdad, no una copia) si ya se ha hecho. Adaptado del
// prototipo de referencia: mismo patrón (pasos "info"/"do", check()/task()
// recalculados en cada cambio, resaltado + guía sobre el plano), con los
// selectores y el estado de MI tablero.
import type { GameState, GameStore } from '../game/store';
import { markKey, objGridKey } from '../game/store';
import { markTutorialDone } from '../game/storage';
import type { TutorialStep, TutorialStepState } from '../game/tutorial';
import { TUTORIAL_STEPS } from '../game/tutorial';
import type { PlanHandle } from './plan';

export interface TutorialOptions {
  onExit: () => void;
}

function toStepState(state: GameState): TutorialStepState {
  return {
    mode: state.mode,
    hour: state.hour,
    selectedSuspect: state.selectedSuspect,
    markAt: (hour, room, suspect) => (state.marks.get(markKey(hour, room, suspect)) ?? 0) as 0 | 1 | 2,
    gridAt: (obj, suspect) => (state.objGrid.get(objGridKey(obj, suspect)) ?? 0) as 0 | 1 | 2,
    struckHas: (i) => state.struck.has(i),
    strokeCount: state.strokes.length,
    longestStroke: state.strokes.reduce((max, s) => Math.max(max, s.points.length), 0),
    filter: state.filter,
    result: state.result,
  };
}

const AUTO_ADVANCE_MS = 1300;

export function startTutorialCoach(root: HTMLElement, store: GameStore, plan: PlanHandle, options: TutorialOptions): () => void {
  const coach = document.createElement('div');
  coach.className = 'coach';
  coach.setAttribute('role', 'region');
  coach.setAttribute('aria-label', 'Tutorial');
  document.body.appendChild(coach);
  document.body.classList.add('tut-on');

  let i = 0;
  let max = 0;
  let doneAt: number | null = null;
  let min = false;
  let lastTargetKey: string | null = null;
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;

  function currentStep(): TutorialStep {
    return TUTORIAL_STEPS[i];
  }

  function goTo(next: number): void {
    i = Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, next));
    max = Math.max(max, i);
    doneAt = null;
    lastTargetKey = null;
    renderStep();
  }

  function renderStep(): void {
    const step = currentStep();
    const n = TUTORIAL_STEPS.length;
    const isFirst = i === 0;
    const isLast = step.id === 'final';
    if (isLast) markTutorialDone();
    coach.innerHTML = `
      <div class="co-bar"><i style="width:${(((i + 1) / n) * 100).toFixed(1)}%"></i></div>
      <div class="co-head">
        <span>Paso ${i + 1} de ${n}</span>
        <span class="co-act">
          <button class="link" id="coMin" type="button">${min ? 'Mostrar' : 'Ocultar'}</button>
          <button class="link" id="coExit" type="button">Salir</button>
        </span>
      </div>
      <div class="co-main">
        <h3 class="co-title">${step.title}</h3>
        <div class="co-body">${step.body}</div>
        ${step.tip ? `<p class="co-tip"><b>Consejo.</b> ${step.tip}</p>` : ''}
        ${step.kind === 'do' ? '<p class="co-task" id="coTask" aria-live="polite"><b id="coTaskB">Tu turno.</b> <span id="coTaskTx"></span></p>' : ''}
        <div class="co-foot">
          ${!isFirst && !isLast ? '<button class="btn ghost" id="coBack" type="button">Atrás</button>' : ''}
          ${isLast ? '<button class="btn ghost" id="coStay" type="button">Quedarme aquí</button><button class="btn" id="coDone" type="button">Terminar el tutorial</button>' : `<button class="btn" id="coNext" type="button"${step.kind === 'do' ? ' hidden' : ''}>${step.nextLabel || 'Siguiente'}</button>`}
        </div>
      </div>
    `;
    coach.classList.toggle('min', min);
    coach.scrollTop = 0;
    coach.querySelector<HTMLButtonElement>('#coMin')?.addEventListener('click', () => {
      min = !min;
      coach.classList.toggle('min', min);
      const b = coach.querySelector('#coMin');
      if (b) b.textContent = min ? 'Mostrar' : 'Ocultar';
      lastTargetKey = null;
    });
    coach.querySelector<HTMLButtonElement>('#coExit')?.addEventListener('click', () => options.onExit());
    coach.querySelector<HTMLButtonElement>('#coStay')?.addEventListener('click', () => cleanup());
    coach.querySelector<HTMLButtonElement>('#coDone')?.addEventListener('click', () => options.onExit());
    coach.querySelector<HTMLButtonElement>('#coBack')?.addEventListener('click', () => goTo(i - 1));
    coach.querySelector<HTMLButtonElement>('#coNext')?.addEventListener('click', () => goTo(i + 1));
    tick();
  }

  function placeCoach(): void {
    const desktop = window.innerWidth >= 1100;
    const sheetPanel = root.querySelector('.sheet-panel');
    if (desktop && sheetPanel) {
      if (coach.parentNode !== sheetPanel) sheetPanel.prepend(coach);
      coach.classList.add('dock');
    } else {
      if (coach.parentNode !== document.body) document.body.appendChild(coach);
      coach.classList.remove('dock');
    }
  }

  function applyTargets(sels: string[], rooms: number[], overlay: TutorialStep['overlay']): void {
    root.querySelectorAll('.tut-target').forEach((n) => {
      if (!sels.some((s) => s !== '.plan' && n.matches(s))) n.classList.remove('tut-target');
    });
    for (const s of sels) {
      if (s === '.plan') continue;
      root.querySelectorAll(s).forEach((n) => n.classList.add('tut-target'));
    }

    const svg = root.querySelector<SVGSVGElement>('#mapSvg');
    if (!svg) return;
    const key = rooms.join(',') + '|' + (overlay ?? '');
    let ov = svg.querySelector<SVGGElement>('#tutOv');
    if (!ov || ov.dataset.k !== key) {
      ov?.remove();
      ov = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;
      ov.setAttribute('id', 'tutOv');
      ov.dataset.k = key;
      ov.setAttribute('pointer-events', 'none');
      let html = '';
      const center = (r: number): [number, number] => {
        const rect = plan.roomRect(r);
        return [rect.x + rect.w / 2, rect.y + rect.h / 2 + 12];
      };
      for (const r of rooms) {
        const rect = plan.roomRect(r);
        html += `<rect class="tut-hl" x="${rect.x + 4}" y="${rect.y + 4}" width="${rect.w - 8}" height="${rect.h - 8}"/>`;
      }
      if ((overlay === 'path' || overlay === 'guide') && rooms.length >= 2) {
        const pts = rooms.map(center);
        html += `<defs><marker id="tutArr" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path class="tut-arrow" d="M0,0L10,5L0,10Z"/></marker></defs>`;
        html += `<path class="tut-path${overlay === 'guide' ? ' faint' : ''}" d="M${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join('L')}" marker-end="url(#tutArr)"/>`;
      }
      if (overlay === 'back' && rooms.length) {
        const noRoom = rooms[rooms.length - 1];
        const rect = plan.roomRect(noRoom);
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2 + 8;
        html += `<rect class="tut-no" x="${rect.x + 4}" y="${rect.y + 4}" width="${rect.w - 8}" height="${rect.h - 8}"/><path class="tut-x" d="M${cx - 16},${cy - 16}L${cx + 16},${cy + 16}M${cx + 16},${cy - 16}L${cx - 16},${cy + 16}"/>`;
      }
      ov.innerHTML = html;
      svg.appendChild(ov);
    }
    const targetKey = sels.join('|');
    if (sels.length && targetKey !== lastTargetKey) {
      lastTargetKey = targetKey;
      const el = root.querySelector(sels[0]) ?? document.querySelector(sels[0]);
      if (el) {
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
      }
    }
  }

  function tick(): void {
    const step = currentStep();
    const state = store.getState();
    const stepState = toStepState(state);
    const task = step.kind === 'do' ? step.task?.(stepState) : undefined;
    const sels = [task?.sel ?? step.target, task?.extra].filter((s): s is string => Boolean(s));
    const rooms = step.rooms ?? [];
    placeCoach();
    applyTargets(sels, rooms, step.overlay);
    if (step.kind !== 'do') return;
    const ok = step.check ? step.check(stepState) : false;
    const box = coach.querySelector('#coTask');
    if (box) {
      box.classList.toggle('ok', ok);
      const b = coach.querySelector('#coTaskB');
      const tx = coach.querySelector('#coTaskTx');
      const wantB = ok ? '✓ Bien.' : 'Tu turno.';
      const wantTx = ok ? step.success ?? 'Hecho.' : (task?.tx ?? '');
      if (b && b.textContent !== wantB) b.textContent = wantB;
      if (tx && tx.textContent !== wantTx) tx.textContent = wantTx;
    }
    const nextBtn = coach.querySelector<HTMLButtonElement>('#coNext');
    if (nextBtn) nextBtn.hidden = !ok;
    if (ok && i === max && doneAt === null) doneAt = Date.now();
    if (!ok) doneAt = null;
  }

  const unsubscribe = store.subscribe(tick);
  const autoAdvanceTimer = setInterval(() => {
    if (doneAt !== null && Date.now() - doneAt > AUTO_ADVANCE_MS) {
      doneAt = null;
      goTo(i + 1);
    }
  }, 200);
  const onResize = (): void => placeCoach();
  window.addEventListener('resize', onResize);

  function cleanup(): void {
    unsubscribe();
    clearInterval(autoAdvanceTimer);
    if (scrollTimer) clearTimeout(scrollTimer);
    window.removeEventListener('resize', onResize);
    document.body.classList.remove('tut-on');
    root.querySelectorAll('.tut-target').forEach((n) => n.classList.remove('tut-target'));
    root.querySelector('#mapSvg #tutOv')?.remove();
    coach.remove();
  }

  renderStep();
  return cleanup;
}
