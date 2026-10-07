// Tipos del Modo Calentamiento (docs/MODOS.md 3.2, 3.3 y 3.7).
//
// Hay dos formas de un ejercicio:
// - SeedDrill: la forma de autor, como en el prototipo, con nombres de persona, ids de
//   sala y claves de objeto. Es la que se escribe y se lee a mano.
// - Drill: la forma normalizada (índices), la que usan el verificador, la corrección y
//   el reproductor. La produce normalize.ts.
import type { ClueTextContext } from '../../engine/text';
import type { Clue, FloorPlan, Obj, Room, Sus } from '../../engine/types';

export type Tech = 'alcance' | 'seguro' | 'tabla' | 'remate';
export type DrillType = 'reach' | 'tri' | 'pick' | 'clue' | 'contra';
export type Tri = 'V' | 'F' | 'NS';

/** Personas y objetos del calentamiento (los del prototipo). */
export type GymName = 'Bruno' | 'Celia' | 'Dora' | 'Elías';
export type GymObject = 'candelabro' | 'cuerda' | 'abrecartas' | 'veneno';
export type GymMapId = 'practica' | 'mansion';

/** Una pista en forma de autor: personas por nombre, salas por id, objetos por clave y rasgos por id. */
type Named<C> = {
  [K in keyof C]: K extends 'c' | 'a' | 'b' ? GymName : K extends 'r' ? string : K extends 'o' ? GymObject : K extends 'f' ? string : C[K];
};
export type SeedClue = Clue extends infer C ? (C extends Clue ? Named<C> : never) : never;
/** "X llevaba O": enunciado de un ejercicio de tipo `tri`, no una pista del juego. */
export interface SeedCarry {
  k: 'carry';
  c: GymName;
  o: GymObject;
}

export interface SeedDrill {
  id: string;
  tech: Tech;
  type: DrillType;
  /** null: ejercicio sin plano (solo la tabla de objetos). */
  map: GymMapId | null;
  T: number;
  cast: GymName[];
  objs?: GymObject[];
  /** "Lo que sabes". */
  given?: SeedClue[];
  /** Hechos del enunciado que no se listan como pistas. */
  facts?: SeedClue[];
  /** Pistas entre las que elegir (clue y contra); `used`: ya usada, no se puede elegir. */
  clues?: (SeedClue & { used?: boolean })[];
  stmt?: SeedClue | SeedCarry;
  ask?: { c?: GymName; t?: number; who?: GymObject; what?: GymName };
  /** Regla del crimen (remates): la víctima en `rv` a la hora `td`, y una sola persona con ella. */
  rv?: string;
  td?: number;
  /** contra: hipótesis "fue esta persona". */
  hyp?: { culprit: GymName };
  /** clue: qué decide la pista: el culpable o el objeto de alguien. */
  decide?: { culprit?: boolean; what?: GymName };
  tokens?: { c: GymName; r: string; h: string }[];
  show?: { rooms?: string[]; path?: string[] };
  prompt?: string;
  context?: string;
  explain: string;
}

/** Respuesta en forma de autor. */
export type SeedAnswer =
  | { type: 'reach'; rooms: string[] }
  | { type: 'tri'; value: Tri }
  | { type: 'pick'; value: GymName | GymObject | 'NS' }
  | { type: 'decide'; decide: number[]; answer?: GymName | GymObject };

export type Statement = Clue | { k: 'carry'; c: Sus; o: Obj };

export interface Drill {
  id: string;
  tech: Tech;
  type: DrillType;
  plan: FloorPlan;
  /** El ejercicio tiene plano que enseñar (no lo tienen los de solo tabla). */
  hasPlan: boolean;
  T: number;
  N: number;
  /** Número de objetos (0 si el ejercicio no tiene tabla). */
  nObjs: number;
  ctx: ClueTextContext;
  given: Clue[];
  facts: Clue[];
  clues: Clue[];
  used: boolean[];
  stmt: Statement | null;
  ask: { c: Sus | null; t: number | null; who: Obj | null; what: Sus | null } | null;
  rv: Room | null;
  td: number | null;
  hyp: Sus | null;
  decide: { culprit: boolean; what: Sus | null } | null;
  tokens: { c: Sus; r: Room; caption: string; hyp: boolean }[];
  show: { rooms: Room[]; path: Room[] };
  prompt: string;
  context: string;
  explain: string;
}

/** Respuesta normalizada (índices). */
export type Answer =
  | { type: 'reach'; rooms: Room[] }
  | { type: 'tri'; value: Tri }
  | { type: 'pick'; value: number | 'NS' }
  | { type: 'decide'; decide: number[]; answer: number | null };

/** Lo que contesta quien juega. */
export type Reply =
  | { type: 'reach'; rooms: Room[] }
  | { type: 'tri'; value: Tri }
  | { type: 'pick'; value: number | 'NS' }
  | { type: 'decide'; pick: number };
