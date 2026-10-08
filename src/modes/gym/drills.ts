// Banco de ejercicios del calentamiento (docs/MODOS.md 3.8): los 23 del prototipo
// (fuente 1, en el código) y los generados desde el solver humano (fuente 2,
// public/drills.json, que construye scripts/build-drills.ts). Cada uno con su respuesta
// ya verificada y su nivel.
import { drillLevel, type Level } from './adapt';
import { drillFromDef, normalizeAnswer, normalizeDrill, unpackDef } from './normalize';
import { SEED_ANSWERS, SEED_DRILLS } from './seed';
import type { Answer, Drill, DrillDef, PackedDrillDef, SeedDrill } from './types';

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

/** Un ejercicio generado, tal como está en public/drills.json o ya completo. */
export function bankDrillFromDef(packed: PackedDrillDef | DrillDef): BankDrill {
  const def = unpackDef(packed);
  const drill = drillFromDef(def);
  return { drill, answer: def.answer, level: drillLevel(drill) };
}

/** Los 23 del prototipo: siempre disponibles, también sin conexión. */
export const DRILLS: BankDrill[] = SEED_DRILLS.map(load);
