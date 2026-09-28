// Tutorial guiado: un caso de prácticas pequeño (4 sospechosos, 5 salas, 3
// horas) sobre la Casa Valdemar de verdad, con una verdad y unas pistas
// escritas a mano para que el arco pedagógico sea exacto (igual que hace el
// prototipo de referencia con su propio caso fijo, en vez de usar el
// generador). Verificado contra el solver exacto (unique) y el solver humano
// (resuelve, nivel máximo 4, arquetipos "pareja"+"coartada") con un script
// aparte antes de escribir esto; `solve` se calcula aquí mismo llamando al
// solver humano de verdad, así que nunca puede desincronizarse del motor.
import { buildGraph } from '../engine/graph';
import { solveHuman } from '../engine/human';
import { reindexCriticalSteps } from '../engine/generate';
import { MANSION } from '../engine/content/maps';
import type { Clue, Room, Sus, Truth } from '../engine/types';
import type { CaseDef } from '../engine/types';

export const TUTORIAL_CASE_ID = 'TUT-01';

const graph = buildGraph(MANSION);
const N = 4;
const T = 3;
const RV: Room = 0; // Biblioteca
const TD = 1; // 22:00

// 0 Adela (culpable), 1 Bruno, 2 Celia, 3 Darío.
const TUTORIAL_TRUTH: Truth = {
  rooms: [
    [1, 0, 0], // Adela: Estudio -> Biblioteca -> Biblioteca
    [7, 5, 5], // Bruno: Cocina -> Comedor -> Comedor
    [4, 3, 4], // Celia: Vestíbulo -> Salón -> Vestíbulo
    [6, 3, 6], // Darío: Bodega -> Salón -> Bodega
  ],
  obj: [2, 1, 0, 3], // Adela=abrecartas (arma), Bruno=cuerda, Celia=candelabro, Darío=veneno
};

const TUTORIAL_CLUES: Clue[] = [
  { k: 'at', c: 1, r: 7, t: 0 }, // A las 21:00, Bruno estaba en la Cocina.
  { k: 'together', a: 2, b: 3, t: 1 }, // A las 22:00, Celia y Darío estaban en la misma sala.
  { k: 'cat', o: 1, r: 7, t: 0 }, // A las 21:00, quien llevaba la cuerda estaba en la Cocina.
  { k: 'cfeat', o: 3, t: 1, f: 1, neg: false }, // A las 22:00, quien llevaba el veneno estaba en una sala con ventana.
  { k: 'ncarry', c: 0, o: 0 }, // Adela no llevaba el candelabro.
];

function buildTutorialSolve(): CaseDef['solve'] {
  const human = solveHuman({ N, T, graph, rv: RV, td: TD }, TUTORIAL_CLUES);
  if (!human) throw new Error('El caso de tutorial no resuelve: revisa TUTORIAL_TRUTH/TUTORIAL_CLUES.');
  const keyStep = human.steps[human.key];
  const criticalUnindexed = human.steps.filter((s) => s.crit);
  const key = criticalUnindexed.indexOf(keyStep);
  const steps = reindexCriticalSteps(human.steps);
  return { steps, key, arch: human.arch, maxLv: human.maxLv, score: human.score };
}

export const TUTORIAL_CASE: CaseDef = {
  v: 2,
  id: TUTORIAL_CASE_ID,
  mode: 'novato',
  diff: 0,
  map: 'mansion',
  cast: [0, 1, 2, 3],
  objects: [0, 1, 2, 3],
  victim: 0,
  motive: 3,
  N,
  T,
  rv: RV,
  td: TD,
  culprit: 0,
  weapon: 2,
  truth: TUTORIAL_TRUTH,
  clues: TUTORIAL_CLUES,
  solve: buildTutorialSolve(),
  sig: 'tutorial-fixed',
};

// =====================================================================
// Pasos del tutorial guiado.
// =====================================================================

export interface TutorialTask {
  /** Instrucción concreta para el paso actual, recalculada en cada tick a
   * partir del estado real (igual que hace el prototipo: el texto siempre
   * dice justo lo que falta, no una instrucción fija). */
  tx: string;
  /** Selector CSS del elemento a resaltar para esta instrucción. */
  sel: string;
  /** Selector adicional a resaltar a la vez (p. ej. la pista relacionada). */
  extra?: string;
}

export interface TutorialStepState {
  mode: string;
  hour: number;
  selectedSuspect: number | null;
  markAt: (hour: number, room: number, suspect: number) => 0 | 1 | 2;
  gridAt: (obj: number, suspect: number) => 0 | 1 | 2;
  struckHas: (clueIndex: number) => boolean;
  strokeCount: number;
  longestStroke: number;
  filter: { type: 'sus'; c: number } | { type: 'room'; r: number } | null;
  result: 'playing' | 'solved' | 'archived';
}

export interface TutorialStep {
  id: string;
  kind: 'info' | 'do';
  title: string;
  /** HTML (ya en español, sin interpolar nada externo). */
  body: string;
  tip?: string;
  /** Selector a resaltar mientras se ve este paso (pasos "info", o de respaldo). */
  target?: string;
  /** Salas del plano a resaltar (rectángulo ámbar). */
  rooms?: Room[];
  /** Guía extra dibujada sobre el plano. */
  overlay?: 'path' | 'guide' | 'back';
  /** Solo pasos "do": si ya está hecho. */
  check?: (s: TutorialStepState) => boolean;
  /** Solo pasos "do": instrucción dinámica. */
  task?: (s: TutorialStepState) => TutorialTask;
  /** Mensaje al completarse un paso "do". */
  success?: string;
  nextLabel?: string;
}

const selChip = (c: Sus): string => `#subtools .pal:nth-child(${c + 1})`;
const selTime = (t: number): string => `#times button:nth-child(${t + 1})`;
const selMode = (m: string): string => `.seg button[data-mode="${m}"]`;
const selClue = (i: number): string => `.clue-text[data-focus="${i}"]`;
const selCell = (o: number, c: number): string => `.objtable .cell[data-o="${o}"][data-c="${c}"]`;

const ROOM_NAME: Record<Room, string> = { 0: 'la Biblioteca', 1: 'el Estudio', 2: 'el Invernadero', 3: 'el Salón', 4: 'el Vestíbulo', 5: 'el Comedor', 6: 'la Bodega', 7: 'la Cocina' };
const SUSPECT_NAME: Record<Sus, string> = { 0: 'Adela', 1: 'Bruno', 2: 'Celia', 3: 'Darío' };

function markTask(s: TutorialStepState, c: Sus, t: number, r: Room, want: 1 | 2): TutorialTask {
  const name = SUSPECT_NAME[c];
  if (s.mode !== 'mark') return { tx: 'Pulsa Marcar, en la barra de herramientas.', sel: selMode('mark') };
  if (s.selectedSuspect !== c) return { tx: `Toca el chip de ${name} en la fila de sospechosos.`, sel: selChip(c) };
  if (s.hour !== t) return { tx: `Cambia a las ${t === 0 ? '21:00' : t === 1 ? '22:00' : '23:00'} con las pestañas de hora.`, sel: selTime(t) };
  const v = s.markAt(t, r, c);
  if (want === 1) {
    return v === 2
      ? { tx: `Ahí hay una ✗. Toca ${ROOM_NAME[r]} dos veces más: el primer toque la borra y el segundo pone ✓.`, sel: '.plan' }
      : { tx: `Toca ${ROOM_NAME[r]} en el plano.`, sel: '.plan' };
  }
  return v === 1
    ? { tx: `Toca otra vez ${ROOM_NAME[r]}: la ✓ pasa a ✗.`, sel: '.plan' }
    : { tx: `Toca ${ROOM_NAME[r]} dos veces: el primer toque pone ✓ y el segundo la cambia a ✗.`, sel: '.plan' };
}

function gridTask(s: TutorialStepState, o: number, c: Sus, want: 1 | 2, objLabel: string): TutorialTask {
  const v = s.gridAt(o, c);
  const name = SUSPECT_NAME[c][0];
  if (want === 2) {
    return v === 1
      ? { tx: 'Toca otra vez la casilla: la ✓ pasa a ✗.', sel: selCell(o, c) }
      : { tx: `En la fila ${objLabel}, columna ${name}, toca dos veces para poner ✗.`, sel: selCell(o, c) };
  }
  return { tx: `En la fila ${objLabel}, columna ${name}, toca para poner ✓.`, sel: selCell(o, c) };
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'hola',
    kind: 'info',
    title: 'Un caso de prácticas',
    nextLabel: 'Empezar',
    body: '<p>Vas a resolver un caso completo, pero pequeño: cuatro sospechosos, cinco salas y tres horas. Te explico cada idea y tú haces cada movimiento en el tablero de verdad.</p><p>Nada de lo que hagas aquí cuenta en tus estadísticas, así que equivócate sin miedo.</p>',
  },
  {
    id: 'informe',
    kind: 'info',
    title: 'Primero, los hechos',
    target: '#brief',
    body: '<p>El informe dice dónde y cuándo: <b>Don Aurelio Valdemar</b> apareció sin vida en la <b>Biblioteca</b> a las <b>22:00</b>. Abajo tienes a los cuatro sospechosos.</p><p>Tu respuesta final serán dos cosas: quién lo hizo y con qué objeto.</p>',
    tip: 'Quédate con la sala y la hora del crimen: casi todo el razonamiento gira alrededor de ese momento.',
  },
  {
    id: 'plano',
    kind: 'info',
    title: 'El plano',
    target: '.plan',
    body: '<p>Cada rectángulo es una sala. Los huecos en las paredes son puertas: solo se pasa de una sala a otra por ellas.</p><p>Los iconos indican rasgos de la sala, como chimenea o ventana, y la marca roja señala a la víctima.</p>',
    tip: 'Si olvidas qué significa un icono, mira la leyenda debajo del plano.',
  },
  {
    id: 'horas',
    kind: 'do',
    title: 'Una pestaña por hora',
    body: '<p>El caso ocurre a las 21:00, 22:00 y 23:00. Con estas pestañas cambias la hora del plano, y tus marcas se guardan en cada una por separado.</p>',
    check: (s) => s.hour === 1,
    task: () => ({ tx: 'Toca la pestaña de las 22:00, la hora del crimen.', sel: selTime(1) }),
    success: 'La Biblioteca se recuadra en rojo: ahí y a esa hora ocurrió todo.',
  },
  {
    id: 'pista1',
    kind: 'info',
    title: 'Lee las pistas de una en una',
    target: selClue(0),
    body: '<p>Todas las pistas son verdad y, juntas, solo admiten una respuesta. Conviene empezar por la más concreta.</p><p>La pista 1 dice: <b>a las 21:00, Bruno estaba en la Cocina.</b> Vamos a anotarla.</p>',
  },
  {
    id: 'marca1',
    kind: 'do',
    title: 'Anótalo en el plano',
    body: '<p>En el modo Marcar eliges a un sospechoso y tocas una sala. Un toque pone ✓: estaba aquí a esta hora.</p>',
    check: (s) => s.markAt(0, 7, 1) === 1,
    task: (s) => markTask(s, 1, 0, 7, 1),
    success: 'Anotado: Bruno, Cocina, 21:00.',
  },
  {
    id: 'alcance',
    kind: 'info',
    title: 'Una puerta por hora',
    target: '.plan',
    rooms: [7, 5, 0],
    overlay: 'path',
    body: '<p>Entre una hora y la siguiente, cada persona se queda donde está o cruza <b>una sola puerta</b>.</p><p>La Cocina solo tiene una puerta, al Comedor. A las 22:00, Bruno solo pudo quedarse en la Cocina o pasar al Comedor. No llega a tiempo a la Biblioteca.</p>',
    tip: 'Es la deducción más habitual del juego: cuenta puertas, no distancias.',
  },
  {
    id: 'tiza',
    kind: 'do',
    title: 'La pizarra',
    body: '<p>Pensar dibujando ayuda. En el modo Tiza puedes trazar encima del plano con el dedo o con el ratón.</p>',
    check: (s) => s.mode === 'chalk',
    task: () => ({ tx: 'Pulsa Tiza, en la barra de herramientas.', sel: selMode('chalk') }),
  },
  {
    id: 'dibujo',
    kind: 'do',
    title: 'Dibuja el camino',
    overlay: 'guide',
    rooms: [7, 5],
    body: '<p>Traza el recorrido de Bruno: de la Cocina al Comedor. Te dejo una guía tenue para que la repases.</p>',
    tip: 'Puedes cambiar de color, borrar un trazo con la Goma o limpiar la hora entera. Lo que dibujas se guarda en la hora en la que estás.',
    check: (s) => s.longestStroke >= 4,
    task: (s) => (s.mode !== 'chalk' ? { tx: 'Vuelve a pulsar Tiza.', sel: selMode('chalk') } : { tx: 'Dibuja una línea sobre el plano siguiendo la guía.', sel: '.plan' }),
    success: 'Una puerta, una hora: se ve claro que no llega a la Biblioteca.',
  },
  {
    id: 'descarte1',
    kind: 'do',
    title: 'Anota la conclusión',
    body: '<p>Bruno no pudo estar en la Biblioteca a las 22:00, así que <b>no es el culpable</b>. Anótalo con una ✗: en Marcar, el segundo toque en una sala cambia la ✓ por ✗ (no estaba).</p>',
    tip: 'Si te equivocas, el botón Deshacer revierte tu última marca o trazo.',
    check: (s) => s.markAt(1, 0, 1) === 2,
    task: (s) => markTask(s, 1, 1, 0, 2),
    success: 'Bruno, descartado.',
  },
  {
    id: 'tachar',
    kind: 'do',
    title: 'Tacha lo que ya usaste',
    body: '<p>La pista 1 ya no da más de sí. Tócala para tacharla: así sabrás de un vistazo qué te queda por leer.</p>',
    check: (s) => s.struckHas(0),
    task: () => ({ tx: 'Toca la pista 1 (el cuadrito a su izquierda).', sel: '.clue-check[data-strike="0"]' }),
  },
  {
    id: 'pareja',
    kind: 'info',
    title: 'Dos a la vez no puede ser',
    target: selClue(1),
    body: '<p>La pista 2 dice: <b>a las 22:00, Celia y Darío estaban en la misma sala.</b></p><p>Si una de ellas hubiera estado en la Biblioteca, la otra también, y serían dos. Pero el culpable estaba solo con la víctima. Ninguna de las dos es la culpable.</p>',
    tip: 'Cuando dos personas van juntas a la hora del crimen, descarta a las dos.',
  },
  {
    id: 'descarte2',
    kind: 'do',
    title: 'Márcalas',
    body: '<p>Pon una ✗ a Celia y otra a Darío en la Biblioteca a las 22:00.</p>',
    check: (s) => s.markAt(1, 0, 2) === 2 && s.markAt(1, 0, 3) === 2,
    task: (s) => (s.markAt(1, 0, 2) !== 2 ? markTask(s, 2, 1, 0, 2) : markTask(s, 3, 1, 0, 2)),
    success: 'Celia y Darío, descartados.',
  },
  {
    id: 'culpable',
    kind: 'do',
    title: 'Solo queda uno',
    body: '<p>Alguien tuvo que estar a solas con la víctima, y Bruno, Celia y Darío no pudieron. <b>La culpable es Adela.</b></p><p>Márcala con ✓ en la Biblioteca a las 22:00 y tacha la pista 2.</p>',
    check: (s) => s.markAt(1, 0, 0) === 1 && s.struckHas(1),
    task: (s) => (s.markAt(1, 0, 0) !== 1 ? markTask(s, 0, 1, 0, 1) : { tx: 'Ahora toca la pista 2 para tacharla.', sel: '.clue-check[data-strike="1"]' }),
    success: 'Ya sabes quién. Falta saber con qué.',
  },
  {
    id: 'tabla',
    kind: 'do',
    title: 'La tabla de objetos',
    body: '<p>Cada sospechoso llevó un objeto distinto y el arma es el del culpable. En la tabla, un toque pone ✓ (lo llevaba) y dos ponen ✗ (no lo llevaba).</p><p>La pista 5 dice: <b>Adela no llevaba el candelabro.</b></p>',
    check: (s) => s.gridAt(0, 0) === 2,
    task: (s) => ({ ...gridTask(s, 0, 0, 2, 'Candelabro'), extra: '.clue-text[data-focus="4"]' }),
  },
  {
    id: 'cuerda',
    kind: 'do',
    title: 'Cruza el lugar con el objeto',
    overlay: 'back',
    rooms: [0, 1, 4],
    body: '<p>La pista 3 dice: <b>a las 21:00, quien llevaba la cuerda estaba en la Cocina.</b></p><p>Adela estaba en el Estudio a las 21:00, no en la Cocina: <b>Adela no llevaba la cuerda.</b></p>',
    tip: 'Es la misma regla de las puertas, pero mirando hacia atrás en el tiempo.',
    check: (s) => s.gridAt(1, 0) === 2,
    task: (s) => ({ ...gridTask(s, 1, 0, 2, 'Cuerda'), extra: '.clue-text[data-focus="2"]' }),
  },
  {
    id: 'veneno',
    kind: 'do',
    title: 'Mira los rasgos de la sala',
    rooms: [0],
    body: '<p>La pista 4 dice: <b>a las 22:00, quien llevaba el veneno estaba en una sala con ventana.</b></p><p>Adela estaba en la Biblioteca, que solo tiene chimenea. <b>Adela no llevaba el veneno.</b></p>',
    check: (s) => s.gridAt(3, 0) === 2,
    task: (s) => ({ ...gridTask(s, 3, 0, 2, 'Veneno'), extra: '.clue-text[data-focus="3"]' }),
  },
  {
    id: 'arma',
    kind: 'do',
    title: 'Por eliminación',
    body: '<p>A Adela solo le queda un objeto posible: <b>el abrecartas</b>. Márcalo con ✓.</p>',
    check: (s) => s.gridAt(2, 0) === 1,
    task: (s) => gridTask(s, 2, 0, 1, 'Abrecartas'),
    success: 'Culpable y arma: ya lo tienes.',
  },
  {
    id: 'ver',
    kind: 'do',
    title: 'Revisa antes de acusar',
    body: '<p>El modo Ver deja el plano a salvo de toques accidentales. Además, si tocas un sospechoso, se resaltan las pistas que lo mencionan.</p>',
    check: (s) => s.mode === 'view' && s.filter?.type === 'sus' && s.filter.c === 0,
    task: (s) => (s.mode !== 'view' ? { tx: 'Pulsa Ver, en la barra de herramientas.', sel: selMode('view') } : { tx: 'Toca el chip de Adela.', sel: selChip(0) }),
    success: 'Las pistas que hablan de Adela quedan resaltadas, y todas encajan.',
  },
  {
    id: 'acusar',
    kind: 'do',
    title: 'Acusa',
    body: '<p>Cuando todo encaja, acusa. Elige a Adela como culpable y el abrecartas como arma, y presenta la acusación.</p>',
    check: (s) => s.result === 'solved',
    task: () => ({ tx: 'Pulsa Acusar.', sel: '#accuseBtn' }),
    success: 'Acusación correcta.',
  },
  {
    id: 'final',
    kind: 'info',
    title: 'Lo que has aprendido',
    body:
      '<ul>' +
      '<li>Empieza por los hechos: sala y hora del crimen.</li>' +
      '<li>El culpable estaba solo con la víctima: busca quién pudo estar allí y descarta al resto.</li>' +
      '<li>Una puerta por hora: cuenta puertas hacia delante y hacia atrás en el tiempo.</li>' +
      '<li>Dos personas juntas a la hora del crimen quedan descartadas las dos.</li>' +
      '<li>Cruza objetos con lugares y rasgos de sala en la tabla.</li>' +
      '<li>Anota todo: ✓, ✗, tiza y pistas tachadas. Acusa solo cuando todo encaje.</li>' +
      '</ul><p>Ya puedes ir a por un caso de verdad.</p>',
  },
];
