import type { CaseDef } from './engine/types';
import { loadBank } from './game/bank';
import { initTheme, wireThemeToggles } from './ui/a11y';
import { renderBoard } from './ui/board';
import { renderLanding } from './ui/landing';
import { toast } from './ui/toast';

const appEl = document.getElementById('app');
if (!appEl) throw new Error('Falta el contenedor #app en index.astro.');
const app: HTMLElement = appEl;

let cleanup: (() => void) | null = null;

function showLanding(): void {
  cleanup?.();
  cleanup = renderLanding(app, { onStart: showBoard });
  wireThemeToggles();
}

function showBoard(caseData: CaseDef): void {
  cleanup?.();
  cleanup = renderBoard(app, caseData, {
    onExit: showLanding,
    onNextCase: (finished) => {
      void nextCase(finished);
    },
  });
}

async function nextCase(finished: CaseDef): Promise<void> {
  try {
    const bank = await loadBank(finished.mode);
    const pool = bank.cases.filter((c) => c.id !== finished.id);
    const candidates = pool.length > 0 ? pool : bank.cases;
    if (candidates.length === 0) {
      showLanding();
      return;
    }
    showBoard(candidates[Math.floor(Math.random() * candidates.length)]);
  } catch {
    toast('No se ha podido cargar el siguiente caso.');
    showLanding();
  }
}

initTheme();
showLanding();
