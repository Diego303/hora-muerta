// Progreso del calentamiento en hm2:gym (docs/MODOS.md 3.12): esquema y persistencia.
// Las reglas que lo cambian (niveles, técnica del día, repaso, racha) están en adapt.ts.
import { readJSON, writeJSON } from '../../game/storage';
import type { Tech } from './types';

export interface TechProgress {
  level: 1 | 2 | 3;
  /** Últimos 20 resultados, del más antiguo al más reciente (1 acierto, 0 fallo). */
  hist: (0 | 1)[];
  ok: number;
  n: number;
  /** Respuestas desde el último cambio de nivel. Ampliación del esquema de MODOS 3.12:
   * "los últimos 10 del nivel actual" no se puede saber solo con `hist`. */
  atLevel: number;
}

export interface GymSessionRecord {
  date: string;
  score: number;
  n: number;
  tech: Tech;
}

export interface GymProgress {
  tech: Partial<Record<Tech, TechProgress>>;
  /** Ejercicios servidos por grupo `${técnica}:${nivel}` desde la última vez que se agotó. */
  served: Record<string, string[]>;
  /** Fallados que vuelven como repaso cuando `done` llegue a `due`. */
  review: { id: string; due: number }[];
  /** Sesiones completadas en total. Ampliación del esquema: `sessions` se recorta a 30
   * y no sirve para contar "3 sesiones después". */
  done: number;
  streak: { last: string; count: number; best: number };
  /** Últimas 30 sesiones completadas. */
  sessions: GymSessionRecord[];
}

export function emptyProgress(): GymProgress {
  return { tech: {}, served: {}, review: [], done: 0, streak: { last: '', count: 0, best: 0 }, sessions: [] };
}

export function techProgress(progress: GymProgress, tech: Tech): TechProgress {
  return progress.tech[tech] ?? { level: 1, hist: [], ok: 0, n: 0, atLevel: 0 };
}

export function loadGymProgress(): GymProgress {
  const saved = readJSON<Partial<GymProgress>>('gym', {});
  const empty = emptyProgress();
  const tech: GymProgress['tech'] = {};
  for (const [k, v] of Object.entries(saved.tech ?? {}) as [Tech, Partial<TechProgress>][]) {
    tech[k] = { level: v.level ?? 1, hist: v.hist ?? [], ok: v.ok ?? 0, n: v.n ?? 0, atLevel: v.atLevel ?? v.hist?.length ?? 0 };
  }
  return {
    tech,
    served: saved.served ?? empty.served,
    review: saved.review ?? empty.review,
    done: saved.done ?? saved.sessions?.length ?? 0,
    streak: saved.streak ?? empty.streak,
    sessions: saved.sessions ?? empty.sessions,
  };
}

export function saveGymProgress(progress: GymProgress): void {
  writeJSON('gym', progress);
}
