import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nextHint } from '../../src/game/hints';
import { createGameStore } from '../../src/game/store';
import type { GameState } from '../../src/game/store';
import type { CaseDef, Step } from '../../src/engine/types';

/** Sin esto, "Autocompletar tabla" (activado por defecto) rellenaría con ✗ el
 * resto de la fila/columna en una rejilla de 3x3: con N tan pequeño casi toda
 * la tabla quedaría tocada por un solo clic, y las pruebas de abajo necesitan
 * control exacto de qué celda queda marcada. */
class FixedStorage {
  getItem(): string {
    return JSON.stringify({ autoGrid: false });
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

beforeAll(() => {
  // @ts-expect-error se sustituye por una implementación en memoria solo para esta prueba
  globalThis.localStorage = new FixedStorage();
});
afterAll(() => {
  // @ts-expect-error localStorage no existe en el entorno de pruebas por defecto (Node)
  delete globalThis.localStorage;
});

// Cadena sintética, independiente del solver real, pensada para probar el
// algoritmo de la pista (§15.1) con control total sobre premisas/conclusiones:
// step0 y step1 son "intermedios" (reducen posibilidades de objeto sin fijar
// una sola persona), imposibles de reflejar solo con una marca directa; step2
// sí fija un objeto y depende de step1, que depende de step0.
const STEPS: Step[] = [
  { lv: 1, rule: 'R1_NCARRY', cl: [], concl: [{ k: 'notCarry', c: 1, o: 0 }], prem: [], crit: true },
  { lv: 4, rule: 'R4_OBJ_WHERE', cl: [], concl: [{ k: 'notCarry', c: 1, o: 1 }], prem: [0], crit: true },
  { lv: 5, rule: 'R5_OBJ_SINGLE', cl: [], concl: [{ k: 'carry', c: 1, o: 2 }], prem: [1], crit: true },
];

const CASE: CaseDef = {
  v: 2,
  id: 'TEST-HINT',
  mode: 'novato',
  diff: 0,
  map: 'mansion',
  cast: [0, 1, 2],
  objects: [0, 1, 2],
  victim: 0,
  motive: 0,
  N: 3,
  T: 2,
  rv: 0,
  td: 1,
  culprit: 0,
  weapon: 2,
  truth: { rooms: [[0, 0], [1, 1], [2, 0]], obj: [0, 2, 1] },
  clues: [],
  solve: { steps: STEPS, key: 0, arch: [], maxLv: 5, score: 20 },
  sig: 'test',
};
const ROOM_COUNT = 8;

function createStore() {
  return createGameStore(CASE, ROOM_COUNT, (caseData, roomCount, state) => nextHint(caseData, roomCount, state as GameState));
}

describe('game/hints: nextHint (§15.1)', () => {
  it('sin marcas, la pista es el primer paso de la cadena', () => {
    const hint = nextHint(CASE, ROOM_COUNT, createStore().getState());
    expect(hint).toEqual({ kind: 'step', stepIndex: 0 });
  });

  it('un paso intermedio (reduce sin fijar) cuenta como reflejado si su dependiente ya lo está', () => {
    const store = createStore();
    // Marca directamente la conclusión de step2 (carry(1,2)): step0 y step1 no
    // tienen marca propia, pero dependen (transitivamente) de step2.
    store.cycleObjGrid(2, 1);
    const hint = nextHint(CASE, ROOM_COUNT, store.getState());
    expect(hint).toEqual({ kind: 'done' });
  });

  it('si solo se refleja el primer paso, la pista pasa al segundo', () => {
    const store = createStore();
    store.cycleObjGrid(0, 1); // primer toque: ✓
    store.cycleObjGrid(0, 1); // segundo toque: ✗ (notCarry(1,0) directo)
    const hint = nextHint(CASE, ROOM_COUNT, store.getState());
    expect(hint).toEqual({ kind: 'step', stepIndex: 1 });
  });

  it('marca de sala equivocada (✓ donde no estaba) da una pista de revisión de marcas antes que cualquier paso', () => {
    const store = createStore();
    // Verdad: suspect 1 está en sala 1 a la hora 0 (truth.rooms[1][0] = 1). Marcar ✓ en otra sala es falso.
    store.selectSuspect(1);
    store.setHour(0);
    store.mark(5); // ✓ en la sala 5, pero de verdad estaba en la 1: marca errónea
    const hint = nextHint(CASE, ROOM_COUNT, store.getState());
    expect(hint).toEqual({ kind: 'markError', hour: 0, room: 5, obj: null, suspect: 1 });
  });

  it('marca de sala equivocada (✗ donde sí estaba) también se detecta', () => {
    const store = createStore();
    store.selectSuspect(1);
    store.setHour(0);
    store.mark(1); // ✓ en la sala correcta
    store.mark(1); // segundo toque: ✗ en la sala donde sí estaba: marca errónea
    const hint = nextHint(CASE, ROOM_COUNT, store.getState());
    expect(hint).toEqual({ kind: 'markError', hour: 0, room: 1, obj: null, suspect: 1 });
  });

  it('marca errónea en la tabla de objetos se detecta (sin hora asociada)', () => {
    const store = createStore();
    // Verdad: truth.obj[1] = 2 (el sospechoso 1 lleva el objeto 2). Marcar que lleva el 0 es falso.
    store.cycleObjGrid(0, 1); // ✓ para objeto 0, sospechoso 1: falso
    const hint = nextHint(CASE, ROOM_COUNT, store.getState());
    expect(hint).toEqual({ kind: 'markError', hour: null, room: null, obj: 0, suspect: 1 });
  });

  it('descartar al culpable de verdad se detecta como marca errónea', () => {
    const store = createStore();
    store.discardSuspect(CASE.culprit);
    const hint = nextHint(CASE, ROOM_COUNT, store.getState());
    expect(hint).toEqual({ kind: 'markError', hour: null, room: null, obj: null, suspect: CASE.culprit });
  });

  it('con todo reflejado y sin errores, la pista es "done"', () => {
    const store = createStore();
    store.cycleObjGrid(2, 1); // refleja los 3 pasos (directo + transitividad)
    const hint = nextHint(CASE, ROOM_COUNT, store.getState());
    expect(hint).toEqual({ kind: 'done' });
  });
});

describe('game/store: requestHint/explainHint (§14.1, §15.1)', () => {
  it('pedir una pista nueva cuesta 1 estrella; volver a pedir la misma no cobra otra vez', () => {
    const store = createStore();
    expect(store.getState().hintsUsed).toBe(0);
    store.requestHint();
    expect(store.getState().hintsUsed).toBe(1);
    expect(store.getState().hint).toEqual({ kind: 'step', stepIndex: 0 });
    store.requestHint();
    expect(store.getState().hintsUsed).toBe(1);
  });

  it('cuando la pista cambia (porque se reflejó algo), la siguiente sí cobra', () => {
    const store = createStore();
    store.requestHint();
    expect(store.getState().hintsUsed).toBe(1);
    store.cycleObjGrid(0, 1);
    store.cycleObjGrid(0, 1); // step0 reflejado directamente: la pista pasa a step1
    store.requestHint();
    expect(store.getState().hintsUsed).toBe(2);
    expect(store.getState().hint).toEqual({ kind: 'step', stepIndex: 1 });
  });

  it('explainHint no cuesta estrella adicional', () => {
    const store = createStore();
    store.requestHint();
    expect(store.getState().hintsUsed).toBe(1);
    store.explainHint();
    expect(store.getState().hintsUsed).toBe(1);
    expect(store.getState().hintExplained).toBe(true);
  });
});
