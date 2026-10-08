import { createRouter, parseRoute } from './core/router';
import type { ViewDef, VisualMode } from './core/router';
import { applyVisualMode } from './core/visualmode';
import type { DiffIndex } from './engine/clues';
import { MAPS } from './engine/content/maps';
import type { BankFile, CaseDef, CaseMode, LevelMode, MapId } from './engine/types';
import { diffForMode, getOrderSeed, loadBank, modeForDiff, nextUnplayed } from './game/bank';
import type { InfiniteSession } from './game/infinite';
import { reproduceCase, startInfiniteSession } from './game/infinite';
import { getDailyCase } from './game/modes';
import { hasReachedRank, isMapUnlocked } from './game/progression';
import { computeStars } from './game/scoring';
import { clearSavedGame, loadSavedGame } from './game/session';
import { forgetExpediente, getProfile, migrateFromV1 } from './game/storage';
import { TUTORIAL_CASE } from './game/tutorial';
import { initTheme, prefersReducedMotion, wireThemeToggles } from './ui/a11y';
import { renderBoard } from './ui/board';
import { renderCaseList } from './ui/caselist';
import { renderExhausted } from './ui/exhausted';
import { renderHelp } from './ui/help';
import { renderLanding } from './ui/landing';
import { linkForCase } from './ui/links';
import { renderLoading } from './ui/loading';
import { mountAcademy } from './modes/gym/mount';
import type { Tech } from './modes/gym/types';
import { loadFireCases } from './modes/fire/cases';
import { mountFireCase } from './modes/fire/mount';
import { renderFireLobby } from './modes/fire/ui/lobby';
import { loadFireRecords } from './modes/fire/records';
import { fireOffers, fireOrder } from './modes/fire/serve';
import { startEmbers } from './modes/fire/theme/embers';
import type { FireCase } from './modes/fire/types';
import { renderProfile } from './ui/profile';
import { renderSettings } from './ui/settings';
import { toast } from './ui/toast';
import { startTutorialCoach } from './ui/tutorial';

const appEl = document.getElementById('app');
if (!appEl) throw new Error('Falta el contenedor #app en index.astro.');
const app: HTMLElement = appEl;

/** Una partida del tablero: el hash que la representa (o null) y cómo montarla. */
interface GameRoute {
  hash: string | null;
  /** Modo visual de la partida: el Modo Incendio se juega con su paleta. */
  mode?: 'fuego';
  mount: () => () => void;
}

interface AppRoutes {
  home: undefined;
  game: GameRoute;
  fire: undefined;
  academy: undefined;
}

const OWN_HASHES = ['#incendio', '#academia', '#tutorial'];

function writeHash(hash: string | null): void {
  // Solo se borra el hash que es nuestro: un #caso=... de enlace se conserva.
  if (hash === null && !OWN_HASHES.includes(location.hash)) return;
  const next = hash === null ? '' : `#${hash}`;
  if (location.hash === next) return;
  try {
    history.replaceState(history.state, '', `${location.pathname}${location.search}${next}`);
  } catch {
    // sin acceso al historial: la URL se queda como está
  }
}

/** Vista que monta una pantalla completa: lo que devuelve mount es cómo pararla.
 * Se pinta sola al montarse, así que render no hace nada. */
function screenView<P>(
  mount: (params: P) => () => void,
  mode: VisualMode | ((params: P) => VisualMode),
  hash: (params: P) => string | null,
): ViewDef<P> {
  let stop: (() => void) | null = null;
  return {
    mode,
    hash,
    enter: (params) => {
      stop = mount(params);
    },
    render: () => undefined,
    leave: () => {
      const s = stop;
      stop = null;
      s?.();
    },
  };
}

/** Vista del Modo Incendio: la lista de edificios. Los casos se cargan al pintarla. */
function fireLobbyView(): ViewDef<undefined> {
  let stop: (() => void) | null = null;
  let token = 0;
  return {
    mode: 'fuego',
    hash: () => 'incendio',
    enter: () => undefined,
    render: () => {
      stop?.();
      stop = null;
      const mine = ++token;
      app.innerHTML = '<p class="fire-loading">Cargando…</p>';
      loadFireCases()
        .then((bank) => {
          if (mine !== token) return;
          const records = loadFireRecords();
          const ordered = fireOrder(bank.cases, `${getOrderSeed()}|incendio|${bank.version}`);
          const offers = fireOffers(ordered, records, unlockedMapIds());
          const leaveLobby = renderFireLobby(app, offers, records, { onEnter: enterFire, onBack: showLanding });
          const stopEmbers = startEmbers(() => 0.12);
          stop = () => {
            stopEmbers();
            leaveLobby();
          };
        })
        .catch(() => {
          if (mine === token) toast('No se han podido cargar los edificios.');
        });
    },
    leave: () => {
      token++;
      stop?.();
      stop = null;
    },
  };
}

/** Entra en un edificio: una partida nueva con su propio reloj. */
function enterFire(fire: FireCase): void {
  router.showView('game', {
    hash: null,
    mode: 'fuego',
    mount: () =>
      mountFireCase(app, fire, {
        onExit: showLanding,
        onRestart: () => enterFire(fire),
        onLobby: () => router.showView('fire'),
      }),
  });
}

/** A qué viene quien entra en la Academia desde un caso (MODOS 3.10): se consume al montarla. */
let academyFocusOnce: Tech | 'remates' | undefined;

function showAcademy(focus: Tech | 'remates'): void {
  academyFocusOnce = focus;
  router.showView('academy');
}

/** Opciones del tablero que llevan a la Academia, para los casos que se pueden retomar. */
const ACADEMY_LINKS = {
  onPracticeRemates: () => showAcademy('remates'),
  onTrain: (tech: Tech) => showAcademy(tech),
};

const router = createRouter<AppRoutes>(
  {
    home: screenView(() => mountLanding(), null, () => null),
    game: screenView((route: GameRoute) => route.mount(), (route) => route.mode ?? null, (route) => route.hash),
    fire: fireLobbyView(),
    academy: screenView(
      () => {
        const focus = academyFocusOnce;
        academyFocusOnce = undefined;
        return mountAcademy(app, {
          onBack: showLanding,
          onPlayCase: showLandingWithCaseMap,
          focus,
          // Desde "Practicar remates" el caso quedó guardado: se puede volver a él.
          onResumeCase: focus === 'remates' ? () => void resumeGame() : undefined,
        });
      },
      null,
      () => 'academia',
    ),
  },
  {
    applyMode: (mode, previous) => applyVisualMode(mode, previous, prefersReducedMotion()),
    writeHash,
  },
);

/** Escenarios desbloqueados con el rango actual (§16.1); "sin repetir" nunca
 * sirve un caso de un mapa bloqueado. */
function unlockedMapIds(): Set<MapId> {
  const stars = getProfile().stars;
  return new Set(MAPS.filter((m) => isMapUnlocked(m.unlock, stars)).map((m) => m.id));
}

/** La próxima vez que se monte la portada, que llegue con el plano de casos desplegado. */
let openCaseMapOnce = false;

function showLandingWithCaseMap(): void {
  openCaseMapOnce = true;
  showLanding();
}

function mountLanding(): () => void {
  const openCaseMap = openCaseMapOnce;
  openCaseMapOnce = false;
  const leave = renderLanding(app, {
    openCaseMap,
    onStart: (diff, mapFilter) => {
      void startCasual(modeForDiff(diff), mapFilter);
    },
    onDaily: () => {
      void startDaily();
    },
    onResume: () => {
      void resumeGame();
    },
    onSettings: showSettings,
    onProfile: showProfile,
    onHelp: showHelp,
    onTutorial: showTutorial,
    onAcademy: () => router.showView('academy'),
    onFire: () => router.showView('fire'),
    onPlayCase: (caseData, bankVersion) => showBoard(caseData, bankVersion, null),
    onShowCaseList: showCaseList,
  });
  wireThemeToggles();
  return leave;
}

function showLanding(): void {
  router.showView('home');
}

function showHelp(): void {
  router.replaceScreen(() => renderHelp(app, { onBack: showLanding }));
}

/** Tutorial guiado: un caso de prácticas fijo (game/tutorial.ts) con un
 * "coach" flotante encima del tablero real (ui/tutorial.ts). No cuenta para
 * las estadísticas ni se guarda como caso en curso (board.ts ya lo trata
 * aparte por el id TUT-01). */
function showTutorial(): void {
  router.showView('game', { hash: 'tutorial', mount: mountTutorialBoard });
}

function mountTutorialBoard(): () => void {
  let stopCoach: (() => void) | null = null;
  const exitTutorial = (): void => {
    stopCoach?.();
    stopCoach = null;
    showLanding();
  };
  const leaveBoard = renderBoard(app, TUTORIAL_CASE, {
    onExit: exitTutorial,
    onNextCase: () => exitTutorial(),
    bankVersion: null,
    onReady: (store, plan) => {
      stopCoach = startTutorialCoach(app, store, plan, { onExit: exitTutorial });
    },
  });
  return () => {
    stopCoach?.();
    stopCoach = null;
    leaveBoard();
  };
}

/** Lista completa de casos, filtrable (§ nueva mejora): la alternativa de
 * "elegir con calma" al plano plegable, que solo enseña unos pocos a la vez. */
function showCaseList(): void {
  router.replaceScreen(() =>
    renderCaseList(app, {
      onBack: showLanding,
      onPlay: (caseData, bankVersion) => showBoard(caseData, bankVersion, null),
    }),
  );
}

function showSettings(): void {
  router.replaceScreen(() =>
    renderSettings(app, {
      onBack: showLanding,
      sepiaUnlocked: hasReachedRank(getProfile().stars, 'cabo'),
    }),
  );
}

function showProfile(): void {
  router.replaceScreen(() =>
    renderProfile(app, getProfile(), {
      onBack: showLanding,
      linkFor: linkForCase,
    }),
  );
}

function showBoard(caseData: CaseDef, bankVersion: string | null, mapFilter: MapId | null): void {
  router.showView('game', {
    hash: null,
    mount: () =>
      renderBoard(app, caseData, {
        onExit: showLanding,
        onNextCase: (finished) => {
          void nextCase(finished, mapFilter);
        },
        bankVersion,
        ...(bankVersion !== null ? ACADEMY_LINKS : {}),
      }),
  });
}

function showExhausted(mode: LevelMode, bank: BankFile, mapFilter: MapId | null): void {
  router.replaceScreen(() => {
    renderExhausted(app, bank, mapFilter, {
      unlockedMaps: unlockedMapIds(),
      onRestart: () => {
        void startCasual(mode, mapFilter);
      },
      onInfinite: () => {
        showInfinite(diffForMode(mode), mapFilter);
      },
      onBackToLanding: showLanding,
    });
    return () => undefined;
  });
}

async function startCasual(mode: LevelMode, mapFilter: MapId | null): Promise<void> {
  try {
    const bank = await loadBank(mode);
    const next = nextUnplayed(bank, mapFilter, unlockedMapIds());
    if (!next) {
      showExhausted(mode, bank, mapFilter);
      return;
    }
    showBoard(next, bank.version, mapFilter);
  } catch {
    toast('No se ha podido cargar el caso. Comprueba tu conexión e inténtalo de nuevo.');
  }
}

async function nextCase(finished: CaseDef, mapFilter: MapId | null): Promise<void> {
  // El caso del día es uno solo para todos (§13): no hay "siguiente" dentro del
  // mismo día.
  if (finished.mode === 'diario') {
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

/** Modo infinito (§13): genera en un Web Worker, con presupuesto de 8 s por
 * caso; el siguiente se pregenera mientras se juega el actual. */
function showInfinite(diff: DiffIndex, mapFilter: MapId | null): void {
  const session = startInfiniteSession(diff, mapFilter);
  router.replaceScreen(() => renderLoading(app, 'Generando un caso nuevo…'));
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
  router.showView('game', {
    hash: null,
    mount: () =>
      renderBoard(app, caseData, {
        onExit: () => {
          session.destroy();
          showLanding();
        },
        onNextCase: () => {
          void nextInfiniteCase(session, diff, mapFilter);
        },
        bankVersion: null,
        // El caso infinito no se retoma, así que no hay "Practicar remates"; la técnica sugerida, sí.
        onTrain: (tech) => {
          session.destroy();
          showAcademy(tech);
        },
      }),
  });
}

async function nextInfiniteCase(session: InfiniteSession, diff: DiffIndex, mapFilter: MapId | null): Promise<void> {
  router.replaceScreen(() => renderLoading(app, 'Generando el siguiente caso…'));
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
  router.replaceScreen(() => renderLoading(app, 'Generando ese caso…'));
  const caseData = await reproduceCase(seed, diff, mapId);
  if (!caseData) {
    toast('No se ha podido reproducir ese caso.');
    showLanding();
    return;
  }
  router.showView('game', {
    hash: null,
    mount: () =>
      renderBoard(app, caseData, {
        onExit: showLanding,
        onNextCase: () => showLanding(),
        bankVersion: null,
      }),
  });
}

function routeFromHash(): void {
  const route = parseRoute(location.hash);
  switch (route.kind) {
    case 'fire':
      router.showView('fire');
      return;
    case 'academy':
      router.showView('academy');
      return;
    case 'tutorial':
      showTutorial();
      return;
    case 'caso':
      void openLinkedCase(route.id);
      return;
    case 'gen':
      void openGenLink(route.seed, route.diff, route.map === null ? undefined : (route.map as MapId));
      return;
    case 'home':
      showLanding();
      return;
  }
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
forgetExpediente();
registerServiceWorker();
routeFromHash();
