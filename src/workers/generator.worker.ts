// Modo infinito (§13, §19.1): genera casos con el mismo generador y los mismos
// filtros que el banco, en un Web Worker para no bloquear el hilo principal,
// con un presupuesto de 8 s por caso. El hilo principal pide el siguiente
// mientras se juega el actual (pregeneración).
import type { DiffIndex } from '../engine/clues';
import { buildCaseCandidate, draftToCaseDef } from '../engine/generate';
import type { CaseDef, LevelMode, MapId } from '../engine/types';

const BUDGET_MS = 8000;

const MODE_BY_DIFF: Record<DiffIndex, LevelMode> = {
  0: 'novato',
  1: 'inspector',
  2: 'comisario',
};

export interface GenerateRequest {
  type: 'generate';
  requestId: string;
  diff: DiffIndex;
  mapId?: MapId;
  /** Si se da, reproduce ESE caso exacto (enlaces #gen=) en vez de buscar uno nuevo. */
  seed?: string;
}

export interface GenerateResult {
  type: 'result';
  requestId: string;
  caseData: CaseDef | null;
}

function generate(diff: DiffIndex, mapId?: MapId, fixedSeed?: string): CaseDef | null {
  if (fixedSeed) {
    const draft = buildCaseCandidate(fixedSeed, diff, mapId);
    return draft ? draftToCaseDef(draft, `INF-${fixedSeed}`, MODE_BY_DIFF[diff]) : null;
  }
  const deadline = Date.now() + BUDGET_MS;
  let i = 0;
  while (Date.now() < deadline) {
    const seed = `infinite-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${i}`;
    i += 1;
    const draft = buildCaseCandidate(seed, diff, mapId);
    if (draft) return draftToCaseDef(draft, `INF-${seed}`, MODE_BY_DIFF[diff]);
  }
  return null;
}

self.onmessage = (event: MessageEvent<GenerateRequest>) => {
  const { requestId, diff, mapId, seed } = event.data;
  const result: GenerateResult = { type: 'result', requestId, caseData: generate(diff, mapId, seed) };
  self.postMessage(result);
};
