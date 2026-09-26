import { describe, expect, it } from 'vitest';
import { buildGraph } from '../../src/engine/graph';
import { enumeratePaths } from '../../src/engine/paths';
import { buildCaseCandidate } from '../../src/engine/generate';
import { checkUnique } from '../../src/engine/exact';
import type { SolveContext } from '../../src/engine/exact';
import type { Clue, Graph } from '../../src/engine/types';

/**
 * Verificador independiente por fuerza bruta: backtracking sencillo (sin la
 * propagación/poda del solver exacto) que decide si existe una asignación
 * completa compatible con `cand` de culpable (y, si se da, `weaponCand` de
 * arma). Se usa solo en pruebas, para contrastar el solver exacto.
 */
function bruteForceHasSolution(
  N: number,
  T: number,
  paths: number[][],
  graph: Graph,
  clues: Clue[],
  rv: number,
  td: number,
  cand: number,
  weaponCand: number | null,
): boolean {
  const domains: number[][] = [];
  for (let c = 0; c < N; c++) {
    const domain: number[] = [];
    for (let p = 0; p < paths.length; p++) {
      const path = paths[p];
      if (c === cand ? path[td] !== rv : path[td] === rv) continue;
      if (!suspectUnaryOk(clues, c, path, graph)) continue;
      domain.push(p);
    }
    domains.push(domain);
  }
  if (domains.some((d) => d.length === 0)) return false;

  const assignment: number[] = new Array(N).fill(-1);

  function pairwiseOk(upTo: number): boolean {
    for (const clue of clues) {
      if (clue.k === 'together' && clue.a <= upTo && clue.b <= upTo) {
        if (paths[assignment[clue.a]][clue.t] !== paths[assignment[clue.b]][clue.t]) return false;
      } else if (clue.k === 'adj' && clue.a <= upTo && clue.b <= upTo) {
        if (!graph.adjM[paths[assignment[clue.a]][clue.t]][paths[assignment[clue.b]][clue.t]]) return false;
      } else if (clue.k === 'apart' && clue.a <= upTo && clue.b <= upTo) {
        for (let t = 0; t < T; t++) if (paths[assignment[clue.a]][t] === paths[assignment[clue.b]][t]) return false;
      }
    }
    return true;
  }

  function countOk(): boolean {
    for (const clue of clues) {
      if (clue.k === 'count') {
        const n = assignment.filter((p) => paths[p][clue.t] === clue.r).length;
        if (n !== clue.n) return false;
      }
    }
    return true;
  }

  /** Poda temprana: el recuento de asignados hasta ahora solo puede crecer, así
   * que si ya supera lo pedido, ninguna asignación completa lo arreglará. */
  function countPartialOk(upTo: number): boolean {
    for (const clue of clues) {
      if (clue.k === 'count') {
        let count = 0;
        for (let c = 0; c <= upTo; c++) if (paths[assignment[c]][clue.t] === clue.r) count++;
        if (count > clue.n) return false;
      }
    }
    return true;
  }

  function hasValidObjects(): boolean {
    const objAssignment: number[] = new Array(N).fill(-1);
    const used: boolean[] = new Array(N).fill(false);
    function assign(c: number): boolean {
      if (c === N) {
        if (weaponCand != null && objAssignment[cand] !== weaponCand) return false;
        for (const clue of clues) {
          if (clue.k === 'cat') {
            const carrier = objAssignment.indexOf(clue.o);
            if (paths[assignment[carrier]][clue.t] !== clue.r) return false;
          } else if (clue.k === 'cfeat') {
            const carrier = objAssignment.indexOf(clue.o);
            if (graph.feat[paths[assignment[carrier]][clue.t]][clue.f] === clue.neg) return false;
          } else if (clue.k === 'cwith') {
            const carrier = objAssignment.indexOf(clue.o);
            if (carrier === clue.c || paths[assignment[carrier]][clue.t] !== paths[assignment[clue.c]][clue.t]) return false;
          }
        }
        return true;
      }
      for (let o = 0; o < N; o++) {
        if (used[o]) continue;
        if (clues.some((clue) => clue.k === 'ncarry' && clue.c === c && clue.o === o)) continue;
        used[o] = true;
        objAssignment[c] = o;
        if (assign(c + 1)) return true;
        used[o] = false;
        objAssignment[c] = -1;
      }
      return false;
    }
    return assign(0);
  }

  function recurse(c: number): boolean {
    if (c === N) return countOk() && hasValidObjects();
    for (const p of domains[c]) {
      assignment[c] = p;
      if (pairwiseOk(c) && countPartialOk(c)) {
        if (recurse(c + 1)) return true;
      }
    }
    assignment[c] = -1;
    return false;
  }

  return recurse(0);
}

/** Pistas que restringen el recorrido de UN sospechoso de forma aislada (independiente del resto). */
function suspectUnaryOk(clues: Clue[], suspect: number, path: number[], graph: Graph): boolean {
  for (const clue of clues) {
    if (clue.k === 'at' && clue.c === suspect && path[clue.t] !== clue.r) return false;
    if (clue.k === 'notat' && clue.c === suspect && path[clue.t] === clue.r) return false;
    if (clue.k === 'feat' && clue.c === suspect && graph.feat[path[clue.t]][clue.f] === clue.neg) return false;
    if (clue.k === 'never' && clue.c === suspect && path.includes(clue.r)) return false;
    if (clue.k === 'visited' && clue.c === suspect && !path.includes(clue.r)) return false;
    if (clue.k === 'stayed' && clue.c === suspect && !path.every((x) => x === path[0])) return false;
    if (clue.k === 'moved' && clue.c === suspect && path[clue.t] === path[clue.t + 1]) return false;
    if (clue.k === 'still' && clue.c === suspect && path[clue.t] !== path[clue.t + 1]) return false;
  }
  return true;
}

describe('solver exacto vs. fuerza bruta en 30 casos Novato (§20)', () => {
  it(
    'el conjunto de respuestas coincide exactamente en los 30 casos',
    () => {
      for (let i = 0; i < 30; i++) {
        const candidate = buildCaseCandidate(`novato-exact-${i}`, 0);
        expect(candidate).not.toBeNull();
        if (!candidate) continue;

        const graph = buildGraph(candidate.map);
        const paths = enumeratePaths(graph.adj, candidate.map.rooms.length, candidate.T);
        const ctx: SolveContext = { N: candidate.N, T: candidate.T, paths, rv: candidate.rv, td: candidate.td, graph };

        const result = checkUnique(ctx, candidate.culprit, candidate.weapon, candidate.clues);
        expect(result.status).toBe('unique');

        // La verdad siempre debe admitir una asignación válida.
        expect(bruteForceHasSolution(candidate.N, candidate.T, paths, graph, candidate.clues, candidate.rv, candidate.td, candidate.culprit, candidate.weapon)).toBe(true);

        // Ningún otro culpable ni ninguna otra arma debe admitir una asignación válida.
        for (let c = 0; c < candidate.N; c++) {
          if (c === candidate.culprit) continue;
          expect(bruteForceHasSolution(candidate.N, candidate.T, paths, graph, candidate.clues, candidate.rv, candidate.td, c, null)).toBe(false);
        }
        for (let o = 0; o < candidate.N; o++) {
          if (o === candidate.weapon) continue;
          expect(bruteForceHasSolution(candidate.N, candidate.T, paths, graph, candidate.clues, candidate.rv, candidate.td, candidate.culprit, o)).toBe(false);
        }
      }
    },
    60000,
  );
});
