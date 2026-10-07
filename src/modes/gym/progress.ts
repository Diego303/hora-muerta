// Progreso del calentamiento en hm2:gym (docs/MODOS.md 3.12) y técnica del día.
// Funciones puras; la lectura y escritura van al final, siempre con try/catch (storage.ts).
// F4 rellena `tech` (aciertos, historial) y `sessions`; F5 añade niveles, servicio sin
// repetir, repaso y racha sobre el mismo esquema, sin migrar.
import { readJSON, writeJSON } from '../../game/storage';
import type { DayTech } from './compose';
import type { Tech } from './types';

export interface TechProgress {
  level: 1 | 2 | 3;
  /** Últimos 20 resultados, del más antiguo al más reciente (1 acierto, 0 fallo). */
  hist: (0 | 1)[];
  ok: number;
  n: number;
}

export interface GymSessionRecord {
  date: string;
  score: number;
  n: number;
  tech: Tech;
}

export interface GymProgress {
  tech: Partial<Record<Tech, TechProgress>>;
  sessions: GymSessionRecord[];
}

export const HIST_SIZE = 20;
export const SESSIONS_KEPT = 30;

export function emptyProgress(): GymProgress {
  return { tech: {}, sessions: [] };
}

export function techProgress(progress: GymProgress, tech: Tech): TechProgress {
  return progress.tech[tech] ?? { level: 1, hist: [], ok: 0, n: 0 };
}

/** Cada respuesta cuenta al momento: si se sale a mitad, lo respondido ya está guardado. */
export function withAnswer(progress: GymProgress, tech: Tech, ok: boolean): GymProgress {
  const prev = techProgress(progress, tech);
  const next: TechProgress = {
    level: prev.level,
    hist: [...prev.hist, ok ? (1 as const) : (0 as const)].slice(-HIST_SIZE),
    ok: prev.ok + (ok ? 1 : 0),
    n: prev.n + 1,
  };
  return { ...progress, tech: { ...progress.tech, [tech]: next } };
}

export function withSession(progress: GymProgress, record: GymSessionRecord): GymProgress {
  return { ...progress, sessions: [...progress.sessions, record].slice(-SESSIONS_KEPT) };
}

const DAY_ORDER: DayTech[] = ['seguro', 'tabla', 'alcance'];

/**
 * Técnica del día, con la regla del prototipo: primero las que no se han practicado
 * (en este orden: seguro, tabla, alcance); después, la de menor acierto (en empate, la
 * menos practicada). F5 la sustituye por la regla completa de MODOS 3.6.
 */
export function techOfDay(progress: GymProgress): { tech: DayTech; why: string } {
  const untried = DAY_ORDER.find((t) => techProgress(progress, t).n === 0);
  if (untried) return { tech: untried, why: 'Todavía no la has practicado.' };
  const rate = (t: DayTech): number => techProgress(progress, t).ok / techProgress(progress, t).n;
  const tech = [...DAY_ORDER].sort((a, b) => rate(a) - rate(b) || techProgress(progress, a).n - techProgress(progress, b).n)[0];
  return { tech, why: `Es tu técnica con menos aciertos (${Math.round(rate(tech) * 100)} %).` };
}

export function loadGymProgress(): GymProgress {
  const saved = readJSON<Partial<GymProgress>>('gym', {});
  return { ...emptyProgress(), ...saved, tech: { ...saved.tech }, sessions: saved.sessions ?? [] };
}

export function saveGymProgress(progress: GymProgress): void {
  writeJSON('gym', progress);
}
