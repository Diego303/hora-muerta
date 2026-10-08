import { describe, expect, it } from 'vitest';
import { fireMedals, fireStars, recordOf, withAttempt, withSolve, type FireRecords } from '../../src/modes/fire/records';

describe('medallas (MODOS 2.6): Sin fotos, A tiempo y Sin errores', () => {
  it('las tres a la vez', () => {
    expect(fireMedals({ photosUsed: 0, wrongAccusations: 0, secondsLeft: 200 })).toEqual(['sin-fotos', 'a-tiempo', 'sin-errores']);
  });

  it('"A tiempo" exige más de 2:00 restantes, no 2:00 justos', () => {
    expect(fireMedals({ photosUsed: 1, wrongAccusations: 1, secondsLeft: 120 })).toEqual([]);
    expect(fireMedals({ photosUsed: 1, wrongAccusations: 1, secondsLeft: 120.5 })).toEqual(['a-tiempo']);
  });

  it('una foto quita "Sin fotos" y un error quita "Sin errores"', () => {
    expect(fireMedals({ photosUsed: 1, wrongAccusations: 0, secondsLeft: 10 })).toEqual(['sin-errores']);
    expect(fireMedals({ photosUsed: 0, wrongAccusations: 2, secondsLeft: 10 })).toEqual(['sin-fotos']);
  });

  it('estrellas: 1 por resolver, más 1 por medalla, como mucho 3', () => {
    expect(fireStars([])).toBe(1);
    expect(fireStars(['a-tiempo'])).toBe(2);
    expect(fireStars(['sin-fotos', 'a-tiempo'])).toBe(3);
    expect(fireStars(['sin-fotos', 'a-tiempo', 'sin-errores'])).toBe(3);
  });
});

describe('récords en hm2:fire (MODOS 2.8)', () => {
  const now = new Date('2026-10-07T12:00:00Z');

  it('cada entrada cuenta como intento', () => {
    let records: FireRecords = {};
    records = withAttempt(records, 'INC-01');
    records = withAttempt(records, 'INC-01');
    expect(recordOf(records, 'INC-01')).toEqual({ bestLeft: null, medals: [], attempts: 2, solvedAt: null });
  });

  it('la primera vez que se resuelve guarda la marca, las medallas y suma sus estrellas', () => {
    const { records, starsGained, newBest } = withSolve(withAttempt({}, 'INC-01'), 'INC-01', 133.7, ['a-tiempo'], now);
    expect(recordOf(records, 'INC-01')).toEqual({ bestLeft: 133, medals: ['a-tiempo'], attempts: 1, solvedAt: now.toISOString() });
    expect(starsGained).toBe(2);
    expect(newBest).toBe(true);
  });

  it('repetir el mismo edificio no regala estrellas; solo suma lo que mejora', () => {
    const first = withSolve({}, 'INC-01', 100, ['sin-errores'], now);
    const same = withSolve(first.records, 'INC-01', 90, ['sin-errores'], now);
    expect(same.starsGained).toBe(0);
    expect(same.newBest).toBe(false);
    expect(recordOf(same.records, 'INC-01').bestLeft).toBe(100);

    const better = withSolve(same.records, 'INC-01', 150, ['a-tiempo'], now);
    expect(better.starsGained).toBe(1);
    expect(better.newBest).toBe(true);
    expect(recordOf(better.records, 'INC-01').medals).toEqual(['a-tiempo', 'sin-errores']);
  });

  it('un caso no toca los récords de otro', () => {
    const { records } = withSolve(withAttempt({}, 'INC-02'), 'INC-01', 50, [], now);
    expect(recordOf(records, 'INC-02').attempts).toBe(1);
    expect(recordOf(records, 'INC-02').bestLeft).toBeNull();
  });
});
