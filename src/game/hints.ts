// Pista del inspector (§15): revisión de marcas contradictorias, y si no hay
// ninguna, el siguiente paso no reflejado de la cadena crítica. Nunca revela
// la solución entera, solo el siguiente paso lógico. Sin DOM.
import type { CaseDef, Conclusion, Hour, Obj, Room, Step, Sus } from '../engine/types';
import { markKey, objGridKey } from './store';
import type { GameState } from './store';

export interface MarkErrorHint {
  kind: 'markError';
  hour: Hour | null;
  room: Room | null;
  obj: Obj | null;
  suspect: Sus;
}

export interface StepHint {
  kind: 'step';
  stepIndex: number;
}

export interface DoneHint {
  kind: 'done';
}

export type Hint = MarkErrorHint | StepHint | DoneHint;

/** Marcas, tabla de objetos o descartes que contradicen la verdad (§15.1, paso 1):
 * evita que alguien se quede atascado por un error antiguo sin saberlo. */
function findMarkError(caseData: CaseDef, state: GameState, roomCount: number): MarkErrorHint | null {
  for (let t = 0; t < caseData.T; t++) {
    for (let r = 0; r < roomCount; r++) {
      for (let c = 0; c < caseData.N; c++) {
        const value = state.marks.get(markKey(t, r, c));
        if (!value) continue;
        const actuallyThere = caseData.truth.rooms[c][t] === r;
        if ((value === 1 && !actuallyThere) || (value === 2 && actuallyThere)) {
          return { kind: 'markError', hour: t, room: r, obj: null, suspect: c };
        }
      }
    }
  }
  for (let o = 0; o < caseData.N; o++) {
    for (let c = 0; c < caseData.N; c++) {
      const value = state.objGrid.get(objGridKey(o, c));
      if (!value) continue;
      const actuallyCarries = caseData.truth.obj[c] === o;
      if ((value === 1 && !actuallyCarries) || (value === 2 && actuallyCarries)) {
        return { kind: 'markError', hour: null, room: null, obj: o, suspect: c };
      }
    }
  }
  if (state.discarded.has(caseData.culprit)) {
    return { kind: 'markError', hour: null, room: null, obj: null, suspect: caseData.culprit };
  }
  return null;
}

function isConclusionReflected(concl: Conclusion, state: GameState, caseData: CaseDef, roomCount: number): boolean {
  switch (concl.k) {
    case 'notRoom': {
      if (state.marks.get(markKey(concl.t, concl.r, concl.c)) === 2) return true;
      for (let r = 0; r < roomCount; r++) {
        if (r !== concl.r && state.marks.get(markKey(concl.t, r, concl.c)) === 1) return true;
      }
      return false;
    }
    case 'isRoom':
      return state.marks.get(markKey(concl.t, concl.r, concl.c)) === 1;
    case 'notCarry':
      return state.objGrid.get(objGridKey(concl.o, concl.c)) === 2;
    case 'carry':
      return state.objGrid.get(objGridKey(concl.o, concl.c)) === 1;
    case 'notCulprit':
      return state.discarded.has(concl.c);
    case 'culprit':
      for (let c = 0; c < caseData.N; c++) {
        if (c !== concl.c && !state.discarded.has(c)) return false;
      }
      return true;
  }
}

function computeDependents(steps: Step[]): number[][] {
  const deps: number[][] = steps.map(() => []);
  steps.forEach((step, j) => {
    for (const p of step.prem) deps[p].push(j);
  });
  return deps;
}

/** Reflejado (§15.1, paso 2): directamente por las marcas, o si no, cuando todos los
 * pasos que dependen de él (lo usan como premisa) ya lo están — para los pasos
 * intermedios que reducen posibilidades sin fijar una sola sala u objeto. */
function isStepReflected(steps: Step[], idx: number, deps: number[][], state: GameState, caseData: CaseDef, roomCount: number, cache: Map<number, boolean>): boolean {
  const cached = cache.get(idx);
  if (cached !== undefined) return cached;
  const step = steps[idx];
  const direct = step.concl.every((concl) => isConclusionReflected(concl, state, caseData, roomCount));
  if (direct) {
    cache.set(idx, true);
    return true;
  }
  const dependents = deps[idx];
  const result = dependents.length > 0 && dependents.every((j) => isStepReflected(steps, j, deps, state, caseData, roomCount, cache));
  cache.set(idx, result);
  return result;
}

/** Siguiente pista del inspector (§15): revisión de marcas primero, luego el
 * primer paso no reflejado de la cadena crítica, o 'done' si ya está todo. */
export function nextHint(caseData: CaseDef, roomCount: number, state: GameState): Hint {
  const markError = findMarkError(caseData, state, roomCount);
  if (markError) return markError;

  const steps = caseData.solve.steps;
  const deps = computeDependents(steps);
  const cache = new Map<number, boolean>();
  for (let i = 0; i < steps.length; i++) {
    if (!isStepReflected(steps, i, deps, state, caseData, roomCount, cache)) return { kind: 'step', stepIndex: i };
  }
  return { kind: 'done' };
}
