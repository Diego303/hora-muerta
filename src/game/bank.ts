// Carga del banco pregenerado (§12.2): "Caso suelto" sirve el siguiente caso del
// banco del nivel elegido, servido al instante desde public/cases/*.json.
import type { BankFile, CaseMode } from '../engine/types';

const MODE_BY_DIFF: Record<0 | 1 | 2, Exclude<CaseMode, 'diario' | 'expediente'>> = {
  0: 'novato',
  1: 'inspector',
  2: 'comisario',
};

export function modeForDiff(diff: 0 | 1 | 2): CaseMode {
  return MODE_BY_DIFF[diff];
}

export async function loadBank(mode: CaseMode): Promise<BankFile> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}cases/${mode}.json`);
  if (!res.ok) throw new Error(`No se pudo cargar el banco de casos de ${mode} (HTTP ${res.status}).`);
  return (await res.json()) as BankFile;
}
