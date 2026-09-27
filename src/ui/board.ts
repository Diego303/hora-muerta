// Mesa de trabajo (§17.3): orquesta plano, tiza, horas, herramientas, hoja
// inferior (pistas, objetos, caso) y el bucle acusación → cierre → siguiente
// caso sobre un GameStore.
import { VICTIMS } from '../engine/content/cast';
import { MAPS } from '../engine/content/maps';
import { buildTextContext } from '../engine/generate';
import { timeLabel } from '../engine/text';
import type { CaseDef, MapDef, Room } from '../engine/types';
import { computeStars } from '../game/scoring';
import type { ChalkColor, MarkValue } from '../game/store';
import { createGameStore, markKey } from '../game/store';
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

const CHALK_SWATCHES: { color: ChalkColor; label: string }[] = [
  { color: 'ink', label: 'Tinta' },
  { color: 'amber', label: 'Ámbar' },
  { color: 'pencil', label: 'Rojo' },
];

export function renderBoard(root: HTMLElement, caseData: CaseDef, options: BoardOptions): () => void {
  const map = findMap(caseData.map);
  const textCtx = buildTextContext(map, caseData.cast, caseData.objects);
  const suspects: SuspectView[] = textCtx.suspects.map((s) => ({ name: s.name, init: s.name[0], color: s.color }));
  const store = createGameStore(caseData);

  root.innerHTML = `
    <div class="game" id="gameRoot" data-case-id="${caseData.id}">
      <div class="gbar">
        <button class="icon-btn" id="exit" aria-label="Volver a la portada">←</button>
        <div class="ttl"><b>${map.name}</b></div>
        <div class="stars" id="starsDisplay">★★★</div>
      </div>
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
      <div class="sheet-panel" id="sheetPanel">
        <button class="sheet-handle" id="sheetHandle" aria-label="Subir o bajar la hoja"><i></i></button>
        <div class="sheet-tabs" role="tablist">
          <button data-tab="pistas" aria-pressed="true">Pistas</button>
          <button data-tab="objetos" aria-pressed="false">Objetos</button>
          <button data-tab="caso" aria-pressed="false">Caso</button>
        </div>
        <div class="sheet-body" id="sheetBody"></div>
      </div>
      <div class="actionbar">
        <button class="btn ghost" id="hintBtn">Pista</button>
        <button class="btn" id="accuseBtn">Acusar</button>
      </div>
    </div>
  `;

  const gameRoot = requireEl<HTMLDivElement>(root, '#gameRoot');
  const starsDisplay = requireEl<HTMLDivElement>(root, '#starsDisplay');
  const briefEl = requireEl<HTMLButtonElement>(root, '#brief');
  const mapSvg = requireEl<SVGSVGElement>(root, '#mapSvg');
  const chalkCanvas = requireEl<HTMLCanvasElement>(root, '#chalkCanvas');
  const timesEl = requireEl<HTMLDivElement>(root, '#times');
  const subtoolsEl = requireEl<HTMLDivElement>(root, '#subtools');
  const hintEl = requireEl<HTMLParagraphElement>(root, '#hint');
  const legendEl = requireEl<HTMLDivElement>(root, '#legend');
  const sheetBody = requireEl<HTMLDivElement>(root, '#sheetBody');

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
      }
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
  root.querySelector('#hintBtn')?.addEventListener('click', () => toast('La pista del inspector llega en el hito M6.'));
  root.querySelector('#accuseBtn')?.addEventListener('click', () => {
    openAccuseSheet(textCtx, store, () => showClosure());
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

  function renderSheet(): void {
    const state = store.getState();
    root.querySelectorAll<HTMLButtonElement>('.sheet-tabs button[data-tab]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.tab === state.sheetTab));
    });
    if (state.sheetTab === 'pistas') {
      renderClueList(sheetBody, caseData.clues, textCtx, store);
    } else if (state.sheetTab === 'objetos') {
      renderObjectsTable(sheetBody, textCtx, store);
    } else {
      renderCaseTab(sheetBody, map, caseData, textCtx, store);
    }
  }

  function draw(): void {
    const state = store.getState();
    plan.setCrime(state.hour === caseData.td);
    plan.marks((room, suspect) => (state.marks.get(markKey(state.hour, room, suspect)) ?? 0) as MarkValue, suspects);

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
    plan.highlight(highlightRooms);

    const prevHour = state.hour > 0 ? state.hour - 1 : null;
    const nextHour = state.hour < caseData.T - 1 ? state.hour + 1 : null;
    plan.trail(
      prevHour === null ? null : (room, suspect) => (state.marks.get(markKey(prevHour, room, suspect)) ?? 0) as MarkValue,
      nextHour === null ? null : (room, suspect) => (state.marks.get(markKey(nextHour, room, suspect)) ?? 0) as MarkValue,
      suspects,
    );

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
    renderSubtools();
    renderSheet();
    draw();
  }

  const unsubscribe = store.subscribe(renderAll);
  renderLegend();
  renderAll();

  let expandCleanup: (() => void) | null = null;
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
      expandedPlan.marks((room, suspect) => (state.marks.get(markKey(state.hour, room, suspect)) ?? 0) as MarkValue, suspects);
      overlay.querySelectorAll<HTMLButtonElement>('#timesExpanded button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === state.hour)));
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
    chalk.destroy();
    expandCleanup?.();
  }

  function showClosure(): void {
    cleanup();
    let closureCleanup: (() => void) | null = null;
    closureCleanup = renderClosure(root, map, caseData, textCtx, suspects, store, {
      onNext: () => {
        closureCleanup?.();
        options.onNextCase(caseData);
      },
      onBackToLanding: () => {
        closureCleanup?.();
        options.onExit();
      },
    });
  }

  return cleanup;
}
