// Estado del juego + acciones puras + suscripción (§19.3). Un único store por
// partida; la UI se suscribe y repinta solo lo afectado. No usa el DOM.
import type { CaseDef, Hour, Obj, Room, Sus } from '../engine/types';
// Import de solo tipos: game/hints.ts importa markKey/objGridKey/GameState de
// aquí, así que un import "de verdad" de vuelta crearía un ciclo. nextHint()
// se recibe como dependencia en createGameStore() en vez de importarse.
import type { Hint } from './hints';
import type { AccusationOutcome, CaseResult } from './scoring';
import { checkAccusation } from './scoring';
import { getSettings } from './storage';

export type MarkValue = 0 | 1 | 2; // 0 = sin marca, 1 = ✓ (estaba), 2 = ✗ (no estaba)
export type BoardMode = 'mark' | 'chalk' | 'view';
// Solo 3 colores de tiza (§17.5: "tinta, ámbar, rojo"): no se añaden más.
export type ChalkColor = 'ink' | 'amber' | 'pencil';
export type SheetTab = 'pistas' | 'objetos' | 'caso';
export type SheetState = 'media' | 'desplegada';
export type ViewFilter = { type: 'sus'; c: Sus } | { type: 'room'; r: Room } | null;

export interface ChalkStroke {
  color: ChalkColor;
  /** Hora a la que pertenece el trazo, o 'all' si se dibujó "en todas las horas". */
  hour: Hour | 'all';
  points: [number, number][];
}

export interface GameState {
  caseData: CaseDef;
  hour: Hour;
  mode: BoardMode;
  /** clave `${hora}:${sala}:${sospechoso}` → marca. */
  marks: Map<string, MarkValue>;
  strokes: ChalkStroke[];
  selectedSuspect: Sus;
  filter: ViewFilter;
  chalkColor: ChalkColor;
  eraseMode: boolean;
  allLayer: boolean;
  sheetState: SheetState;
  sheetTab: SheetTab;
  planExpanded: boolean;
  elapsed: number;
  /** Pistas tachadas (§17.6): índice en `caseData.clues`. */
  struck: Set<number>;
  /** Pista enfocada (§17.6), o null si ninguna. */
  clueFocus: number | null;
  /** Sospechosos descartados (§17.8). */
  discarded: Set<Sus>;
  /** Tabla de objetos (§17.7): clave `${objeto}:${sospechoso}` → marca. */
  objGrid: Map<string, MarkValue>;
  accuseCulprit: Sus | null;
  accuseWeapon: Obj | null;
  errors: number;
  result: CaseResult;
  /** Pistas del inspector solicitadas (M6); ya cuenta para las estrellas (§14.1). */
  hintsUsed: number;
  /** Pista actual (§15), o null si no se ha pedido ninguna todavía. */
  hint: Hint | null;
  /** Fase 2 ("Explícamelo", gratis) ya mostrada para `hint` (§15.1). */
  hintExplained: boolean;
}

function hintsEqual(a: Hint | null, b: Hint): boolean {
  if (!a || a.kind !== b.kind) return false;
  if (a.kind === 'step' && b.kind === 'step') return a.stepIndex === b.stepIndex;
  if (a.kind === 'markError' && b.kind === 'markError') {
    return a.hour === b.hour && a.room === b.room && a.obj === b.obj && a.suspect === b.suspect;
  }
  return true; // los dos son 'done'
}

type UndoAction =
  | { k: 'mark'; key: string; prev: MarkValue }
  | { k: 'stroke'; stroke: ChalkStroke }
  | { k: 'unstroke'; stroke: ChalkStroke }
  | { k: 'strokes'; strokes: ChalkStroke[] }
  | { k: 'objgrid'; prev: [string, MarkValue][] }
  | { k: 'discard'; c: Sus; prev: boolean }
  | { k: 'strike'; i: number; prev: boolean };

type Listener = () => void;

export function markKey(t: Hour, r: Room, c: Sus): string {
  return `${t}:${r}:${c}`;
}

export function objGridKey(o: Obj, c: Sus): string {
  return `${o}:${c}`;
}

export interface GameStore {
  getState(): GameState;
  subscribe(listener: Listener): () => void;
  setHour(hour: Hour): void;
  setMode(mode: BoardMode): void;
  selectSuspect(c: Sus): void;
  setFilter(filter: ViewFilter): void;
  mark(room: Room): void;
  setChalkColor(color: ChalkColor): void;
  setEraseMode(on: boolean): void;
  setAllLayer(on: boolean): void;
  addStroke(stroke: ChalkStroke): void;
  eraseStrokeNear(point: [number, number], radius: number): void;
  clearHourStrokes(): void;
  undo(): void;
  toggleSheet(): void;
  setSheetTab(tab: SheetTab): void;
  setPlanExpanded(on: boolean): void;
  tick(): void;
  toggleStrike(clueIndex: number): void;
  focusClue(clueIndex: number | null): void;
  discardSuspect(c: Sus): void;
  cycleObjGrid(o: Obj, c: Sus): void;
  setAccuseCulprit(c: Sus | null): void;
  setAccuseWeapon(o: Obj | null): void;
  accuse(): AccusationOutcome;
  requestHint(): void;
  explainHint(): void;
  /** Restaura el caso en curso (§18, hm2:game) al reabrir la web. */
  hydrate(saved: {
    hour: Hour;
    marks: [string, MarkValue][];
    objGrid: [string, MarkValue][];
    discarded: Sus[];
    struck: number[];
    strokes: ChalkStroke[];
    errors: number;
    hintsUsed: number;
    elapsed: number;
  }): void;
}

export function createGameStore(caseData: CaseDef, roomCount: number, computeHint: (caseData: CaseDef, roomCount: number, state: GameState) => Hint): GameStore {
  const state: GameState = {
    caseData,
    hour: 0,
    mode: 'mark',
    marks: new Map(),
    strokes: [],
    selectedSuspect: 0,
    filter: null,
    chalkColor: 'ink',
    eraseMode: false,
    allLayer: false,
    sheetState: 'media',
    sheetTab: 'pistas',
    planExpanded: false,
    elapsed: 0,
    struck: new Set(),
    clueFocus: null,
    discarded: new Set(),
    objGrid: new Map(),
    accuseCulprit: null,
    accuseWeapon: null,
    errors: 0,
    result: 'playing',
    hintsUsed: 0,
    hint: null,
    hintExplained: false,
  };
  const undoStack: UndoAction[] = [];
  const listeners = new Set<Listener>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function distanceTo(points: [number, number][], point: [number, number]): number {
    let best = Infinity;
    for (const p of points) {
      const d = Math.hypot(p[0] - point[0], p[1] - point[1]);
      if (d < best) best = d;
    }
    return best;
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setHour(hour) {
      state.hour = hour;
      notify();
    },
    setMode(mode) {
      state.mode = mode;
      state.filter = null;
      notify();
    },
    selectSuspect(c) {
      state.selectedSuspect = c;
      notify();
    },
    setFilter(filter) {
      state.filter = filter;
      notify();
    },
    mark(room) {
      if (state.mode !== 'mark') return;
      const key = markKey(state.hour, room, state.selectedSuspect);
      const prev = state.marks.get(key) ?? 0;
      const next = ((prev + 1) % 3) as MarkValue;
      if (next === 0) state.marks.delete(key);
      else state.marks.set(key, next);
      undoStack.push({ k: 'mark', key, prev });
      notify();
    },
    setChalkColor(color) {
      state.chalkColor = color;
      state.eraseMode = false;
      notify();
    },
    setEraseMode(on) {
      state.eraseMode = on;
      notify();
    },
    setAllLayer(on) {
      state.allLayer = on;
      notify();
    },
    addStroke(stroke) {
      state.strokes.push(stroke);
      undoStack.push({ k: 'stroke', stroke });
      notify();
    },
    eraseStrokeNear(point, radius) {
      let closest: ChalkStroke | null = null;
      let closestDist = radius;
      for (const stroke of state.strokes) {
        if (stroke.hour !== 'all' && stroke.hour !== state.hour) continue;
        const d = distanceTo(stroke.points, point);
        if (d < closestDist) {
          closestDist = d;
          closest = stroke;
        }
      }
      if (!closest) return;
      state.strokes = state.strokes.filter((s) => s !== closest);
      undoStack.push({ k: 'unstroke', stroke: closest });
      notify();
    },
    clearHourStrokes() {
      const removed = state.strokes.filter((s) => s.hour === state.hour);
      if (removed.length === 0) return;
      state.strokes = state.strokes.filter((s) => s.hour !== state.hour);
      undoStack.push({ k: 'strokes', strokes: removed });
      notify();
    },
    undo() {
      const action = undoStack.pop();
      if (!action) return;
      if (action.k === 'mark') {
        if (action.prev === 0) state.marks.delete(action.key);
        else state.marks.set(action.key, action.prev);
      } else if (action.k === 'stroke') {
        state.strokes = state.strokes.filter((s) => s !== action.stroke);
      } else if (action.k === 'unstroke') {
        state.strokes = state.strokes.concat(action.stroke);
      } else if (action.k === 'strokes') {
        state.strokes = state.strokes.concat(action.strokes);
      } else if (action.k === 'objgrid') {
        for (const [key, prev] of action.prev) {
          if (prev === 0) state.objGrid.delete(key);
          else state.objGrid.set(key, prev);
        }
      } else if (action.k === 'discard') {
        if (action.prev) state.discarded.add(action.c);
        else state.discarded.delete(action.c);
      } else {
        if (action.prev) state.struck.add(action.i);
        else state.struck.delete(action.i);
      }
      notify();
    },
    toggleSheet() {
      state.sheetState = state.sheetState === 'media' ? 'desplegada' : 'media';
      notify();
    },
    setSheetTab(tab) {
      state.sheetTab = tab;
      state.sheetState = 'media';
      notify();
    },
    setPlanExpanded(on) {
      state.planExpanded = on;
      notify();
    },
    tick() {
      state.elapsed += 1;
      notify();
    },
    toggleStrike(clueIndex) {
      const prev = state.struck.has(clueIndex);
      if (prev) state.struck.delete(clueIndex);
      else state.struck.add(clueIndex);
      undoStack.push({ k: 'strike', i: clueIndex, prev });
      notify();
    },
    focusClue(clueIndex) {
      state.clueFocus = clueIndex;
      if (clueIndex !== null) state.sheetState = 'media';
      notify();
    },
    discardSuspect(c) {
      const prev = state.discarded.has(c);
      if (prev) state.discarded.delete(c);
      else state.discarded.add(c);
      undoStack.push({ k: 'discard', c, prev });
      notify();
    },
    cycleObjGrid(o, c) {
      const key = objGridKey(o, c);
      const prev = (state.objGrid.get(key) ?? 0) as MarkValue;
      const next = ((prev + 1) % 3) as MarkValue;
      const touched: [string, MarkValue][] = [[key, prev]];
      const setCell = (k: string, v: MarkValue): void => {
        if (!touched.some(([tk]) => tk === k)) touched.push([k, (state.objGrid.get(k) ?? 0) as MarkValue]);
        if (v === 0) state.objGrid.delete(k);
        else state.objGrid.set(k, v);
      };
      setCell(key, next);
      // "Autocompletar tabla" (§17.7, activado por defecto): al poner ✓ se
      // rellena con ✗ el resto de la fila y de la columna. Es mecánica, no
      // deducción: cada objeto tiene un único portador y viceversa.
      if (next === 1 && getSettings().autoGrid) {
        for (let cc = 0; cc < state.caseData.N; cc++) if (cc !== c) setCell(objGridKey(o, cc), 2);
        for (let oo = 0; oo < state.caseData.N; oo++) if (oo !== o) setCell(objGridKey(oo, c), 2);
      }
      undoStack.push({ k: 'objgrid', prev: touched });
      notify();
    },
    setAccuseCulprit(c) {
      state.accuseCulprit = c;
      notify();
    },
    setAccuseWeapon(o) {
      state.accuseWeapon = o;
      notify();
    },
    accuse() {
      if (state.accuseCulprit === null || state.accuseWeapon === null) {
        return { correct: false, errors: state.errors, result: state.result };
      }
      const outcome = checkAccusation(state.caseData, state.accuseCulprit, state.accuseWeapon, state.errors);
      state.errors = outcome.errors;
      state.result = outcome.result;
      notify();
      return outcome;
    },
    requestHint() {
      const hint = computeHint(state.caseData, roomCount, state);
      // La misma pista que ya se estaba mostrando no vuelve a cobrar estrella
      // (§14.1 no lo dice explícitamente, pero cobrar por pedir de nuevo un
      // aviso sin haber cambiado nada sería castigar releerlo, no pedir ayuda
      // nueva; ver docs/DECISIONES.md).
      if (!hintsEqual(state.hint, hint)) {
        state.hint = hint;
        state.hintExplained = false;
        if (hint.kind !== 'done') state.hintsUsed += 1;
      }
      notify();
    },
    explainHint() {
      state.hintExplained = true;
      notify();
    },
    hydrate(saved) {
      state.hour = saved.hour;
      state.marks = new Map(saved.marks);
      state.objGrid = new Map(saved.objGrid);
      state.discarded = new Set(saved.discarded);
      state.struck = new Set(saved.struck);
      state.strokes = saved.strokes;
      state.errors = saved.errors;
      state.hintsUsed = saved.hintsUsed;
      state.elapsed = saved.elapsed;
      notify();
    },
  };
}
