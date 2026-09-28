// Agotamiento de un grupo (§12.5): "Has resuelto todos los casos de este
// nivel", con dos salidas: modo infinito o volver a empezar (reinicia la
// lista de jugados de ese grupo, sin tocar el resto).
import { resetPlayed } from '../game/bank';
import type { BankFile, CaseMode, MapId } from '../engine/types';

const MODE_LABEL: Record<CaseMode, string> = {
  novato: 'Novato',
  inspector: 'Inspector',
  comisario: 'Comisario',
  diario: 'Diario',
  expediente: 'Expediente',
};

export interface ExhaustedOptions {
  onRestart: () => void;
  onInfinite: () => void;
  onBackToLanding: () => void;
}

export function renderExhausted(root: HTMLElement, bank: BankFile, mapFilter: MapId | null, options: ExhaustedOptions): void {
  root.innerHTML = `
    <div class="exhausted">
      <h1>Has resuelto todos los casos de ${MODE_LABEL[bank.mode]}${mapFilter ? ' en ese escenario' : ''}.</h1>
      <p>Puedes seguir con el modo infinito (un generador en tu propio navegador) o volver a jugar los mismos casos desde el principio.</p>
      <div class="exhausted-actions">
        <button class="btn" id="infiniteBtn">Modo infinito</button>
        <button class="btn ghost" id="restartBtn">Volver a empezar</button>
        <button class="btn ghost" id="backBtn">Volver a la portada</button>
      </div>
    </div>
  `;
  root.querySelector('#infiniteBtn')?.addEventListener('click', () => options.onInfinite());
  root.querySelector('#restartBtn')?.addEventListener('click', () => {
    resetPlayed(
      bank.version,
      bank.cases.map((c) => c.id),
    );
    options.onRestart();
  });
  root.querySelector('#backBtn')?.addEventListener('click', () => options.onBackToLanding());
}
