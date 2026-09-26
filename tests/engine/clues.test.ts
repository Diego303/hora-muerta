import { describe, expect, it } from 'vitest';
import { buildGraph } from '../../src/engine/graph';
import { buildCluePool, holds } from '../../src/engine/clues';
import { MANSION } from '../../src/engine/content/maps';
import { rngFromSeed } from '../../src/engine/rng';
import type { Truth } from '../../src/engine/types';

const graph = buildGraph(MANSION);

// bib=0, est=1, inv=2, sal=3, ves=4, com=5, bod=6, coc=7.
const truth: Truth = {
  rooms: [
    [4, 6, 6], // suspect 0 (culpable): ves → bod → bod
    [2, 5, 7], // suspect 1: inv → com → coc
    [0, 1, 4], // suspect 2: bib → est → ves
    [0, 1, 2], // suspect 3: bib → est → inv
  ],
  obj: [1, 0, 3, 2],
};
const rv = 6; // bod
const td = 1;
const culprit = 0;
const weapon = truth.obj[culprit]; // 1

describe('buildCluePool: reserva y prohibiciones (§6.1-§6.2)', () => {
  const pool = buildCluePool({ N: 4, T: 3, map: MANSION, graph, truth, rv, td, culprit, weapon, diff: 1 }, rngFromSeed('pool-test'));

  it('toda pista de la reserva es verdad sobre la verdad', () => {
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((clue) => holds(clue, truth, graph))).toBe(true);
  });

  it('nunca sitúa al culpable en la sala del crimen a la hora del crimen (at)', () => {
    expect(pool.some((clue) => clue.k === 'at' && clue.c === culprit && clue.t === td && clue.r === rv)).toBe(false);
  });

  it('nunca da la posición del arma a la hora del crimen (cat/cfeat)', () => {
    expect(pool.some((clue) => (clue.k === 'cat' || clue.k === 'cfeat') && clue.o === weapon && clue.t === td)).toBe(false);
  });

  it('nunca da el recuento de la sala del crimen a la hora del crimen', () => {
    expect(pool.some((clue) => clue.k === 'count' && clue.r === rv && clue.t === td)).toBe(false);
  });

  it('nunca dice que el culpable visitó la sala del crimen, ni que no se movió en toda la noche', () => {
    expect(pool.some((clue) => clue.k === 'visited' && clue.c === culprit && clue.r === rv)).toBe(false);
    expect(pool.some((clue) => clue.k === 'stayed' && clue.c === culprit)).toBe(false);
  });

  it('en Inspector y Comisario, nunca hay notat ni never referidos a la sala del crimen', () => {
    expect(pool.some((clue) => clue.k === 'notat' && clue.r === rv)).toBe(false);
    expect(pool.some((clue) => clue.k === 'never' && clue.r === rv)).toBe(false);
  });

  it('en Novato sí se permiten notat/never de la sala del crimen (son más generosas)', () => {
    const easyPool = buildCluePool({ N: 4, T: 3, map: MANSION, graph, truth, rv, td, culprit, weapon, diff: 0 }, rngFromSeed('pool-test-easy'));
    expect(easyPool.some((clue) => clue.k === 'notat' && clue.r === rv)).toBe(true);
  });
});
