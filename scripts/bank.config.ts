// Composición del banco (§12.1). Cambiar aquí basta para regenerar con otro tamaño:
// scripts/build-bank.ts lee esta configuración, no tiene números a fuego.
import type { DiffIndex } from '../src/engine/clues';
import type { CaseMode } from '../src/engine/types';

export interface BankGroupConfig {
  mode: CaseMode;
  diff: DiffIndex;
  count: number;
  idPrefix: string;
}

/** `manifest.json.version`: cambia cuando el banco generado deja de ser compatible con el anterior (§12.6). */
export const BANK_VERSION = '2026.09-a';

/** Composición por defecto (540 casos): 170 + 190 + 120 + 60 (§12.1).
 * Comisario necesita R6_HYPOTHESIS (implementada en `src/engine/human.ts`, ver
 * docs/DECISIONES.md) y cada hueco es mucho más caro que uno de Inspector. */
export const BANK_GROUPS: BankGroupConfig[] = [
  { mode: 'novato', diff: 0, count: 170, idPrefix: 'N' },
  { mode: 'inspector', diff: 1, count: 190, idPrefix: 'I' },
  { mode: 'comisario', diff: 2, count: 120, idPrefix: 'C' },
  // El caso del día usa el nivel Inspector (§13).
  { mode: 'diario', diff: 1, count: 60, idPrefix: 'D' },
];

/** Mínimo razonable si se reduce el banco (§12.1): 70/70/40/20. */
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

/** Grupo "incendio" (docs/MODOS.md 2.5): 20 Novato y 20 Inspector exprés (5
 * sospechosos, 3 horas, 9 pistas como mucho). Cada hueco se reintenta hasta
 * encontrar un caso que cumpla todas las garantías de justicia. */
export interface FireGroupConfig {
  level: 'Novato' | 'Inspector exprés';
  mode: 'novato' | 'inspector';
  diff: 0 | 1;
  count: number;
  idPrefix: string;
  maxClues?: number;
}

export const FIRE_GROUPS: FireGroupConfig[] = [
  { level: 'Novato', mode: 'novato', diff: 0, count: 20, idPrefix: 'INC-N' },
  { level: 'Inspector exprés', mode: 'inspector', diff: 1, count: 20, idPrefix: 'INC-I', maxClues: 9 },
];

/** Reintentos por hueco del incendio: más que en el banco normal, porque las
 * garantías de justicia rechazan alrededor de un tercio de los casos válidos. */
export const FIRE_MAX_RETRIES_PER_SLOT = 16;
