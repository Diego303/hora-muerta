// Generación de ejercicios a partir de los casos del banco (docs/MODOS.md 3.8, fuente 2).
// Cada paso de la cadena crítica del solver humano se convierte en un ejercicio según
// la tabla de 3.8. El ejercicio es un "mundo pequeño" sacado del caso: las personas y
// las pistas que necesita ese paso (como mucho 4 personas y 3 horas), con la verdad del
// caso como escenario válido. Después:
// - la respuesta se calcula por fuerza bruta (verify.ts), nunca se copia del solver;
// - el solver humano, aplicado al mundo pequeño, tiene que llegar a esa misma respuesta
//   (si no, el ejercicio exigiría algo más que las reglas que se enseñan) y su cadena de
//   pasos da la explicación, con las plantillas del Apéndice C;
// - se aplican los filtros de calidad: pocas pistas, nada que se responda sin mirar.
// Puro y sin DOM: lo usa scripts/build-drills.ts.
import { MAPS } from '../../engine/content/maps';
import { buildGraph } from '../../engine/graph';
import { propagateHuman, solveHuman, type HumanPropagation } from '../../engine/human';
import { culpritNoun, isFemale, objPronoun, plainText, stepExplanation, timeLabel } from '../../engine/text';
import type { CaseDef, Clue, Conclusion, Graph, MapDef, Room, Step, Sus } from '../../engine/types';
import { drillLevel } from './adapt';
import { compactMarkup, drillFromDef } from './normalize';
import type { Answer, Drill, DrillDef, DrillType, Statement, Tech } from './types';
import { BudgetExceeded, computeAnswer, drillErrors, scenarios, type Enumerator } from './verify';

/** Presupuesto de cada enumeración al generar: un candidato que no cabe se descarta (el
 * banco tiene de sobra y así ninguno tarda minutos). La validación no tiene límite. */
const BUDGET = 400_000;
const scenariosFor: Enumerator = (drill, statements, relevant) => scenarios(drill, statements, relevant, BUDGET);

/** Límites de MODOS 3.8: lo que la fuerza bruta recorre y lo que cabe en "Lo que sabes". */
export const MAX_PERSONS = 4;
export const MAX_GIVEN = 4;
export const MAX_GIVEN_REMATE = 6;
/** Pasos de la explicación: más sería una cadena demasiado larga para un ejercicio. */
export const MAX_EXPLAIN_STEPS = 5;

/** Por qué se descartan candidatos (para el informe de scripts/build-drills.ts). */
export const REJECTS: Record<string, number> = {};
function reject(reason: string): null {
  REJECTS[reason] = (REJECTS[reason] ?? 0) + 1;
  return null;
}

export interface CaseAnalysis {
  caseData: CaseDef;
  map: MapDef;
  graph: Graph;
  /** Todos los pasos del solver humano (con `crit` marcado). */
  steps: Step[];
}

export function analyzeCase(caseData: CaseDef): CaseAnalysis | null {
  const map = MAPS.find((m) => m.id === caseData.map);
  if (!map) return null;
  const graph = buildGraph(map);
  const solved = solveHuman({ N: caseData.N, T: caseData.T, graph, rv: caseData.rv, td: caseData.td }, caseData.clues);
  return solved ? { caseData, map, graph, steps: solved.steps } : null;
}

const isCandStep = (step: Step): boolean => step.concl.some((c) => c.k === 'notCulprit' || c.k === 'culprit');
const usesCrime = (step: Step): boolean => step.rule.startsWith('R2_') || step.rule === 'R6_HYPOTHESIS' || isCandStep(step);

/** Pistas (índices del caso) de las que depende un paso, siguiendo sus premisas hacia
 * atrás. Con `own`, sin pasar por los descartes de otros sospechosos (el solver los cita
 * como premisa de cada descarte aunque no hagan falta para ese). */
export function premiseClues(steps: readonly Step[], index: number, own = false): { clues: number[]; crime: boolean } {
  const seen = new Set<number>();
  const clues = new Set<number>();
  let crime = false;
  const stack = [index];
  while (stack.length) {
    const i = stack.pop() as number;
    if (seen.has(i)) continue;
    if (own && i !== index && isCandStep(steps[i])) continue;
    seen.add(i);
    if (usesCrime(steps[i])) crime = true;
    for (const c of steps[i].cl) clues.add(c);
    stack.push(...steps[i].prem);
  }
  return { clues: [...clues].sort((a, b) => a - b), crime };
}

// ---------------- Mundo pequeño ----------------

/** Personas (del caso) que una pista nombra; las de objeto, también quien lo llevaba. */
function clueRefs(a: CaseAnalysis, clue: Clue): Sus[] {
  const carrier = (o: number): Sus => a.caseData.truth.obj.indexOf(o);
  switch (clue.k) {
    case 'together':
    case 'apart':
    case 'adj':
      return [clue.a, clue.b];
    case 'count':
      return [];
    case 'cat':
    case 'cfeat':
      return [carrier(clue.o)];
    case 'cwith':
      return [carrier(clue.o), clue.c];
    default:
      return [clue.c];
  }
}

const OBJECT_KINDS = new Set(['cat', 'cfeat', 'ncarry', 'cwith']);
const WHOLE_NIGHT = new Set(['never', 'visited', 'stayed']);
const isObjectClue = (clue: Clue): boolean => OBJECT_KINDS.has(clue.k);

interface World {
  a: CaseAnalysis;
  /** Personas del caso, en orden. */
  persons: Sus[];
  /** Objetos de esas personas en el caso (índices del caso), en orden; [] sin tabla. */
  objects: number[];
  T: number;
  crime: boolean;
}

function makeWorld(a: CaseAnalysis, persons: Iterable<Sus>, clues: readonly Clue[], extraHours: number[], crime: boolean): World | null {
  const ps = [...new Set(persons)].sort((x, y) => x - y);
  if (ps.length === 0 || ps.length > MAX_PERSONS) return null;
  const withObjects = clues.some(isObjectClue);
  // Con una sola persona, "quien llevaba el objeto" o "había exactamente una" la nombran sin decirlo.
  if (ps.length < 2 && (withObjects || clues.some((c) => c.k === 'count'))) return null;
  const objects = withObjects ? ps.map((p) => a.caseData.truth.obj[p]).sort((x, y) => x - y) : [];
  let T = 1;
  const hour = (t: number): void => {
    T = Math.max(T, t + 1);
  };
  for (const c of clues) {
    if (WHOLE_NIGHT.has(c.k)) T = a.caseData.T;
    if ('t' in c) hour(c.k === 'moved' || c.k === 'still' ? c.t + 1 : c.t);
  }
  extraHours.forEach(hour);
  if (crime) hour(a.caseData.td);
  return { a, persons: ps, objects, T: Math.min(T, a.caseData.T), crime };
}

/** Una pista del caso en índices del mundo; null si nombra algo que no está en él. */
function localClue(w: World, clue: Clue): Clue | null {
  const p = (c: Sus): number => w.persons.indexOf(c);
  const o = (x: number): number => w.objects.indexOf(x);
  if (clueRefs(w.a, clue).some((c) => p(c) < 0)) return null;
  if ('t' in clue && (clue.k === 'moved' || clue.k === 'still' ? clue.t + 1 : clue.t) >= w.T) return null;
  switch (clue.k) {
    case 'together':
    case 'apart':
    case 'adj':
      return { ...clue, a: p(clue.a), b: p(clue.b) };
    case 'count': {
      // El recuento se rehace con las personas del mundo: sigue siendo cierto en él.
      const n = w.persons.filter((c) => w.a.caseData.truth.rooms[c][clue.t] === clue.r).length;
      return { ...clue, n };
    }
    case 'cat':
    case 'cfeat':
      return w.objects.length ? { ...clue, o: o(clue.o) } : null;
    case 'cwith':
      return w.objects.length ? { ...clue, o: o(clue.o), c: p(clue.c) } : null;
    case 'ncarry':
      return w.objects.length && o(clue.o) >= 0 ? { ...clue, c: p(clue.c), o: o(clue.o) } : null;
    default:
      return { ...clue, c: p(clue.c) };
  }
}

function localClues(w: World, indices: readonly number[]): Clue[] | null {
  const out: Clue[] = [];
  for (const i of indices) {
    const c = localClue(w, w.a.caseData.clues[i]);
    if (!c) return null;
    out.push(c);
  }
  return out;
}

const sameClue = (x: Statement, y: Statement): boolean => JSON.stringify(x) === JSON.stringify(y);

interface DefParts {
  id: string;
  tech: Tech;
  type: DrillType;
  given: Clue[];
  facts?: Clue[];
  clues?: Clue[];
  used?: boolean[];
  stmt?: Statement | null;
  ask?: Drill['ask'];
  hyp?: Sus | null;
  decide?: Drill['decide'];
  prompt?: string;
  context?: string;
  src: string;
}

function baseDef(w: World, parts: DefParts): DrillDef {
  const c = w.a.caseData;
  // Una tabla solo con "X no llevaba O" no tiene plano que enseñar.
  const hasRooms = parts.type !== 'pick' || [...parts.given, ...(parts.facts ?? []), ...(parts.clues ?? [])].some((x) => x.k !== 'ncarry');
  return {
    id: parts.id,
    tech: parts.tech,
    type: parts.type,
    level: 1,
    map: hasRooms ? c.map : null,
    T: hasRooms ? w.T : 1,
    cast: w.persons.map((p) => c.cast[p]),
    objs: w.objects.map((o) => c.objects[o]),
    given: parts.given,
    facts: parts.facts ?? [],
    clues: parts.clues ?? [],
    used: parts.used ?? (parts.clues ?? []).map(() => false),
    stmt: parts.stmt ?? null,
    ask: parts.ask ?? null,
    rv: w.crime ? c.rv : null,
    td: w.crime ? c.td : null,
    hyp: parts.hyp ?? null,
    decide: parts.decide ?? null,
    show: { rooms: [], path: [] },
    prompt: parts.prompt ?? '',
    context: parts.context ?? '',
    explain: '',
    answer: { type: 'tri', value: 'NS' },
    src: parts.src,
  };
}

// ---------------- Explicación (Apéndice C, en "tú") ----------------

function humanRun(drill: Drill, clues: Clue[], crime: boolean): HumanPropagation {
  return propagateHuman({ N: drill.N, T: drill.T, graph: buildGraph(drill.plan), rv: drill.rv ?? 0, td: drill.td ?? 0 }, clues, { crime });
}

/** Pasos (en orden) de los que salen los que cumplen `target`. Los descartes de otros
 * sospechosos no se cuentan: el solver los cita como premisa de cada descarte, pero
 * para explicar este no hacen falta. */
function chainTo(steps: readonly Step[], target: (c: Conclusion) => boolean): number[] {
  const seen = new Set<number>();
  const stack = steps.map((s, i) => (s.concl.some(target) ? i : -1)).filter((i) => i >= 0);
  while (stack.length) {
    const i = stack.pop() as number;
    if (seen.has(i)) continue;
    if (isCandStep(steps[i]) && !steps[i].concl.some(target)) continue;
    seen.add(i);
    stack.push(...steps[i].prem);
  }
  return [...seen].sort((a, b) => a - b);
}

const who = (drill: Drill, c: Sus): string => `<span class="who" style="--c:${drill.ctx.suspects[c].color}">${drill.ctx.suspects[c].name}</span>`;
const room = (drill: Drill, r: Room): string => `${drill.ctx.rooms[r].art} <b class="rm">${drill.ctx.rooms[r].name}</b>`;
const time = (t: number): string => `<span class="tm">${timeLabel(t)}</span>`;
const objName = (drill: Drill, o: number): string => `${drill.ctx.objects[o].article} <span class="obj">${drill.ctx.objects[o].name}</span>`;
const roomName = (drill: Drill, r: Room): string => `${drill.ctx.rooms[r].art} ${drill.ctx.rooms[r].name}`;
const name = (drill: Drill, c: Sus): string => drill.ctx.suspects[c].name;

function listOr(items: string[]): string {
  return items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} o ${items[items.length - 1]}`;
}

function listAnd(items: string[]): string {
  return items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

function bitsOf(mask: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (mask & (1 << i)) out.push(i);
  return out;
}

const roomsList = (drill: Drill, mask: number): string => listOr(bitsOf(mask, drill.plan.rooms.length).map((r) => room(drill, r)));
const lo = (drill: Drill, o: number): string => objPronoun(drill.ctx.objects[o]);

/** Las salas posibles de cada persona y hora justo antes de cada paso (el solver no las guarda). */
function possBefore(drill: Drill, steps: readonly Step[]): number[][][] {
  const poss = Array.from({ length: drill.N }, () => new Array<number>(drill.T).fill((1 << drill.plan.rooms.length) - 1));
  return steps.map((step) => {
    const snapshot = poss.map((row) => row.slice());
    for (const x of step.concl) {
      if (x.k === 'notRoom') poss[x.c][x.t] &= ~(1 << x.r);
      if (x.k === 'isRoom') poss[x.c][x.t] = 1 << x.r;
    }
    return snapshot;
  });
}

/** Una frase por paso con las plantillas del Apéndice C. Las de alcance y rasgo usan
 * la lista de salas que quedan, como pide el apéndice (en el ejercicio sí se conoce).
 * `R1_AT` no se repite: ya está en "Lo que sabes" y la frase de alcance lo nombra. */
function stepText(drill: Drill, clues: Clue[], steps: readonly Step[], i: number, before: number[][][], listed: Set<string>): string {
  const step = steps[i];
  const after = (c: Sus, t: number): number => (i + 1 < before.length ? before[i + 1][c][t] : possAfterLast(before[i], step)[c][t]);
  const cell = step.concl.find((x) => x.k === 'notRoom' || x.k === 'isRoom');
  const unit = drill.ctx.unit === 'vagón' ? 'un vagón' : 'una sala';
  switch (step.rule) {
    case 'R1_AT':
      return '';
    case 'R1_FEAT': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'feat' }>;
      const f = drill.ctx.features[clue.f];
      listed.add(`${clue.c}:${clue.t}`);
      return `A las ${time(clue.t)}, ${who(drill, clue.c)} estaba en ${unit} ${clue.neg ? f.neg : f.txt}: solo puede ser ${roomsList(drill, after(clue.c, clue.t))}.`;
    }
    case 'R3_REACH_FWD':
    case 'R3_REACH_BWD': {
      if (!cell || (cell.k !== 'notRoom' && cell.k !== 'isRoom')) return '';
      const from = step.rule === 'R3_REACH_FWD' ? cell.t - 1 : cell.t + 1;
      listed.add(`${cell.c}:${cell.t}`);
      // Si la frase anterior ya dejó las salas de esa hora, no se repiten.
      if (listed.has(`${cell.c}:${from}`))
        return `Una hora ${from < cell.t ? 'después' : 'antes'}, a las ${time(cell.t)}, ${who(drill, cell.c)} solo pudo estar en ${roomsList(drill, after(cell.c, cell.t))}.`;
      return `A las ${time(from)}, ${who(drill, cell.c)} estaba en ${roomsList(drill, before[i][cell.c][from])}. En una hora solo se cruza una puerta, así que a las ${time(cell.t)} solo pudo estar en ${roomsList(drill, after(cell.c, cell.t))}.`;
    }
    case 'R4_TOGETHER': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'together' }>;
      if (step.concl.some((x) => x.k === 'notCulprit') || !cell || (cell.k !== 'notRoom' && cell.k !== 'isRoom')) break;
      const moved = cell.c;
      const other = moved === clue.a ? clue.b : clue.a;
      listed.add(`${moved}:${clue.t}`);
      return `${who(drill, clue.a)} y ${who(drill, clue.b)} estaban ${isFemale(drill.ctx.suspects[clue.a]) && isFemale(drill.ctx.suspects[clue.b]) ? 'juntas' : 'juntos'} a las ${time(clue.t)}; como ${who(drill, other)} solo pudo estar en ${roomsList(drill, before[i][other][clue.t])}, ${who(drill, moved)} también.`;
    }
    case 'R4_ADJ': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'adj' }>;
      if (!cell || (cell.k !== 'notRoom' && cell.k !== 'isRoom')) break;
      return `${who(drill, clue.a)} estaba en ${drill.ctx.unit === 'vagón' ? 'un vagón contiguo al' : 'una sala contigua a la'} de ${who(drill, clue.b)} a las ${time(clue.t)}: para ${who(drill, cell.c)} solo encaja ${roomsList(drill, after(cell.c, cell.t))}.`;
    }
  }
  const pseudo = { clues, rv: drill.rv ?? 0, td: drill.td ?? 0 } as unknown as CaseDef;
  return stepExplanation(step, i, steps as Step[], pseudo, drill.ctx)
    .replace(/ \(p\. \d+(, p\. \d+)*\)/g, '')
    .replace(/Por la pista \d+, /g, '');
}

function possAfterLast(before: number[][], step: Step): number[][] {
  const poss = before.map((row) => row.slice());
  for (const x of step.concl) {
    if (x.k === 'notRoom') poss[x.c][x.t] &= ~(1 << x.r);
    if (x.k === 'isRoom') poss[x.c][x.t] = 1 << x.r;
  }
  return poss;
}

/** La cadena de pasos como texto; null si queda demasiado larga o algún paso no tiene plantilla. */
function chainText(drill: Drill, clues: Clue[], steps: readonly Step[], chain: number[]): string | null {
  const before = possBefore(drill, steps);
  const listed = new Set<string>();
  const parts: string[] = [];
  for (const i of chain) {
    // "X estaba en S a las H" ya está en "Lo que sabes" y la frase de alcance lo repite.
    if (steps[i].rule === 'R1_AT') continue;
    parts.push(stepText(drill, clues, steps, i, before, listed));
  }
  if (parts.length > MAX_EXPLAIN_STEPS || parts.some((p) => !p)) return null;
  return parts.join(' ');
}

// ---------------- Construcción, mínimo y filtros ----------------

/** Respuesta por fuerza bruta; null si las pistas no admiten escenarios o el remate no tiene una sola pista decisiva. */
function solve(def: DrillDef): { drill: Drill; answer: Answer } | null {
  const drill = drillFromDef(def);
  try {
    const answer = computeAnswer(drill, scenariosFor);
    if (answer.type === 'decide' && answer.decide.length !== 1) return null;
    return { drill, answer };
  } catch {
    return null;
  }
}

/** Quita pistas de una en una mientras `ok` siga cumpliéndose: lo que queda hace falta. */
function minimize<T>(items: readonly T[], ok: (subset: T[]) => boolean): T[] {
  let kept = items.slice();
  for (const item of items) {
    const without = kept.filter((k) => k !== item);
    if (without.length > 0 && ok(without)) kept = without;
  }
  return kept;
}

const sameAnswer = (x: Answer, y: Answer): boolean => JSON.stringify(x) === JSON.stringify(y);

/** "Ningún ejercicio se responde sin mirar el plano ni las pistas": sin lo que se sabe, la respuesta tendría que cambiar. */
function needsClues(def: DrillDef, answer: Answer): boolean {
  const bare = solve({ ...def, given: [], facts: [] });
  return !bare || !sameAnswer(bare.answer, answer);
}

function finish(def: DrillDef, drill: Drill, answer: Answer, explain: string): DrillDef {
  return { ...def, answer, explain: compactMarkup(explain, drill.ctx), level: drillLevel(drill) };
}

/** Salas posibles de una persona a una hora, por fuerza bruta (máscara). */
function bruteRooms(def: DrillDef, c: Sus, t: number): number {
  const solved = solve({ ...def, type: 'reach', stmt: null, ask: { c, t, who: null, what: null } });
  return solved && solved.answer.type === 'reach' ? solved.answer.rooms.reduce((m, r) => m | (1 << r), 0) : 0;
}

/** Objetos posibles de una persona, o personas posibles para un objeto, por fuerza bruta (máscara). */
function bruteCarry(def: DrillDef, ask: { who: number | null; what: number | null }): number {
  const drill = drillFromDef(def);
  const sols = scenariosFor(drill, [...def.given, ...def.facts], []);
  let mask = 0;
  for (const s of sols) mask |= 1 << (ask.who !== null ? s.obj.indexOf(ask.who) : s.obj[ask.what as number]);
  return mask;
}

const popcount = (m: number): number => bitsOf(m, 31).length;

// ---------------- Contar puertas: reach ----------------

const REACH_RULES = new Set(['R3_REACH_FWD', 'R3_REACH_BWD', 'R1_FEAT']);

function primaryCell(step: Step): { c: Sus; t: number } | null {
  for (const x of step.concl) if (x.k === 'notRoom' || x.k === 'isRoom') return { c: x.c, t: x.t };
  return null;
}

/** Un mundo con las pistas `indices` del caso y las personas que nombran (más `extra`). */
function worldFor(a: CaseAnalysis, indices: readonly number[], extra: Sus[], hours: number[], crime: boolean): { w: World; given: Clue[] } | null {
  const raw = indices.map((i) => a.caseData.clues[i]);
  const w = makeWorld(a, [...extra, ...raw.flatMap((c) => clueRefs(a, c))], raw, hours, crime);
  const given = w && localClues(w, indices);
  return w && given ? { w, given } : null;
}

/** `askT`: preguntar por otra hora de la misma persona, con las mismas premisas (la cadena sigue). */
export function reachDrill(a: CaseAnalysis, index: number, askT?: number): DrillDef | null {
  const step = a.steps[index];
  const found = primaryCell(step);
  if (!REACH_RULES.has(step.rule) || !found) return null;
  const cell = { c: found.c, t: askT ?? found.t };
  const prem = premiseClues(a.steps, index);
  if (prem.crime || prem.clues.length === 0 || prem.clues.some((i) => isObjectClue(a.caseData.clues[i]))) return reject('reach:premisas');
  const build = (indices: readonly number[]): { def: DrillDef; drill: Drill; answer: Answer; c: Sus } | null => {
    const made = worldFor(a, indices, [cell.c], [cell.t], false);
    if (!made) return null;
    const c = made.w.persons.indexOf(cell.c);
    const def = baseDef(made.w, { id: `${a.caseData.id}-${index}-reach${askT ?? ''}`, tech: 'alcance', type: 'reach', given: made.given, ask: { c, t: cell.t, who: null, what: null }, src: `${a.caseData.id} paso ${index} (${step.rule})` });
    const solved = solve(def);
    return solved ? { def, c, ...solved } : null;
  };
  const full = build(prem.clues);
  if (!full) return null;
  const kept = minimize(prem.clues, (sub) => {
    const b = build(sub);
    return b !== null && sameAnswer(b.answer, full.answer);
  });
  if (kept.length > MAX_GIVEN) return null;
  // Si una pista ya dice dónde estaba a esa hora, no hay nada que contar.
  if (kept.some((i) => { const c = a.caseData.clues[i]; return c.k === 'at' && c.c === cell.c && c.t === cell.t; })) return null;
  const built = build(kept);
  if (!built || built.answer.type !== 'reach') return null;
  const { def, drill, answer, c } = built;
  const rooms = answer.rooms;
  // Ni todas las salas ni casi todas: el ejercicio tiene que descartar algo que se vea.
  if (rooms.length === 0 || rooms.length > Math.min(6, drill.plan.rooms.length - 2)) return reject('reach:demasiadas-salas');
  const run = humanRun(drill, def.given, false);
  if (run.poss[c][cell.t] !== rooms.reduce((m, r) => m | (1 << r), 0)) return null;
  const chain = chainText(drill, def.given, run.steps, chainTo(run.steps, (x) => (x.k === 'notRoom' || x.k === 'isRoom') && x.c === c && x.t === cell.t));
  if (chain === null) return null;
  const units = drill.ctx.unit === 'vagón' ? 'los vagones' : 'las salas';
  def.prompt = `¿Dónde pudo estar ${name(drill, c)} a las ${timeLabel(cell.t)}? Toca ${drill.ctx.unit === 'vagón' ? 'todos los vagones posibles' : 'todas las salas posibles'}.`;
  const close = rooms.length === 1 ? `Solo tienes que marcar ${room(drill, rooms[0])}.` : `${drill.ctx.unit === 'vagón' ? 'Esos' : 'Esas'} son ${units} que tienes que marcar.`;
  return finish(def, drill, answer, `${chain} ${close}`.trim());
}

// ---------------- Seguro o solo posible: tri ----------------

const TRI_RULES = new Set(['R4_TOGETHER', 'R4_OBJ_WHERE', 'R4_OBJ_WITH', 'R4_ADJ', 'R4_APART', 'R4_VISITED', 'R4_COUNT_FULL', 'R4_COUNT_NEED', 'R3_STILL', 'R3_MOVED']);
export type TriFlavour = 'V' | 'F' | 'NS';

/** Lo que el solver humano sabe de un enunciado: V, F o NS. */
function humanTri(run: HumanPropagation, s: Statement): TriFlavour {
  switch (s.k) {
    case 'at':
      return run.poss[s.c][s.t] === 1 << s.r ? 'V' : run.poss[s.c][s.t] & (1 << s.r) ? 'NS' : 'F';
    case 'notat':
      return run.poss[s.c][s.t] & (1 << s.r) ? (run.poss[s.c][s.t] === 1 << s.r ? 'F' : 'NS') : 'V';
    case 'carry':
      return run.carry[s.c] === 1 << s.o ? 'V' : run.carry[s.c] & (1 << s.o) ? 'NS' : 'F';
    case 'ncarry':
      return run.carry[s.c] & (1 << s.o) ? (run.carry[s.c] === 1 << s.o ? 'F' : 'NS') : 'V';
    default:
      return 'NS';
  }
}

/** Enunciado del caso (personas y objetos del caso) que se convierte en `tri`. */
type CaseStatement = { k: 'at' | 'notat'; c: Sus; t: number; r: Room } | { k: 'carry' | 'ncarry'; c: Sus; t?: undefined; o: number };

/** Enunciados candidatos a partir de lo que concluye el paso. Para "no se sabe", sobre la
 * misma persona y hora (o la misma persona y la tabla), primero lo que de verdad pasó. */
function triStatements(a: CaseAnalysis, step: Step, flavour: TriFlavour): CaseStatement[] {
  const out: CaseStatement[] = [];
  const truth = a.caseData.truth;
  for (const x of step.concl) {
    if (x.k === 'isRoom' || x.k === 'notRoom') {
      const positive = x.k === 'isRoom';
      if (flavour === 'V') out.push({ k: positive ? 'at' : 'notat', c: x.c, t: x.t, r: x.r });
      if (flavour === 'F') out.push({ k: positive ? 'notat' : 'at', c: x.c, t: x.t, r: x.r });
      if (flavour === 'NS') {
        out.push({ k: 'at', c: x.c, t: x.t, r: truth.rooms[x.c][x.t] });
        for (let r = 0; r < a.map.rooms.length; r++) if (r !== truth.rooms[x.c][x.t]) out.push({ k: 'at', c: x.c, t: x.t, r });
      }
    }
    if (x.k === 'carry' || x.k === 'notCarry') {
      const positive = x.k === 'carry';
      if (flavour === 'V') out.push({ k: positive ? 'carry' : 'ncarry', c: x.c, o: x.o });
      if (flavour === 'F') out.push({ k: positive ? 'ncarry' : 'carry', c: x.c, o: x.o });
      if (flavour === 'NS') {
        out.push({ k: 'carry', c: x.c, o: truth.obj[x.c] });
        for (let o = 0; o < a.caseData.N; o++) if (o !== truth.obj[x.c]) out.push({ k: 'carry', c: x.c, o });
      }
    }
  }
  return out;
}

function localStatement(w: World, s: CaseStatement): Statement | null {
  const c = w.persons.indexOf(s.c);
  if (c < 0) return null;
  if ('r' in s) return s.t < w.T ? { k: s.k, c, t: s.t, r: s.r } : null;
  const o = w.objects.indexOf(s.o);
  return o < 0 ? null : s.k === 'carry' ? { k: 'carry', c, o } : { k: 'ncarry', c, o };
}

/** Lo que el enunciado deja abierto, por fuerza bruta: salas posibles o objetos posibles. */
function openSet(def: DrillDef, s: Statement): number {
  if (s.k === 'at' || s.k === 'notat') return bruteRooms(def, s.c, s.t);
  if (s.k === 'carry' || s.k === 'ncarry') return bruteCarry(def, { who: null, what: s.c });
  return 0;
}

export function triDrill(a: CaseAnalysis, index: number, flavour: TriFlavour): DrillDef | null {
  const step = a.steps[index];
  if (!TRI_RULES.has(step.rule)) return null;
  const prem = premiseClues(a.steps, index);
  if (prem.crime || prem.clues.length === 0) return reject('tri:premisas');
  // "No se sabe" admite muchos enunciados; con los primeros (lo que pasó de verdad va primero) basta.
  for (const cs of triStatements(a, step, flavour).slice(0, flavour === 'NS' ? 4 : undefined)) {
    const usesObjects = cs.k === 'carry' || cs.k === 'ncarry';
    const build = (indices: readonly number[]): { def: DrillDef; drill: Drill; answer: Answer; stmt: Statement } | null => {
      // Con objetos, el mundo los necesita aunque las pistas no los nombren.
      const raw = indices.map((i) => a.caseData.clues[i]);
      if (usesObjects && !raw.some(isObjectClue)) return null;
      const made = worldFor(a, indices, [cs.c], 'r' in cs ? [cs.t] : [], false);
      const stmt = made && localStatement(made.w, cs);
      if (!made || !stmt) return null;
      const def = baseDef(made.w, { id: `${a.caseData.id}-${index}-tri${flavour}`, tech: 'seguro', type: 'tri', given: made.given, stmt, src: `${a.caseData.id} paso ${index} (${step.rule})` });
      const solved = solve(def);
      return solved && solved.answer.type === 'tri' && solved.answer.value === flavour ? { def, stmt, ...solved } : null;
    };
    const full = build(prem.clues);
    if (!full) {
      reject('tri:sin-mundo');
      continue;
    }
    // Para "no se sabe" se conserva lo que las pistas dejan abierto: si no, bastaría con borrarlas todas.
    const open = flavour === 'NS' ? openSet(full.def, full.stmt) : 0;
    const kept = minimize(prem.clues, (sub) => {
      const b = build(sub);
      return b !== null && (flavour !== 'NS' || openSet(b.def, b.stmt) === open);
    });
    if (kept.length > MAX_GIVEN) {
      reject('tri:muchas-pistas');
      continue;
    }
    const built = build(kept);
    if (!built) continue;
    const { def, drill, answer, stmt } = built;
    if (def.given.some((g) => sameClue(g, stmt))) {
      reject('tri:igual-a-pista');
      continue;
    }
    if (flavour !== 'NS' && !needsClues(def, answer)) {
      reject('tri:sin-pistas-igual');
      continue;
    }
    // Un "no se sabe" interesante deja pocas opciones abiertas, no todas.
    const total = stmt.k === 'at' || stmt.k === 'notat' ? drill.plan.rooms.length : drill.nObjs;
    if (flavour === 'NS' && (popcount(open) < 2 || popcount(open) > Math.min(3, total - 1))) {
      reject('tri:ns-abierto');
      continue;
    }
    const run = humanRun(drill, def.given, false);
    if (humanTri(run, stmt) !== flavour) {
      reject('tri:humano');
      continue;
    }
    let explain: string;
    if (flavour === 'NS') {
      if (stmt.k === 'at' || stmt.k === 'notat') {
        if (run.poss[stmt.c][stmt.t] !== open) {
      reject('tri:ns-humano');
      continue;
    }
        const chain = chainText(drill, def.given, run.steps, chainTo(run.steps, (x) => (x.k === 'notRoom' || x.k === 'isRoom') && x.c === stmt.c && x.t === stmt.t));
        if (chain === null) {
      reject('tri:ns-cadena');
      continue;
    }
        explain = `${chain} Con lo que sabes, ${who(drill, stmt.c)} pudo estar en ${roomsList(drill, open)}: es posible, pero no lo puedes demostrar.`;
      } else {
        if (stmt.k !== 'carry' && stmt.k !== 'ncarry') continue;
        if (run.carry[stmt.c] !== open) {
      reject('tri:ns-humano');
      continue;
    }
        const chain = chainText(drill, def.given, run.steps, chainTo(run.steps, (x) => (x.k === 'notCarry' || x.k === 'carry') && x.c === stmt.c));
        if (chain === null) {
      reject('tri:ns-cadena');
      continue;
    }
        explain = `${chain} Con lo que sabes, ${who(drill, stmt.c)} pudo llevar ${listOr(bitsOf(open, drill.nObjs).map((o) => objName(drill, o)))}: es posible, pero no lo puedes demostrar.`;
      }
    } else {
      const target = (x: Conclusion): boolean =>
        stmt.k === 'at' || stmt.k === 'notat'
          ? (x.k === 'isRoom' && x.c === stmt.c && x.t === stmt.t) || (x.k === 'notRoom' && x.c === stmt.c && x.t === stmt.t && x.r === stmt.r)
          : stmt.k === 'carry' || stmt.k === 'ncarry'
            ? (x.k === 'carry' && x.c === stmt.c) || (x.k === 'notCarry' && x.c === stmt.c && x.o === stmt.o)
            : false;
      const chain = chainText(drill, def.given, run.steps, chainTo(run.steps, target));
      if (!chain) {
      reject('tri:cadena');
      continue;
    }
      explain = `${chain} ${flavour === 'V' ? 'Lo puedes demostrar: es verdadero.' : 'Puedes descartarlo: es falso.'}`;
    }
    return finish(def, drill, answer, explain.trim());
  }
  return null;
}

// ---------------- La tabla de objetos: pick ----------------

const PICK_RULES = new Set(['R5_OBJ_SINGLE', 'R5_SUS_SINGLE', 'R4_OBJ_WHERE', 'R4_OBJ_WITH', 'R1_NCARRY']);
export type PickMode = 'who' | 'what' | 'NS';

export function pickDrill(a: CaseAnalysis, index: number, mode: PickMode): DrillDef | null {
  const step = a.steps[index];
  if (!PICK_RULES.has(step.rule)) return null;
  const prem = premiseClues(a.steps, index);
  if (prem.crime || prem.clues.length === 0 || !prem.clues.some((i) => isObjectClue(a.caseData.clues[i]))) return reject('pick:premisas');
  const truth = a.caseData.truth;
  const named = [...new Set(step.concl.flatMap((x) => (x.k === 'carry' || x.k === 'notCarry' ? [x.c, truth.obj.indexOf(x.o)] : [])))];
  // Preguntas a nivel de caso: por el objeto de alguien o por lo que llevaba alguien.
  const asks: { who: number | null; what: Sus | null }[] = named.flatMap((c) => [
    ...(mode !== 'what' ? [{ who: truth.obj[c], what: null }] : []),
    ...(mode !== 'who' ? [{ who: null, what: c }] : []),
  ]);
  for (const q of asks) {
    const build = (indices: readonly number[]): { def: DrillDef; drill: Drill; answer: Answer } | null => {
      const raw = indices.map((i) => a.caseData.clues[i]);
      if (!raw.some(isObjectClue)) return null;
      const made = worldFor(a, indices, named, [], false);
      if (!made || made.w.persons.length < 2) return null;
      const ask: Drill['ask'] = {
        c: null,
        t: null,
        who: q.who !== null ? made.w.objects.indexOf(q.who) : null,
        what: q.what !== null ? made.w.persons.indexOf(q.what) : null,
      };
      if ((ask.who ?? ask.what ?? -1) < 0) return null;
      const def = baseDef(made.w, { id: `${a.caseData.id}-${index}-pick${mode}`, tech: 'tabla', type: 'pick', given: made.given, ask, src: `${a.caseData.id} paso ${index} (${step.rule})` });
      const solved = solve(def);
      if (!solved || solved.answer.type !== 'pick' || (mode === 'NS') !== (solved.answer.value === 'NS')) return null;
      return { def, ...solved };
    };
    const full = build(prem.clues);
    if (!full) {
      reject('pick:sin-mundo');
      continue;
    }
    const askOf = (d: DrillDef): { who: number | null; what: number | null } => ({ who: d.ask?.who ?? null, what: d.ask?.what ?? null });
    const open = mode === 'NS' ? bruteCarry(full.def, askOf(full.def)) : 0;
    const kept = minimize(prem.clues, (sub) => {
      const b = build(sub);
      return b !== null && sameAnswer(b.answer, full.answer) && (mode !== 'NS' || bruteCarry(b.def, askOf(b.def)) === open);
    });
    if (kept.length > MAX_GIVEN) {
      reject('pick:muchas-pistas');
      continue;
    }
    const built = build(kept);
    if (!built || built.answer.type !== 'pick') {
      reject('pick:sin-mundo-min');
      continue;
    }
    const { def, drill, answer } = built;
    if (mode !== 'NS' && !needsClues(def, answer)) {
      reject('pick:sin-pistas-igual');
      continue;
    }
    if (mode === 'NS' && (popcount(open) < 2 || popcount(open) >= drill.N)) {
      reject('pick:ns-abierto');
      continue;
    }
    const whoAsk = def.ask?.who ?? null;
    const whatAsk = def.ask?.what ?? null;
    const run = humanRun(drill, def.given, false);
    const carriers = whoAsk !== null ? [...Array(drill.N).keys()].filter((c) => run.carry[c] & (1 << whoAsk)) : [];
    const objects = whatAsk !== null ? bitsOf(run.carry[whatAsk], drill.nObjs) : [];
    const human = whoAsk !== null ? (carriers.length === 1 ? carriers[0] : 'NS') : objects.length === 1 ? objects[0] : 'NS';
    if (human !== answer.value) {
      reject('pick:humano');
      continue;
    }
    // En un "no se sabe", el solver humano tiene que dejar abierto lo mismo que la fuerza bruta.
    if (answer.value === 'NS' && (whoAsk !== null ? carriers : objects).reduce((m, x) => m | (1 << x), 0) !== open) {
      reject('pick:ns-humano');
      continue;
    }
    let explain: string;
    if (answer.value === 'NS') {
      const chain = chainText(drill, def.given, run.steps, chainTo(run.steps, (x) => x.k === 'notCarry' && (whoAsk !== null ? x.o === whoAsk : x.c === whatAsk)));
      if (chain === null) {
      reject('pick:cadena');
      continue;
    }
      const close =
        whoAsk !== null
          ? `Con lo que sabes, ${objName(drill, whoAsk)} ${lo(drill, whoAsk)} pudo llevar ${listOr(carriers.map((c) => who(drill, c)))}: no lo puedes saber.`
          : `Con lo que sabes, ${who(drill, whatAsk as number)} pudo llevar ${listOr(objects.map((o) => objName(drill, o)))}: no lo puedes saber.`;
      explain = `${chain} ${close}`;
    } else {
      const c = whoAsk !== null ? (answer.value as number) : (whatAsk as number);
      const o = whoAsk !== null ? whoAsk : (answer.value as number);
      const chain = chainText(drill, def.given, run.steps, chainTo(run.steps, (x) => (x.k === 'carry' && x.c === c) || (x.k === 'notCarry' && (x.o === o || x.c === c))));
      if (!chain) {
      reject('pick:cadena');
      continue;
    }
      explain = `${chain} ${whoAsk !== null ? `Así que ${objName(drill, o)} ${lo(drill, o)} llevaba ${who(drill, c)}.` : `Así que ${who(drill, c)} llevaba ${objName(drill, o)}.`}`;
    }
    return finish(def, drill, answer, explain.trim());
  }
  return null;
}

// ---------------- Remates con dos: clue y contra ----------------

/** Quién pudo estar a solas con la víctima según la fuerza bruta (índices del mundo). */
function enumerateCulprits(drill: Drill, clues: Clue[], td: number, rv: number): number[] {
  const sols = scenariosFor(drill, clues, []);
  return [...new Set(sols.map((s) => s.rooms.findIndex((p) => p[td] === rv)))].sort((x, y) => x - y);
}

function mentions(clue: Clue, c: number): boolean {
  return 'c' in clue ? clue.c === c : 'a' in clue ? clue.a === c || clue.b === c : false;
}

/** Pistas del caso que pueden servir de distracción en el mundo: ciertas, sin repetir. */
function distractorPool(w: World, exclude: readonly Clue[]): Clue[] {
  const out: Clue[] = [];
  for (const clue of w.a.caseData.clues) {
    const local = localClue(w, clue);
    if (!local || (w.objects.length === 0 && isObjectClue(local)) || exclude.some((e) => sameClue(e, local)) || out.some((e) => sameClue(e, local))) continue;
    out.push(local);
  }
  return out;
}

function rotate<T>(items: T[], k: number): T[] {
  if (items.length === 0) return items;
  const s = k % items.length;
  return [...items.slice(s), ...items.slice(0, s)];
}

/** Primer paso que descarta a cada sospechoso (índice en `steps`), o -1. */
function eliminationSteps(a: CaseAnalysis): number[] {
  return [...Array(a.caseData.N).keys()].map((c) => a.steps.findIndex((st) => st.concl.some((x) => x.k === 'notCulprit' && x.c === c)));
}

/**
 * "Quedan dos": el culpable y un sospechoso que el caso descarta en el paso `index`.
 * El mundo trae lo que descarta a ese sospechoso y, si nombra a alguien más, también lo
 * que descarta a esa persona (sus pistas aparecen tachadas, ya usadas).
 */
export function clueDrill(a: CaseAnalysis, index: number, variant: number): DrillDef | null {
  const step = a.steps[index];
  const culprit = a.caseData.culprit;
  const outs = step.concl.flatMap((x) => (x.k === 'notCulprit' && x.c !== culprit ? [x.c] : []));
  if (outs.length === 0) return null;
  const other = outs[variant % outs.length];
  const elim = eliminationSteps(a);
  const indices = new Set(premiseClues(a.steps, index, true).clues);
  const persons = new Set<Sus>([culprit, other]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const i of [...indices]) for (const c of clueRefs(a, a.caseData.clues[i])) if (!persons.has(c)) persons.add(c);
    if (persons.size > MAX_PERSONS) return reject('clue:muchas-personas');
    for (const c of persons) {
      if (c === culprit || c === other || elim[c] < 0) continue;
      for (const i of premiseClues(a.steps, elim[c], true).clues) {
        if (!indices.has(i)) {
          indices.add(i);
          changed = true;
        }
      }
    }
  }
  const prem = { clues: [...indices].sort((x, y) => x - y) };
  const raw = prem.clues.map((i) => a.caseData.clues[i]);
  const w = makeWorld(a, persons, raw, [], true);
  const all = w && localClues(w, prem.clues);
  if (!w || !all) return reject('clue:mundo');
  const A = w.persons.indexOf(culprit);
  const B = w.persons.indexOf(other);
  const def = baseDef(w, { id: `${a.caseData.id}-${index}-clue${variant}`, tech: 'remate', type: 'clue', given: [], src: `${a.caseData.id} paso ${index} (${step.rule})` });
  const unique = (cl: Clue[]): boolean => {
    const c = enumerateCulprits(drillFromDef(def), cl, def.td as number, def.rv as number);
    return c.length === 1 && c[0] === A;
  };
  if (!unique(all)) return reject('clue:no-unico');
  // Lo mínimo que sigue dejando un solo culpable.
  let kept = all.slice();
  for (const clue of all) {
    const without = kept.filter((k) => k !== clue);
    if (unique(without)) kept = without;
  }
  // Las que deciden entre los dos y las que descartan a los demás (ya usadas).
  const between: Clue[] = [];
  const used: Clue[] = [];
  for (const clue of kept) {
    const c = enumerateCulprits(drillFromDef(def), kept.filter((k) => k !== clue), def.td as number, def.rv as number);
    if (c.length === 2 && c.includes(A) && c.includes(B)) between.push(clue);
    else if (!c.includes(B)) used.push(clue);
    else return reject('clue:mixta');
  }
  if (between.length === 0) return reject('clue:sin-decisiva');
  const decisive = [...between].sort((x, y) => Number(mentions(y, B)) - Number(mentions(x, B)))[variant % between.length];
  const given = between.filter((c) => c !== decisive);
  if (given.length > MAX_GIVEN_REMATE) return reject('clue:muchas');
  const pool = distractorPool(w, kept).sort((x, y) => Number(mentions(y, A) || mentions(y, B)) - Number(mentions(x, A) || mentions(x, B)));
  for (let k = 0; k + 1 < Math.max(2, pool.length); k++) {
    const distract = pool.slice(k, k + 2);
    if (distract.length < 1) return null;
    const options = rotate([decisive, ...distract], index + variant);
    const candidate: DrillDef = {
      ...def,
      given,
      clues: [...used, ...options],
      used: [...used.map(() => true), ...options.map(() => false)],
      decide: { culprit: true, what: null },
    };
    const solved = solve(candidate);
    if (!solved || solved.answer.type !== 'decide' || solved.answer.answer !== A) {
      reject('clue:respuesta');
      continue;
    }
    const { drill, answer } = solved;
    const n = answer.decide[0] + 1;
    const run = humanRun(drill, [...drill.clues, ...given], true);
    if (bitsOf(run.cand, drill.N).join() !== String(A)) {
      reject('clue:humano');
      continue;
    }
    const chain = chainText(drill, [...drill.clues, ...given], run.steps, chainTo(run.steps, (x) => x.k === 'notCulprit' && x.c === B));
    if (chain === null) {
      reject('clue:cadena');
      continue;
    }
    const victimRoom = roomName(drill, drill.rv as number);
    const usedNames = w.persons.map((_, i) => i).filter((i) => i !== A && i !== B).map((i) => name(drill, i));
    candidate.prompt = `¿Qué pista decide entre ${name(drill, A)} y ${name(drill, B)}?`;
    candidate.context = `La víctima apareció en ${victimRoom} a las ${timeLabel(drill.td as number)}.${usedNames.length ? ` Las pistas tachadas ya descartaron a ${listAnd(usedNames)}.` : ''} Quedan ${name(drill, A)} y ${name(drill, B)}.`;
    return finish(candidate, drill, answer, `${chain} La pista decisiva es la ${n}: descarta a ${who(drill, B)}, así que ${culpritNoun(drill.ctx.suspects[A])} es ${who(drill, A)}.`.trim());
  }
  return null;
}

export function contraDrill(a: CaseAnalysis, index: number, variant: number): DrillDef | null {
  const step = a.steps[index];
  const culprit = a.caseData.culprit;
  const out = step.concl.find((x) => x.k === 'notCulprit' && x.c !== culprit);
  if (!out || out.k !== 'notCulprit') return null;
  const suspect = out.c;
  const prem = premiseClues(a.steps, index, true);
  const raw = prem.clues.map((i) => a.caseData.clues[i]);
  const w = makeWorld(a, [culprit, suspect, ...raw.flatMap((c) => clueRefs(a, c))], raw, [], true);
  const all = w && localClues(w, prem.clues);
  if (!w || !all) return reject('contra:mundo');
  const B = w.persons.indexOf(suspect);
  const def = baseDef(w, { id: `${a.caseData.id}-${index}-contra`, tech: 'remate', type: 'contra', given: [], hyp: B, src: `${a.caseData.id} paso ${index} (${step.rule})` });
  const hyp: Clue = { k: 'at', c: B, t: a.caseData.td, r: a.caseData.rv };
  const broken = (cl: Clue[]): boolean => scenariosFor(drillFromDef(def), [...cl, hyp], []).length === 0;
  if (!broken(all)) return reject('contra:no-rompe');
  let kept = all.slice();
  for (const clue of all) {
    const without = kept.filter((k) => k !== clue);
    if (broken(without)) kept = without;
  }
  const decisive = [...kept].sort((x, y) => Number(mentions(y, B)) - Number(mentions(x, B)))[variant % kept.length];
  const given = kept.filter((c) => c !== decisive);
  if (given.length > MAX_GIVEN_REMATE) return reject('contra:muchas');
  const pool = distractorPool(w, kept).sort((x, y) => Number(mentions(y, B)) - Number(mentions(x, B)));
  for (let k = 0; k + 1 < Math.max(2, pool.length); k++) {
    const distract = pool.slice(k, k + 2);
    if (distract.length < 1) return null;
    const options = rotate([decisive, ...distract], index + variant);
    const candidate: DrillDef = { ...def, given, clues: options, used: options.map(() => false) };
    const solved = solve(candidate);
    if (!solved || solved.answer.type !== 'decide') {
      reject('contra:respuesta');
      continue;
    }
    const { drill, answer } = solved;
    const n = answer.decide[0] + 1;
    // El solver humano, con todas las pistas, tiene que descartar a esa persona.
    const run = humanRun(drill, [...drill.clues, ...given], true);
    if (run.cand & (1 << B)) {
      reject('contra:humano');
      continue;
    }
    const chain = chainText(drill, [...drill.clues, ...given], run.steps, chainTo(run.steps, (x) => x.k === 'notCulprit' && x.c === B));
    if (chain === null) {
      reject('contra:cadena');
      continue;
    }
    const victimRoom = roomName(drill, drill.rv as number);
    candidate.prompt = `Si ${name(drill, B)} hubiera estado a solas con la víctima, ¿qué pista se rompe?`;
    candidate.context = `La víctima apareció en ${victimRoom} a las ${timeLabel(drill.td as number)}. Prueba una hipótesis: supón que fue ${name(drill, B)}.`;
    return finish(candidate, drill, answer, `${chain} Si supones que fue ${who(drill, B)}, la pista ${n} no se cumple: la hipótesis se rompe y no pudo ser ${who(drill, B)}.`.trim());
  }
  return null;
}

// ---------------- Todo lo de un caso ----------------

export interface Candidate {
  def: DrillDef;
  map: string;
  caseId: string;
}

/** Todos los ejercicios que salen de los pasos críticos de un caso. */
export function drillsFromCase(a: CaseAnalysis): Candidate[] {
  const out: DrillDef[] = [];
  a.steps.forEach((step, i) => {
    if (!step.crit) return;
    const push = (make: () => DrillDef | null): void => {
      let d: DrillDef | null;
      try {
        d = make();
      } catch (e) {
        if (!(e instanceof BudgetExceeded)) throw e;
        d = reject('presupuesto');
      }
      if (d && !out.some((o) => o.id === d.id)) out.push(d);
    };
    push(() => reachDrill(a, i));
    for (let t = 0; t < a.caseData.T; t++) push(() => reachDrill(a, i, t));
    for (const f of ['V', 'F', 'NS'] as const) push(() => triDrill(a, i, f));
    for (const m of ['who', 'what', 'NS'] as const) push(() => pickDrill(a, i, m));
    push(() => clueDrill(a, i, 0));
    push(() => clueDrill(a, i, 1));
    push(() => contraDrill(a, i, 0));
  });
  return out.filter((d) => drillErrors(d.answer, computeAnswer(drillFromDef(d))).length === 0).map((def) => ({ def, map: a.caseData.map, caseId: a.caseData.id }));
}

/** Texto plano de un ejercicio, para revisarlo a mano (scripts/build-drills.ts). */
export function describeDrill(def: DrillDef): string {
  return plainText(drillFromDef(def).explain);
}
