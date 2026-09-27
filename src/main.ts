import type { BankFile, CaseDef, CaseMode, MapId } from './engine/types';
import { loadBank, modeForDiff, nextUnplayed } from './game/bank';
import { getDailyCase } from './game/modes';
import { clearSavedGame, loadSavedGame } from './game/session';
import { initTheme, wireThemeToggles } from './ui/a11y';
import { renderBoard } from './ui/board';
import { renderExhausted } from './ui/exhausted';
import { renderLanding } from './ui/landing';
import { toast } from './ui/toast';

const appEl = document.getElementById('app');
if (!appEl) throw new Error('Falta el contenedor #app en index.astro.');
const app: HTMLElement = appEl;

let cleanup: (() => void) | null = null;

function showLanding(): void {
  cleanup?.();
  cleanup = renderLanding(app, {
    onStart: (diff, mapFilter) => {
      void startCasual(modeForDiff(diff), mapFilter);
    },
    onDaily: () => {
      void startDaily();
    },
    onResume: () => {
      void resumeGame();
    },
  });
  wireThemeToggles();
}

function showBoard(caseData: CaseDef, bankVersion: string | null, mapFilter: MapId | null): void {
  cleanup?.();
  cleanup = renderBoard(app, caseData, {
    onExit: showLanding,
    onNextCase: (finished) => {
      void nextCase(finished, mapFilter);
    },
    bankVersion,
  });
}

function showExhausted(bank: BankFile, mapFilter: MapId | null): void {
  cleanup?.();
  renderExhausted(app, bank, mapFilter, {
    onRestart: () => {
      void startCasual(bank.mode as Exclude<CaseMode, 'diario' | 'expediente'>, mapFilter);
    },
    onInfinite: () => toast('El modo infinito llega en breve.'),
    onBackToLanding: showLanding,
  });
  cleanup = null;
}

async function startCasual(mode: Exclude<CaseMode, 'diario' | 'expediente'>, mapFilter: MapId | null): Promise<void> {
  try {
    const bank = await loadBank(mode);
    const next = nextUnplayed(bank, mapFilter);
    if (!next) {
      showExhausted(bank, mapFilter);
      return;
    }
    showBoard(next, bank.version, mapFilter);
  } catch {
    toast('No se ha podido cargar el caso. Comprueba tu conexión e inténtalo de nuevo.');
  }
}

async function nextCase(finished: CaseDef, mapFilter: MapId | null): Promise<void> {
  // El caso del día es uno solo para todos (§13): no hay "siguiente" dentro del
  // mismo día. El expediente aún no está implementado (llega con modo infinito).
  if (finished.mode === 'diario' || finished.mode === 'expediente') {
    showLanding();
    return;
  }
  await startCasual(finished.mode, mapFilter);
}

async function startDaily(): Promise<void> {
  try {
    const daily = await getDailyCase();
    if (!daily) {
      toast('Todavía no hay caso del día disponible.');
      return;
    }
    showBoard(daily.caseData, daily.bankVersion, null);
  } catch {
    toast('No se ha podido cargar el caso del día.');
  }
}

async function resumeGame(): Promise<void> {
  const saved = loadSavedGame();
  if (!saved) {
    showLanding();
    return;
  }
  if (saved.mode === 'expediente') {
    toast('Reanudar un expediente llega en breve.');
    return;
  }
  try {
    const bank = await loadBank(saved.mode);
    const caseData = bank.cases.find((c) => c.id === saved.caseId);
    if (!caseData) {
      clearSavedGame();
      toast('Ese caso ya no está disponible.');
      showLanding();
      return;
    }
    showBoard(caseData, bank.version, null);
  } catch {
    toast('No se ha podido retomar el caso. Comprueba tu conexión e inténtalo de nuevo.');
  }
}

/** Enlaces (§12.5): #caso=I-142 abre ese caso concreto del banco. #gen=... (modo
 * infinito) queda para cuando exista el generador en un Web Worker. */
const ID_PREFIX_TO_MODE: Record<string, CaseMode> = { N: 'novato', I: 'inspector', C: 'comisario', D: 'diario' };

async function openLinkedCase(id: string): Promise<void> {
  const mode = ID_PREFIX_TO_MODE[id.split('-')[0]];
  if (!mode) {
    toast('Enlace de caso no reconocido.');
    showLanding();
    return;
  }
  try {
    const bank = await loadBank(mode);
    const caseData = bank.cases.find((c) => c.id === id);
    if (!caseData) {
      toast('Ese caso ya no está en el banco actual.');
      showLanding();
      return;
    }
    showBoard(caseData, bank.version, null);
  } catch {
    toast('No se ha podido abrir el caso enlazado.');
    showLanding();
  }
}

function routeFromHash(): void {
  const caso = new URLSearchParams(location.hash.slice(1)).get('caso');
  if (caso) {
    void openLinkedCase(caso);
    return;
  }
  showLanding();
}

initTheme();
routeFromHash();
