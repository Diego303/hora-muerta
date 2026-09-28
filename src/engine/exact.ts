// Solver exacto (§8), portado de v1 (exists/checkUnique) sin cambios de lógica,
// con moved/still añadidos como restricciones unarias (§8).
import type { Clue, Graph, Hour, Obj, Room, Sus } from './types';

export interface SolveContext {
  N: number;
  T: number;
  /** Todos los recorridos posibles de longitud T sobre el grafo (iguales para cualquier sospechoso). */
  paths: Room[][];
  rv: Room;
  td: Hour;
  graph: Graph;
}

type PathPredicate = (path: Room[]) => boolean;
type BinKind = 'tog' | 'apart' | 'adj';
interface BinPair {
  a: Sus;
  b: Sus;
  kind: BinKind;
  t: Hour;
}
interface CountConstraint {
  r: Room;
  t: Hour;
  n: number;
}
interface CwithConstraint {
  c: Sus;
  t: Hour;
}

export interface Compiled {
  unary: PathPredicate[][];
  pairs: BinPair[];
  counts: CountConstraint[];
  /** Por índice de recorrido: máscara de bits de los objetos compatibles con ese recorrido. */
  objMaskPath: Int32Array;
  /** Máscara de bits de los objetos que un sospechoso NO puede llevar (por `ncarry`). */
  notCarry: number[];
  /** cwith[o] = con quién debe coincidir el portador del objeto o, y a qué hora. */
  cwith: CwithConstraint[][];
}

export function compile(ctx: SolveContext, clues: Clue[]): Compiled {
  const { N, paths, graph } = ctx;
  const unary: PathPredicate[][] = Array.from({ length: N }, () => []);
  const bin: { other: Sus; kind: BinKind; t: Hour }[][] = Array.from({ length: N }, () => []);
  const counts: CountConstraint[] = [];
  const objPred: PathPredicate[][] = Array.from({ length: N }, () => []);
  const notCarry: number[] = new Array(N).fill(0);
  const cwith: CwithConstraint[][] = Array.from({ length: N }, () => []);

  const addBin = (a: Sus, b: Sus, kind: BinKind, t: Hour): void => {
    bin[a].push({ other: b, kind, t });
    bin[b].push({ other: a, kind, t });
  };

  for (const clue of clues) {
    switch (clue.k) {
      case 'at':
        unary[clue.c].push((p) => p[clue.t] === clue.r);
        break;
      case 'notat':
        unary[clue.c].push((p) => p[clue.t] !== clue.r);
        break;
      case 'feat':
        unary[clue.c].push((p) => graph.feat[p[clue.t]][clue.f] !== clue.neg);
        break;
      case 'never':
        unary[clue.c].push((p) => !p.includes(clue.r));
        break;
      case 'visited':
        unary[clue.c].push((p) => p.includes(clue.r));
        break;
      case 'stayed':
        unary[clue.c].push((p) => p.every((x) => x === p[0]));
        break;
      case 'moved':
        unary[clue.c].push((p) => p[clue.t] !== p[clue.t + 1]);
        break;
      case 'still':
        unary[clue.c].push((p) => p[clue.t] === p[clue.t + 1]);
        break;
      case 'together':
        addBin(clue.a, clue.b, 'tog', clue.t);
        break;
      case 'apart':
        addBin(clue.a, clue.b, 'apart', -1);
        break;
      case 'adj':
        addBin(clue.a, clue.b, 'adj', clue.t);
        break;
      case 'count':
        if (clue.n === 0) {
          for (let c = 0; c < N; c++) unary[c].push((p) => p[clue.t] !== clue.r);
        } else {
          counts.push({ r: clue.r, t: clue.t, n: clue.n });
        }
        break;
      case 'cat':
        objPred[clue.o].push((p) => p[clue.t] === clue.r);
        break;
      case 'cfeat':
        objPred[clue.o].push((p) => graph.feat[p[clue.t]][clue.f] !== clue.neg);
        break;
      case 'ncarry':
        notCarry[clue.c] |= 1 << clue.o;
        break;
      case 'cwith':
        cwith[clue.o].push({ c: clue.c, t: clue.t });
        break;
    }
  }

  const objMaskPath = new Int32Array(paths.length);
  for (let p = 0; p < paths.length; p++) {
    let mask = 0;
    for (let o = 0; o < N; o++) if (objPred[o].every((pred) => pred(paths[p]))) mask |= 1 << o;
    objMaskPath[p] = mask;
  }

  const pairs: BinPair[] = [];
  for (let a = 0; a < N; a++) {
    for (const entry of bin[a]) if (a < entry.other) pairs.push({ a, b: entry.other, kind: entry.kind, t: entry.t });
  }

  return { unary, pairs, counts, objMaskPath, notCarry, cwith };
}

function hasMatching(masks: number[], N: number): boolean {
  const matchOf: number[] = new Array(N).fill(-1);
  const tryAugment = (c: number, seen: boolean[]): boolean => {
    for (let o = 0; o < N; o++) {
      if (!((masks[c] >> o) & 1) || seen[o]) continue;
      seen[o] = true;
      if (matchOf[o] < 0 || tryAugment(matchOf[o], seen)) {
        matchOf[o] = c;
        return true;
      }
    }
    return false;
  };
  for (let c = 0; c < N; c++) if (!tryAugment(c, new Array(N).fill(false))) return false;
  return true;
}

function binOK(kind: BinKind, t: Hour, pathA: Room[], pathB: Room[], graph: Graph): boolean {
  if (kind === 'tog') return pathA[t] === pathB[t];
  if (kind === 'adj') return graph.adjM[pathA[t]][pathB[t]];
  for (let i = 0; i < pathA.length; i++) if (pathA[i] === pathB[i]) return false;
  return true;
}

export interface ExactSolution {
  rooms: Room[][];
  obj: Obj[];
}

class NodeBudgetExceeded extends Error {}

/**
 * ¿Existe una asignación completa que cumpla todas las pistas con `cand` de
 * culpable (y, si `weaponCand` no es null, con ese objeto como arma)? Sondea
 * hasta `limit` nodos de búsqueda; si se excede, lanza NodeBudgetExceeded
 * (capturada más abajo y traducida a 'limit').
 */
function exists(ctx: SolveContext, compiled: Compiled, cand: Sus, weaponCand: Obj | null, limit: number): ExactSolution | null | 'limit' {
  const { N, T, paths, rv, td, graph } = ctx;
  const roomCount = graph.adj.length;
  const all = (1 << N) - 1;
  const allowed: number[] = [];
  for (let c = 0; c < N; c++) {
    let mask = all & ~compiled.notCarry[c];
    if (weaponCand != null) mask = c === cand ? mask & (1 << weaponCand) : mask & ~(1 << weaponCand);
    allowed.push(mask);
  }

  const initialDomains: number[][] = [];
  for (let c = 0; c < N; c++) {
    const domain: number[] = [];
    const preds = compiled.unary[c];
    for (let p = 0; p < paths.length; p++) {
      const path = paths[p];
      if (c === cand ? path[td] !== rv : path[td] === rv) continue;
      if ((compiled.objMaskPath[p] & allowed[c]) === 0) continue;
      if (preds.every((pred) => pred(path))) domain.push(p);
    }
    if (domain.length === 0) return null;
    initialDomains.push(domain);
  }

  let nodes = 0;

  function propagate(domains: number[][]): boolean {
    let changed = true;
    let guard = 0;
    while (changed && guard++ < 30) {
      changed = false;
      for (const pair of compiled.pairs) {
        for (const [x, y] of [
          [pair.a, pair.b],
          [pair.b, pair.a],
        ] as const) {
          const dx = domains[x];
          const dy = domains[y];
          let filtered: number[];
          if (pair.kind === 'apart') {
            const forced: number[] = new Array(T).fill(-2);
            for (const p of dy) {
              const path = paths[p];
              for (let t = 0; t < T; t++) {
                if (forced[t] === -2) forced[t] = path[t];
                else if (forced[t] !== path[t]) forced[t] = -1;
              }
            }
            filtered = dx.filter((p) => {
              const path = paths[p];
              for (let t = 0; t < T; t++) if (forced[t] >= 0 && path[t] === forced[t]) return false;
              return true;
            });
          } else {
            const set = new Uint8Array(roomCount);
            for (const p of dy) set[paths[p][pair.t]] = 1;
            filtered = pair.kind === 'tog' ? dx.filter((p) => set[paths[p][pair.t]] === 1) : dx.filter((p) => graph.adj[paths[p][pair.t]].some((n) => set[n] === 1));
          }
          if (filtered.length === 0) return false;
          if (filtered.length !== dx.length) {
            domains[x] = filtered;
            changed = true;
          }
        }
      }

      for (const count of compiled.counts) {
        let lo = 0;
        let hi = 0;
        const anySus: boolean[] = [];
        const allSus: boolean[] = [];
        for (let c = 0; c < N; c++) {
          let any = false;
          let allIn = true;
          for (const p of domains[c]) {
            if (paths[p][count.t] === count.r) any = true;
            else allIn = false;
            if (any && !allIn) break;
          }
          anySus.push(any);
          allSus.push(allIn);
          if (any) hi++;
          if (allIn) lo++;
        }
        if (lo > count.n || hi < count.n) return false;
        if (lo === count.n && hi > lo) {
          for (let c = 0; c < N; c++) {
            if (anySus[c] && !allSus[c]) {
              domains[c] = domains[c].filter((p) => paths[p][count.t] !== count.r);
              changed = true;
            }
          }
        } else if (hi === count.n && hi > lo) {
          for (let c = 0; c < N; c++) {
            if (anySus[c] && !allSus[c]) {
              domains[c] = domains[c].filter((p) => paths[p][count.t] === count.r);
              changed = true;
            }
          }
        }
      }
    }

    const masks: number[] = [];
    for (let c = 0; c < N; c++) {
      let mask = 0;
      for (const p of domains[c]) {
        mask |= compiled.objMaskPath[p];
        if ((mask & allowed[c]) === allowed[c]) break;
      }
      mask &= allowed[c];
      if (!mask) return false;
      masks.push(mask);
    }
    return hasMatching(masks, N);
  }

  function assignObjects(assignment: number[]): Obj[] | null {
    const masks = assignment.map((p, c) => compiled.objMaskPath[p] & allowed[c]);
    const obj: Obj[] = new Array(N).fill(-1);
    const used: boolean[] = new Array(N).fill(false);
    const recurse = (c: number): boolean => {
      if (c === N) return true;
      for (let o = 0; o < N; o++) {
        if (used[o] || !((masks[c] >> o) & 1)) continue;
        let ok = true;
        for (const cw of compiled.cwith[o]) {
          if (c === cw.c || paths[assignment[c]][cw.t] !== paths[assignment[cw.c]][cw.t]) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        used[o] = true;
        obj[c] = o;
        if (recurse(c + 1)) return true;
        used[o] = false;
      }
      return false;
    };
    return recurse(0) ? obj : null;
  }

  function search(domains: number[][]): ExactSolution | null {
    nodes += 1;
    if (nodes > limit) throw new NodeBudgetExceeded();
    if (!propagate(domains)) return null;
    let best = -1;
    let bestSize = Infinity;
    for (let c = 0; c < N; c++) {
      if (domains[c].length > 1 && domains[c].length < bestSize) {
        bestSize = domains[c].length;
        best = c;
      }
    }
    if (best < 0) {
      const assignment = domains.map((d) => d[0]);
      for (const pair of compiled.pairs) {
        if (!binOK(pair.kind, pair.t, paths[assignment[pair.a]], paths[assignment[pair.b]], graph)) return null;
      }
      const obj = assignObjects(assignment);
      return obj ? { rooms: assignment.map((p) => paths[p]), obj } : null;
    }
    for (const p of domains[best]) {
      const next = domains.slice();
      next[best] = [p];
      const result = search(next);
      if (result) return result;
    }
    return null;
  }

  try {
    return search(initialDomains);
  } catch (error) {
    if (error instanceof NodeBudgetExceeded) return 'limit';
    throw error;
  }
}

export type UniquenessResult = { status: 'unique' } | { status: 'alt'; alt: ExactSolution } | { status: 'limit' };

/**
 * Comprueba la unicidad de la respuesta: busca un culpable distinto, o el
 * culpable verdadero con un arma distinta, que también cumpla todas las
 * pistas. `unique` la garantiza; `alt` trae la solución alternativa (para
 * guiar la selección de pistas, §7.3); `limit` es "no probado".
 */
export function checkUnique(ctx: SolveContext, culprit: Sus, weapon: Obj, clues: Clue[], limit = 15000): UniquenessResult {
  const compiled = compile(ctx, clues);
  for (let c = 0; c < ctx.N; c++) {
    if (c === culprit) continue;
    const result = exists(ctx, compiled, c, null, limit);
    if (result === 'limit') return { status: 'limit' };
    if (result) return { status: 'alt', alt: result };
  }
  for (let o = 0; o < ctx.N; o++) {
    if (o === weapon) continue;
    const result = exists(ctx, compiled, culprit, o, limit);
    if (result === 'limit') return { status: 'limit' };
    if (result) return { status: 'alt', alt: result };
  }
  return { status: 'unique' };
}
