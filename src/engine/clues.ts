import type { Rng } from './rng';
import type { Clue, ClueKind, Graph, Hour, MapDef, Obj, Room, Sus, Truth } from './types';

/** Evalúa si una pista es verdadera sobre una asignación completa (la verdad, o una alternativa). */
export function holds(clue: Clue, truth: Truth, graph: Graph): boolean {
  const rooms = truth.rooms;
  const carrierOf = (o: Obj): Sus => truth.obj.indexOf(o);
  switch (clue.k) {
    case 'at':
      return rooms[clue.c][clue.t] === clue.r;
    case 'notat':
      return rooms[clue.c][clue.t] !== clue.r;
    case 'feat':
      return graph.feat[rooms[clue.c][clue.t]][clue.f] !== clue.neg;
    case 'never':
      return !rooms[clue.c].includes(clue.r);
    case 'visited':
      return rooms[clue.c].includes(clue.r);
    case 'stayed':
      return rooms[clue.c].every((x) => x === rooms[clue.c][0]);
    case 'moved':
      return rooms[clue.c][clue.t] !== rooms[clue.c][clue.t + 1];
    case 'still':
      return rooms[clue.c][clue.t] === rooms[clue.c][clue.t + 1];
    case 'together':
      return rooms[clue.a][clue.t] === rooms[clue.b][clue.t];
    case 'apart':
      return rooms[clue.a].every((x, t) => x !== rooms[clue.b][t]);
    case 'adj':
      return graph.adjM[rooms[clue.a][clue.t]][rooms[clue.b][clue.t]];
    case 'count':
      return rooms.filter((path) => path[clue.t] === clue.r).length === clue.n;
    case 'cat':
      return rooms[carrierOf(clue.o)][clue.t] === clue.r;
    case 'cfeat':
      return graph.feat[rooms[carrierOf(clue.o)][clue.t]][clue.f] !== clue.neg;
    case 'ncarry':
      return truth.obj[clue.c] !== clue.o;
    case 'cwith': {
      const carrier = carrierOf(clue.o);
      return carrier !== clue.c && rooms[carrier][clue.t] === rooms[clue.c][clue.t];
    }
  }
}

export type DiffIndex = 0 | 1 | 2;

/** "Fuerza" de cada tipo de pista (§6.1): cuánto reduce el espacio de soluciones. */
export const CLUE_STRENGTH: Record<ClueKind, number> = {
  at: 1.0,
  notat: 0.15,
  feat: 0.5,
  never: 0.35,
  visited: 0.45,
  stayed: 0.8,
  moved: 0.4,
  still: 0.55,
  together: 0.9,
  apart: 0.6,
  adj: 0.8,
  count: 0.85,
  cat: 0.95,
  cfeat: 0.5,
  ncarry: 0.2,
  cwith: 0.9,
};

/** Peso por tipo y dificultad (§6.3): orienta la selección del generador, no es una probabilidad directa. */
export const CLUE_WEIGHTS: Record<DiffIndex, Record<ClueKind, number>> = {
  0: { at: 2.0, notat: 1.0, feat: 1.5, never: 2.0, visited: 1.5, stayed: 1.0, moved: 1.5, still: 1.5, together: 2.0, apart: 1.0, adj: 0, count: 1.5, cat: 2.0, cfeat: 1.0, ncarry: 2.0, cwith: 0 },
  1: { at: 0.8, notat: 0.3, feat: 1.5, never: 1.6, visited: 1.8, stayed: 1.0, moved: 2.0, still: 2.0, together: 2.0, apart: 1.5, adj: 1.8, count: 1.8, cat: 1.4, cfeat: 1.4, ncarry: 1.0, cwith: 1.2 },
  2: { at: 0.4, notat: 0.2, feat: 1.6, never: 1.4, visited: 1.8, stayed: 0.8, moved: 2.0, still: 2.0, together: 1.5, apart: 1.6, adj: 2.2, count: 1.8, cat: 1.0, cfeat: 1.8, ncarry: 0.6, cwith: 1.6 },
};

/** Tope máximo de pistas de cada tipo por caso, por dificultad (§6.3, incluye la regla "máximo 3 del mismo tipo"). */
export const CLUE_CAPS: Record<DiffIndex, Record<ClueKind, number>> = {
  0: { at: 2, notat: 2, feat: 3, never: 3, visited: 2, stayed: 1, moved: 2, still: 2, together: 2, apart: 1, adj: 0, count: 2, cat: 3, cfeat: 1, ncarry: 2, cwith: 0 },
  1: { at: 1, notat: 1, feat: 3, never: 3, visited: 3, stayed: 1, moved: 3, still: 3, together: 3, apart: 2, adj: 2, count: 3, cat: 3, cfeat: 2, ncarry: 2, cwith: 2 },
  2: { at: 1, notat: 1, feat: 3, never: 3, visited: 3, stayed: 1, moved: 3, still: 3, together: 3, apart: 2, adj: 3, count: 3, cat: 3, cfeat: 3, ncarry: 1, cwith: 3 },
};

/** Longitud máxima de lectura en caracteres de texto plano, pensada para móvil (§6.3). */
export const MAX_READ_LENGTH: Record<DiffIndex, number> = { 0: 600, 1: 900, 2: 1250 };

/** Mínimo de pistas de categoría Movimiento por caso (§6.3, "el movimiento es protagonista"). */
export const MIN_MOVEMENT_CLUES: Record<DiffIndex, number> = { 0: 1, 1: 2, 2: 2 };

export type ClueCategory = 'Personas' | 'Movimiento' | 'Encuentros' | 'Salas' | 'Objetos';

const CLUE_CATEGORY: Record<ClueKind, ClueCategory> = {
  at: 'Personas',
  notat: 'Personas',
  feat: 'Personas',
  never: 'Movimiento',
  visited: 'Movimiento',
  stayed: 'Movimiento',
  moved: 'Movimiento',
  still: 'Movimiento',
  together: 'Encuentros',
  apart: 'Encuentros',
  adj: 'Encuentros',
  count: 'Salas',
  cat: 'Objetos',
  cfeat: 'Objetos',
  ncarry: 'Objetos',
  cwith: 'Objetos',
};

const CATEGORY_ORDER: ClueCategory[] = ['Personas', 'Movimiento', 'Encuentros', 'Salas', 'Objetos'];

export function clueCategory(clue: Clue): ClueCategory {
  return CLUE_CATEGORY[clue.k];
}

function clueHour(clue: Clue): Hour {
  return 't' in clue ? clue.t : -1;
}

/** Orden de presentación (§6.4): por categoría y, dentro de cada una, por hora ascendente. */
export function sortClues(clues: Clue[]): Clue[] {
  return clues
    .map((clue, index) => ({ clue, index }))
    .sort((a, b) => {
      const categoryDiff = CATEGORY_ORDER.indexOf(clueCategory(a.clue)) - CATEGORY_ORDER.indexOf(clueCategory(b.clue));
      if (categoryDiff !== 0) return categoryDiff;
      const hourDiff = clueHour(a.clue) - clueHour(b.clue);
      if (hourDiff !== 0) return hourDiff;
      return a.index - b.index;
    })
    .map(({ clue }) => clue);
}

export interface CluePoolContext {
  N: number;
  T: number;
  map: MapDef;
  graph: Graph;
  truth: Truth;
  rv: Room;
  td: Hour;
  culprit: Sus;
  weapon: Obj;
  diff: DiffIndex;
}

/**
 * Construye la reserva de pistas verdaderas (§6.1) aplicando las prohibiciones
 * de §6.2 y filtrando los tipos con peso 0 en esta dificultad (§6.3). Nota: a
 * diferencia de v1, en Inspector y Comisario se excluye cualquier `notat`
 * referido a la sala del crimen a cualquier hora (no solo a la hora del
 * crimen), tal como pide el diseño ("acortan demasiado"); ver docs/DECISIONES.md.
 */
export function buildCluePool(ctx: CluePoolContext, rng: Rng): Clue[] {
  const { N, T, map, graph, truth, rv, td, culprit, weapon, diff } = ctx;
  const rooms = truth.rooms;
  const roomCount = map.rooms.length;
  const easy = diff === 0;
  const pool: Clue[] = [];

  for (let c = 0; c < N; c++) {
    for (let t = 0; t < T; t++) {
      const r = rooms[c][t];
      if (!(c === culprit && t === td)) pool.push({ k: 'at', c, t, r });
      for (let f = 0; f < map.features.length; f++) {
        pool.push({ k: 'feat', c, t, f: f as 0 | 1, neg: !graph.feat[r][f] });
      }
      for (let x = 0; x < roomCount; x++) {
        if (x !== r && (easy || x !== rv)) pool.push({ k: 'notat', c, t, r: x });
      }
    }
    for (let t = 0; t < T - 1; t++) {
      if (rooms[c][t] !== rooms[c][t + 1]) pool.push({ k: 'moved', c, t });
      else pool.push({ k: 'still', c, t });
    }
  }

  for (let c = 0; c < N; c++) {
    for (let x = 0; x < roomCount; x++) {
      if (rooms[c].includes(x)) {
        if (!(c === culprit && x === rv)) pool.push({ k: 'visited', c, r: x });
      } else if (easy || x !== rv) {
        pool.push({ k: 'never', c, r: x });
      }
    }
    if (c !== culprit && rooms[c].every((x) => x === rooms[c][0])) pool.push({ k: 'stayed', c });
    for (let o = 0; o < N; o++) if (o !== truth.obj[c]) pool.push({ k: 'ncarry', c, o });
  }

  for (let a = 0; a < N; a++) {
    for (let b = a + 1; b < N; b++) {
      let neverTogether = true;
      for (let t = 0; t < T; t++) {
        if (rooms[a][t] === rooms[b][t]) {
          neverTogether = false;
          pool.push({ k: 'together', a, b, t });
        } else if (graph.adjM[rooms[a][t]][rooms[b][t]]) {
          pool.push(rng() < 0.5 ? { k: 'adj', a, b, t } : { k: 'adj', a: b, b: a, t });
        }
      }
      if (neverTogether) pool.push({ k: 'apart', a, b });
    }
  }

  for (let t = 0; t < T; t++) {
    for (let x = 0; x < roomCount; x++) {
      if (x === rv && t === td) continue;
      pool.push({ k: 'count', r: x, t, n: rooms.filter((path) => path[t] === x).length });
    }
  }

  for (let o = 0; o < N; o++) {
    const carrier = truth.obj.indexOf(o);
    for (let t = 0; t < T; t++) {
      if (!(o === weapon && t === td)) {
        pool.push({ k: 'cat', o, t, r: rooms[carrier][t] });
        for (let f = 0; f < map.features.length; f++) {
          pool.push({ k: 'cfeat', o, t, f: f as 0 | 1, neg: !graph.feat[rooms[carrier][t]][f] });
        }
      }
      for (let d = 0; d < N; d++) {
        if (d !== carrier && rooms[d][t] === rooms[carrier][t]) pool.push({ k: 'cwith', o, c: d, t });
      }
    }
  }

  return pool.filter((clue) => CLUE_WEIGHTS[diff][clue.k] > 0);
}
