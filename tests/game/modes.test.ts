import { afterEach, describe, expect, it } from 'vitest';
import { dailyIndex, getDailyResult, recordDailyResult, todayKey } from '../../src/game/modes';

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

describe('game/modes: dailyIndex (§13)', () => {
  it('el 1 de enero de 2026 (época) da índice 0', () => {
    expect(dailyIndex(new Date('2026-01-01T00:00:00Z'), 60)).toBe(0);
  });

  it('avanza un día por día', () => {
    expect(dailyIndex(new Date('2026-01-02T00:00:00Z'), 60)).toBe(1);
    expect(dailyIndex(new Date('2026-01-03T12:34:56Z'), 60)).toBe(2);
  });

  it('da la vuelta (módulo) al llegar al final del banco', () => {
    expect(dailyIndex(new Date('2026-03-02T00:00:00Z'), 60)).toBe(0); // día 60 desde la época
  });

  it('usa el día en UTC, no la hora local: no cambia dentro del mismo día UTC', () => {
    const early = dailyIndex(new Date('2026-01-05T00:05:00Z'), 60);
    const late = dailyIndex(new Date('2026-01-05T23:55:00Z'), 60);
    expect(early).toBe(late);
  });

  it('todayKey da el formato AAAA-MM-DD', () => {
    expect(todayKey(new Date('2026-01-05T10:00:00Z'))).toBe('2026-01-05');
  });
});

describe('game/modes: resultado del caso del día (hm2:daily)', () => {
  afterEach(() => {
    // @ts-expect-error localStorage no existe en el entorno de pruebas por defecto (Node)
    delete globalThis.localStorage;
  });

  it('guarda y recupera el resultado de un día concreto sin tocar otros días', () => {
    // @ts-expect-error se sustituye por una implementación en memoria solo para la prueba
    globalThis.localStorage = new MemoryStorage();
    recordDailyResult('2026-01-05', { stars: 3, errors: 0, hints: 0, time: 120 });
    recordDailyResult('2026-01-06', { stars: 1, errors: 2, hints: 1, time: 300 });
    expect(getDailyResult('2026-01-05')).toEqual({ stars: 3, errors: 0, hints: 0, time: 120 });
    expect(getDailyResult('2026-01-06')).toEqual({ stars: 1, errors: 2, hints: 1, time: 300 });
    expect(getDailyResult('2026-01-07')).toBeNull();
  });
});
