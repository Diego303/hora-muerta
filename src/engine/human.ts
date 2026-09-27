// Solver humano (§9-10): resuelve razonando como una persona, con la regla más
// sencilla que avance en cada paso. Si se atasca, el caso no es válido (nunca
// hay que adivinar). Sin DOM: solo máscaras de bits y aritmética.
import type { Archetype, Clue, Conclusion, Graph, Hour, Obj, Room, Step, Sus } from './types';

export interface HumanContext {
  N: number;
  T: number;
  graph: Graph;
  rv: Room;
  td: Hour;
}

const bit = (i: number): number => 1 << i;
const fullMask = (n: number): number => (1 << n) - 1;
const popcount = (mask: number): number => {
  let m = mask;
  let c = 0;
  while (m) {
    m &= m - 1;
    c += 1;
  }
  return c;
};
const singleBit = (mask: number): number => {
  let i = 0;
  let m = mask;
  while (m > 1) {
    m >>>= 1;
    i += 1;
  }
  return i;
};
const bitsOf = (mask: number, n: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (mask & bit(i)) out.push(i);
  return out;
};

interface State {
  poss: number[][]; // poss[c][t]
  carry: number[]; // carry[c]
  cand: number;
}

export interface HumanSolution {
  /** Todos los pasos, en el orden en que se produjeron (no solo los críticos). */
  steps: Step[];
  score: number;
  maxLv: 1 | 2 | 3 | 4 | 5 | 6;
  /** Cuántos pasos de la cadena que identifica al culpable están en `maxLv`
   * (para el tope "como mucho N pasos de ese nivel" de §11: Novato/Comisario). */
  maxLvStepCount: number;
  /** Índice, dentro de `steps`, del paso de deducción clave. */
  key: number;
  arch: Archetype[];
}

const LEVEL_WEIGHT: Record<1 | 2 | 3 | 4 | 5 | 6, number> = { 1: 1, 2: 2, 3: 4, 4: 6, 5: 8, 6: 20 };

/** Tope de pasos de la propagación interna de una hipótesis (§9.2: "hasta un máximo de 12 pasos"). */
const MAX_HYPOTHESIS_STEPS = 12;

/**
 * Resuelve un caso como lo haría una persona (§9). Devuelve null si el solver
 * se atasca (el caso no sirve: exige adivinar).
 */
export function solveHuman(ctx: HumanContext, clues: Clue[]): HumanSolution | null {
  const roomCount = ctx.graph.adj.length;
  const allRooms = fullMask(roomCount);
  const allSus = fullMask(ctx.N);

  const state: State = {
    poss: Array.from({ length: ctx.N }, () => new Array(ctx.T).fill(allRooms) as number[]),
    carry: new Array(ctx.N).fill(allSus) as number[],
    cand: allSus,
  };
  const possSteps: number[][][] = Array.from({ length: ctx.N }, () => Array.from({ length: ctx.T }, () => [] as number[]));
  const carrySteps: number[][] = Array.from({ length: ctx.N }, () => []);
  const candSteps: number[] = [];
  const steps: Step[] = [];

  function isDone(): boolean {
    return popcount(state.cand) === 1 && popcount(state.carry[singleBit(state.cand)]) === 1;
  }

  function isContradiction(): boolean {
    if (state.cand === 0) return true;
    for (let c = 0; c < ctx.N; c++) {
      if (state.carry[c] === 0) return true;
      for (let t = 0; t < ctx.T; t++) if (state.poss[c][t] === 0) return true;
    }
    for (let o = 0; o < ctx.N; o++) {
      let hasCarrier = false;
      for (let c = 0; c < ctx.N; c++) if (state.carry[c] & bit(o)) hasCarrier = true;
      if (!hasCarrier) return true;
    }
    for (const clue of clues) {
      if (clue.k !== 'count') continue;
      let lo = 0;
      let hi = 0;
      for (let c = 0; c < ctx.N; c++) {
        const mask = state.poss[c][clue.t];
        if (mask & bit(clue.r)) hi += 1;
        if (mask === bit(clue.r)) lo += 1;
      }
      if (lo > clue.n || hi < clue.n) return true;
    }
    return false;
  }

  interface Delta {
    concl: Conclusion[];
    prem: number[];
  }

  function applyPoss(c: Sus, t: Hour, newMask: number): Delta | null {
    const before = state.poss[c][t];
    const after = before & newMask;
    if (after === before) return null;
    const prem = possSteps[c][t].slice();
    const removed = bitsOf(before & ~after, roomCount);
    state.poss[c][t] = after;
    possSteps[c][t].push(steps.length);
    const concl: Conclusion[] = removed.map((r): Conclusion => ({ k: 'notRoom', c, t, r }));
    if (popcount(after) === 1) concl.push({ k: 'isRoom', c, t, r: singleBit(after) });
    return { concl, prem };
  }

  function applyCarry(c: Sus, newMask: number): Delta | null {
    const before = state.carry[c];
    const after = before & newMask;
    if (after === before) return null;
    const prem = carrySteps[c].slice();
    const removed = bitsOf(before & ~after, ctx.N);
    state.carry[c] = after;
    carrySteps[c].push(steps.length);
    const concl: Conclusion[] = removed.map((o): Conclusion => ({ k: 'notCarry', c, o }));
    if (popcount(after) === 1) concl.push({ k: 'carry', c, o: singleBit(after) });
    return { concl, prem };
  }

  function applyCand(newMask: number): Delta | null {
    const before = state.cand;
    const after = before & newMask;
    if (after === before) return null;
    const prem = candSteps.slice();
    const removed = bitsOf(before & ~after, ctx.N);
    state.cand = after;
    candSteps.push(steps.length);
    const concl: Conclusion[] = removed.map((c): Conclusion => ({ k: 'notCulprit', c }));
    if (popcount(after) === 1) concl.push({ k: 'culprit', c: singleBit(after) });
    return { concl, prem };
  }

  function commit(lv: 1 | 2 | 3 | 4 | 5 | 6, rule: string, cl: number[], concl: Conclusion[], prem: number[]): true {
    steps.push({ lv, rule, cl, concl, prem: Array.from(new Set(prem)), crit: false });
    return true;
  }

  /**
   * Premisas reales de una hipótesis que llevó a contradicción (§9.2): los pasos
   * internos de la propagación (índices >= `fromLen`) se van a deshacer con
   * `restore()`, así que no pueden citarse tal cual en el `Step` final. En vez de
   * sobreestimar con TODOS los pasos anteriores del caso (inflaba cadenas de
   * Comisario a 60+ pasos en la práctica, medido al generar; ver
   * docs/DECISIONES.md), se recorre hacia atrás el `prem` de cada paso interno y
   * se queda solo con los índices reales (< `fromLen`) a los que en verdad
   * llegó la propagación: sigue siendo una sobreestimación aceptable (§9.4),
   * pero mucho más ajustada.
   */
  function collectExternalPrem(fromLen: number): number[] {
    const external = new Set<number>();
    const visited = new Set<number>();
    function visit(idx: number): void {
      if (idx < fromLen) {
        external.add(idx);
        return;
      }
      if (visited.has(idx)) return;
      visited.add(idx);
      for (const p of steps[idx].prem) visit(p);
    }
    for (let i = fromLen; i < steps.length; i++) visit(i);
    return Array.from(external);
  }

  interface Snapshot {
    poss: number[][];
    carry: number[];
    cand: number;
    possSteps: number[][][];
    carrySteps: number[][];
    candSteps: number[];
    stepsLength: number;
  }

  /** Copia el estado mutable para poder deshacer una hipótesis (§9.2) que no lleve a nada. */
  function snapshot(): Snapshot {
    return {
      poss: state.poss.map((row) => row.slice()),
      carry: state.carry.slice(),
      cand: state.cand,
      possSteps: possSteps.map((row) => row.map((arr) => arr.slice())),
      carrySteps: carrySteps.map((arr) => arr.slice()),
      candSteps: candSteps.slice(),
      stepsLength: steps.length,
    };
  }

  function restore(snap: Snapshot): void {
    for (let c = 0; c < ctx.N; c++) {
      state.poss[c] = snap.poss[c].slice();
      state.carry[c] = snap.carry[c];
      for (let t = 0; t < ctx.T; t++) possSteps[c][t] = snap.possSteps[c][t].slice();
      carrySteps[c] = snap.carrySteps[c].slice();
    }
    state.cand = snap.cand;
    candSteps.length = 0;
    candSteps.push(...snap.candSteps);
    steps.length = snap.stepsLength;
  }

  function closureOf(mask: number): number {
    let out = mask;
    for (let r = 0; r < roomCount; r++) if (mask & bit(r)) for (const nb of ctx.graph.adj[r]) out |= bit(nb);
    return out;
  }

  function neighborsOf(mask: number): number {
    let out = 0;
    for (let r = 0; r < roomCount; r++) if (mask & bit(r)) for (const nb of ctx.graph.adj[r]) out |= bit(nb);
    return out;
  }

  // ---------------- Nivel 1: lectura directa ----------------

  function ruleR1At(): boolean {
    for (let i = 0; i < clues.length; i++) {
      const clue = clues[i];
      if (clue.k !== 'at') continue;
      const res = applyPoss(clue.c, clue.t, bit(clue.r));
      if (res) return commit(1, 'R1_AT', [i], res.concl, res.prem);
    }
    return false;
  }

  function ruleR1NotAt(): boolean {
    for (let i = 0; i < clues.length; i++) {
      const clue = clues[i];
      if (clue.k !== 'notat') continue;
      const res = applyPoss(clue.c, clue.t, allRooms & ~bit(clue.r));
      if (res) return commit(1, 'R1_NOTAT', [i], res.concl, res.prem);
    }
    return false;
  }

  function ruleR1Feat(): boolean {
    for (let i = 0; i < clues.length; i++) {
      const clue = clues[i];
      if (clue.k !== 'feat') continue;
      let mask = 0;
      for (let r = 0; r < roomCount; r++) if (ctx.graph.feat[r][clue.f] !== clue.neg) mask |= bit(r);
      const res = applyPoss(clue.c, clue.t, mask);
      if (res) return commit(1, 'R1_FEAT', [i], res.concl, res.prem);
    }
    return false;
  }

  function ruleR1Never(): boolean {
    for (let i = 0; i < clues.length; i++) {
      const clue = clues[i];
      if (clue.k !== 'never') continue;
      let concl: Conclusion[] = [];
      let prem: number[] = [];
      for (let t = 0; t < ctx.T; t++) {
        const res = applyPoss(clue.c, t, allRooms & ~bit(clue.r));
        if (res) {
          concl = concl.concat(res.concl);
          prem = prem.concat(res.prem);
        }
      }
      if (concl.length) return commit(1, 'R1_NEVER', [i], concl, prem);
    }
    return false;
  }

  function ruleR1Stayed(): boolean {
    for (let i = 0; i < clues.length; i++) {
      const clue = clues[i];
      if (clue.k !== 'stayed') continue;
      let common = allRooms;
      for (let t = 0; t < ctx.T; t++) common &= state.poss[clue.c][t];
      let concl: Conclusion[] = [];
      let prem: number[] = [];
      for (let t = 0; t < ctx.T; t++) {
        const res = applyPoss(clue.c, t, common);
        if (res) {
          concl = concl.concat(res.concl);
          prem = prem.concat(res.prem);
        }
      }
      if (concl.length) return commit(1, 'R1_STAYED', [i], concl, prem);
    }
    return false;
  }

  function ruleR1Ncarry(): boolean {
    for (let i = 0; i < clues.length; i++) {
      const clue = clues[i];
      if (clue.k !== 'ncarry') continue;
      const res = applyCarry(clue.c, allSus & ~bit(clue.o));
      if (res) return commit(1, 'R1_NCARRY', [i], res.concl, res.prem);
    }
    return false;
  }

  function ruleR1Empty(): boolean {
    for (let i = 0; i < clues.length; i++) {
      const clue = clues[i];
      if (clue.k !== 'count' || clue.n !== 0) continue;
      let concl: Conclusion[] = [];
      let prem: number[] = [];
      for (let c = 0; c < ctx.N; c++) {
        const res = applyPoss(c, clue.t, allRooms & ~bit(clue.r));
        if (res) {
          concl = concl.concat(res.concl);
          prem = prem.concat(res.prem);
        }
      }
      if (concl.length) return commit(1, 'R1_EMPTY', [i], concl, prem);
    }
    return false;
  }

  // ---------------- Nivel 2: la regla del crimen ----------------

  function ruleR2CantBeThere(): boolean {
    for (let c = 0; c < ctx.N; c++) {
      if (!(state.cand & bit(c))) continue;
      if (state.poss[c][ctx.td] & bit(ctx.rv)) continue;
      const res = applyCand(allSus & ~bit(c));
      if (res) return commit(2, 'R2_CANT_BE_THERE', [], res.concl, res.prem.concat(possSteps[c][ctx.td]));
    }
    return false;
  }

  function ruleR2OnlyOne(): boolean {
    if (popcount(state.cand) <= 1) return false;
    const possible: number[] = [];
    for (let c = 0; c < ctx.N; c++) if (state.cand & bit(c) && state.poss[c][ctx.td] & bit(ctx.rv)) possible.push(c);
    if (possible.length !== 1) return false;
    const only = possible[0];
    const res = applyCand(bit(only));
    if (!res) return false;
    let prem = res.prem;
    for (let c = 0; c < ctx.N; c++) if (c !== only) prem = prem.concat(possSteps[c][ctx.td]);
    return commit(2, 'R2_ONLY_ONE', [], res.concl, prem);
  }

  /** Si ya solo queda un candidato (por la vía que sea: R2_ONLY_ONE lo deja así
   * directamente, pero R4_TOGETHER u otras eliminaciones también pueden dejar
   * cand con un solo bit), ESE es quien estaba a solas con la víctima: fija su
   * sala en la hora del crimen, aunque poss aún no lo reflejara. */
  function ruleR2PinCulprit(): boolean {
    if (popcount(state.cand) !== 1) return false;
    const c = singleBit(state.cand);
    const res = applyPoss(c, ctx.td, bit(ctx.rv));
    if (!res) return false;
    return commit(2, 'R2_ONLY_ONE', [], res.concl, res.prem.concat(candSteps));
  }

  function ruleR2Taken(): boolean {
    let taken = -1;
    for (let c = 0; c < ctx.N; c++) {
      if (state.poss[c][ctx.td] === bit(ctx.rv)) {
        taken = c;
        break;
      }
    }
    if (taken < 0) return false;
    let concl: Conclusion[] = [];
    let prem: number[] = possSteps[taken][ctx.td].slice();
    for (let d = 0; d < ctx.N; d++) {
      if (d === taken) continue;
      const res = applyPoss(d, ctx.td, allRooms & ~bit(ctx.rv));
      if (res) {
        concl = concl.concat(res.concl);
        prem = prem.concat(res.prem);
      }
    }
    if (concl.length) return commit(2, 'R2_TAKEN', [], concl, prem);
    return false;
  }

  // ---------------- Nivel 3: alcance ----------------

  function ruleR3ReachFwd(): boolean {
    for (let c = 0; c < ctx.N; c++) {
      for (let t = 0; t < ctx.T - 1; t++) {
        const res = applyPoss(c, t + 1, closureOf(state.poss[c][t]));
        if (res) return commit(3, 'R3_REACH_FWD', [], res.concl, res.prem.concat(possSteps[c][t]));
      }
    }
    return false;
  }

  function ruleR3ReachBwd(): boolean {
    for (let c = 0; c < ctx.N; c++) {
      for (let t = ctx.T - 1; t > 0; t--) {
        const res = applyPoss(c, t - 1, closureOf(state.poss[c][t]));
        if (res) return commit(3, 'R3_REACH_BWD', [], res.concl, res.prem.concat(possSteps[c][t]));
      }
    }
    return false;
  }

  function ruleR3Still(): boolean {
    for (let i = 0; i < clues.length; i++) {
      const clue = clues[i];
      if (clue.k !== 'still') continue;
      const common = state.poss[clue.c][clue.t] & state.poss[clue.c][clue.t + 1];
      const res1 = applyPoss(clue.c, clue.t, common);
      const res2 = applyPoss(clue.c, clue.t + 1, common);
      if (res1 || res2) {
        const concl = (res1?.concl ?? []).concat(res2?.concl ?? []);
        const prem = (res1?.prem ?? []).concat(res2?.prem ?? []);
        return commit(3, 'R3_STILL', [i], concl, prem);
      }
    }
    return false;
  }

  function ruleR3Moved(): boolean {
    for (let i = 0; i < clues.length; i++) {
      const clue = clues[i];
      if (clue.k !== 'moved') continue;
      let concl: Conclusion[] = [];
      let prem: number[] = [];
      if (popcount(state.poss[clue.c][clue.t]) === 1) {
        const r = singleBit(state.poss[clue.c][clue.t]);
        const res = applyPoss(clue.c, clue.t + 1, allRooms & ~bit(r));
        if (res) {
          concl = concl.concat(res.concl);
          prem = prem.concat(res.prem, possSteps[clue.c][clue.t]);
        }
      }
      if (popcount(state.poss[clue.c][clue.t + 1]) === 1) {
        const r = singleBit(state.poss[clue.c][clue.t + 1]);
        const res = applyPoss(clue.c, clue.t, allRooms & ~bit(r));
        if (res) {
          concl = concl.concat(res.concl);
          prem = prem.concat(res.prem, possSteps[clue.c][clue.t + 1]);
        }
      }
      if (concl.length) return commit(3, 'R3_MOVED', [i], concl, prem);
    }
    return false;
  }

  // ---------------- Nivel 4: cruce ----------------

  function ruleR4Together(): boolean {
    for (let i = 0; i < clues.length; i++) {
      const clue = clues[i];
      if (clue.k !== 'together') continue;

      // Arquetipo "la pareja inseparable" (§10.2, Apéndice D paso 4): si van
      // juntos a la hora del crimen, ninguno de los dos pudo estar a solas con
      // la víctima (regla 2), sea cual sea la sala en la que coincidieran.
      if (clue.t === ctx.td && (state.cand & bit(clue.a) || state.cand & bit(clue.b))) {
        const res = applyCand(allSus & ~bit(clue.a) & ~bit(clue.b));
        if (res) return commit(4, 'R4_TOGETHER', [i], res.concl, res.prem);
      }

      const common = state.poss[clue.a][clue.t] & state.poss[clue.b][clue.t];
      const res1 = applyPoss(clue.a, clue.t, common);
      const res2 = applyPoss(clue.b, clue.t, common);
      if (res1 || res2) {
        const concl = (res1?.concl ?? []).concat(res2?.concl ?? []);
        const prem = (res1?.prem ?? []).concat(res2?.prem ?? []);
        return commit(4, 'R4_TOGETHER', [i], concl, prem);
      }
    }
    return false;
  }

  function ruleR4Adj(): boolean {
    for (let i = 0; i < clues.length; i++) {
      const clue = clues[i];
      if (clue.k !== 'adj') continue;
      const res1 = applyPoss(clue.a, clue.t, neighborsOf(state.poss[clue.b][clue.t]));
      const res2 = applyPoss(clue.b, clue.t, neighborsOf(state.poss[clue.a][clue.t]));
      if (res1 || res2) {
        const concl = (res1?.concl ?? []).concat(res2?.concl ?? []);
        const prem = (res1?.prem ?? []).concat(res2?.prem ?? []);
        return commit(4, 'R4_ADJ', [i], concl, prem);
      }
    }
    return false;
  }

  function ruleR4Apart(): boolean {
    for (let i = 0; i < clues.length; i++) {
      const clue = clues[i];
      if (clue.k !== 'apart') continue;
      let concl: Conclusion[] = [];
      let prem: number[] = [];
      for (let t = 0; t < ctx.T; t++) {
        if (popcount(state.poss[clue.b][t]) === 1) {
          const r = singleBit(state.poss[clue.b][t]);
          const res = applyPoss(clue.a, t, allRooms & ~bit(r));
          if (res) {
            concl = concl.concat(res.concl);
            prem = prem.concat(res.prem, possSteps[clue.b][t]);
          }
        }
        if (popcount(state.poss[clue.a][t]) === 1) {
          const r = singleBit(state.poss[clue.a][t]);
          const res = applyPoss(clue.b, t, allRooms & ~bit(r));
          if (res) {
            concl = concl.concat(res.concl);
            prem = prem.concat(res.prem, possSteps[clue.a][t]);
          }
        }
      }
      if (concl.length) return commit(4, 'R4_APART', [i], concl, prem);
    }
    return false;
  }

  function ruleR4CountFull(): boolean {
    for (let i = 0; i < clues.length; i++) {
      const clue = clues[i];
      if (clue.k !== 'count') continue;
      const sureCs: number[] = [];
      const maybeCs: number[] = [];
      for (let c = 0; c < ctx.N; c++) {
        const mask = state.poss[c][clue.t];
        if (mask === bit(clue.r)) sureCs.push(c);
        else if (mask & bit(clue.r)) maybeCs.push(c);
      }
      if (sureCs.length === clue.n && maybeCs.length > 0) {
        let concl: Conclusion[] = [];
        let prem: number[] = sureCs.flatMap((c) => possSteps[c][clue.t]);
        for (const c of maybeCs) {
          const res = applyPoss(c, clue.t, allRooms & ~bit(clue.r));
          if (res) {
            concl = concl.concat(res.concl);
            prem = prem.concat(res.prem);
          }
        }
        if (concl.length) return commit(4, 'R4_COUNT_FULL', [i], concl, prem);
      }
    }
    return false;
  }

  function ruleR4CountNeed(): boolean {
    for (let i = 0; i < clues.length; i++) {
      const clue = clues[i];
      if (clue.k !== 'count') continue;
      const candidates: number[] = [];
      for (let c = 0; c < ctx.N; c++) if (state.poss[c][clue.t] & bit(clue.r)) candidates.push(c);
      if (candidates.length === clue.n) {
        let concl: Conclusion[] = [];
        let prem: number[] = [];
        for (const c of candidates) {
          const res = applyPoss(c, clue.t, bit(clue.r));
          if (res) {
            concl = concl.concat(res.concl);
            prem = prem.concat(res.prem);
          }
        }
        if (concl.length) return commit(4, 'R4_COUNT_NEED', [i], concl, prem);
      }
    }
    return false;
  }

  function ruleR4ObjWhere(): boolean {
    for (let i = 0; i < clues.length; i++) {
      const clue = clues[i];
      if (clue.k !== 'cat' && clue.k !== 'cfeat') continue;
      const isCat = clue.k === 'cat';
      const targetRoom = clue.k === 'cat' ? clue.r : -1;
      const targetFeat = clue.k === 'cfeat' ? clue.f : 0;
      const targetNeg = clue.k === 'cfeat' ? clue.neg : false;
      const roomOk = (r: Room): boolean => (isCat ? r === targetRoom : ctx.graph.feat[r][targetFeat] !== targetNeg);
      let concl: Conclusion[] = [];
      let prem: number[] = [];
      const possibleCarriers: number[] = [];
      for (let c = 0; c < ctx.N; c++) {
        if (!(state.carry[c] & bit(clue.o))) continue;
        let canSatisfy = false;
        for (let r = 0; r < roomCount; r++) if (state.poss[c][clue.t] & bit(r) && roomOk(r)) canSatisfy = true;
        if (canSatisfy) {
          possibleCarriers.push(c);
        } else {
          const res = applyCarry(c, allSus & ~bit(clue.o));
          if (res) {
            concl = concl.concat(res.concl);
            prem = prem.concat(res.prem, possSteps[c][clue.t]);
          }
        }
      }
      if (concl.length) return commit(4, 'R4_OBJ_WHERE', [i], concl, prem);
      if (possibleCarriers.length === 1) {
        const c = possibleCarriers[0];
        let mask = 0;
        for (let r = 0; r < roomCount; r++) if (roomOk(r)) mask |= bit(r);
        const res = applyPoss(c, clue.t, mask);
        if (res) return commit(4, 'R4_OBJ_WHERE', [i], res.concl, res.prem.concat(carrySteps[c]));
      }
    }
    return false;
  }

  function ruleR4ObjWith(): boolean {
    for (let i = 0; i < clues.length; i++) {
      const clue = clues[i];
      if (clue.k !== 'cwith') continue;
      const res0 = applyCarry(clue.c, allSus & ~bit(clue.o));
      if (res0) return commit(4, 'R4_OBJ_WITH', [i], res0.concl, res0.prem);

      let concl: Conclusion[] = [];
      let prem: number[] = [];
      const possibleCarriers: number[] = [];
      for (let c = 0; c < ctx.N; c++) {
        if (c === clue.c) continue;
        if (!(state.carry[c] & bit(clue.o))) continue;
        const canCoincide = (state.poss[c][clue.t] & state.poss[clue.c][clue.t]) !== 0;
        if (canCoincide) {
          possibleCarriers.push(c);
        } else {
          const res = applyCarry(c, allSus & ~bit(clue.o));
          if (res) {
            concl = concl.concat(res.concl);
            prem = prem.concat(res.prem, possSteps[c][clue.t], possSteps[clue.c][clue.t]);
          }
        }
      }
      if (concl.length) return commit(4, 'R4_OBJ_WITH', [i], concl, prem);
      if (possibleCarriers.length === 1) {
        const c = possibleCarriers[0];
        const res = applyPoss(c, clue.t, state.poss[clue.c][clue.t]);
        if (res) return commit(4, 'R4_OBJ_WITH', [i], res.concl, res.prem.concat(carrySteps[c], possSteps[clue.c][clue.t]));
      }
    }
    return false;
  }

  function ruleR4Visited(): boolean {
    for (let i = 0; i < clues.length; i++) {
      const clue = clues[i];
      if (clue.k !== 'visited') continue;
      const hoursOk: number[] = [];
      for (let t = 0; t < ctx.T; t++) if (state.poss[clue.c][t] & bit(clue.r)) hoursOk.push(t);
      if (hoursOk.length !== 1) continue;
      const t = hoursOk[0];
      const res = applyPoss(clue.c, t, bit(clue.r));
      if (!res) continue;
      let prem = res.prem;
      for (let tt = 0; tt < ctx.T; tt++) if (tt !== t) prem = prem.concat(possSteps[clue.c][tt]);
      return commit(4, 'R4_VISITED', [i], res.concl, prem);
    }
    return false;
  }

  // ---------------- Nivel 5: agotamiento ----------------

  function ruleR5ObjSingle(): boolean {
    for (let o = 0; o < ctx.N; o++) {
      const carriers: number[] = [];
      for (let c = 0; c < ctx.N; c++) if (state.carry[c] & bit(o)) carriers.push(c);
      if (carriers.length !== 1) continue;
      const c = carriers[0];
      if (popcount(state.carry[c]) <= 1) continue;
      const res = applyCarry(c, bit(o));
      if (!res) continue;
      let prem = res.prem;
      for (let cc = 0; cc < ctx.N; cc++) if (cc !== c) prem = prem.concat(carrySteps[cc]);
      return commit(5, 'R5_OBJ_SINGLE', [], res.concl, prem);
    }
    return false;
  }

  function ruleR5SusSingle(): boolean {
    for (let d = 0; d < ctx.N; d++) {
      if (popcount(state.carry[d]) !== 1) continue;
      const o = singleBit(state.carry[d]);
      let concl: Conclusion[] = [];
      let prem: number[] = carrySteps[d].slice();
      for (let c = 0; c < ctx.N; c++) {
        if (c === d) continue;
        if (!(state.carry[c] & bit(o))) continue;
        const res = applyCarry(c, allSus & ~bit(o));
        if (res) {
          concl = concl.concat(res.concl);
          prem = prem.concat(res.prem);
        }
      }
      if (concl.length) return commit(5, 'R5_SUS_SINGLE', [], concl, prem);
    }
    return false;
  }

  // ---------------- Nivel 6: hipótesis corta ----------------

  const BASE_LEVELS: (() => boolean)[][] = [
    [ruleR1At, ruleR1NotAt, ruleR1Feat, ruleR1Never, ruleR1Stayed, ruleR1Ncarry, ruleR1Empty],
    [ruleR2CantBeThere, ruleR2OnlyOne, ruleR2PinCulprit, ruleR2Taken],
    [ruleR3ReachFwd, ruleR3ReachBwd, ruleR3Still, ruleR3Moved],
    [ruleR4Together, ruleR4Adj, ruleR4Apart, ruleR4CountFull, ruleR4CountNeed, ruleR4ObjWhere, ruleR4ObjWith, ruleR4Visited],
    [ruleR5ObjSingle, ruleR5SusSingle],
  ];

  /** Propaga solo con niveles 1-5 (profundidad 1: nunca se anida una hipótesis
   * dentro de otra) hasta `MAX_HYPOTHESIS_STEPS` pasos o hasta contradicción. */
  function propagateForContradiction(maxSteps: number): boolean {
    for (let i = 0; i < maxSteps; i++) {
      if (isContradiction()) return true;
      let applied = false;
      for (const level of BASE_LEVELS) {
        for (const rule of level) {
          if (rule()) {
            applied = true;
            break;
          }
        }
        if (applied) break;
      }
      if (!applied) break;
    }
    return isContradiction();
  }

  /** Supone "fue X" para cada candidato que queda; si lleva a contradicción, X no es el culpable. */
  function ruleR6HypCulprit(): boolean {
    for (const c of bitsOf(state.cand, ctx.N)) {
      const before = snapshot();
      state.cand = bit(c);
      const contradiction = propagateForContradiction(MAX_HYPOTHESIS_STEPS);
      const hypPrem = contradiction ? collectExternalPrem(before.stepsLength) : [];
      restore(before);
      if (!contradiction) continue;
      const res = applyCand(allSus & ~bit(c));
      if (!res) continue;
      return commit(6, 'R6_HYPOTHESIS', [], res.concl, res.prem.concat(hypPrem));
    }
    return false;
  }

  /** Supone "X estaba en R a la hora T" para cada celda con exactamente 2 salas
   * posibles; si una de las dos lleva a contradicción, la otra es la buena. */
  function ruleR6HypCell(): boolean {
    for (let c = 0; c < ctx.N; c++) {
      for (let t = 0; t < ctx.T; t++) {
        if (popcount(state.poss[c][t]) !== 2) continue;
        for (const r of bitsOf(state.poss[c][t], roomCount)) {
          const before = snapshot();
          state.poss[c][t] = bit(r);
          const contradiction = propagateForContradiction(MAX_HYPOTHESIS_STEPS);
          const hypPrem = contradiction ? collectExternalPrem(before.stepsLength) : [];
          restore(before);
          if (!contradiction) continue;
          const res = applyPoss(c, t, allRooms & ~bit(r));
          if (!res) continue;
          return commit(6, 'R6_HYPOTHESIS', [], res.concl, res.prem.concat(hypPrem));
        }
      }
    }
    return false;
  }

  const LEVELS: (() => boolean)[][] = [...BASE_LEVELS, [ruleR6HypCulprit, ruleR6HypCell]];

  while (!isDone()) {
    if (isContradiction()) return null;
    let applied = false;
    for (const level of LEVELS) {
      for (const rule of level) {
        if (rule()) {
          applied = true;
          break;
        }
      }
      if (applied) break;
    }
    if (!applied) return null; // atascado: el caso exige más de lo que el solver humano sabe hacer
  }

  // Cierre (§Apéndice D, pasos 10-11: R5_SUS_SINGLE y luego, aparte, R5_WEAPON).
  const culprit = singleBit(state.cand);
  const weapon = singleBit(state.carry[culprit]);
  // Solo concluye el arma, no "culprit" de nuevo (eso ya lo concluyó un paso
  // anterior): si repitiera "culprit" aquí, esta cadena de premisas —que
  // incluye la eliminación de objetos— se colaría en culpritIndices y volvería
  // a inflar el nivel máximo (ver comentario más abajo).
  commit(5, 'R5_WEAPON', [], [{ k: 'carry', c: culprit, o: weapon }], candSteps.concat(carrySteps[culprit]));

  // El Apéndice D distingue la cadena completa (11 pasos, incluidos los que solo
  // determinan el arma tras conocer ya al culpable) de "el nivel máximo" y la
  // puntuación, que solo cuentan la parte que identifica AL CULPABLE (pasos 1-5
  // en ese ejemplo: puntuación 1+4+2+6+2=15, nivel máximo 4, aunque los pasos
  // 10-11 sean de nivel 5). Ver docs/DECISIONES.md.
  const { fullIndices, culpritIndices } = markCriticalChain(steps, culprit, weapon);
  for (const i of fullIndices) steps[i].crit = true;

  const culpritSteps = culpritIndices.map((i) => steps[i]);
  const score = culpritSteps.reduce((sum, step) => sum + LEVEL_WEIGHT[step.lv], 0);
  const maxLv = culpritSteps.reduce<1 | 2 | 3 | 4 | 5 | 6>((max, step) => (step.lv > max ? step.lv : max), 1);
  const maxLvStepCount = culpritSteps.filter((step) => step.lv === maxLv).length;
  const key = pickKeyStep(culpritIndices, steps, culprit);
  const arch = detectArchetypes(culpritIndices, steps, key);

  return { steps, score, maxLv, maxLvStepCount, key, arch };
}

/** Cadena crítica (§9.4): desde los pasos que fijan culpable/arma, hacia atrás por las premisas. */
function reachableBackward(steps: Step[], isTerminal: (step: Step) => boolean): number[] {
  const reachable = new Set<number>();
  const queue: number[] = [];
  steps.forEach((step, i) => {
    if (isTerminal(step)) queue.push(i);
  });
  while (queue.length > 0) {
    const i = queue.pop();
    if (i === undefined || reachable.has(i)) continue;
    reachable.add(i);
    for (const p of steps[i].prem) if (!reachable.has(p)) queue.push(p);
  }
  return Array.from(reachable).sort((a, b) => a - b);
}

/** `culpritIndices`: solo lo necesario para saber QUIÉN es (§9.4, base de nivel/puntuación/clave).
 * `fullIndices`: añade además lo necesario para saber el arma (para `solve.steps`, la cadena completa
 * que se enseña al cerrar el caso, como los 11 pasos del Apéndice D). */
function markCriticalChain(steps: Step[], culprit: Sus, weapon: Obj): { fullIndices: number[]; culpritIndices: number[] } {
  const culpritIndices = reachableBackward(steps, (step) => step.concl.some((c) => c.k === 'culprit' && c.c === culprit));
  const weaponIndices = reachableBackward(steps, (step) => step.concl.some((c) => c.k === 'carry' && c.c === culprit && c.o === weapon));
  const fullIndices = Array.from(new Set([...culpritIndices, ...weaponIndices])).sort((a, b) => a - b);
  return { fullIndices, culpritIndices };
}

/** Deducción clave (§10.1): el paso crítico de mayor nivel que descarta un candidato
 * (o fija culpable/arma); en empate, el último de la cadena (no se desempata por
 * "más candidatos elimina": ver docs/DECISIONES.md). */
function pickKeyStep(criticalIndices: number[], steps: Step[], culprit: Sus): number {
  let best = criticalIndices[0];
  for (const i of criticalIndices) {
    const step = steps[i];
    const decides = step.concl.some((c) => c.k === 'notCulprit' || c.k === 'culprit' || (c.k === 'carry' && c.c === culprit));
    if (!decides) continue;
    if (step.lv >= steps[best].lv) best = i;
  }
  return best;
}

/** Arquetipos (§10.2) detectables sin R6_HYPOTHESIS (callejón queda pendiente, ver DECISIONES.md). */
function detectArchetypes(criticalIndices: number[], steps: Step[], key: number): Archetype[] {
  const rules = new Set(criticalIndices.map((i) => steps[i].rule));
  const found: Archetype[] = [];
  const keyRule = steps[key].rule;

  const hasReachThenCant = criticalIndices.some(
    (i, idx) => steps[i].rule.startsWith('R3_REACH') && criticalIndices.slice(idx + 1).some((j) => steps[j].rule === 'R2_CANT_BE_THERE' && steps[j].prem.includes(i)),
  );
  if (hasReachThenCant) found.push('coartada');
  const hasPairElimination = criticalIndices.some(
    (i) => steps[i].rule === 'R4_TOGETHER' && steps[i].concl.filter((c) => c.k === 'notCulprit').length >= 2,
  );
  if (hasPairElimination) found.push('pareja');
  if (rules.has('R4_COUNT_FULL') || rules.has('R4_COUNT_NEED')) found.push('recuento');
  // "objeto" exige que sea la propia deducción clave la que ligue el objeto a su portador (§10.2).
  if (keyRule === 'R4_OBJ_WHERE' || keyRule === 'R4_OBJ_WITH' || keyRule === 'R5_OBJ_SINGLE') found.push('objeto');
  if (rules.has('R1_EMPTY')) found.push('vacia');
  // "callejón sin salida" (§10.2): la cadena usa una hipótesis (solo posible en Comisario, §11).
  if (rules.has('R6_HYPOTHESIS')) found.push('callejon');

  // El primero de la lista es el de la deducción clave, si su regla corresponde a un arquetipo detectado.
  const keyArch: Partial<Record<string, Archetype>> = {
    R2_CANT_BE_THERE: 'coartada',
    R4_TOGETHER: 'pareja',
    R4_COUNT_FULL: 'recuento',
    R4_COUNT_NEED: 'recuento',
    R4_OBJ_WHERE: 'objeto',
    R4_OBJ_WITH: 'objeto',
    R5_OBJ_SINGLE: 'objeto',
    R6_HYPOTHESIS: 'callejon',
  };
  const primary = keyArch[keyRule];
  // Si no se reconoce ningún patrón (heurística simplificada, ver docs/DECISIONES.md),
  // se deja la lista vacía en vez de etiquetar con un arquetipo que no corresponde.
  return primary && found.includes(primary) ? [primary, ...found.filter((a) => a !== primary)] : found;
}
