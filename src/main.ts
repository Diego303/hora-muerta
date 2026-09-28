import type { DiffIndex } from './engine/clues';
import { MAPS } from './engine/content/maps';
import { rngFromSeed, shuffle } from './engine/rng';
import type { BankFile, CaseDef, CaseMode, MapId, SeriesDef } from './engine/types';
import { getOrderSeed, getPlayed, loadBank, markPlayed, modeForDiff, nextUnplayed } from './game/bank';
import type { SeriesProgress } from './game/expediente';
import { clearSeriesProgress, loadExpedientes, loadSeriesProgress, startSeries } from './game/expediente';
import type { InfiniteSession } from './game/infinite';
import { reproduceCase, startInfiniteSession } from './game/infinite';
import { getDailyCase } from './game/modes';
import { hasReachedRank, isMapUnlocked, recordSeriesCompletion } from './game/progression';
import { computeStars } from './game/scoring';
import { clearSavedGame, loadSavedGame } from './game/session';
import { getProfile, migrateFromV1, saveProfile } from './game/storage';
import { initTheme, wireThemeToggles } from './ui/a11y';
import { renderBoard } from './ui/board';
import { renderExhausted } from './ui/exhausted';
import { renderHelp } from './ui/help';
import { renderLanding } from './ui/landing';
import { linkForCase } from './ui/links';
import { renderLoading } from './ui/loading';
import { renderProfile } from './ui/profile';
import { renderSettings } from './ui/settings';
import { toast } from './ui/toast';

const appEl = document.getElementById('app');
if (!appEl) throw new Error('Falta el contenedor #app en index.astro.');
const app: HTMLElement = appEl;

let cleanup: (() => void) | null = null;

/** Escenarios desbloqueados con el rango actual (§16.1); "sin repetir" nunca
 * sirve un caso de un mapa bloqueado. */
function unlockedMapIds(): Set<MapId> {
  const stars = getProfile().stars;
  return new Set(MAPS.filter((m) => isMapUnlocked(m.unlock, stars)).map((m) => m.id));
}

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
    onExpediente: () => {
      void startExpediente();
    },
    onSettings: showSettings,
    onProfile: showProfile,
    onHelp: showHelp,
  });
  wireThemeToggles();
}

function showHelp(): void {
  cleanup?.();
  cleanup = renderHelp(app, { onBack: showLanding });
}

function showSettings(): void {
  cleanup?.();
  cleanup = renderSettings(app, {
    onBack: showLanding,
    sepiaUnlocked: hasReachedRank(getProfile().stars, 'cabo'),
  });
}

function showProfile(): void {
  cleanup?.();
  cleanup = renderProfile(app, getProfile(), {
    onBack: showLanding,
    linkFor: linkForCase,
  });
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
    onInfinite: () => {
      showInfinite(bank.cases[0].diff, mapFilter);
    },
    onBackToLanding: showLanding,
  });
  cleanup = null;
}

async function startCasual(mode: Exclude<CaseMode, 'diario' | 'expediente'>, mapFilter: MapId | null): Promise<void> {
  try {
    const bank = await loadBank(mode);
    const next = nextUnplayed(bank, mapFilter, unlockedMapIds());
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
  // mismo día. El expediente tiene su propio flujo (showExpedienteNight);
  // nunca llega aquí.
  if (finished.mode === 'diario') {
    showLanding();
    return;
  }
  await startCasual(finished.mode as Exclude<CaseMode, 'diario' | 'expediente'>, mapFilter);
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
    await resumeExpediente();
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

/** Expediente (§13): 3 noches con el mismo reparto y un presupuesto de errores
 * compartido (game/expediente.ts); "sin repetir" se aplica a la serie entera,
 * no a cada noche por separado, con su propia clave de versión (bank.ts). */
function expedienteVersionKey(bankVersion: string): string {
  return `expediente:${bankVersion}`;
}

async function startExpediente(): Promise<void> {
  try {
    const data = await loadExpedientes();
    if (data.series.length === 0) {
      toast('Todavía no hay expedientes disponibles.');
      return;
    }
    const versionKey = expedienteVersionKey(data.version);
    const rng = rngFromSeed(`${getOrderSeed()}|${versionKey}`);
    const order = shuffle(rng, data.series);
    const played = getPlayed(versionKey);
    const series = order.find((s) => !played.has(s.id));
    if (!series) {
      toast('Has jugado todos los expedientes disponibles.');
      return;
    }
    const progress = startSeries(series.id, data.version);
    showExpedienteNight(series, progress);
  } catch {
    toast('No se ha podido cargar el expediente.');
  }
}

async function resumeExpediente(): Promise<void> {
  const progress = loadSeriesProgress();
  if (!progress) {
    showLanding();
    return;
  }
  try {
    const data = await loadExpedientes();
    const series = data.series.find((s) => s.id === progress.id);
    if (!series) {
      clearSeriesProgress();
      toast('Ese expediente ya no está disponible.');
      showLanding();
      return;
    }
    showExpedienteNight(series, progress);
  } catch {
    toast('No se ha podido retomar el expediente. Comprueba tu conexión e inténtalo de nuevo.');
  }
}

function showExpedienteNight(series: SeriesDef, progress: SeriesProgress): void {
  cleanup?.();
  cleanup = renderBoard(app, series.cases[progress.index], {
    onExit: showLanding,
    onNextCase: () => {
      void advanceExpediente(series);
    },
    bankVersion: null,
  });
}

async function advanceExpediente(series: SeriesDef): Promise<void> {
  const progress = loadSeriesProgress();
  if (!progress || progress.done) {
    const stars = progress?.starsSoFar ?? 0;
    markPlayed(expedienteVersionKey(progress?.version ?? ''), series.id);
    clearSeriesProgress();
    // §16.3 "expedientes completados": la serie terminó, se resolvieran o no
    // las 3 noches (progress.done también se marca al agotar el presupuesto
    // compartido, expediente.ts#registerSeriesError).
    if (progress) saveProfile(recordSeriesCompletion(getProfile()));
    toast(`Expediente cerrado: ${stars}/9 estrellas.`);
    showLanding();
    return;
  }
  showExpedienteNight(series, progress);
}

/** Modo infinito (§13): genera en un Web Worker, con presupuesto de 8 s por
 * caso; el siguiente se pregenera mientras se juega el actual. */
function showInfinite(diff: DiffIndex, mapFilter: MapId | null): void {
  const session = startInfiniteSession(diff, mapFilter);
  cleanup?.();
  cleanup = renderLoading(app, 'Generando un caso nuevo…');
  void session.next().then((caseData) => {
    if (!caseData) {
      toast('No se ha podido generar un caso a tiempo. Inténtalo de nuevo.');
      session.destroy();
      showLanding();
      return;
    }
    showInfiniteBoard(caseData, session, diff, mapFilter);
  });
}

function showInfiniteBoard(caseData: CaseDef, session: InfiniteSession, diff: DiffIndex, mapFilter: MapId | null): void {
  session.pregenerate();
  cleanup?.();
  cleanup = renderBoard(app, caseData, {
    onExit: () => {
      session.destroy();
      showLanding();
    },
    onNextCase: () => {
      void nextInfiniteCase(session, diff, mapFilter);
    },
    bankVersion: null,
  });
}

async function nextInfiniteCase(session: InfiniteSession, diff: DiffIndex, mapFilter: MapId | null): Promise<void> {
  cleanup?.();
  cleanup = renderLoading(app, 'Generando el siguiente caso…');
  const caseData = await session.next();
  if (!caseData) {
    toast('No se ha podido generar el siguiente caso a tiempo.');
    session.destroy();
    showLanding();
    return;
  }
  showInfiniteBoard(caseData, session, diff, mapFilter);
}

/** Enlaces (§12.5): #caso=I-142 abre ese caso concreto del banco;
 * #gen=<semilla>&n=<nivel>&m=<mapa> reproduce un caso de modo infinito. */
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

async function openGenLink(seed: string, diff: DiffIndex, mapId: MapId | undefined): Promise<void> {
  cleanup?.();
  cleanup = renderLoading(app, 'Generando ese caso…');
  const caseData = await reproduceCase(seed, diff, mapId);
  if (!caseData) {
    toast('No se ha podido reproducir ese caso.');
    showLanding();
    return;
  }
  cleanup?.();
  cleanup = renderBoard(app, caseData, {
    onExit: showLanding,
    onNextCase: () => showLanding(),
    bankVersion: null,
  });
}

function routeFromHash(): void {
  const params = new URLSearchParams(location.hash.slice(1));
  const caso = params.get('caso');
  if (caso) {
    void openLinkedCase(caso);
    return;
  }
  const gen = params.get('gen');
  if (gen) {
    const diffRaw = Number(params.get('n'));
    const diff: DiffIndex = diffRaw === 1 || diffRaw === 2 ? diffRaw : 0;
    const mapId = params.get('m') as MapId | null;
    void openGenLink(gen, diff, mapId ?? undefined);
    return;
  }
  showLanding();
}

/** PWA (§19.1, §19.4): solo en producción, para no interferir con el recargado
 * en caliente de `pnpm dev`. */
function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
    /* sin service worker el juego sigue funcionando, solo sin caché offline */
  });
}

initTheme();
migrateFromV1(computeStars);
registerServiceWorker();
routeFromHash();
