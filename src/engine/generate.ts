// generarCaso() (§7.1), completo: pasos 1-11 de la tubería (mapa/reparto/noche/
// reserva/selección guiada/minimización/topes y longitud/cortesía/solver
// humano/puntuación/orden y firma). Devuelve un CaseDraft: todo lo de CaseDef
// salvo `id`, `mode` (los asigna quien coloca el caso en un grupo del banco,
// scripts/build-bank.ts en M3) y con `map` como MapDef completo en vez de solo
// su id (más cómodo para el resto de la tubería; ver docs/DECISIONES.md).
import type { ObjectDef } from './content/cast';
import { CAST, CHIP_COLORS, MOTIVES, OBJECTS, VICTIMS } from './content/cast';
import { MAPS } from './content/maps';
import {
  CLUE_CAPS,
  CLUE_STRENGTH,
  CLUE_WEIGHTS,
  MAX_READ_LENGTH,
  MIN_MOVEMENT_CLUES,
  buildCluePool,
  clueCategory,
  holds,
  sortClues,
} from './clues';
import type { DiffIndex } from './clues';
import { checkUnique } from './exact';
import type { SolveContext } from './exact';
import { buildGraph } from './graph';
import { solveHuman } from './human';
import type { HumanContext } from './human';
import { enumeratePaths } from './paths';
import type { Rng } from './rng';
import { fnv1a, pick, rngFromSeed, shuffle } from './rng';
import type { ClueTextContext } from './text';
import { clueText, plainText } from './text';
import { buildTruth, generateNight, generateObjectAssignment, planNight } from './truth';
import type { CaseDef, Clue, ClueKind, MapDef, MapId, Truth } from './types';

export interface DifficultyParams {
  N: number;
  T: number;
  minClues: number;
  maxClues: number;
  courtesyClues: number;
}

/** N, T y número de pistas por dificultad (§11). */
export const DIFFICULTY: Record<DiffIndex, DifficultyParams> = {
  0: { N: 4, T: 3, minClues: 5, maxClues: 7, courtesyClues: 1 },
  1: { N: 5, T: 3, minClues: 7, maxClues: 10, courtesyClues: 0 },
  2: { N: 5, T: 4, minClues: 10, maxClues: 14, courtesyClues: 0 },
};

interface LevelGate {
  minLevel: 1 | 2 | 3 | 4 | 5 | 6;
  maxLevel: 1 | 2 | 3 | 4 | 5 | 6;
  /** Tope de pasos críticos en `capLevel` (Novato: como mucho 1 de nivel 4; Comisario: como mucho 2 de nivel 6). */
  capLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  capCount?: number;
}

/** Nivel máximo permitido y requisito mínimo de la cadena crítica (§11). */
export const LEVEL_GATE: Record<DiffIndex, LevelGate> = {
  0: { minLevel: 3, maxLevel: 4, capLevel: 4, capCount: 1 },
  1: { minLevel: 4, maxLevel: 5 },
  2: { minLevel: 5, maxLevel: 6, capLevel: 6, capCount: 2 },
};

/** Banda de puntuación inicial (§11); se recalibra con `bank-report` en M3 si hace falta. */
export const SCORE_BAND: Record<DiffIndex, [number, number]> = {
  0: [8, 25],
  1: [22, 60],
  2: [55, 140],
};

const GENERATION_ATTEMPTS = 40;
const SELECTION_ATTEMPTS = 70;
const SELECT_LIMIT = 15000;
const MINIMIZE_LIMIT = 4000;
const COURTESY_TYPES: ClueKind[] = ['at', 'ncarry', 'together'];

export type CaseDraft = Omit<CaseDef, 'id' | 'mode' | 'map'> & { map: MapDef };

function clueScore(clue: Clue, diff: DiffIndex): number {
  return CLUE_WEIGHTS[diff][clue.k] * CLUE_STRENGTH[clue.k] ** 2;
}

/** Aproxima "la que más candidatos de respuesta descarta" (§7.3) por la de mayor
 * peso × fuerza² entre las candidatas: todas ya descartan la alternativa conocida,
 * así que se prioriza la más informativa. Ver docs/DECISIONES.md. */
function strongestClue(candidates: Clue[], diff: DiffIndex): Clue {
  let best = candidates[0];
  let bestScore = clueScore(best, diff);
  for (const clue of candidates) {
    const score = clueScore(clue, diff);
    if (score > bestScore) {
      best = clue;
      bestScore = score;
    }
  }
  return best;
}

function weightedPick(rng: Rng, candidates: Clue[], diff: DiffIndex): Clue {
  const total = candidates.reduce((sum, clue) => sum + clueScore(clue, diff), 0);
  let x = rng() * total;
  for (const clue of candidates) {
    x -= clueScore(clue, diff);
    if (x <= 0) return clue;
  }
  return candidates[candidates.length - 1];
}

/** Selección guiada por contraejemplos (§7.3): añade pistas hasta que el solver
 * exacto certifique unicidad, o hasta agotar los intentos. */
function selectClues(rng: Rng, ctx: SolveContext, pool: Clue[], diff: DiffIndex, culprit: number, weapon: number): Clue[] | null {
  let selected: Clue[] = [];
  const typeCounts: Partial<Record<ClueKind, number>> = {};

  for (let iteration = 0; iteration < SELECTION_ATTEMPTS; iteration++) {
    const result = checkUnique(ctx, culprit, weapon, selected, SELECT_LIMIT);
    if (result.status === 'unique') return selected;

    let candidates = pool.filter((clue) => !selected.includes(clue) && (typeCounts[clue.k] ?? 0) < CLUE_CAPS[diff][clue.k]);
    if (result.status === 'alt') {
      const alt = result.alt;
      const discarding = candidates.filter((clue) => !holds(clue, { rooms: alt.rooms, obj: alt.obj }, ctx.graph));
      if (discarding.length > 0) candidates = discarding;
    }
    if (candidates.length === 0) return null;

    const chosen = rng() < 0.3 ? strongestClue(candidates, diff) : weightedPick(rng, candidates, diff);
    selected = selected.concat(chosen);
    typeCounts[chosen.k] = (typeCounts[chosen.k] ?? 0) + 1;
  }
  return null;
}

/** Minimiza: quita cada pista, en un orden aleatorio, si la unicidad se mantiene sin ella (§7.1, paso 6). */
function minimizeClues(rng: Rng, ctx: SolveContext, clues: Clue[], culprit: number, weapon: number): Clue[] {
  let result = clues;
  for (const clue of shuffle(rng, result)) {
    const trial = result.filter((c) => c !== clue);
    if (checkUnique(ctx, culprit, weapon, trial, MINIMIZE_LIMIT).status === 'unique') result = trial;
  }
  return result;
}

function withinCaps(clues: Clue[], diff: DiffIndex): boolean {
  const counts: Partial<Record<ClueKind, number>> = {};
  for (const clue of clues) counts[clue.k] = (counts[clue.k] ?? 0) + 1;
  return Object.entries(counts).every(([k, n]) => (n ?? 0) <= CLUE_CAPS[diff][k as ClueKind]);
}

function countMovementClues(clues: Clue[]): number {
  return clues.filter((clue) => clueCategory(clue) === 'Movimiento').length;
}

/** Contexto de textos para un candidato: reparto y objetos ya resueltos a nombre/color/etiqueta. */
export function buildTextContext(map: MapDef, castIndices: number[], objectIndices: number[]): ClueTextContext {
  return {
    rooms: map.rooms,
    features: map.features,
    unit: map.unit,
    suspects: castIndices.map((i, idx) => ({ name: CAST[i].name, color: CHIP_COLORS[idx], role: CAST[i].role })),
    objects: objectIndices.map((i): ObjectDef => OBJECTS[i]),
  };
}

/**
 * Nivel máximo permitido, requisito mínimo y tope de pasos en el nivel más alto
 * (§11). `maxLvStepCount` cuenta solo la cadena que identifica al culpable
 * (HumanSolution.maxLvStepCount), no la cadena completa que incluye el arma:
 * ver docs/DECISIONES.md.
 */
export function meetsLevelGate(diff: DiffIndex, maxLv: number, maxLvStepCount: number): boolean {
  const gate = LEVEL_GATE[diff];
  if (maxLv < gate.minLevel || maxLv > gate.maxLevel) return false;
  if (gate.capLevel !== undefined && gate.capCount !== undefined && maxLv === gate.capLevel) {
    if (maxLvStepCount > gate.capCount) return false;
  }
  return true;
}

/** Firma estructural (§12.4): dos casos con la misma firma son la misma noche con otros nombres. */
function computeSignature(mapId: MapId, rv: number, td: number, truth: Truth, culprit: number): string {
  const sortedPaths = truth.rooms.map((path) => path.join('-')).slice().sort();
  const culpritPath = truth.rooms[culprit].join('-');
  return fnv1a(`${mapId}|${rv}|${td}|${sortedPaths.join(';')}|${culpritPath}`).toString(36);
}

/**
 * Tubería de generación completa (§7.1). Determinista: la misma semilla
 * produce el mismo candidato. Devuelve null si los 40 intentos se agotan sin
 * producir un caso que cumpla topes, longitud de lectura, mínimo de
 * movimiento, y que el solver humano resuelva dentro del nivel y la banda de
 * puntuación de la dificultad (rechaza los que se atascan, incluidos los que
 * solo se resolverían con R6_HYPOTHESIS: ver docs/DECISIONES.md).
 */
export interface BuildCaseOptions {
  /**
   * Reparto fijo (índices en CAST, cualquier orden): se usan sus primeros N
   * tras ordenar alfabéticamente. Para el modo Expediente (§12.2): mismo mapa
   * y mismo reparto de 5 en las tres noches; la de Novato usa los 4 primeros.
   */
  castOverride?: number[];
}

export function buildCaseCandidate(seed: string, diff: DiffIndex, mapId?: MapId, options?: BuildCaseOptions): CaseDraft | null {
  const params = DIFFICULTY[diff];
  const fixedMap = mapId ? MAPS.find((m) => m.id === mapId) : undefined;
  if (mapId && !fixedMap) throw new Error(`Mapa desconocido: ${mapId}`);
  const sortedCastOverride = options?.castOverride
    ? options.castOverride.slice().sort((a, b) => CAST[a].name.localeCompare(CAST[b].name, 'es'))
    : undefined;

  for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt++) {
    const rng = rngFromSeed(`${seed}|${diff}|${attempt}`);
    const map = fixedMap ?? pick(rng, MAPS);
    const graph = buildGraph(map);
    const roomCount = map.rooms.length;
    const paths = enumeratePaths(graph.adj, roomCount, params.T);

    const castIndices = sortedCastOverride
      ? sortedCastOverride.slice(0, params.N)
      : shuffle(
          rng,
          CAST.map((_, i) => i),
        )
          .slice(0, params.N)
          .sort((a, b) => CAST[a].name.localeCompare(CAST[b].name, 'es'));
    const objectIndices = shuffle(
      rng,
      OBJECTS.map((_, i) => i),
    ).slice(0, params.N);
    const victim = Math.floor(rng() * VICTIMS.length);
    const motive = Math.floor(rng() * MOTIVES.length);

    const plan = planNight(rng, roomCount, params.N, params.T);
    const rooms = generateNight(rng, graph, roomCount, plan, params.N, params.T);
    if (!rooms) continue;
    const objectAssignment = generateObjectAssignment(rng, params.N);
    const truth = buildTruth(rooms, objectAssignment);
    const weapon = objectAssignment[plan.culprit];

    const solveCtx: SolveContext = { N: params.N, T: params.T, paths, rv: plan.rv, td: plan.td, graph };
    const pool = buildCluePool(
      { N: params.N, T: params.T, map, graph, truth, rv: plan.rv, td: plan.td, culprit: plan.culprit, weapon, diff },
      rng,
    );

    const selected = selectClues(rng, solveCtx, pool, diff, plan.culprit, weapon);
    if (!selected) continue;
    let clues = minimizeClues(rng, solveCtx, selected, plan.culprit, weapon);

    if (clues.length < params.minClues || (clues.length > params.maxClues && attempt < 2)) continue;
    if (!clues.every((clue) => holds(clue, truth, graph))) continue; // salvaguarda: no debería fallar nunca
    if (!withinCaps(clues, diff)) continue;
    if (countMovementClues(clues) < MIN_MOVEMENT_CLUES[diff]) continue;

    const textCtx = buildTextContext(map, castIndices, objectIndices);
    const readLength = clues.reduce((sum, clue) => sum + plainText(clueText(clue, textCtx)).length, 0);
    if (readLength > MAX_READ_LENGTH[diff]) continue;

    if (params.courtesyClues > 0) {
      const alreadySelected = clues;
      const courtesyCandidates = shuffle(
        rng,
        pool.filter((clue) => !alreadySelected.includes(clue) && COURTESY_TYPES.includes(clue.k)),
      );
      clues = clues.concat(courtesyCandidates.slice(0, params.courtesyClues));
    }

    const finalClues = sortClues(clues);
    const humanCtx: HumanContext = { N: params.N, T: params.T, graph, rv: plan.rv, td: plan.td };
    const solved = solveHuman(humanCtx, finalClues);
    if (!solved) continue; // atascado: el caso exige más de lo que el solver humano sabe hacer

    const criticalSteps = solved.steps.filter((s) => s.crit);
    if (!meetsLevelGate(diff, solved.maxLv, solved.maxLvStepCount)) continue;
    const [scoreMin, scoreMax] = SCORE_BAND[diff];
    if (solved.score < scoreMin || solved.score > scoreMax) continue;

    const keyStep = solved.steps[solved.key];
    const key = criticalSteps.indexOf(keyStep);

    return {
      v: 2,
      diff,
      map,
      cast: castIndices,
      objects: objectIndices,
      victim,
      motive,
      N: params.N,
      T: params.T,
      rv: plan.rv,
      td: plan.td,
      culprit: plan.culprit,
      weapon,
      truth,
      clues: finalClues,
      solve: {
        steps: criticalSteps,
        key: key >= 0 ? key : 0,
        arch: solved.arch,
        maxLv: solved.maxLv,
        score: solved.score,
      },
      sig: computeSignature(map.id, plan.rv, plan.td, truth, plan.culprit),
    };
  }
  return null;
}
