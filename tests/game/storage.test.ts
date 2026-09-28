import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, getProfile, getSettings, migrateFromV1, readJSON, saveProfile, saveSettings, writeJSON } from '../../src/game/storage';

const computeStars = (errors: number, hints: number): number => Math.max(0, 3 - errors - hints);

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

describe('game/storage', () => {
  afterEach(() => {
    // @ts-expect-error localStorage no existe en el entorno de pruebas por defecto (Node)
    delete globalThis.localStorage;
  });

  it('devuelve el valor por defecto cuando localStorage no existe (modo privado)', () => {
    expect(readJSON('inexistente', { ok: true })).toEqual({ ok: true });
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => writeJSON('inexistente', { ok: true })).not.toThrow();
    expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
    expect(getProfile()).toEqual(DEFAULT_PROFILE);
    expect(() => saveProfile(DEFAULT_PROFILE)).not.toThrow();
  });

  describe('con localStorage disponible', () => {
    beforeEach(() => {
      // @ts-expect-error se sustituye por una implementación en memoria solo para la prueba
      globalThis.localStorage = new MemoryStorage();
    });

    it('guarda y recupera con el prefijo hm2:', () => {
      writeJSON('clave', { valor: 42 });
      expect(localStorage.getItem('hm2:clave')).toBe('{"valor":42}');
      expect(readJSON('clave', null)).toEqual({ valor: 42 });
    });

    it('getSettings combina lo guardado con los valores por defecto', () => {
      saveSettings({ ...DEFAULT_SETTINGS, theme: 'dark', showTimer: true });
      expect(getSettings()).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark', showTimer: true });
    });

    it('readJSON no rompe con JSON corrupto: usa el valor por defecto', () => {
      localStorage.setItem('hm2:rota', '{no es json');
      expect(readJSON('rota', 'por-defecto')).toBe('por-defecto');
    });

    it('getProfile devuelve el perfil por defecto si no hay nada guardado', () => {
      expect(getProfile()).toEqual(DEFAULT_PROFILE);
    });

    it('getProfile rellena los recuentos por nivel que falten al fusionar con lo guardado', () => {
      saveProfile({ ...DEFAULT_PROFILE, stars: 5, solved: { n: 2, i: 0, c: 0 } });
      const profile = getProfile();
      expect(profile.stars).toBe(5);
      expect(profile.solved).toEqual({ n: 2, i: 0, c: 0 });
      expect(profile.perfect).toEqual({ n: 0, i: 0, c: 0 });
      expect(profile.arch.coartada).toBe(0);
    });

    describe('migrateFromV1 (§18)', () => {
      it('sin hm:stats no hace nada', () => {
        migrateFromV1(computeStars);
        expect(getProfile()).toEqual(DEFAULT_PROFILE);
        expect(readJSON('daily', {})).toEqual({});
      });

      it('importa solved a legacySolvedV1 (no a solved ni a stars) y borra hm:stats', () => {
        localStorage.setItem('hm:stats', JSON.stringify({ solved: 7, daily: {} }));
        migrateFromV1(computeStars);
        const profile = getProfile();
        expect(profile.legacySolvedV1).toBe(7);
        expect(profile.stars).toBe(0);
        expect(profile.solved).toEqual({ n: 0, i: 0, c: 0 });
        expect(localStorage.getItem('hm:stats')).toBeNull();
      });

      it('importa daily a hm2:daily recalculando las estrellas con 0 pistas', () => {
        localStorage.setItem(
          'hm:stats',
          JSON.stringify({ solved: 0, daily: { '2026-01-05': { time: 240, errors: 1 }, '2026-01-06': { time: 90, errors: 0 } } }),
        );
        migrateFromV1(computeStars);
        const daily = readJSON<Record<string, { stars: number; errors: number; hints: number; time: number }>>('daily', {});
        expect(daily['2026-01-05']).toEqual({ stars: 2, errors: 1, hints: 0, time: 240 });
        expect(daily['2026-01-06']).toEqual({ stars: 3, errors: 0, hints: 0, time: 90 });
      });

      it('no pisa un resultado de v2 ya guardado ese día', () => {
        writeJSON('daily', { '2026-01-05': { stars: 1, errors: 2, hints: 0, time: 500 } });
        localStorage.setItem('hm:stats', JSON.stringify({ solved: 0, daily: { '2026-01-05': { time: 240, errors: 0 } } }));
        migrateFromV1(computeStars);
        const daily = readJSON<Record<string, { stars: number; errors: number; hints: number; time: number }>>('daily', {});
        expect(daily['2026-01-05']).toEqual({ stars: 1, errors: 2, hints: 0, time: 500 });
      });

      it('con hm:stats corrupto no rompe y no borra la clave', () => {
        localStorage.setItem('hm:stats', '{esto no es json');
        expect(() => migrateFromV1(computeStars)).not.toThrow();
        expect(getProfile()).toEqual(DEFAULT_PROFILE);
        expect(localStorage.getItem('hm:stats')).not.toBeNull();
      });
    });
  });

  it('migrateFromV1 sin localStorage (modo privado) no rompe', () => {
    expect(() => migrateFromV1(computeStars)).not.toThrow();
  });
});
