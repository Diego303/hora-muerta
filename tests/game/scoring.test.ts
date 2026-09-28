import { describe, expect, it } from 'vitest';
import { checkAccusation, computeStars } from '../../src/game/scoring';
import type { CaseDef } from '../../src/engine/types';

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
  culprit: 2,
  weapon: 1,
  truth: { rooms: [[0, 0, 0], [1, 1, 1], [2, 2, 2], [3, 3, 3]], obj: [0, 1, 2, 3] },
  clues: [],
  solve: { steps: [], key: 0, arch: [], maxLv: 1, score: 0 },
  sig: 'test',
};

describe('game/scoring', () => {
  describe('computeStars (§14.1)', () => {
    it('empieza en 3 y resta 1 por cada error y por cada pista, con mínimo 0', () => {
      expect(computeStars(0, 0)).toBe(3);
      expect(computeStars(1, 0)).toBe(2);
      expect(computeStars(0, 1)).toBe(2);
      expect(computeStars(1, 1)).toBe(1);
      expect(computeStars(2, 2)).toBe(0);
      expect(computeStars(3, 3)).toBe(0);
    });
  });

  describe('checkAccusation (§14.3)', () => {
    it('culpable y arma correctos: resuelto, sin sumar errores', () => {
      const outcome = checkAccusation(CASE, CASE.culprit, CASE.weapon, 0);
      expect(outcome).toEqual({ correct: true, errors: 0, result: 'solved' });
    });

    it('culpable correcto pero arma incorrecta: no encaja', () => {
      const otherWeapon = (CASE.weapon + 1) % CASE.N;
      const outcome = checkAccusation(CASE, CASE.culprit, otherWeapon, 0);
      expect(outcome.correct).toBe(false);
      expect(outcome.result).toBe('playing');
      expect(outcome.errors).toBe(1);
    });

    it('arma correcta pero culpable incorrecto: no encaja', () => {
      const otherCulprit = (CASE.culprit + 1) % CASE.N;
      const outcome = checkAccusation(CASE, otherCulprit, CASE.weapon, 0);
      expect(outcome.correct).toBe(false);
      expect(outcome.result).toBe('playing');
    });

    it('con 1 error previo, un segundo error archiva el caso sin resolver', () => {
      const otherCulprit = (CASE.culprit + 1) % CASE.N;
      const outcome = checkAccusation(CASE, otherCulprit, CASE.weapon, 1);
      expect(outcome).toEqual({ correct: false, errors: 2, result: 'archived' });
    });

    it('con maxErrors=Infinity (una noche de expediente, §13) nunca archiva por sí sola', () => {
      const otherCulprit = (CASE.culprit + 1) % CASE.N;
      const outcome = checkAccusation(CASE, otherCulprit, CASE.weapon, 10, Number.POSITIVE_INFINITY);
      expect(outcome).toEqual({ correct: false, errors: 11, result: 'playing' });
    });
  });
});
