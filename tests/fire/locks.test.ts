import { describe, expect, it } from 'vitest';
import type { CaseDef } from '../../src/engine/types';
import type { Hint } from '../../src/game/hints';
import { createGameStore } from '../../src/game/store';
import type { BoardLocks } from '../../src/game/store';

// Sala 0 a la izquierda del plano (x < 100), sala 1 a la derecha; fuera, null.
function setup(burning: Set<number>, frozen = false) {
  const notices: string[] = [];
  let collapsed = frozen;
  const locks: BoardLocks = {
    roomBurning: (room) => burning.has(room),
    roomAt: (point) => (point[0] < 0 || point[0] > 200 ? null : point[0] < 100 ? 0 : 1),
    frozen: () => collapsed,
    notice: (message) => notices.push(message),
  };
  const caseData = { N: 4, clues: [], mode: 'novato' } as unknown as CaseDef;
  const store = createGameStore(caseData, 2, () => ({ kind: 'done' }) as Hint, Number.POSITIVE_INFINITY, locks);
  return {
    store,
    notices,
    collapse: () => {
      collapsed = true;
    },
  };
}

describe('salas en llamas: no admiten marcas nuevas ni cambios', () => {
  it('se puede marcar una sala fría y no una en llamas, con aviso', () => {
    const burning = new Set<number>();
    const { store, notices } = setup(burning);
    store.mark(0);
    expect(store.getState().marks.size).toBe(1);

    burning.add(1);
    store.mark(1);
    expect(store.getState().marks.size).toBe(1);
    expect(notices).toEqual(['Esa sala está en llamas: ya no se puede anotar.']);
  });

  it('una marca ya hecha en una sala que arde después se ve, pero no se puede cambiar', () => {
    const burning = new Set<number>();
    const { store } = setup(burning);
    store.mark(0);
    burning.add(0);
    store.mark(0);
    expect(store.getState().marks.get('0:0:0')).toBe(1);
  });
});

describe('deshacer: si afecta a una sala en llamas, la entrada se descarta con aviso', () => {
  it('una marca de una sala que ya arde no se deshace, y se avisa', () => {
    const burning = new Set<number>();
    const { store, notices } = setup(burning);
    store.mark(0);
    burning.add(0);
    store.undo();
    expect(store.getState().marks.get('0:0:0')).toBe(1);
    expect(notices).toEqual(['Esa acción afecta a una sala en llamas y no se puede deshacer.']);
  });

  it('deshacer una marca de una sala fría sí funciona', () => {
    const burning = new Set<number>();
    const { store, notices } = setup(burning);
    store.mark(0);
    store.undo();
    expect(store.getState().marks.size).toBe(0);
    expect(notices).toEqual([]);
  });

  it('la entrada descartada sale de la pila: el siguiente deshacer toca la anterior', () => {
    const burning = new Set<number>();
    const { store } = setup(burning);
    store.mark(0);
    store.mark(1);
    burning.add(1);
    store.undo();
    burning.clear();
    store.undo();
    expect(store.getState().marks.has('0:0:0')).toBe(false);
    expect(store.getState().marks.has('0:1:0')).toBe(true);
  });
});

describe('tiza: no se empieza un trazo en una sala en llamas, pero la goma sí funciona', () => {
  it('se puede empezar un trazo fuera de las salas en llamas', () => {
    const { store, notices } = setup(new Set([0]));
    expect(store.requestStroke([150, 40])).toBe(true);
    expect(store.requestStroke([300, 40])).toBe(true);
    expect(notices).toEqual([]);
  });

  it('no se empieza un trazo dentro de una sala en llamas, y se avisa', () => {
    const { store, notices } = setup(new Set([0]));
    expect(store.requestStroke([20, 40])).toBe(false);
    expect(notices).toEqual(['Esa sala está en llamas: no se puede dibujar ahí.']);
  });

  it('un trazo que ya estaba se puede borrar con la goma aunque su sala arda', () => {
    const burning = new Set<number>();
    const { store } = setup(burning);
    store.addStroke({ color: 'ink', hour: 0, points: [[20, 40], [30, 40]] });
    burning.add(0);
    store.eraseStrokeNear([25, 40], 14);
    expect(store.getState().strokes).toHaveLength(0);
  });

  it('deshacer un trazo que empezaba en una sala que ya arde se descarta con aviso', () => {
    const burning = new Set<number>();
    const { store, notices } = setup(burning);
    store.addStroke({ color: 'ink', hour: 0, points: [[20, 40], [30, 40]] });
    burning.add(0);
    store.undo();
    expect(store.getState().strokes).toHaveLength(1);
    expect(notices).toEqual(['Esa acción afecta a una sala en llamas y no se puede deshacer.']);
  });
});

describe('derrumbe: el tablero queda congelado', () => {
  it('no se marca, no se traza, no se deshace y no se acusa', () => {
    const { store, notices, collapse } = setup(new Set(), false);
    store.mark(0);
    collapse();
    store.mark(1);
    expect(store.getState().marks.size).toBe(1);
    expect(store.requestStroke([150, 40])).toBe(false);
    store.undo();
    expect(store.getState().marks.size).toBe(1);
    store.setAccuseCulprit(0);
    store.setAccuseWeapon(0);
    expect(store.accuse()).toEqual({ correct: false, errors: 0, result: 'playing' });
    expect(notices).toContain('El edificio se ha derrumbado.');
  });
});

describe('sin bloqueos, el store se comporta como antes', () => {
  it('marcar, deshacer y trazar no avisan de nada', () => {
    const caseData = { N: 4, clues: [], mode: 'novato' } as unknown as CaseDef;
    const store = createGameStore(caseData, 2, () => ({ kind: 'done' }) as Hint);
    store.mark(0);
    expect(store.requestStroke([20, 40])).toBe(true);
    store.undo();
    store.undo();
    expect(store.getState().marks.size).toBe(0);
  });
});
