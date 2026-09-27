import { describe, expect, it } from 'vitest';
import { buildGraph } from '../../src/engine/graph';
import { checkUnique } from '../../src/engine/exact';
import type { SolveContext } from '../../src/engine/exact';
import { enumeratePaths } from '../../src/engine/paths';
import { buildCaseCandidate } from '../../src/engine/generate';
import type { DiffIndex } from '../../src/engine/clues';
import { solveHuman } from '../../src/engine/human';
import type { HumanContext } from '../../src/engine/human';
import { MANSION } from '../../src/engine/content/maps';
import type { Clue, Conclusion, Sus, Truth } from '../../src/engine/types';

function isConclusionSound(concl: Conclusion, truth: Truth, culprit: Sus): boolean {
  switch (concl.k) {
    case 'notRoom':
      return truth.rooms[concl.c][concl.t] !== concl.r;
    case 'isRoom':
      return truth.rooms[concl.c][concl.t] === concl.r;
    case 'notCarry':
      return truth.obj[concl.c] !== concl.o;
    case 'carry':
      return truth.obj[concl.c] === concl.o;
    case 'notCulprit':
      return concl.c !== culprit;
    case 'culprit':
      return concl.c === culprit;
  }
}

describe('solver humano: ejemplo del Apéndice D', () => {
  // Casa Valdemar: bib=0, est=1, inv=2, sal=3, ves=4, com=5, bod=6, coc=7.
  // Adela=0, Bruno=1, Celia=2, Darío=3. Objetos: cuerda=0, bastón=1, candelabro=2, pisapapeles=3.
  // Verdad construida a mano que cumple las 5 pistas exactas del Apéndice D
  // (verificada: cada movimiento respeta una puerta por hora, y Adela es la
  // única en la Bodega a las 22:00, con el bastón).
  const truth: Truth = {
    rooms: [
      [4, 6, 6], // Adela: Vestíbulo → Bodega → Bodega
      [2, 1, 1], // Bruno: Invernadero → Estudio → Estudio
      [4, 5, 4], // Celia: Vestíbulo → Comedor → Vestíbulo
      [7, 5, 7], // Darío: Cocina → Comedor → Cocina
    ],
    obj: [1, 0, 2, 3], // Adela=bastón, Bruno=cuerda, Celia=candelabro, Darío=pisapapeles
  };
  const clues: Clue[] = [
    { k: 'at', c: 1, t: 0, r: 2 }, // p.1: Bruno estaba en el Invernadero a las 21:00
    { k: 'together', a: 2, b: 3, t: 1 }, // p.2: Celia y Darío, misma sala a las 22:00
    { k: 'cat', o: 0, t: 2, r: 1 }, // p.3: quien llevaba la cuerda estaba en el Estudio a las 23:00
    { k: 'ncarry', c: 0, o: 2 }, // p.4: Adela no llevaba el candelabro
    { k: 'cat', o: 3, t: 0, r: 7 }, // p.5: quien llevaba el pisapapeles estaba en la Cocina a las 21:00
  ];
  const graph = buildGraph(MANSION);
  const ctx: HumanContext = { N: 4, T: 3, graph, rv: 6, td: 1 };

  it('la verdad construida cumple las 5 pistas del ejemplo', () => {
    // No usa holds() a propósito: comprobación directa, para no depender del propio motor.
    expect(truth.rooms[1][0]).toBe(2);
    expect(truth.rooms[2][1]).toBe(truth.rooms[3][1]);
    const cuerdaCarrier = truth.obj.indexOf(0);
    expect(truth.rooms[cuerdaCarrier][2]).toBe(1);
    expect(truth.obj[0]).not.toBe(2);
    const pisapapelesCarrier = truth.obj.indexOf(3);
    expect(truth.rooms[pisapapelesCarrier][0]).toBe(7);
  });

  it('resuelve el caso: Adela con el bastón, nivel máximo 4, arquetipo "pareja"', () => {
    const result = solveHuman(ctx, clues);
    expect(result).not.toBeNull();
    if (!result) return;

    // El último paso siempre es el cierre R5_WEAPON, con el culpable y el arma.
    const closing = result.steps[result.steps.length - 1];
    expect(closing.rule).toBe('R5_WEAPON');
    expect(closing.concl.find((c) => c.k === 'culprit')).toEqual({ k: 'culprit', c: 0 });
    expect(closing.concl.find((c) => c.k === 'carry')).toEqual({ k: 'carry', c: 0, o: 1 });

    expect(result.maxLv).toBe(4);
    expect(result.arch).toContain('pareja');
  });

  it('toda conclusión de todo paso es verdadera en la verdad (solidez)', () => {
    const result = solveHuman(ctx, clues);
    expect(result).not.toBeNull();
    if (!result) return;
    for (const step of result.steps) {
      for (const concl of step.concl) {
        expect(isConclusionSound(concl, truth, 0)).toBe(true);
      }
    }
  });

  it('coherencia: si el solver humano resuelve, el solver exacto da unique', () => {
    const paths = enumeratePaths(graph.adj, MANSION.rooms.length, 3);
    const solveCtx: SolveContext = { N: 4, T: 3, paths, rv: 6, td: 1, graph };
    const result = checkUnique(solveCtx, 0, 1, clues);
    expect(result.status).toBe('unique');
  });
});

describe('solver humano: solidez y coherencia en 300 casos generados (§20)', () => {
  it(
    'toda conclusión es verdadera en la verdad; si resuelve, el exacto da unique',
    () => {
      let solvedCount = 0;
      let totalCount = 0;
      for (const diff of [0, 1, 2] as DiffIndex[]) {
        for (let i = 0; i < 100; i++) {
          totalCount += 1;
          const candidate = buildCaseCandidate(`humano-solidez-${diff}-${i}`, diff);
          if (!candidate) continue;

          const graph = buildGraph(candidate.map);
          const humanCtx: HumanContext = { N: candidate.N, T: candidate.T, graph, rv: candidate.rv, td: candidate.td };
          const result = solveHuman(humanCtx, candidate.clues);
          if (!result) continue; // atascado: esperable mientras R6_HYPOTHESIS no exista (docs/DECISIONES.md)
          solvedCount += 1;

          for (const step of result.steps) {
            for (const concl of step.concl) {
              expect(isConclusionSound(concl, candidate.truth, candidate.culprit)).toBe(true);
            }
          }

          const paths = enumeratePaths(graph.adj, candidate.map.rooms.length, candidate.T);
          const solveCtx: SolveContext = { N: candidate.N, T: candidate.T, paths, rv: candidate.rv, td: candidate.td, graph };
          const exactResult = checkUnique(solveCtx, candidate.culprit, candidate.weapon, candidate.clues);
          expect(exactResult.status).toBe('unique');
        }
      }
      // Sanity mínima: si esto fuera 0, el solver estaría roto (siempre atascado), no solo incompleto.
      expect(solvedCount).toBeGreaterThan(0);
      expect(totalCount).toBe(300);
    },
    120000,
  );
});
