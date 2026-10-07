// Banco de ejercicios del calentamiento: de momento, los 23 del prototipo ya
// normalizados con su respuesta y su nivel (F6 añadirá los generados desde el solver
// humano).
import { drillLevel, type Level } from './adapt';
import { normalizeAnswer, normalizeDrill } from './normalize';
import { SEED_ANSWERS, SEED_DRILLS } from './seed';
import type { Answer, Drill, SeedDrill } from './types';

export interface BankDrill {
  drill: Drill;
  answer: Answer;
  /** Nivel de dificultad (MODOS 3.6), calculado a partir del ejercicio. */
  level: Level;
}

function load(seed: SeedDrill): BankDrill {
  const answer = SEED_ANSWERS[seed.id];
  if (!answer) throw new Error(`${seed.id}: ejercicio sin respuesta`);
  const drill = normalizeDrill(seed);
  return { drill, answer: normalizeAnswer(seed, answer), level: drillLevel(drill) };
}

export const DRILLS: BankDrill[] = SEED_DRILLS.map(load);
