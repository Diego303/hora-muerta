import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameStore, markKey, objGridKey } from '../../src/game/store';
import type { CaseDef } from '../../src/engine/types';

/** localStorage en memoria que siempre devuelve el mismo valor guardado, para
 * forzar un ajuste concreto (p. ej. autoGrid) sin depender de game/storage.ts. */
class FixedStorage {
  constructor(private readonly value: string) {}
  getItem(): string {
    return this.value;
  }
  setItem(): void {
    /* no hace falta guardar nada para esta prueba */
  }
  removeItem(): void {
    /* no hace falta borrar nada para esta prueba */
  }
  clear(): void {
    /* no hace falta limpiar nada para esta prueba */
  }
}

const CASE: CaseDef = {
  v: 2,
  id: 'N-001',
  mode: 'novato',
  diff: 0,
  map: 'mansion',
  cast: [0, 1, 2, 3],
  objects: [0, 1, 2, 3],
  victim: 0,
  motive: 0,
  N: 4,
  T: 3,
  rv: 0,
  td: 1,
  culprit: 0,
  weapon: 0,
  truth: { rooms: [[0, 0, 0], [1, 1, 1], [2, 2, 2], [3, 3, 3]], obj: [0, 1, 2, 3] },
  clues: [],
  solve: { steps: [], key: 0, arch: [], maxLv: 1, score: 0 },
  sig: 'test',
};

/** El algoritmo de pistas (game/hints.ts) tiene sus propias pruebas; aquí basta
 * un `computeHint` fijo, ya que createGameStore lo recibe por dependencia
 * para evitar un ciclo de imports con game/hints.ts (ver docs/DECISIONES.md). */
function createStore() {
  return createGameStore(CASE, 8, () => ({ kind: 'done' }));
}

describe('game/store', () => {
  it('empieza en la hora 0, modo marcar, sin marcas ni trazos', () => {
    const store = createStore();
    const state = store.getState();
    expect(state.hour).toBe(0);
    expect(state.mode).toBe('mark');
    expect(state.marks.size).toBe(0);
    expect(state.strokes).toEqual([]);
    expect(state.sheetState).toBe('media');
  });

  it('mark() rota sin marca -> estaba -> no estaba -> sin marca, para el sospechoso elegido y la hora actual', () => {
    const store = createStore();
    store.selectSuspect(2);
    store.setHour(1);
    const key = markKey(1, 5, 2);
    expect(store.getState().marks.get(key)).toBeUndefined();
    store.mark(5);
    expect(store.getState().marks.get(key)).toBe(1);
    store.mark(5);
    expect(store.getState().marks.get(key)).toBe(2);
    store.mark(5);
    expect(store.getState().marks.get(key)).toBeUndefined();
  });

  it('mark() no hace nada fuera del modo marcar', () => {
    const store = createStore();
    store.setMode('view');
    store.mark(3);
    expect(store.getState().marks.size).toBe(0);
  });

  it('setMode limpia el filtro de Ver al cambiar de modo', () => {
    const store = createStore();
    store.setMode('view');
    store.setFilter({ type: 'room', r: 4 });
    expect(store.getState().filter).toEqual({ type: 'room', r: 4 });
    store.setMode('chalk');
    expect(store.getState().filter).toBeNull();
  });

  it('undo revierte la última marca', () => {
    const store = createStore();
    const key = markKey(0, 5, 0);
    store.mark(5);
    store.mark(5);
    expect(store.getState().marks.get(key)).toBe(2);
    store.undo();
    expect(store.getState().marks.get(key)).toBe(1);
    store.undo();
    expect(store.getState().marks.get(key)).toBeUndefined();
  });

  it('undo sin nada que deshacer no lanza ni cambia el estado', () => {
    const store = createStore();
    expect(() => store.undo()).not.toThrow();
    expect(store.getState().marks.size).toBe(0);
  });

  it('addStroke añade un trazo y undo lo retira', () => {
    const store = createStore();
    store.addStroke({ color: 'ink', hour: 0, points: [[0, 0], [10, 10]] });
    expect(store.getState().strokes).toHaveLength(1);
    store.undo();
    expect(store.getState().strokes).toHaveLength(0);
  });

  it('eraseStrokeNear borra el trazo más cercano dentro del radio, respetando la hora', () => {
    const store = createStore();
    store.addStroke({ color: 'ink', hour: 0, points: [[0, 0]] });
    store.addStroke({ color: 'amber', hour: 1, points: [[0, 0]] });
    store.addStroke({ color: 'pencil', hour: 'all', points: [[100, 100]] });
    // hora actual (0): solo compiten el trazo de hora 0 y el de 'all'.
    store.eraseStrokeNear([0, 0], 5);
    const remaining = store.getState().strokes;
    expect(remaining).toHaveLength(2);
    expect(remaining.some((s) => s.hour === 0)).toBe(false);
    expect(remaining.some((s) => s.hour === 1)).toBe(true);
    expect(remaining.some((s) => s.hour === 'all')).toBe(true);
  });

  it('eraseStrokeNear no borra nada si no hay trazo dentro del radio', () => {
    const store = createStore();
    store.addStroke({ color: 'ink', hour: 0, points: [[0, 0]] });
    store.eraseStrokeNear([500, 500], 5);
    expect(store.getState().strokes).toHaveLength(1);
  });

  it('clearHourStrokes solo borra los trazos de la hora actual, y undo los devuelve', () => {
    const store = createStore();
    store.addStroke({ color: 'ink', hour: 0, points: [[0, 0]] });
    store.addStroke({ color: 'ink', hour: 1, points: [[1, 1]] });
    store.clearHourStrokes();
    expect(store.getState().strokes).toEqual([{ color: 'ink', hour: 1, points: [[1, 1]] }]);
    store.undo();
    expect(store.getState().strokes).toHaveLength(2);
  });

  it('toggleSheet alterna entre media y desplegada; setSheetTab siempre vuelve a media', () => {
    const store = createStore();
    store.toggleSheet();
    expect(store.getState().sheetState).toBe('desplegada');
    store.toggleSheet();
    expect(store.getState().sheetState).toBe('media');
    store.toggleSheet();
    store.setSheetTab('objetos');
    expect(store.getState().sheetTab).toBe('objetos');
    expect(store.getState().sheetState).toBe('media');
  });

  it('subscribe notifica en cada acción y deja de notificar tras darse de baja', () => {
    const store = createStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.setHour(1);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.setHour(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  describe('pistas, objetos y descartes (§17.6-17.8)', () => {
    afterEach(() => {
      // @ts-expect-error localStorage no existe en el entorno de pruebas por defecto (Node)
      delete globalThis.localStorage;
    });

    it('toggleStrike tacha/destacha una pista y undo lo revierte', () => {
      const store = createStore();
      store.toggleStrike(3);
      expect(store.getState().struck.has(3)).toBe(true);
      store.undo();
      expect(store.getState().struck.has(3)).toBe(false);
    });

    it('focusClue fija el foco y devuelve la hoja a estado media', () => {
      const store = createStore();
      store.toggleSheet();
      expect(store.getState().sheetState).toBe('desplegada');
      store.focusClue(2);
      expect(store.getState().clueFocus).toBe(2);
      expect(store.getState().sheetState).toBe('media');
    });

    it('discardSuspect alterna el descarte y undo lo revierte', () => {
      const store = createStore();
      store.discardSuspect(2);
      expect(store.getState().discarded.has(2)).toBe(true);
      store.undo();
      expect(store.getState().discarded.has(2)).toBe(false);
    });

    it('cycleObjGrid rota vacío -> ✓ -> ✗ -> vacío; con autocompletar (por defecto) un ✓ rellena el resto de la fila y la columna con ✗', () => {
      const store = createStore();
      store.cycleObjGrid(0, 1);
      const g = store.getState().objGrid;
      expect(g.get(objGridKey(0, 1))).toBe(1);
      expect(g.get(objGridKey(0, 0))).toBe(2);
      expect(g.get(objGridKey(0, 2))).toBe(2);
      expect(g.get(objGridKey(0, 3))).toBe(2);
      expect(g.get(objGridKey(1, 1))).toBe(2);
      expect(g.get(objGridKey(2, 1))).toBe(2);
      expect(g.get(objGridKey(3, 1))).toBe(2);
      store.cycleObjGrid(0, 1);
      expect(store.getState().objGrid.get(objGridKey(0, 1))).toBe(2);
    });

    it('cycleObjGrid: undo deshace la celda tocada y todo lo autocompletado en el mismo toque', () => {
      const store = createStore();
      store.cycleObjGrid(0, 1);
      store.undo();
      expect(store.getState().objGrid.size).toBe(0);
    });

    it('sin autocompletar (ajuste desactivado), cycleObjGrid solo toca la celda pulsada', () => {
      // @ts-expect-error se sustituye por una implementación en memoria solo para la prueba
      globalThis.localStorage = new FixedStorage(JSON.stringify({ autoGrid: false }));
      const store = createStore();
      store.cycleObjGrid(0, 1);
      const g = store.getState().objGrid;
      expect(g.size).toBe(1);
      expect(g.get(objGridKey(0, 1))).toBe(1);
    });
  });

  describe('acusación (§14.1, §14.3)', () => {
    it('acusar sin haber elegido culpable y arma no cambia el resultado', () => {
      const store = createStore();
      const outcome = store.accuse();
      expect(outcome.correct).toBe(false);
      expect(store.getState().result).toBe('playing');
      expect(store.getState().errors).toBe(0);
    });

    it('una acusación correcta resuelve el caso', () => {
      const store = createStore();
      store.setAccuseCulprit(CASE.culprit);
      store.setAccuseWeapon(CASE.weapon);
      const outcome = store.accuse();
      expect(outcome).toEqual({ correct: true, errors: 0, result: 'solved' });
      expect(store.getState().result).toBe('solved');
    });

    it('dos acusaciones erróneas archivan el caso sin resolver', () => {
      const store = createStore();
      store.setAccuseCulprit((CASE.culprit + 1) % CASE.N);
      store.setAccuseWeapon(CASE.weapon);
      const first = store.accuse();
      expect(first).toEqual({ correct: false, errors: 1, result: 'playing' });
      const second = store.accuse();
      expect(second).toEqual({ correct: false, errors: 2, result: 'archived' });
      expect(store.getState().result).toBe('archived');
    });

    it('con maxErrors=Infinity (una noche de expediente, §13) nunca se archiva sola', () => {
      const store = createGameStore(CASE, 8, () => ({ kind: 'done' }), Number.POSITIVE_INFINITY);
      store.setAccuseCulprit((CASE.culprit + 1) % CASE.N);
      store.setAccuseWeapon(CASE.weapon);
      for (let i = 0; i < 5; i++) {
        const outcome = store.accuse();
        expect(outcome.result).toBe('playing');
      }
      expect(store.getState().result).toBe('playing');
    });

    it('forceArchive cierra la noche como archivada sin pasar por accuse()', () => {
      const store = createGameStore(CASE, 8, () => ({ kind: 'done' }), Number.POSITIVE_INFINITY);
      expect(store.getState().result).toBe('playing');
      store.forceArchive();
      expect(store.getState().result).toBe('archived');
    });
  });
});
