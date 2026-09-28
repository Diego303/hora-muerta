import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearSavedGame, loadSavedGame, saveGame } from '../../src/game/session';
import { createGameStore, markKey, objGridKey } from '../../src/game/store';
import type { CaseDef } from '../../src/engine/types';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
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

function newStore() {
  return createGameStore(CASE, 8, () => ({ kind: 'done' }));
}

describe('game/session: hm2:game, caso en curso (§18)', () => {
  beforeEach(() => {
    // @ts-expect-error se sustituye por una implementación en memoria solo para la prueba
    globalThis.localStorage = new MemoryStorage();
  });
  afterEach(() => {
    // @ts-expect-error localStorage no existe en el entorno de pruebas por defecto (Node)
    delete globalThis.localStorage;
  });

  it('loadSavedGame da null si no hay ningún caso en curso', () => {
    expect(loadSavedGame()).toBeNull();
  });

  it('saveGame guarda el caso, el modo y cuándo se empezó', () => {
    saveGame(CASE.id, CASE.mode, newStore().getState(), 1000);
    const saved = loadSavedGame();
    expect(saved?.caseId).toBe(CASE.id);
    expect(saved?.mode).toBe(CASE.mode);
    expect(saved?.startedAt).toBe(1000);
  });

  it('store.hydrate() restaura exactamente lo guardado en un store nuevo', () => {
    const store1 = newStore();
    store1.selectSuspect(1);
    store1.mark(5); // hora 0 por defecto, sala 5, sospechoso 1: ✓
    store1.cycleObjGrid(0, 1);
    store1.discardSuspect(2);
    store1.toggleStrike(0);
    store1.setHour(2);
    saveGame(CASE.id, CASE.mode, store1.getState(), 500);

    const saved = loadSavedGame();
    expect(saved).not.toBeNull();
    if (!saved) return;

    const store2 = newStore();
    store2.hydrate(saved);
    const state2 = store2.getState();
    expect(state2.hour).toBe(2);
    expect(state2.marks.get(markKey(0, 5, 1))).toBe(1);
    expect(state2.objGrid.get(objGridKey(0, 1))).toBe(1);
    expect(state2.discarded.has(2)).toBe(true);
    expect(state2.struck.has(0)).toBe(true);
  });

  it('clearSavedGame borra el caso en curso', () => {
    saveGame(CASE.id, CASE.mode, newStore().getState(), 1);
    expect(loadSavedGame()).not.toBeNull();
    clearSavedGame();
    expect(loadSavedGame()).toBeNull();
  });
});
