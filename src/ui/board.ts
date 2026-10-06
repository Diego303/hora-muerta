// Mesa de trabajo (§17.3): orquesta plano, tiza, horas, herramientas, hoja
// inferior (pistas, objetos, caso) y el bucle acusación → cierre → siguiente
// caso sobre un GameStore.
import { VICTIMS } from '../engine/content/cast';
import { MAPS } from '../engine/content/maps';
import { buildTextContext } from '../engine/generate';
import { buildGraph } from '../engine/graph';
import { formatElapsed, hintPush, stepExplanation, stepFocus, timeLabel } from '../engine/text';
import type { CaseDef, MapDef, Room } from '../engine/types';
import { markPlayed } from '../game/bank';
import { completeNight, loadSeriesProgress, registerSeriesError } from '../game/expediente';
import { nextHint } from '../game/hints';
import { recordDailyResult, todayKey } from '../game/modes';
import { ARCHETYPE_LABELS, recordClosure } from '../game/progression';
import { TUTORIAL_CASE_ID } from '../game/tutorial';
import type { AccusationOutcome } from '../game/scoring';
import { computeStars } from '../game/scoring';
import { clearSavedGame, loadSavedGame, saveGame } from '../game/session';
import type { ChalkColor, GameStore, MarkValue } from '../game/store';
import { createGameStore, markKey } from '../game/store';
import { effectiveMoveHelp, getProfile, getSettings, saveProfile } from '../game/storage';
import { openAccuseSheet } from './accuse';
import { setupChalk } from './chalk';
import { renderCaseTab } from './casetab';
import { clueFocusTarget, renderClueList } from './clues';
import { renderClosure } from './closure';
import { renderObjectsTable } from './objects';
import { buildPlan } from './plan';
import type { PlanHandle, SuspectView } from './plan';
import { toast } from './toast';

export interface BoardOptions {
  onExit: () => void;
  onNextCase: (finishedCase: CaseDef) => void;
  /** Versión del banco de la que viene `caseData` (§12.5, §12.6), para marcarlo
   * como jugado al cerrar el caso; `null` si no viene de un banco versionado
   * (p. ej. modo infinito). */
  bankVersion: string | null;
  /** Se llama una vez, justo después de montar el tablero, con el store y el
   * plano ya construidos (ui/tutorial.ts lo usa para enganchar el "coach" sin
   * que board.ts sepa nada del tutorial). */
  onReady?: (store: GameStore, plan: PlanHandle) => void;
}

function findMap(mapId: CaseDef['map']): MapDef {
  const map = MAPS.find((m) => m.id === mapId);
  if (!map) throw new Error(`Mapa desconocido: ${mapId}`);
  return map;
}

function requireEl<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Falta "${selector}" en el marcado de la mesa de trabajo.`);
  return el;
}

/** Sala más cercana en una dirección (§17.9, flechas): la que tenga el centro
 * más alineado con (dx,dy) desde la sala de partida, usando las coordenadas
 * del propio plano (no el grafo de puertas: aquí es solo para mover el foco). */
function roomInDirection(map: MapDef, from: number, dx: number, dy: number): number | null {
  const center = (i: number): [number, number] => {
    const r = map.rooms[i];
    return [r.x + r.w / 2, r.y + r.h / 2];
  };
  const [fx, fy] = center(from);
  let best: number | null = null;
  let bestScore = Infinity;
  map.rooms.forEach((_, i) => {
    if (i === from) return;
    const [tx, ty] = center(i);
    const vx = tx - fx;
    const vy = ty - fy;
    const primary = vx * dx + vy * dy;
    if (primary <= 0) return;
    const lateral = Math.abs(vx * dy - vy * dx);
    const score = primary + lateral * 2;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

const CHALK_SWATCHES: { color: ChalkColor; label: string }[] = [
  { color: 'ink', label: 'Tinta' },
  { color: 'amber', label: 'Ámbar' },
  { color: 'pencil', label: 'Rojo' },
];

export function renderBoard(root: HTMLElement, caseData: CaseDef, options: BoardOptions): () => void {
  const map = findMap(caseData.map);
  const graph = buildGraph(map);
  const textCtx = buildTextContext(map, caseData.cast, caseData.objects);
  const suspects: SuspectView[] = textCtx.suspects.map((s) => ({ name: s.name, init: s.name[0], color: s.color }));
  // Un expediente comparte el presupuesto de errores entre sus 3 noches
  // (§13): esta noche por sí sola nunca se archiva; el handler de la
  // acusación (más abajo) lleva la cuenta compartida aparte. El tutorial
  // tampoco tiene presupuesto de errores: "equivócate sin miedo".
  const maxErrors = caseData.mode === 'expediente' || caseData.id === TUTORIAL_CASE_ID ? Number.POSITIVE_INFINITY : 2;
  const store = createGameStore(caseData, map.rooms.length, nextHint, maxErrors);

  // Caso en curso (§18, hm2:game): retoma el progreso guardado si es el mismo
  // caso; si no, empieza de cero. Abrir la web no lo descarta; solo cerrar el
  // caso (showClosure) lo borra.
  const resumed = loadSavedGame();
  const startedAt = resumed && resumed.caseId === caseData.id ? resumed.startedAt : Date.now();
  if (resumed && resumed.caseId === caseData.id) store.hydrate(resumed);

  root.innerHTML = `
    <div class="game" id="gameRoot" data-case-id="${caseData.id}">
      <div class="gbar">
        <button class="icon-btn" id="exit" aria-label="Volver a la portada">←</button>
        <div class="ttl"><b>${map.name}</b></div>
        <span class="timer" id="timerDisplay" aria-label="Tiempo" hidden></span>
        <div class="stars" id="starsDisplay">★★★</div>
      </div>
      <div class="game-main">
        <button class="brief" id="brief" type="button"></button>
        <div class="plan-wrap"><div class="plan" id="planHost"><svg class="map" id="mapSvg"></svg><canvas class="chalk" id="chalkCanvas"></canvas></div></div>
        <div class="times" id="times" role="group" aria-label="Hora"></div>
        <div class="tools">
          <div class="seg" role="group" aria-label="Modo">
            <button data-mode="mark" aria-pressed="true">Marcar</button>
            <button data-mode="chalk" aria-pressed="false">Tiza</button>
            <button data-mode="view" aria-pressed="false">Ver</button>
          </div>
          <button class="icon-btn" id="undo" aria-label="Deshacer">↶</button>
          <button class="icon-btn plan-expand-btn" id="expand" aria-label="Ampliar plano">⤢</button>
        </div>
        <div class="subtools" id="subtools"></div>
        <p class="hint" id="hint"></p>
        <div class="legend" id="legend"></div>
      </div>
      <div class="sheet-panel" id="sheetPanel">
        <button class="sheet-handle" id="sheetHandle" aria-label="Subir o bajar la hoja"><i></i></button>
        <div class="sheet-tabs" role="tablist">
          <button data-tab="pistas" aria-pressed="true">Pistas</button>
          <button data-tab="objetos" aria-pressed="false">Objetos</button>
          <button data-tab="caso" aria-pressed="false">Caso</button>
        </div>
        <div class="sheet-body" id="sheetBody">
          <section class="sheet-section" data-panel="pistas">
            <h2 class="sheet-h2">Pistas <small>Toca una pista para tacharla</small></h2>
            <div id="pistasBody"></div>
          </section>
          <section class="sheet-section" data-panel="objetos">
            <h2 class="sheet-h2">Objetos <small>✓ lo llevaba, ✗ no</small></h2>
            <div id="objetosBody"></div>
          </section>
          <section class="sheet-section" data-panel="caso">
            <h2 class="sheet-h2">Caso</h2>
            <div id="casoBody"></div>
          </section>
        </div>
      </div>
      <div class="actionbar">
        <div class="hint-panel" id="hintPanel" hidden>
          <p id="hintText"></p>
          <button class="link" id="hintExplainBtn" hidden>Explícamelo</button>
        </div>
        <div class="actionbar-buttons">
          <button class="btn ghost" id="hintBtn">Pista</button>
          <button class="btn" id="accuseBtn">Acusar</button>
        </div>
      </div>
    </div>
  `;

  const gameRoot = requireEl<HTMLDivElement>(root, '#gameRoot');
  const starsDisplay = requireEl<HTMLDivElement>(root, '#starsDisplay');
  const timerDisplay = requireEl<HTMLSpanElement>(root, '#timerDisplay');
  const briefEl = requireEl<HTMLButtonElement>(root, '#brief');
  const mapSvg = requireEl<SVGSVGElement>(root, '#mapSvg');
  const chalkCanvas = requireEl<HTMLCanvasElement>(root, '#chalkCanvas');
  const timesEl = requireEl<HTMLDivElement>(root, '#times');
  const subtoolsEl = requireEl<HTMLDivElement>(root, '#subtools');
  const hintEl = requireEl<HTMLParagraphElement>(root, '#hint');
  const legendEl = requireEl<HTMLDivElement>(root, '#legend');
  const sheetBody = requireEl<HTMLDivElement>(root, '#sheetBody');
  const pistasBody = requireEl<HTMLDivElement>(root, '#pistasBody');
  const objetosBody = requireEl<HTMLDivElement>(root, '#objetosBody');
  const casoBody = requireEl<HTMLDivElement>(root, '#casoBody');
  const hintPanel = requireEl<HTMLDivElement>(root, '#hintPanel');
  const hintText = requireEl<HTMLParagraphElement>(root, '#hintText');
  const hintExplainBtn = requireEl<HTMLButtonElement>(root, '#hintExplainBtn');

  const victimRoom = map.rooms[caseData.rv];
  const victimName = VICTIMS[caseData.victim];
  briefEl.innerHTML = `<b>${victimName}</b> apareció sin vida en ${victimRoom.art} ${victimRoom.name}. Hora de la muerte: <b>${timeLabel(caseData.td)}</b>.`;
  briefEl.addEventListener('click', () => store.setSheetTab('caso'));

  const plan: PlanHandle = buildPlan(mapSvg, map, { interactive: true, crimeRoom: caseData.rv, victimLabel: victimName });
  const chalk = setupChalk(chalkCanvas, plan.width, plan.height, store);

  plan.hits.forEach((hit) => {
    const room = Number(hit.dataset.r);
    hit.addEventListener('click', () => roomTap(room));
    hit.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        roomTap(room);
        return;
      }
      // Flechas para moverse entre salas (§17.9): la sala más próxima en esa
      // dirección, tomando el centro de cada sala del propio plano.
      const dir: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
      const vector = dir[e.key];
      if (!vector) return;
      e.preventDefault();
      const next = roomInDirection(map, room, vector[0], vector[1]);
      if (next !== null) plan.hits[next]?.focus();
    });
  });

  function roomTap(room: number): void {
    const state = store.getState();
    if (state.mode === 'mark') store.mark(room);
    else if (state.mode === 'view') {
      const current = state.filter;
      store.setFilter(current && current.type === 'room' && current.r === room ? null : { type: 'room', r: room });
    }
  }

  for (let t = 0; t < caseData.T; t++) {
    const button = document.createElement('button');
    button.textContent = timeLabel(t) + (t === caseData.td ? ' †' : '');
    if (t === caseData.td) button.classList.add('td');
    button.addEventListener('click', () => store.setHour(t));
    timesEl.appendChild(button);
  }

  root.querySelectorAll<HTMLButtonElement>('.seg button[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.mode;
      if (mode === 'mark' || mode === 'chalk' || mode === 'view') store.setMode(mode);
    });
  });

  root.querySelector('#undo')?.addEventListener('click', () => store.undo());
  root.querySelector('#expand')?.addEventListener('click', () => openExpandedPlan());
  root.querySelector('#exit')?.addEventListener('click', () => {
    cleanup();
    options.onExit();
  });
  root.querySelector('#hintBtn')?.addEventListener('click', () => {
    store.requestHint();
    // Fase 1 ya cambia la hora a la implicada (§15.1): "se resaltan en el
    // plano las salas y la hora implicadas".
    const hint = store.getState().hint;
    if (hint?.kind === 'step') {
      const focus = stepFocus(caseData.solve.steps[hint.stepIndex], caseData);
      if (focus.hour !== null) store.setHour(focus.hour);
    } else if (hint?.kind === 'markError' && hint.hour !== null) {
      store.setHour(hint.hour);
    }
  });
  hintExplainBtn.addEventListener('click', () => store.explainHint());
  root.querySelector('#accuseBtn')?.addEventListener('click', () => {
    if (caseData.mode === 'expediente') {
      const errorsLeft = loadSeriesProgress()?.errorsLeft ?? 3;
      openAccuseSheet(textCtx, store, {
        errorsLabel: `Quedan ${errorsLeft} acusación${errorsLeft === 1 ? '' : 'es'} para todo el expediente.`,
        onOutcome: (outcome) => handleExpedienteOutcome(outcome),
      });
      return;
    }
    openAccuseSheet(textCtx, store, {
      errorsLabel: `Errores: ${store.getState().errors}/2`,
      onOutcome: (outcome) => {
        if (outcome.correct || outcome.result === 'archived') {
          showClosure();
          return;
        }
        const left = 2 - outcome.errors;
        toast(`No encaja con los hechos. Te queda ${left} acusación${left === 1 ? '' : 'es'}.`);
      },
    });
  });
  root.querySelector('#sheetHandle')?.addEventListener('click', () => store.toggleSheet());
  root.querySelectorAll<HTMLButtonElement>('.sheet-tabs button[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      if (tab === 'pistas' || tab === 'objetos' || tab === 'caso') store.setSheetTab(tab);
    });
  });

  function renderLegend(): void {
    legendEl.innerHTML = map.features
      .map((f) => `<span><svg width="15" height="15"><use href="#ic-${f.icon}"/></svg>${f.label}</span>`)
      .concat(
        `<span><svg width="15" height="15" style="color:var(--pencil)"><use href="#ic-victim"/></svg>Víctima</span>`,
        `<span><svg width="15" height="15"><use href="#ic-door"/></svg>Puerta</span>`,
      )
      .join('');
  }

  function renderSubtools(): void {
    const state = store.getState();
    subtoolsEl.innerHTML = '';
    if (state.mode === 'mark' || state.mode === 'view') {
      suspects.forEach((suspect, i) => {
        const button = document.createElement('button');
        button.className = 'pal';
        button.style.setProperty('--c', suspect.color);
        button.innerHTML = `<span style="display:inline-block;width:.8em;height:.8em;border-radius:50%;background:${suspect.color}"></span>${suspect.name}`;
        const pressed = state.mode === 'mark' ? state.selectedSuspect === i : state.filter?.type === 'sus' && state.filter.c === i;
        button.setAttribute('aria-pressed', String(pressed));
        button.addEventListener('click', () => {
          if (state.mode === 'mark') store.selectSuspect(i);
          else store.setFilter(state.filter?.type === 'sus' && state.filter.c === i ? null : { type: 'sus', c: i });
        });
        subtoolsEl.appendChild(button);
      });
      hintEl.textContent =
        state.mode === 'mark'
          ? `Elige a alguien y toca una sala: primera vez ✓ (estaba aquí a las ${timeLabel(state.hour)}), segunda ✗ (no estaba), tercera borra.`
          : 'Toca una sala para resaltarla, o a alguien para ver dónde lo marcaste a esta hora.';
    } else {
      CHALK_SWATCHES.forEach(({ color, label }) => {
        const button = document.createElement('button');
        button.className = 'sw';
        button.style.setProperty('--c', `var(--${color})`);
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-pressed', String(!state.eraseMode && state.chalkColor === color));
        button.addEventListener('click', () => store.setChalkColor(color));
        subtoolsEl.appendChild(button);
      });
      const eraser = document.createElement('button');
      eraser.className = 'chip';
      eraser.textContent = 'Goma';
      eraser.setAttribute('aria-pressed', String(state.eraseMode));
      eraser.addEventListener('click', () => store.setEraseMode(!state.eraseMode));
      subtoolsEl.appendChild(eraser);
      const allLayer = document.createElement('button');
      allLayer.className = 'chip';
      allLayer.textContent = 'En todas las horas';
      allLayer.setAttribute('aria-pressed', String(state.allLayer));
      allLayer.addEventListener('click', () => store.setAllLayer(!state.allLayer));
      subtoolsEl.appendChild(allLayer);
      const clearHour = document.createElement('button');
      clearHour.className = 'chip';
      clearHour.textContent = 'Borrar tiza de esta hora';
      clearHour.addEventListener('click', () => store.clearHourStrokes());
      subtoolsEl.appendChild(clearHour);
      hintEl.textContent = state.allLayer
        ? 'Lo que dibujes se verá en todas las horas.'
        : `Lo que dibujes se guarda solo en la hora ${timeLabel(state.hour)}. La goma borra el trazo que toques.`;
    }
  }

  // Las tres secciones se pintan siempre las tres (§17.3): en móvil/tableta
  // solo una está visible a la vez (la pestaña activa, vía CSS con
  // data-active-tab); en escritorio (≥1100px) las tres se ven a la vez, sin
  // pestañas, así que todas tienen que estar ya renderizadas y al día.
  function renderSheet(): void {
    const state = store.getState();
    root.querySelectorAll<HTMLButtonElement>('.sheet-tabs button[data-tab]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.tab === state.sheetTab));
    });
    sheetBody.dataset.activeTab = state.sheetTab;
    renderClueList(pistasBody, caseData.clues, textCtx, store);
    renderObjectsTable(objetosBody, textCtx, store);
    renderCaseTab(casoBody, map, caseData, textCtx, store);
  }

  function renderHint(): void {
    const state = store.getState();
    const hint = state.hint;
    if (!hint) {
      hintPanel.hidden = true;
      return;
    }
    hintPanel.hidden = false;
    if (hint.kind === 'done') {
      hintText.textContent = 'Ya tienes todo lo necesario. Revisa quién pudo estar a solas con la víctima.';
      hintExplainBtn.hidden = true;
    } else if (hint.kind === 'markError') {
      const where = hint.hour !== null ? ` de las ${timeLabel(hint.hour)}` : hint.obj !== null ? ' de la tabla de objetos' : '';
      hintText.textContent = `Una de tus marcas${where} no encaja con las pistas.`;
      hintExplainBtn.hidden = true;
    } else {
      const step = caseData.solve.steps[hint.stepIndex];
      hintText.innerHTML = state.hintExplained ? stepExplanation(step, hint.stepIndex, caseData.solve.steps, caseData, textCtx) : hintPush(step, caseData, textCtx);
      hintExplainBtn.hidden = state.hintExplained;
    }
  }

  /** Ayuda de movimiento (§17.4, §11, opcional según Ajustes/nivel): con un
   * sospechoso seleccionado en Marcar que tenga ✓ en la hora anterior o
   * siguiente, las salas a las que no pudo llegar en un paso del grafo se
   * devuelven para rayarlas. Solo usa las marcas de la persona, nunca la
   * verdad del caso. */
  function moveHelpHatch(state: ReturnType<typeof store.getState>): Room[] {
    if (state.mode !== 'mark' || state.selectedSuspect === null) return [];
    if (!effectiveMoveHelp(getSettings(), caseData.diff)) return [];
    const suspect = state.selectedSuspect;
    const prevHour = state.hour > 0 ? state.hour - 1 : null;
    const nextHour = state.hour < caseData.T - 1 ? state.hour + 1 : null;
    const reachableFrom = (hour: number | null): Set<number> | null => {
      if (hour === null) return null;
      for (let r = 0; r < map.rooms.length; r++) {
        if (state.marks.get(markKey(hour, r, suspect)) === 1) return new Set([r, ...graph.adj[r]]);
      }
      return null;
    };
    const fromPrev = reachableFrom(prevHour);
    const fromNext = reachableFrom(nextHour);
    if (!fromPrev && !fromNext) return [];
    const hatch: Room[] = [];
    for (let r = 0; r < map.rooms.length; r++) {
      const okPrev = !fromPrev || fromPrev.has(r);
      const okNext = !fromNext || fromNext.has(r);
      if (!okPrev || !okNext) hatch.push(r);
    }
    return hatch;
  }

  function draw(): void {
    const state = store.getState();
    plan.setCrime(state.hour === caseData.td);
    plan.marks((room, suspect) => (state.marks.get(markKey(state.hour, room, suspect)) ?? 0) as MarkValue, suspects, state.hour);

    let highlightRooms: Room[] = [];
    if (state.mode === 'view' && state.filter) {
      if (state.filter.type === 'room') highlightRooms = [state.filter.r];
      else {
        for (let r = 0; r < map.rooms.length; r++) {
          if (state.marks.get(markKey(state.hour, r, state.filter.c)) === 1) highlightRooms.push(r);
        }
      }
    }
    if (state.clueFocus !== null) highlightRooms = highlightRooms.concat(clueFocusTarget(caseData.clues[state.clueFocus]).rooms);
    if (state.hint?.kind === 'step') highlightRooms = highlightRooms.concat(stepFocus(caseData.solve.steps[state.hint.stepIndex], caseData).rooms);
    else if (state.hint?.kind === 'markError' && state.hint.room !== null) highlightRooms.push(state.hint.room);
    plan.highlight(highlightRooms);

    // Estela (§17.4): se puede desactivar en Ajustes.
    const trailOn = getSettings().trail;
    const prevHour = state.hour > 0 ? state.hour - 1 : null;
    const nextHour = state.hour < caseData.T - 1 ? state.hour + 1 : null;
    plan.trail(
      !trailOn || prevHour === null ? null : (room, suspect) => (state.marks.get(markKey(prevHour, room, suspect)) ?? 0) as MarkValue,
      !trailOn || nextHour === null ? null : (room, suspect) => (state.marks.get(markKey(nextHour, room, suspect)) ?? 0) as MarkValue,
      suspects,
    );

    plan.hatchRooms(moveHelpHatch(state));
    chalk.redraw();
  }

  function renderAll(): void {
    const state = store.getState();
    root.querySelectorAll<HTMLButtonElement>('#times button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === state.hour)));
    root.querySelectorAll<HTMLButtonElement>('.seg button[data-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    gameRoot.classList.toggle('chalk-mode', state.mode === 'chalk');
    gameRoot.setAttribute('data-sheet', state.sheetState);
    const stars = computeStars(state.errors, state.hintsUsed);
    starsDisplay.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    timerDisplay.hidden = !getSettings().showTimer;
    if (!timerDisplay.hidden) timerDisplay.textContent = formatElapsed(state.elapsed);
    renderSubtools();
    renderSheet();
    renderHint();
    draw();
  }

  const unsubscribe = store.subscribe(renderAll);
  renderLegend();
  renderAll();
  options.onReady?.(store, plan);

  // Guardado automático con 300 ms de retardo tras cada acción, y al momento
  // si se oculta la pestaña (§18), para no perder el progreso al recargar.
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function flushSave(): void {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    // El tutorial no se guarda como "caso en curso": no está en ningún banco,
    // así que "Seguir el caso" no podría volver a abrirlo (§18).
    if (caseData.id === TUTORIAL_CASE_ID) return;
    saveGame(caseData.id, caseData.mode, store.getState(), startedAt);
  }
  const unsaveSubscribe = store.subscribe(() => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 300);
  });
  function onVisibilityChange(): void {
    if (document.hidden) flushSave();
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  // Atajos de teclado (§17.9): 1-6 elige sospechoso (Marcar/Ver), espacio
  // cambia la marca (ya lo cubre el keydown de cada sala), [ y ] cambian de
  // hora, z deshace. Se callan mientras la hoja de acusación está abierta
  // (el plano ampliado no cuenta: es la misma mesa de trabajo, solo más grande).
  function onGlobalKeydown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // no pisar atajos del navegador/SO
    if (document.querySelector('.accuse-overlay')) return;
    const state = store.getState();
    if (e.key === 'z') {
      store.undo();
      return;
    }
    if (e.key === '[') {
      store.setHour(Math.max(0, state.hour - 1));
      return;
    }
    if (e.key === ']') {
      store.setHour(Math.min(caseData.T - 1, state.hour + 1));
      return;
    }
    if (state.mode === 'chalk') return;
    if (!/^[1-6]$/.test(e.key)) return;
    const index = Number(e.key) - 1;
    if (index >= suspects.length) return;
    if (state.mode === 'mark') store.selectSuspect(index);
    else store.setFilter(state.filter?.type === 'sus' && state.filter.c === index ? null : { type: 'sus', c: index });
  }
  document.addEventListener('keydown', onGlobalKeydown);

  // Cronómetro (§14.2): oculto por defecto, pero se registra igualmente.
  const tickTimer = setInterval(() => store.tick(), 1000);

  let expandCleanup: (() => void) | null = null;
  let closureCleanup: (() => void) | null = null;
  function stopClosure(): void {
    const stop = closureCleanup;
    closureCleanup = null;
    stop?.();
  }
  function openExpandedPlan(): void {
    const overlay = document.createElement('div');
    overlay.className = 'plan-overlay';
    overlay.innerHTML = `
      <button class="icon-btn plan-close" aria-label="Cerrar">✕</button>
      <div class="plan-wrap"><div class="plan"><svg class="map" id="mapSvgExpanded"></svg><canvas class="chalk" id="chalkCanvasExpanded"></canvas></div></div>
      <div class="times" id="timesExpanded" role="group" aria-label="Hora"></div>
    `;
    document.body.appendChild(overlay);
    const svgEl = overlay.querySelector<SVGSVGElement>('#mapSvgExpanded');
    const canvasEl = overlay.querySelector<HTMLCanvasElement>('#chalkCanvasExpanded');
    const timesExpanded = overlay.querySelector<HTMLDivElement>('#timesExpanded');
    if (!svgEl || !canvasEl || !timesExpanded) return;
    const expandedPlan = buildPlan(svgEl, map, { interactive: true, crimeRoom: caseData.rv, victimLabel: victimName });
    const expandedChalk = setupChalk(canvasEl, expandedPlan.width, expandedPlan.height, store);
    expandedPlan.hits.forEach((hit) => {
      const room = Number(hit.dataset.r);
      hit.addEventListener('click', () => roomTap(room));
    });
    for (let t = 0; t < caseData.T; t++) {
      const button = document.createElement('button');
      button.textContent = timeLabel(t) + (t === caseData.td ? ' †' : '');
      if (t === caseData.td) button.classList.add('td');
      button.addEventListener('click', () => store.setHour(t));
      timesExpanded.appendChild(button);
    }
    const redrawExpanded = (): void => {
      const state = store.getState();
      expandedPlan.setCrime(state.hour === caseData.td);
      expandedPlan.marks((room, suspect) => (state.marks.get(markKey(state.hour, room, suspect)) ?? 0) as MarkValue, suspects, state.hour);
      overlay.querySelectorAll<HTMLButtonElement>('#timesExpanded button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === state.hour)));
      overlay.classList.toggle('chalk-mode', state.mode === 'chalk');
      expandedChalk.redraw();
    };
    const unsub = store.subscribe(redrawExpanded);
    redrawExpanded();
    const close = (): void => {
      unsub();
      expandedChalk.destroy();
      overlay.remove();
      expandCleanup = null;
    };
    overlay.querySelector('.plan-close')?.addEventListener('click', close);
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    expandCleanup = () => {
      document.removeEventListener('keydown', onKey);
      close();
    };
  }

  function cleanup(): void {
    unsubscribe();
    unsaveSubscribe();
    if (saveTimer) clearTimeout(saveTimer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.removeEventListener('keydown', onGlobalKeydown);
    clearInterval(tickTimer);
    chalk.destroy();
    expandCleanup?.();
    stopClosure();
  }

  // Expediente (§13): el presupuesto de errores es de las 3 noches juntas, no
  // de esta sola; una acusación errónea gasta el presupuesto COMPARTIDO
  // (game/expediente.ts), y solo se archiva la noche (con store.forceArchive(),
  // ya que esta noche por sí sola nunca lo hace: ver el maxErrors de arriba)
  // cuando se agota para toda la serie.
  function handleExpedienteOutcome(outcome: AccusationOutcome): void {
    if (outcome.correct) {
      showClosure();
      return;
    }
    const progress = loadSeriesProgress();
    if (!progress) {
      toast('No encaja con los hechos.');
      return;
    }
    const updated = registerSeriesError(progress);
    if (updated.done) {
      store.forceArchive();
      showClosure();
      return;
    }
    toast(`No encaja con los hechos. Quedan ${updated.errorsLeft} acusación${updated.errorsLeft === 1 ? '' : 'es'} para todo el expediente.`);
  }

  const EXPEDIENTE_NIGHTS = 3;

  function showClosure(): void {
    const finalState = store.getState();
    cleanup();
    clearSavedGame();
    if (options.bankVersion) markPlayed(options.bankVersion, caseData.id);
    // Progresión (§16): cada caso RESUELTO (no un archivado sin resolver)
    // cuenta para el rango, los recuentos por nivel y el archivo de
    // arquetipos, sea cual sea el modo (suelto, diario o una noche de
    // expediente). El tutorial es la única excepción: no cuenta en las
    // estadísticas (game/tutorial.ts).
    if (finalState.result === 'solved' && caseData.id !== TUTORIAL_CASE_ID) {
      const { profile, newArchetypes } = recordClosure(getProfile(), {
        caseData,
        stars: computeStars(finalState.errors, finalState.hintsUsed),
        errors: finalState.errors,
        elapsed: finalState.elapsed,
      });
      saveProfile(profile);
      if (newArchetypes.length > 0) {
        const labels = newArchetypes.map((a) => ARCHETYPE_LABELS[a]);
        const joined = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
        toast(`Nuevo en tu archivo: ${joined}.`);
      }
    }
    if (caseData.mode === 'diario') {
      recordDailyResult(todayKey(), {
        stars: computeStars(finalState.errors, finalState.hintsUsed),
        errors: finalState.errors,
        hints: finalState.hintsUsed,
        time: finalState.elapsed,
      });
    }
    if (caseData.mode === 'expediente' && finalState.result === 'solved') {
      const progress = loadSeriesProgress();
      if (progress) completeNight(progress, computeStars(finalState.errors, finalState.hintsUsed), EXPEDIENTE_NIGHTS);
    }
    closureCleanup = renderClosure(root, map, caseData, textCtx, suspects, store, {
      onNext: () => {
        stopClosure();
        options.onNextCase(caseData);
      },
      onBackToLanding: () => {
        stopClosure();
        options.onExit();
      },
    });
  }

  return cleanup;
}
