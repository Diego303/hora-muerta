import { describe, expect, it } from 'vitest';
import { buildGraph } from '../../src/engine/graph';
import { holds } from '../../src/engine/clues';
import { MANSION } from '../../src/engine/content/maps';
import type { Truth } from '../../src/engine/types';

// Sala Casa Valdemar: bib=0, est=1, inv=2, sal=3, ves=4, com=5, bod=6, coc=7.
const graph = buildGraph(MANSION);

// 3 sospechosos, 3 horas. Suspect 0: bib→est→ves. Suspect 1: bib→bib→est. Suspect 2: sal→sal→sal.
// Objetos (case-relative 0,1,2): obj[0]=2 (lleva el 2), obj[1]=0, obj[2]=1.
const truth: Truth = {
  rooms: [
    [0, 1, 4],
    [0, 0, 1],
    [3, 3, 3],
  ],
  obj: [2, 0, 1],
};

describe('holds() — los 16 tipos de pista (§6.1)', () => {
  it('at', () => {
    expect(holds({ k: 'at', c: 0, t: 1, r: 1 }, truth, graph)).toBe(true);
    expect(holds({ k: 'at', c: 0, t: 1, r: 0 }, truth, graph)).toBe(false);
  });

  it('notat', () => {
    expect(holds({ k: 'notat', c: 0, t: 1, r: 0 }, truth, graph)).toBe(true);
    expect(holds({ k: 'notat', c: 0, t: 1, r: 1 }, truth, graph)).toBe(false);
  });

  it('feat', () => {
    // est (1) tiene ventana (f=1) y no tiene chimenea (f=0).
    expect(holds({ k: 'feat', c: 0, t: 1, f: 1, neg: false }, truth, graph)).toBe(true);
    expect(holds({ k: 'feat', c: 0, t: 1, f: 0, neg: false }, truth, graph)).toBe(false);
  });

  it('never', () => {
    expect(holds({ k: 'never', c: 2, r: 0 }, truth, graph)).toBe(true);
    expect(holds({ k: 'never', c: 2, r: 3 }, truth, graph)).toBe(false);
  });

  it('visited', () => {
    expect(holds({ k: 'visited', c: 0, r: 4 }, truth, graph)).toBe(true);
    expect(holds({ k: 'visited', c: 0, r: 6 }, truth, graph)).toBe(false);
  });

  it('stayed', () => {
    expect(holds({ k: 'stayed', c: 2 }, truth, graph)).toBe(true);
    expect(holds({ k: 'stayed', c: 0 }, truth, graph)).toBe(false);
  });

  it('moved', () => {
    expect(holds({ k: 'moved', c: 0, t: 0 }, truth, graph)).toBe(true);
    expect(holds({ k: 'moved', c: 1, t: 0 }, truth, graph)).toBe(false);
  });

  it('still', () => {
    expect(holds({ k: 'still', c: 1, t: 0 }, truth, graph)).toBe(true);
    expect(holds({ k: 'still', c: 0, t: 0 }, truth, graph)).toBe(false);
  });

  it('together', () => {
    expect(holds({ k: 'together', a: 0, b: 1, t: 0 }, truth, graph)).toBe(true);
    expect(holds({ k: 'together', a: 0, b: 2, t: 0 }, truth, graph)).toBe(false);
  });

  it('apart', () => {
    expect(holds({ k: 'apart', a: 0, b: 2 }, truth, graph)).toBe(true);
    expect(holds({ k: 'apart', a: 0, b: 1 }, truth, graph)).toBe(false);
  });

  it('adj', () => {
    // hora 0: bib(0) y sal(3) son contiguas. hora 1: est(1) y sal(3) no lo son.
    expect(holds({ k: 'adj', a: 0, b: 2, t: 0 }, truth, graph)).toBe(true);
    expect(holds({ k: 'adj', a: 0, b: 2, t: 1 }, truth, graph)).toBe(false);
  });

  it('count', () => {
    expect(holds({ k: 'count', r: 0, t: 0, n: 2 }, truth, graph)).toBe(true);
    expect(holds({ k: 'count', r: 3, t: 0, n: 0 }, truth, graph)).toBe(false);
  });

  it('cat', () => {
    // el objeto 2 lo lleva el sospechoso 0, que a la hora 1 está en est (1).
    expect(holds({ k: 'cat', o: 2, t: 1, r: 1 }, truth, graph)).toBe(true);
    expect(holds({ k: 'cat', o: 2, t: 1, r: 0 }, truth, graph)).toBe(false);
  });

  it('cfeat', () => {
    expect(holds({ k: 'cfeat', o: 2, t: 1, f: 1, neg: false }, truth, graph)).toBe(true);
    expect(holds({ k: 'cfeat', o: 2, t: 1, f: 0, neg: false }, truth, graph)).toBe(false);
  });

  it('ncarry', () => {
    expect(holds({ k: 'ncarry', c: 0, o: 0 }, truth, graph)).toBe(true);
    expect(holds({ k: 'ncarry', c: 0, o: 2 }, truth, graph)).toBe(false);
  });

  it('cwith', () => {
    // el objeto 0 lo lleva el sospechoso 1, que a la hora 0 coincide en bib con el sospechoso 0.
    expect(holds({ k: 'cwith', o: 0, c: 0, t: 0 }, truth, graph)).toBe(true);
    // el propio portador nunca "está con" sí mismo.
    expect(holds({ k: 'cwith', o: 0, c: 1, t: 0 }, truth, graph)).toBe(false);
    // el objeto 1 lo lleva el sospechoso 2, que a la hora 0 no coincide con el 0.
    expect(holds({ k: 'cwith', o: 1, c: 0, t: 0 }, truth, graph)).toBe(false);
  });
});
