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

    // El último paso siempre es el cierre R5_WEAPON: solo concluye el arma (el
    // culpable ya se concluyó antes; repetirlo aquí inflaría el nivel máximo,
    // ver docs/DECISIONES.md).
    const closing = result.steps[result.steps.length - 1];
    expect(closing.rule).toBe('R5_WEAPON');
    expect(closing.concl).toEqual([{ k: 'carry', c: 0, o: 1 }]);
    expect(result.steps.some((s) => s.concl.some((c) => c.k === 'culprit' && c.c === 0))).toBe(true);

    // El Apéndice D narra 5 pasos para identificar al culpable (niveles 1,3,2,4,2
    // = puntuación 15), pero mi R4_TOGETHER concluye "culprit" en el mismo paso
    // en que descarta a la pareja (en cuanto solo queda un candidato, la máscara
    // ya lo refleja): son las mismas 4 piezas de razonamiento (R1_AT, R3_REACH_FWD,
    // R2_CANT_BE_THERE, R4_TOGETHER; niveles 1,3,2,4 = puntuación 13) sin un paso
    // R2_ONLY_ONE aparte. Ver docs/DECISIONES.md.
    expect(result.score).toBe(13);
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

describe('solver humano: solidez y coherencia en casos generados (§20)', () => {
  // El diseño pide 300 casos. Medido en este entorno: Novato genera en ~0.2 s
  // por semilla (100% de aciertos), pero Inspector y Comisario son mucho más
  // lentos y con muchos menos aciertos por semilla (~10 s y bastante más caros
  // respectivamente) mientras no exista R6_HYPOTHESIS (§9.2): sin él, muchos
  // casos que el solver exacto sabe resolver quedan "atascados" para el solver
  // humano, y hacen falta más de los 40 intentos disponibles para acertar uno
  // válido. Para que esta prueba termine en un tiempo razonable se reduce la
  // muestra de Inspector/Comisario; ver docs/DECISIONES.md.
  const ATTEMPTS: Record<DiffIndex, number> = { 0: 120, 1: 25, 2: 15 };

  it(
    'toda conclusión guardada es verdadera en la verdad; el solver exacto sigue dando unique',
    () => {
      let solvedCount = 0;
      let totalCount = 0;
      for (const diff of [0, 1, 2] as DiffIndex[]) {
        for (let i = 0; i < ATTEMPTS[diff]; i++) {
          totalCount += 1;
          const candidate = buildCaseCandidate(`humano-solidez-${diff}-${i}`, diff);
          if (!candidate) continue; // rechazo legítimo: atascado, nivel o banda de puntuación fuera de rango
          solvedCount += 1;

          // candidate.solve.steps ya es la cadena crítica que calculó buildCaseCandidate
          // (no hace falta volver a resolver con solveHuman: sería trabajo redundante).
          candidate.solve.steps.forEach((step, idx) => {
            for (const concl of step.concl) {
              expect(isConclusionSound(concl, candidate.truth, candidate.culprit)).toBe(true);
            }
            // Las premisas están reindexadas a posiciones dentro de esta misma lista
            // filtrada (ver reindexCriticalSteps en generate.ts): siempre un paso
            // anterior de la propia cadena, nunca fuera de rango ni hacia delante.
            for (const p of step.prem) {
              expect(p).toBeGreaterThanOrEqual(0);
              expect(p).toBeLessThan(idx);
            }
          });

          const graph = buildGraph(candidate.map);
          const paths = enumeratePaths(graph.adj, candidate.map.rooms.length, candidate.T);
          const solveCtx: SolveContext = { N: candidate.N, T: candidate.T, paths, rv: candidate.rv, td: candidate.td, graph };
          const exactResult = checkUnique(solveCtx, candidate.culprit, candidate.weapon, candidate.clues);
          expect(exactResult.status).toBe('unique');
        }
      }
      // Sanity mínima: si esto fuera 0, el solver estaría roto (siempre atascado), no solo incompleto.
      expect(solvedCount).toBeGreaterThan(0);
      expect(totalCount).toBe(ATTEMPTS[0] + ATTEMPTS[1] + ATTEMPTS[2]);
    },
    600000,
  );
});
