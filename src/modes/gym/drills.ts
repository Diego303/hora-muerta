// Banco de ejercicios del calentamiento: de momento, los 23 del prototipo ya
// normalizados con su respuesta (F6 añadirá los generados desde el solver humano).
import { normalizeAnswer, normalizeDrill } from './normalize';
import { SEED_ANSWERS, SEED_BLOCKS, SEED_DRILLS } from './seed';
import type { Answer, Drill, SeedDrill, Tech } from './types';

export interface BankDrill {
  drill: Drill;
  answer: Answer;
}

function load(seed: SeedDrill): BankDrill {
  const answer = SEED_ANSWERS[seed.id];
  if (!answer) throw new Error(`${seed.id}: ejercicio sin respuesta`);
  return { drill: normalizeDrill(seed), answer: normalizeAnswer(seed, answer) };
}

export const DRILLS: BankDrill[] = SEED_DRILLS.map(load);

/** Ejercicios del prototipo por bloque: activación, cada técnica y remate. */
export const DRILL_GROUPS: Record<'activacion' | Exclude<Tech, 'remate'> | 'remate', BankDrill[]> = {
  activacion: SEED_BLOCKS.activacion.map(load),
  alcance: SEED_BLOCKS.alcance.map(load),
  seguro: SEED_BLOCKS.seguro.map(load),
  tabla: SEED_BLOCKS.tabla.map(load),
  remate: SEED_BLOCKS.remate.map(load),
};
