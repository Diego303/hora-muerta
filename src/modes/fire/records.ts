// Medallas, estrellas y récords del Modo Incendio (docs/MODOS.md 2.6 y 2.8).
// Funciones puras; la lectura y escritura en hm2:fire van al final.
import { readJSON, writeJSON } from '../../game/storage';

export type FireMedal = 'sin-fotos' | 'a-tiempo' | 'sin-errores';

export const MEDAL_NAME: Record<FireMedal, string> = {
  'sin-fotos': 'Sin fotos',
  'a-tiempo': 'A tiempo',
  'sin-errores': 'Sin errores',
};

const MEDAL_ORDER: FireMedal[] = ['sin-fotos', 'a-tiempo', 'sin-errores'];

/** "A tiempo": más de 2:00 restantes al resolver. */
export const ON_TIME_LEFT_S = 120;

export interface FireOutcome {
  photosUsed: number;
  wrongAccusations: number;
  secondsLeft: number;
}

export function fireMedals(outcome: FireOutcome): FireMedal[] {
  const medals: FireMedal[] = [];
  if (outcome.photosUsed === 0) medals.push('sin-fotos');
  if (outcome.secondsLeft > ON_TIME_LEFT_S) medals.push('a-tiempo');
  if (outcome.wrongAccusations === 0) medals.push('sin-errores');
  return medals;
}

/** Estrellas de rango de un incendio resuelto: 1, más 1 por medalla, con un máximo de 3. */
export function fireStars(medals: readonly FireMedal[]): number {
  return Math.min(3, 1 + medals.length);
}

export interface FireRecord {
  /** Mejor tiempo sobrante en segundos, o null si nunca se ha resuelto. */
  bestLeft: number | null;
  /** Medallas conseguidas alguna vez en este caso. */
  medals: FireMedal[];
  attempts: number;
  /** Fecha (ISO) de la última vez que se resolvió, o null. */
  solvedAt: string | null;
}

export type FireRecords = Record<string, FireRecord>;

const EMPTY: FireRecord = { bestLeft: null, medals: [], attempts: 0, solvedAt: null };

export function recordOf(records: FireRecords, caseId: string): FireRecord {
  return records[caseId] ?? EMPTY;
}

export function withAttempt(records: FireRecords, caseId: string): FireRecords {
  const prev = recordOf(records, caseId);
  return { ...records, [caseId]: { ...prev, attempts: prev.attempts + 1 } };
}

/** Registra un incendio resuelto. Las estrellas solo suman lo que mejora la mejor
 * marca del caso: repetir el mismo edificio no regala estrellas. */
export function withSolve(
  records: FireRecords,
  caseId: string,
  secondsLeft: number,
  medals: readonly FireMedal[],
  now: Date,
): { records: FireRecords; starsGained: number; newBest: boolean } {
  const prev = recordOf(records, caseId);
  const union = MEDAL_ORDER.filter((m) => prev.medals.includes(m) || medals.includes(m));
  const before = prev.solvedAt === null ? 0 : fireStars(prev.medals);
  const after = fireStars(union);
  const left = Math.max(0, Math.floor(secondsLeft));
  const newBest = prev.bestLeft === null || left > prev.bestLeft;
  const next: FireRecord = {
    bestLeft: newBest ? left : prev.bestLeft,
    medals: union,
    attempts: prev.attempts,
    solvedAt: now.toISOString(),
  };
  return { records: { ...records, [caseId]: next }, starsGained: after - before, newBest };
}

export function loadFireRecords(): FireRecords {
  return readJSON<FireRecords>('fire', {});
}

export function saveFireRecords(records: FireRecords): void {
  writeJSON('fire', records);
}
