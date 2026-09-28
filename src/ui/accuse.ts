// Hoja de acusación (§14.3): dos selectores (culpable y arma) y el botón
// Acusar. Los descartados aparecen atenuados, pero se pueden elegir. Un error
// no revela qué parte falló. Qué pasa con el resultado (cerrar el caso, avisar
// cuántas quedan) lo decide quien llama: el presupuesto de errores no es
// siempre "2 por caso" (un expediente lo comparte entre sus 3 noches, §13).
import type { ClueTextContext } from '../engine/text';
import type { AccusationOutcome } from '../game/scoring';
import type { GameStore } from '../game/store';

export interface AccuseOptions {
  /** Texto del contador de errores ("Errores: 1/2", o para un expediente
   * "Quedan 2 acusaciones para todo el expediente"). */
  errorsLabel: string;
  onOutcome: (outcome: AccusationOutcome) => void;
}

export function openAccuseSheet(ctx: ClueTextContext, store: GameStore, options: AccuseOptions): void {
  const state = store.getState();
  const overlay = document.createElement('div');
  overlay.className = 'accuse-overlay';

  const susOptions = ctx.suspects
    .map((s, i) => {
      const dim = state.discarded.has(i) ? ' dim' : '';
      return `<button class="pal accsel${dim}" data-sus="${i}" style="--c:${s.color}" aria-pressed="false">${s.name}</button>`;
    })
    .join('');
  const objOptions = ctx.objects.map((o, i) => `<button class="chip accsel" data-obj="${i}" aria-pressed="false">${o.label}</button>`).join('');

  overlay.innerHTML = `
    <div class="accuse-sheet">
      <button class="icon-btn accuse-close" aria-label="Cerrar">✕</button>
      <h2>Acusación</h2>
      <p class="errs">${options.errorsLabel}</p>
      <p class="lbl">¿Quién fue?</p>
      <div class="accuse-row">${susOptions}</div>
      <p class="lbl">¿Con qué?</p>
      <div class="accuse-row">${objOptions}</div>
      <button class="btn" id="accuseSubmit" disabled>Acusar</button>
    </div>
  `;
  document.body.appendChild(overlay);

  let selSus: number | null = null;
  let selObj: number | null = null;
  const submit = overlay.querySelector<HTMLButtonElement>('#accuseSubmit');
  function updateSubmit(): void {
    if (submit) submit.disabled = selSus === null || selObj === null;
  }

  overlay.querySelectorAll<HTMLButtonElement>('[data-sus]').forEach((button) => {
    button.addEventListener('click', () => {
      selSus = Number(button.dataset.sus);
      overlay.querySelectorAll('[data-sus]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      updateSubmit();
    });
  });
  overlay.querySelectorAll<HTMLButtonElement>('[data-obj]').forEach((button) => {
    button.addEventListener('click', () => {
      selObj = Number(button.dataset.obj);
      overlay.querySelectorAll('[data-obj]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      updateSubmit();
    });
  });

  function close(): void {
    overlay.remove();
  }
  overlay.querySelector('.accuse-close')?.addEventListener('click', close);

  submit?.addEventListener('click', () => {
    if (selSus === null || selObj === null) return;
    store.setAccuseCulprit(selSus);
    store.setAccuseWeapon(selObj);
    const outcome = store.accuse();
    close();
    options.onOutcome(outcome);
  });
}
