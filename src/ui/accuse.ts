// Hoja de acusación (§14.3): dos selectores (culpable y arma) y el botón
// Acusar. Los descartados aparecen atenuados, pero se pueden elegir. Un error
// no revela qué parte falló. Qué pasa con el resultado (cerrar el caso, avisar
// cuántas quedan) lo decide quien llama: el presupuesto de errores no es
// siempre "2 por caso" (un expediente lo comparte entre sus 3 noches, §13).
import type { ClueTextContext } from '../engine/text';
import type { AccusationOutcome } from '../game/scoring';
import type { GameStore } from '../game/store';
import { remainingSuspects, TWO_LEFT_STEPS } from '../modes/gym/bridge';

export interface AccuseOptions {
  /** Texto del contador de errores ("Errores: 1/2", o para un expediente
   * "Quedan 2 acusaciones para todo el expediente"). */
  errorsLabel: string;
  onOutcome: (outcome: AccusationOutcome) => void;
  /** "Practicar remates" (MODOS 3.10.1): solo donde el caso en curso se puede guardar y retomar. */
  onPracticeRemates?: () => void;
}

/** "¿Te quedan dos?": el protocolo de cinco comprobaciones, plegado, y la práctica de remates. */
function twoLeftMarkup(withPractice: boolean): string {
  return `<details class="two-left">
      <summary>¿Te quedan dos?</summary>
      <ol>${TWO_LEFT_STEPS.map((s) => `<li>${s}</li>`).join('')}</ol>
      ${withPractice ? '<button class="btn ghost" id="practiceRemates" type="button">Practicar remates</button>' : ''}
    </details>`;
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
  const twoLeft = remainingSuspects(state.caseData, state.discarded, state.marks).length === 2;
  const objOptions = ctx.objects.map((o, i) => `<button class="chip accsel" data-obj="${i}" aria-pressed="false">${o.label}</button>`).join('');

  overlay.innerHTML = `
    <div class="accuse-sheet" role="dialog" aria-modal="true" aria-labelledby="accuseT">
      <button class="icon-btn accuse-close" aria-label="Cerrar">✕</button>
      <h2 id="accuseT">Acusación</h2>
      <p class="errs">${options.errorsLabel}</p>
      <p class="lbl">¿Quién fue?</p>
      <div class="accuse-row">${susOptions}</div>
      <p class="lbl">¿Con qué?</p>
      <div class="accuse-row">${objOptions}</div>
      <button class="btn" id="accuseSubmit" disabled>Acusar</button>
      ${twoLeft ? twoLeftMarkup(Boolean(options.onPracticeRemates)) : ''}
    </div>
  `;
  // Al cerrar, el foco vuelve a donde estaba (el botón Acusar).
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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

  function onKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    close();
  }
  function close(): void {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    if (previous?.isConnected) previous.focus();
  }
  document.addEventListener('keydown', onKey);
  overlay.querySelector('.accuse-close')?.addEventListener('click', close);
  overlay.querySelector<HTMLButtonElement>('[data-sus]')?.focus();
  overlay.querySelector('#practiceRemates')?.addEventListener('click', () => {
    close();
    options.onPracticeRemates?.();
  });

  submit?.addEventListener('click', () => {
    if (selSus === null || selObj === null) return;
    store.setAccuseCulprit(selSus);
    store.setAccuseWeapon(selObj);
    const outcome = store.accuse();
    close();
    options.onOutcome(outcome);
  });
}
