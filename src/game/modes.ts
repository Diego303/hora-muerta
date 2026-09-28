// Modos de juego (§13): caso del día por índice de fecha, y su resultado
// guardado aparte del caso suelto (no cuenta para "sin repetir", §12.5).
import type { BankFile, CaseDef } from '../engine/types';
import { loadBank } from './bank';
import { readJSON, writeJSON } from './storage';

const DAILY_EPOCH_UTC = Date.UTC(2026, 0, 1);

/** índice = días desde 2026-01-01 (UTC, para que sea el mismo caso para todo
 * el mundo sin depender de la zona horaria de cada cual), módulo el número de casos. */
export function dailyIndex(date: Date, count: number): number {
  const dayUTC = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const days = Math.floor((dayUTC - DAILY_EPOCH_UTC) / 86400000);
  return ((days % count) + count) % count;
}

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export interface DailyCase {
  caseData: CaseDef;
  bankVersion: string;
  dateKey: string;
}

export async function getDailyCase(): Promise<DailyCase | null> {
  const bank: BankFile = await loadBank('diario');
  if (bank.cases.length === 0) return null;
  return { caseData: bank.cases[dailyIndex(new Date(), bank.cases.length)], bankVersion: bank.version, dateKey: todayKey() };
}

export interface DailyResult {
  stars: number;
  errors: number;
  hints: number;
  time: number;
}

type DailyResultsByDate = Record<string, DailyResult>;

export function getDailyResult(dateKey: string): DailyResult | null {
  return readJSON<DailyResultsByDate>('daily', {})[dateKey] ?? null;
}

export function recordDailyResult(dateKey: string, result: DailyResult): void {
  const all = readJSON<DailyResultsByDate>('daily', {});
  all[dateKey] = result;
  writeJSON('daily', all);
}

/** Todas las fechas con caso del día resuelto, para la racha diaria (§16.3). */
export function getDailyResultDates(): string[] {
  return Object.keys(readJSON<DailyResultsByDate>('daily', {}));
}
