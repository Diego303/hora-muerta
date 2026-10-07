// Qué edificios ofrece la sala del incendio (docs/MODOS.md 2.6): "se sirven sin
// repetir, como el banco normal". Cada jugador tiene su propio orden (barajado con su
// semilla); se ofrece el primer edificio sin resolver de cada nivel y los ya
// resueltos quedan aparte para mejorar la marca. Un derrumbe no cuenta como
// resuelto: ese edificio se sigue ofreciendo hasta que lo resuelvas. Puro.
import { rngFromSeed, shuffle } from '../../engine/rng';
import type { MapId } from '../../engine/types';
import { recordOf, type FireRecords } from './records';
import type { FireCase, FireData } from './types';

export type FireLevel = FireData['level'];
export const FIRE_LEVELS: FireLevel[] = ['Novato', 'Inspector exprés'];

export interface FireOffer {
  level: FireLevel;
  /** Siguiente edificio sin resolver, o null si ya están todos resueltos. */
  next: FireCase | null;
  /** Edificios ya resueltos, en el orden en que se ofrecieron. */
  solved: FireCase[];
  /** Edificios disponibles en este nivel (escenarios desbloqueados). */
  total: number;
}

export function fireOrder(cases: readonly FireCase[], seed: string): FireCase[] {
  return shuffle(rngFromSeed(seed), cases);
}

export function fireOffers(ordered: readonly FireCase[], records: FireRecords, unlocked: ReadonlySet<MapId>): FireOffer[] {
  return FIRE_LEVELS.map((level) => {
    const ofLevel = ordered.filter((c) => c.fire.level === level);
    const open = ofLevel.filter((c) => unlocked.has(c.caseData.map));
    // Si ningún escenario de este nivel está desbloqueado, se ofrecen todos: un modo
    // vacío no tiene sentido para quien acaba de empezar.
    const pool = open.length > 0 ? open : ofLevel;
    const isSolved = (c: FireCase): boolean => recordOf(records, c.caseData.id).bestLeft !== null;
    return { level, next: pool.find((c) => !isSolved(c)) ?? null, solved: pool.filter(isSolved), total: pool.length };
  });
}
