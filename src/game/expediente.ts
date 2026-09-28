// Expediente (§13): serie de 3 noches con el mismo reparto, un presupuesto de
// errores COMPARTIDO entre las tres (no 2 por noche) y estrellas acumuladas
// (máximo 9: hasta 3 por noche). hm2:series (§18).
import type { SeriesDef } from '../engine/types';
import { readJSON, writeJSON } from './storage';

export interface SeriesProgress {
  id: string;
  version: string;
  /** Noche actual (0, 1 o 2). */
  index: number;
  /** Presupuesto de errores compartido para toda la serie; empieza en 3. */
  errorsLeft: number;
  /** Estrellas de las noches ya cerradas (resueltas). */
  starsSoFar: number;
  /** La serie ya terminó (todas las noches resueltas, o archivada por agotar errores). */
  done: boolean;
}

const MAX_SERIES_ERRORS = 3;

export function loadSeriesProgress(): SeriesProgress | null {
  return readJSON<SeriesProgress | null>('series', null);
}

export function saveSeriesProgress(progress: SeriesProgress): void {
  writeJSON('series', progress);
}

export function clearSeriesProgress(): void {
  writeJSON('series', null);
}

export function startSeries(id: string, version: string): SeriesProgress {
  const progress: SeriesProgress = { id, version, index: 0, errorsLeft: MAX_SERIES_ERRORS, starsSoFar: 0, done: false };
  saveSeriesProgress(progress);
  return progress;
}

/** Una acusación errónea gasta presupuesto de TODA la serie, no solo de esta
 * noche (§13): si se agota, la serie entera queda archivada ahí mismo. */
export function registerSeriesError(progress: SeriesProgress): SeriesProgress {
  const errorsLeft = Math.max(0, progress.errorsLeft - 1);
  const updated: SeriesProgress = { ...progress, errorsLeft, done: errorsLeft <= 0 };
  saveSeriesProgress(updated);
  return updated;
}

/** Cierra la noche actual como resuelta: suma sus estrellas y pasa a la
 * siguiente, o termina la serie si era la última. */
export function completeNight(progress: SeriesProgress, nightStars: number, totalNights: number): SeriesProgress {
  const index = progress.index + 1;
  const updated: SeriesProgress = { ...progress, starsSoFar: progress.starsSoFar + nightStars, index, done: index >= totalNights };
  saveSeriesProgress(updated);
  return updated;
}

/** `expedientes.json` no tiene la forma de `BankFile` (series, no cases; ver
 * docs/DECISIONES.md), así que necesita su propio loader. */
export interface ExpedienteBank {
  version: string;
  series: SeriesDef[];
}

export async function loadExpedientes(): Promise<ExpedienteBank> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}cases/expedientes.json`);
  if (!res.ok) throw new Error(`No se pudo cargar el banco de expedientes (HTTP ${res.status}).`);
  return (await res.json()) as ExpedienteBank;
}
