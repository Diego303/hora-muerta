import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearSeriesProgress, completeNight, loadSeriesProgress, registerSeriesError, startSeries } from '../../src/game/expediente';

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

describe('game/expediente: presupuesto de errores y estrellas compartidos (§13)', () => {
  beforeEach(() => {
    // @ts-expect-error se sustituye por una implementación en memoria solo para la prueba
    globalThis.localStorage = new MemoryStorage();
  });
  afterEach(() => {
    // @ts-expect-error localStorage no existe en el entorno de pruebas por defecto (Node)
    delete globalThis.localStorage;
  });

  it('startSeries empieza con 3 errores, 0 estrellas y noche 0', () => {
    const progress = startSeries('E-01', 'test-v1');
    expect(progress).toEqual({ id: 'E-01', version: 'test-v1', index: 0, errorsLeft: 3, starsSoFar: 0, done: false });
    expect(loadSeriesProgress()).toEqual(progress);
  });

  it('registerSeriesError descuenta uno del presupuesto COMPARTIDO, no reinicia por noche', () => {
    const progress = startSeries('E-01', 'test-v1');
    const afterOne = registerSeriesError(progress);
    expect(afterOne.errorsLeft).toBe(2);
    expect(afterOne.done).toBe(false);
    const afterTwo = registerSeriesError(afterOne);
    expect(afterTwo.errorsLeft).toBe(1);
    expect(afterTwo.done).toBe(false);
  });

  it('registerSeriesError marca la serie como terminada (archivada) al agotar el presupuesto', () => {
    let progress = startSeries('E-01', 'test-v1');
    progress = registerSeriesError(progress);
    progress = registerSeriesError(progress);
    progress = registerSeriesError(progress);
    expect(progress.errorsLeft).toBe(0);
    expect(progress.done).toBe(true);
  });

  it('registerSeriesError no baja de cero aunque se llame de más', () => {
    let progress = startSeries('E-01', 'test-v1');
    for (let i = 0; i < 5; i++) progress = registerSeriesError(progress);
    expect(progress.errorsLeft).toBe(0);
  });

  it('completeNight suma las estrellas de la noche y avanza a la siguiente', () => {
    const progress = startSeries('E-01', 'test-v1');
    const afterNight1 = completeNight(progress, 3, 3);
    expect(afterNight1.index).toBe(1);
    expect(afterNight1.starsSoFar).toBe(3);
    expect(afterNight1.done).toBe(false);
    const afterNight2 = completeNight(afterNight1, 2, 3);
    expect(afterNight2.index).toBe(2);
    expect(afterNight2.starsSoFar).toBe(5);
    expect(afterNight2.done).toBe(false);
  });

  it('completeNight marca la serie como terminada tras la última noche', () => {
    const progress = startSeries('E-01', 'test-v1');
    const afterNight1 = completeNight(progress, 3, 3);
    const afterNight2 = completeNight(afterNight1, 3, 3);
    const afterNight3 = completeNight(afterNight2, 3, 3);
    expect(afterNight3.index).toBe(3);
    expect(afterNight3.starsSoFar).toBe(9);
    expect(afterNight3.done).toBe(true);
  });

  it('clearSeriesProgress borra el progreso guardado', () => {
    startSeries('E-01', 'test-v1');
    clearSeriesProgress();
    expect(loadSeriesProgress()).toBeNull();
  });

  it('sin localStorage (modo privado), sigue funcionando con valores por defecto', () => {
    // @ts-expect-error localStorage no existe en el entorno de pruebas por defecto (Node)
    delete globalThis.localStorage;
    expect(() => startSeries('E-01', 'test-v1')).not.toThrow();
    expect(loadSeriesProgress()).toBeNull();
  });
});
