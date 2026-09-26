import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, getSettings, readJSON, saveSettings, writeJSON } from '../../src/game/storage';

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
  });
});
