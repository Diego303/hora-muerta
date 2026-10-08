// Agotamiento de un grupo (§12.5): no queda ningún caso por jugar en los escenarios
// abiertos. Dice por qué (el nivel aún no tiene casos, quedan casos en escenarios sin
// desbloquear o de verdad están todos jugados) y ofrece las salidas que tengan sentido:
// modo infinito, volver a empezar (reinicia la lista de jugados de ese grupo, sin tocar
// el resto) y volver a la portada.
import { resetPlayed } from '../game/bank';
import type { BankFile, CaseMode, MapId } from '../engine/types';

const MODE_LABEL: Record<CaseMode, string> = {
  novato: 'Novato',
  inspector: 'Inspector',
  comisario: 'Comisario',
  diario: 'Diario',
};

export interface ExhaustedOptions {
  /** Escenarios desbloqueados con el rango actual (§16.1). */
  unlockedMaps: ReadonlySet<MapId>;
  onRestart: () => void;
  onInfinite: () => void;
  onBackToLanding: () => void;
}

export interface ExhaustedMessage {
  title: string;
  text: string;
  /** "Volver a empezar" solo tiene sentido si hay casos que ya se han jugado. */
  canRestart: boolean;
}

/** El texto de la pantalla, según por qué no queda ningún caso. Puro. */
export function exhaustedMessage(bank: BankFile, mapFilter: MapId | null, unlockedMaps: ReadonlySet<MapId>): ExhaustedMessage {
  const level = MODE_LABEL[bank.mode];
  const infinite = 'Puedes seguir con el modo infinito, un generador en tu propio navegador.';
  if (bank.cases.length === 0) {
    return { title: `Todavía no hay casos de ${level}.`, text: infinite, canRestart: false };
  }
  if (mapFilter) {
    return {
      title: `Has resuelto todos los casos de ${level} en ese escenario.`,
      text: `${infinite} También puedes volver a jugar los mismos casos desde el principio.`,
      canRestart: true,
    };
  }
  const locked = bank.cases.filter((c) => !unlockedMaps.has(c.map)).length;
  if (locked > 0) {
    const more = locked === 1 ? 'Hay 1 más en un escenario' : `Hay ${locked} más en escenarios`;
    return {
      title: `Has resuelto los casos de ${level} de tus escenarios.`,
      text: `${more} que aún no has desbloqueado: sube de rango para abrirlos. ${infinite}`,
      canRestart: true,
    };
  }
  return {
    title: `Has resuelto todos los casos de ${level}.`,
    text: `${infinite} También puedes volver a jugar los mismos casos desde el principio.`,
    canRestart: true,
  };
}

export function renderExhausted(root: HTMLElement, bank: BankFile, mapFilter: MapId | null, options: ExhaustedOptions): void {
  const message = exhaustedMessage(bank, mapFilter, options.unlockedMaps);
  root.innerHTML = `
    <div class="exhausted">
      <h1>${message.title}</h1>
      <p>${message.text}</p>
      <div class="exhausted-actions">
        <button class="btn" id="infiniteBtn">Modo infinito</button>
        ${message.canRestart ? '<button class="btn ghost" id="restartBtn">Volver a empezar</button>' : ''}
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
