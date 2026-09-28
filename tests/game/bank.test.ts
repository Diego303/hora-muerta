import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getOrderSeed, getPlayed, markPlayed, nextUnplayed, resetPlayed } from '../../src/game/bank';
import type { BankFile, CaseDef, MapId } from '../../src/engine/types';

const ALL_MAPS = new Set<MapId>(['mansion', 'tren', 'museo', 'hotel', 'barco', 'teatro']);

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

function makeCase(id: string, map: CaseDef['map']): CaseDef {
  return {
    v: 2,
    id,
    mode: 'novato',
    diff: 0,
    map,
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
    sig: id,
  };
}

const BANK: BankFile = {
  version: 'test-v1',
  mode: 'novato',
  cases: [makeCase('N-001', 'mansion'), makeCase('N-002', 'tren'), makeCase('N-003', 'mansion'), makeCase('N-004', 'museo')],
};

describe('game/bank', () => {
  beforeEach(() => {
    // @ts-expect-error se sustituye por una implementación en memoria solo para la prueba
    globalThis.localStorage = new MemoryStorage();
  });
  afterEach(() => {
    // @ts-expect-error localStorage no existe en el entorno de pruebas por defecto (Node)
    delete globalThis.localStorage;
  });

  it('getOrderSeed crea una semilla una vez y la reutiliza siempre (§12.5)', () => {
    const a = getOrderSeed();
    const b = getOrderSeed();
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('con la misma semilla personal, dos "sesiones" distintas ven el mismo primer caso', () => {
    const storage1 = new MemoryStorage();
    storage1.setItem('hm2:order', JSON.stringify({ seed: 'fixed-seed' }));
    // @ts-expect-error se sustituye por una implementación en memoria solo para la prueba
    globalThis.localStorage = storage1;
    const firstSession = nextUnplayed(BANK, null, ALL_MAPS);

    const storage2 = new MemoryStorage();
    storage2.setItem('hm2:order', JSON.stringify({ seed: 'fixed-seed' }));
    // @ts-expect-error se sustituye por una implementación en memoria solo para la prueba
    globalThis.localStorage = storage2;
    const secondSession = nextUnplayed(BANK, null, ALL_MAPS);

    expect(firstSession).not.toBeNull();
    expect(secondSession?.id).toBe(firstSession?.id);
  });

  it('nextUnplayed no repite un caso ya jugado', () => {
    const first = nextUnplayed(BANK, null, ALL_MAPS);
    expect(first).not.toBeNull();
    if (!first) return;
    markPlayed(BANK.version, first.id);
    const second = nextUnplayed(BANK, null, ALL_MAPS);
    expect(second).not.toBeNull();
    expect(second?.id).not.toBe(first.id);
  });

  it('nextUnplayed respeta el filtro de mapa', () => {
    const next = nextUnplayed(BANK, 'tren', ALL_MAPS);
    expect(next?.map).toBe('tren');
  });

  it('nextUnplayed nunca sirve un caso de un escenario bloqueado (§16.1)', () => {
    const onlyMansion = new Set<CaseDef['map']>(['mansion']);
    const mansionCount = BANK.cases.filter((c) => c.map === 'mansion').length;
    for (let i = 0; i < mansionCount; i++) {
      const next = nextUnplayed(BANK, null, onlyMansion);
      expect(next?.map).toBe('mansion');
      if (next) markPlayed(BANK.version, next.id);
    }
    expect(nextUnplayed(BANK, null, onlyMansion)).toBeNull();
  });

  it('el filtro de escenario desbloqueado y el de mapa elegido se combinan', () => {
    const onlyMansion = new Set<CaseDef['map']>(['mansion']);
    expect(nextUnplayed(BANK, 'tren', onlyMansion)).toBeNull();
  });

  it('nextUnplayed devuelve null cuando se han jugado todos los del filtro (agotamiento)', () => {
    for (const c of BANK.cases) markPlayed(BANK.version, c.id);
    expect(nextUnplayed(BANK, null, ALL_MAPS)).toBeNull();
  });

  it('resetPlayed olvida solo los ids del grupo indicado, no los de otros modos', () => {
    markPlayed(BANK.version, 'N-001');
    markPlayed(BANK.version, 'OTHER-999');
    resetPlayed(
      BANK.version,
      BANK.cases.map((c) => c.id),
    );
    const played = getPlayed(BANK.version);
    expect(played.has('N-001')).toBe(false);
    expect(played.has('OTHER-999')).toBe(true);
  });

  it('sin localStorage (modo privado), sigue funcionando con valores por defecto', () => {
    // @ts-expect-error localStorage no existe en el entorno de pruebas por defecto (Node)
    delete globalThis.localStorage;
    expect(() => nextUnplayed(BANK, null, ALL_MAPS)).not.toThrow();
    expect(getPlayed(BANK.version).size).toBe(0);
  });
});
