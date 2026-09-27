// Carga del banco pregenerado y servicio sin repetir (§12.2, §12.5): "Caso
// suelto" sirve el siguiente caso no jugado, en un orden personal por semilla.
import { rngFromSeed, shuffle } from '../engine/rng';
import type { BankFile, CaseDef, CaseMode, MapId } from '../engine/types';
import { readJSON, writeJSON } from './storage';

const MODE_BY_DIFF: Record<0 | 1 | 2, Exclude<CaseMode, 'diario' | 'expediente'>> = {
  0: 'novato',
  1: 'inspector',
  2: 'comisario',
};

export function modeForDiff(diff: 0 | 1 | 2): Exclude<CaseMode, 'diario' | 'expediente'> {
  return MODE_BY_DIFF[diff];
}

export async function loadBank(mode: CaseMode): Promise<BankFile> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}cases/${mode}.json`);
  if (!res.ok) throw new Error(`No se pudo cargar el banco de casos de ${mode} (HTTP ${res.status}).`);
  return (await res.json()) as BankFile;
}

/** Semilla personal de orden (§12.5): se crea una vez, al azar, y se reutiliza siempre
 * (cada persona ve un orden distinto, pero siempre el mismo orden). */
export function getOrderSeed(): string {
  const saved = readJSON<{ seed: string } | null>('order', null);
  if (saved?.seed) return saved.seed;
  const seed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  writeJSON('order', { seed });
  return seed;
}

type PlayedByVersion = Record<string, string[]>;

export function getPlayed(bankVersion: string): Set<string> {
  const all = readJSON<PlayedByVersion>('played', {});
  return new Set(all[bankVersion] ?? []);
}

/** Un caso cuenta como jugado en cuanto el caso se cierra, resuelto o archivado (§12.5). */
export function markPlayed(bankVersion: string, caseId: string): void {
  const all = readJSON<PlayedByVersion>('played', {});
  const list = all[bankVersion] ?? [];
  if (!list.includes(caseId)) all[bankVersion] = list.concat(caseId);
  writeJSON('played', all);
}

/** "Volver a empezar" al agotar un grupo (§12.5): olvida solo los ids de ESE
 * grupo, sin tocar el historial de los demás. */
export function resetPlayed(bankVersion: string, groupIds: string[]): void {
  const all = readJSON<PlayedByVersion>('played', {});
  const list = all[bankVersion] ?? [];
  const toForget = new Set(groupIds);
  all[bankVersion] = list.filter((id) => !toForget.has(id));
  writeJSON('played', all);
}

/**
 * El siguiente caso no jugado del banco, en el orden personal (§12.5): una
 * permutación fija (por semilla + versión + modo) de todo el grupo, filtrada
 * por mapa si la persona eligió uno. `null` si el grupo está agotado (para
 * ese filtro). El filtro por escenarios desbloqueados (§16.1) llega con la
 * progresión (M8): de momento se trata todo como desbloqueado.
 */
export function nextUnplayed(bank: BankFile, mapFilter: MapId | null): CaseDef | null {
  const rng = rngFromSeed(`${getOrderSeed()}|${bank.version}|${bank.mode}`);
  const order = shuffle(rng, bank.cases);
  const played = getPlayed(bank.version);
  const pool = mapFilter ? order.filter((c) => c.map === mapFilter) : order;
  return pool.find((c) => !played.has(c.id)) ?? null;
}
