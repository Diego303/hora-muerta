// Un grupo del banco, hueco a hueco (§12.2): qué mapa le toca a cada hueco, qué semilla
// tiene cada intento y el candidato que sale. Determinista: la misma BANK_VERSION da los
// mismos casos. Lo comparten la generación en serie (build-bank.ts) y la de un solo
// grupo en paralelo (build-group.ts), para que las dos den exactamente lo mismo.
import { MAPS } from '../src/engine/content/maps';
import { buildCaseCandidate, draftToCaseDef, type CaseDraft } from '../src/engine/generate';
import type { CaseDef, MapId } from '../src/engine/types';
import { BANK_GROUPS, BANK_VERSION, type BankGroupConfig } from './bank.config';

export const MAX_RETRIES_PER_SLOT = 6;
const MAP_IDS: MapId[] = MAPS.map((m) => m.id);

export function findGroup(mode: string): BankGroupConfig {
  const group = BANK_GROUPS.find((g) => g.mode === mode);
  if (!group) throw new Error(`Grupo desconocido: "${mode}". Grupos: ${BANK_GROUPS.map((g) => g.mode).join(', ')}.`);
  return group;
}

/** Los mapas se reparten por turnos entre los huecos, para que haya variedad. */
export function slotMap(slot: number): MapId {
  return MAP_IDS[slot % MAP_IDS.length];
}

/** El candidato del intento `retry` del hueco `slot`, o null si sus 40 intentos internos no dan caso. */
export function slotCandidate(group: BankGroupConfig, slot: number, retry: number): CaseDraft | null {
  const seed = `${BANK_VERSION}|${group.mode}|${slot}|${retry}`;
  return buildCaseCandidate(seed, group.diff, slotMap(slot), group.maxClues === undefined ? undefined : { maxClues: group.maxClues });
}

export function caseId(group: BankGroupConfig, index: number): string {
  return `${group.idPrefix}-${String(index + 1).padStart(3, '0')}`;
}

export function toCaseDef(group: BankGroupConfig, draft: CaseDraft, index: number): CaseDef {
  return draftToCaseDef(draft, caseId(group, index), group.mode);
}
