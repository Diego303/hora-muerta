// Estrellas, acusación y cierre (§14.1, §14.3, §14.4). Pura lógica: sin DOM.
import type { CaseDef, Obj, Sus } from '../engine/types';

export type CaseResult = 'playing' | 'solved' | 'archived';

/** 3 estrellas al empezar, -1 por acusación errónea y -1 por pista solicitada; mínimo 0 (§14.1). */
export function computeStars(errors: number, hintsUsed: number): number {
  return Math.max(0, 3 - errors - hintsUsed);
}

export interface AccusationOutcome {
  correct: boolean;
  /** Errores acumulados tras esta acusación (incluida, si fue errónea). */
  errors: number;
  /** Resultado del caso tras esta acusación. */
  result: CaseResult;
}

/** Con 2 acusaciones erróneas el caso se archiva sin resolver (§14.1). */
const MAX_ERRORS = 2;

export function checkAccusation(caseData: CaseDef, culprit: Sus, weapon: Obj, priorErrors: number): AccusationOutcome {
  const correct = culprit === caseData.culprit && weapon === caseData.weapon;
  if (correct) return { correct, errors: priorErrors, result: 'solved' };
  const errors = priorErrors + 1;
  return { correct, errors, result: errors >= MAX_ERRORS ? 'archived' : 'playing' };
}
