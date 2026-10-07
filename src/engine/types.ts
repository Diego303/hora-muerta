// Modelo de datos (sección 5 del diseño técnico). Sin DOM: usable en navegador, Web Worker y Node.

export type RoomId = string;

export type FeatureIcon = 'fire' | 'window' | 'bed' | 'case' | 'sky' | 'balcony' | 'wave' | 'porthole' | 'stage' | 'mirror';

export interface FeatureDef {
  id: string;
  icon: FeatureIcon;
  txt: string;
  neg: string;
  label: string;
}

export interface RoomDef {
  id: RoomId;
  name: string;
  art: string;
  x: number;
  y: number;
  w: number;
  h: number;
  f: string[];
}

export type MapId = 'mansion' | 'tren' | 'museo' | 'hotel' | 'barco' | 'teatro';
export type Unlock = 'start' | 'detective' | 'inspector' | 'inspector_jefe';

export interface MapDef {
  id: MapId;
  name: string;
  place: string;
  intro: string;
  unit: 'sala' | 'vagón';
  w: 12;
  h: 9;
  features: [FeatureDef, FeatureDef];
  rooms: RoomDef[];
  edges: [RoomId, RoomId][];
  unlock: Unlock;
}

/** Lo mínimo de un plano para construir su grafo y dibujarlo: lo cumplen los seis
 * escenarios (MapDef) y los planos que solo existen para ejercicios, como la "Casa de
 * prácticas" del calentamiento (docs/MODOS.md, decisión D2). */
export interface FloorPlan {
  id: string;
  name: string;
  unit: 'sala' | 'vagón';
  w: number;
  h: number;
  features: [FeatureDef, FeatureDef];
  rooms: RoomDef[];
  edges: [RoomId, RoomId][];
}

/** Grafo precalculado a partir de un MapDef (§19.2, graph.ts). */
export interface Graph {
  adj: number[][];
  adjM: boolean[][];
  feat: boolean[][];
  dist: number[][];
}

export type Hour = number; // 0 = 21:00, 1 = 22:00, 2 = 23:00, 3 (Comisario) = 00:00
export type Room = number; // índice en MapDef.rooms
export type Sus = number; // índice en el reparto del caso (0..N-1)
export type Obj = number; // índice en los objetos del caso (0..N-1)

export interface Truth {
  rooms: Room[][]; // rooms[s][t]
  obj: Obj[]; // obj[s]
}

export type Clue =
  | { k: 'at'; c: Sus; t: Hour; r: Room }
  | { k: 'notat'; c: Sus; t: Hour; r: Room }
  | { k: 'feat'; c: Sus; t: Hour; f: 0 | 1; neg: boolean }
  | { k: 'never'; c: Sus; r: Room }
  | { k: 'visited'; c: Sus; r: Room }
  | { k: 'stayed'; c: Sus }
  | { k: 'moved'; c: Sus; t: Hour }
  | { k: 'still'; c: Sus; t: Hour }
  | { k: 'together'; a: Sus; b: Sus; t: Hour }
  | { k: 'apart'; a: Sus; b: Sus }
  | { k: 'adj'; a: Sus; b: Sus; t: Hour }
  | { k: 'count'; r: Room; t: Hour; n: number }
  | { k: 'cat'; o: Obj; t: Hour; r: Room }
  | { k: 'cfeat'; o: Obj; t: Hour; f: 0 | 1; neg: boolean }
  | { k: 'ncarry'; c: Sus; o: Obj }
  | { k: 'cwith'; o: Obj; c: Sus; t: Hour };

export type ClueKind = Clue['k'];

export type Archetype = 'coartada' | 'paso' | 'pareja' | 'recuento' | 'objeto' | 'vacia' | 'callejon';

export type Conclusion =
  | { k: 'notRoom'; c: Sus; t: Hour; r: Room }
  | { k: 'isRoom'; c: Sus; t: Hour; r: Room }
  | { k: 'notCarry'; c: Sus; o: Obj }
  | { k: 'carry'; c: Sus; o: Obj }
  | { k: 'notCulprit'; c: Sus }
  | { k: 'culprit'; c: Sus };

/** Un paso del solver humano (§9). */
export interface Step {
  lv: 1 | 2 | 3 | 4 | 5 | 6;
  rule: string; // id de regla, Apéndice C
  cl: number[]; // índices de pistas usadas (en CaseDef.clues)
  concl: Conclusion[];
  prem: number[]; // índices de pasos previos de los que depende
  crit: boolean; // pertenece a la cadena crítica
}

export type CaseMode = 'novato' | 'inspector' | 'comisario' | 'diario' | 'expediente';

export interface CaseDef {
  v: 2;
  id: string; // "N-017", "I-142", "C-033", "D-012", "E-07-2"
  mode: CaseMode;
  diff: 0 | 1 | 2;
  map: MapId;
  cast: number[]; // índices en el reparto global (longitud N)
  objects: number[]; // índices en la lista global de objetos (longitud N)
  victim: number;
  motive: number;
  N: number;
  T: number;
  rv: Room; // sala del crimen
  td: Hour; // hora del crimen
  culprit: Sus;
  weapon: Obj;
  truth: Truth;
  clues: Clue[]; // en orden de presentación
  solve: {
    steps: Step[]; // solo los pasos de la cadena crítica (crit = true)
    key: number; // índice del paso "deducción clave"
    arch: Archetype[];
    maxLv: number;
    score: number;
  };
  sig: string; // firma estructural para deduplicar
}

export interface BankFile {
  version: string;
  mode: CaseMode;
  cases: CaseDef[];
}

export interface SeriesDef {
  id: string;
  map: MapId;
  cast: number[];
  cases: CaseDef[];
}
