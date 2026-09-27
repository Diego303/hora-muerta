// Composición del banco (§12.1). Cambiar aquí basta para regenerar con otro tamaño:
// scripts/build-bank.ts lee esta configuración, no tiene números a fuego.
import type { DiffIndex } from '../src/engine/clues';
import type { CaseMode } from '../src/engine/types';

export interface BankGroupConfig {
  mode: Exclude<CaseMode, 'expediente'>;
  diff: DiffIndex;
  count: number;
  idPrefix: string;
}

/** `manifest.json.version`: cambia cuando el banco generado deja de ser compatible con el anterior (§12.6). */
export const BANK_VERSION = '2026.09-a';

/** Composición por defecto (600 casos): 170 + 190 + 120 + 60 + 20×3 = 600 (§12.1). */
export const BANK_GROUPS: BankGroupConfig[] = [
  { mode: 'novato', diff: 0, count: 170, idPrefix: 'N' },
  { mode: 'inspector', diff: 1, count: 190, idPrefix: 'I' },
  { mode: 'comisario', diff: 2, count: 120, idPrefix: 'C' },
  // El caso del día usa el nivel Inspector (§13).
  { mode: 'diario', diff: 1, count: 60, idPrefix: 'D' },
];

export const EXPEDIENTE_SERIES_COUNT = 20;
export const EXPEDIENTE_ID_PREFIX = 'E';

/** Mínimo razonable si se reduce el banco (§12.1): 70/70/40/20 sin expedientes. */
export const MIN_BANK_GROUPS: BankGroupConfig[] = [
  { mode: 'novato', diff: 0, count: 70, idPrefix: 'N' },
  { mode: 'inspector', diff: 1, count: 70, idPrefix: 'I' },
  { mode: 'comisario', diff: 2, count: 40, idPrefix: 'C' },
  { mode: 'diario', diff: 1, count: 20, idPrefix: 'D' },
];

/** Cuotas de variedad dentro de cada grupo (§12.1). */
export const MAP_QUOTA_TOLERANCE = 2; // ±2 casos entre los 6 mapas
export const MAX_ARCHETYPE_SHARE = 0.3; // ningún arquetipo por encima del 30%
export const MIN_ARCHETYPE_SHARE = 0.08; // cada arquetipo disponible, al menos el 8%
export const MAX_CRIME_HOUR_SHARE = 0.45; // ninguna hora del crimen por encima del 45%
