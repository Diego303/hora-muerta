// Verificación por fuerza bruta de los ejercicios (docs/MODOS.md 3.8): se enumeran
// TODOS los escenarios del ejercicio (recorrido de cada persona por el plano, una
// puerta por hora, y reparto de objetos) y la respuesta es la que dejan las pistas.
// Puro y sin DOM. Los ejercicios son pequeños a propósito (hasta 4 personas, 3 horas,
// 9 salas), así que enumerar es viable; para ir rápido, las pistas que no dependen
// de los objetos se comprueban antes de probar repartos de objetos.
import { holds } from '../../engine/clues';
import { buildGraph } from '../../engine/graph';
import type { Clue, Graph, Room, Sus, Truth } from '../../engine/types';
import type { Answer, Drill, Statement, Tri } from './types';

const OBJECT_KINDS = new Set(['cat', 'cfeat', 'ncarry', 'cwith', 'carry']);

function usesObjects(s: Statement): boolean {
  return OBJECT_KINDS.has(s.k);
}

export function statementHolds(s: Statement, truth: Truth, graph: Graph): boolean {
  if (s.k === 'carry') return truth.obj[s.c] === s.o;
  return holds(s, truth, graph);
}

function paths(graph: Graph, rooms: number, T: number): Room[][] {
  const out: Room[][] = [];
  const grow = (path: Room[]): void => {
    if (path.length === T) {
      out.push(path.slice());
      return;
    }
    const last = path[path.length - 1];
    for (const next of [last, ...graph.adj[last]]) {
      path.push(next);
      grow(path);
      path.pop();
    }
  };
  for (let r = 0; r < rooms; r++) grow([r]);
  return out;
}

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  const go = (prefix: number[], rest: number[]): void => {
    if (rest.length === 0) {
      out.push(prefix);
      return;
    }
    rest.forEach((x, i) => go([...prefix, x], rest.filter((_, j) => j !== i)));
  };
  go([], [...Array(n).keys()]);
  return out;
}

/** Enumerador: todos los escenarios que cumplen `statements` o, para las personas que no
 * influyen en la pregunta, un representante de cada clase (ver `scenarios`). */
export type Enumerator = (drill: Drill, statements: readonly Statement[], relevant: readonly Sus[]) => Truth[];

/** Se lanza cuando una enumeración pasa de su presupuesto de pasos (ver `scenarios`). */
export class BudgetExceeded extends Error {}

/**
 * Fuerza bruta literal: recorre TODOS los escenarios sin ninguna poda. Solo es viable en
 * ejercicios muy pequeños; las pruebas la usan como segunda opinión de `scenarios`.
 */
export const scenariosLiteral: Enumerator = (drill, statements) => {
  if (drill.nObjs !== 0 && drill.nObjs !== drill.N) throw new Error(`${drill.id}: ${drill.nObjs} objetos para ${drill.N} personas`);
  const graph = buildGraph(drill.plan);
  const allPaths = paths(graph, drill.plan.rooms.length, drill.T);
  const perms = drill.nObjs === 0 ? [[...Array(drill.N).keys()]] : permutations(drill.nObjs);
  const roomOnly = statements.filter((s) => !usesObjects(s));
  const withObjects = statements.filter(usesObjects);
  const found: Truth[] = [];
  const rooms: Room[][] = new Array<Room[]>(drill.N);

  const assign = (k: number): void => {
    if (k === drill.N) {
      if (drill.rv !== null && drill.td !== null) {
        const td = drill.td;
        const rv = drill.rv;
        if (rooms.filter((p) => p[td] === rv).length !== 1) return;
      }
      const placed: Truth = { rooms: rooms.slice(), obj: perms[0] };
      if (!roomOnly.every((s) => statementHolds(s, placed, graph))) return;
      for (const obj of perms) {
        const truth: Truth = { rooms: rooms.slice(), obj };
        if (withObjects.every((s) => statementHolds(s, truth, graph))) found.push(truth);
      }
      return;
    }
    for (const p of allPaths) {
      rooms[k] = p;
      assign(k + 1);
    }
  };
  assign(0);
  return found;
};

/** Personas de las que depende un enunciado con este reparto de objetos; null: todas. */
function personRefs(s: Statement, obj: readonly number[]): Sus[] | null {
  switch (s.k) {
    case 'count':
      return null;
    case 'together':
    case 'apart':
    case 'adj':
      return [s.a, s.b];
    case 'cat':
    case 'cfeat':
      return [obj.indexOf(s.o)];
    case 'cwith':
      return [obj.indexOf(s.o), s.c];
    case 'ncarry':
    case 'carry':
      return [];
    default:
      return [s.c];
  }
}

/**
 * Enumeración exhaustiva con poda, equivalente a la literal para lo que se pregunta:
 * - Con cada reparto de objetos, primero se comprueban las pistas que solo miran objetos.
 * - Los recorridos de cada persona se filtran antes con las pistas que solo hablan de ella.
 * - Cada pista que relaciona a varias se comprueba en cuanto están todas asignadas.
 * - Los recuentos ("exactamente N en S a las H") y la regla del crimen ("una sola
 *   persona con la víctima") se llevan como contadores: se poda en cuanto se pasan o ya
 *   no pueden llegar.
 * - De una persona que no aparece en ninguna pista que la relacione con otras ni en la
 *   pregunta (`relevant`) basta un recorrido por cada forma distinta de contar en esos
 *   contadores: el resto no cambia la respuesta.
 * Así, las salas de las personas de `relevant`, el reparto de objetos y quién estaba con
 * la víctima salen exactamente igual que enumerando todo.
 */
export function scenarios(drill: Drill, statements: readonly Statement[], relevant: readonly Sus[], budget = Number.POSITIVE_INFINITY): Truth[] {
  let work = 0;
  if (drill.nObjs !== 0 && drill.nObjs !== drill.N) throw new Error(`${drill.id}: ${drill.nObjs} objetos para ${drill.N} personas`);
  const N = drill.N;
  const graph = buildGraph(drill.plan);
  const allPaths = paths(graph, drill.plan.rooms.length, drill.T);
  const perms = drill.nObjs === 0 ? [[...Array(N).keys()]] : permutations(drill.nObjs);
  const counters: { r: Room; t: number; n: number }[] = statements.flatMap((s) => (s.k === 'count' ? [{ r: s.r, t: s.t, n: s.n }] : []));
  if (drill.rv !== null && drill.td !== null) counters.push({ r: drill.rv, t: drill.td, n: 1 });
  const inCounter = (p: Room[], j: number): number => (p[counters[j].t] === counters[j].r ? 1 : 0);
  const found: Truth[] = [];

  for (const obj of perms) {
    const objOnly: Statement[] = [];
    const unary: Statement[][] = Array.from({ length: N }, () => []);
    const checkAt: Statement[][] = Array.from({ length: N }, () => []);
    const linked = new Set<Sus>(relevant);
    for (const s of statements) {
      if (s.k === 'count') continue;
      const distinct = [...new Set(personRefs(s, obj) ?? [])];
      if (distinct.length === 0) objOnly.push(s);
      else if (distinct.length === 1) unary[distinct[0]].push(s);
      else {
        checkAt[Math.max(...distinct)].push(s);
        for (const c of distinct) linked.add(c);
      }
    }
    const probe: Truth = { rooms: new Array<Room[]>(N), obj };
    if (!objOnly.every((s) => statementHolds(s, probe, graph))) continue;

    const options: Room[][][] = [];
    for (let c = 0; c < N; c++) {
      let mine = allPaths.filter((p) => {
        probe.rooms[c] = p;
        return unary[c].every((s) => statementHolds(s, probe, graph));
      });
      if (!linked.has(c)) {
        const bySignature = new Map<string, Room[]>();
        for (const p of mine) {
          const sig = counters.map((_, j) => inCounter(p, j)).join('');
          if (!bySignature.has(sig)) bySignature.set(sig, p);
        }
        mine = [...bySignature.values()];
      }
      options.push(mine);
    }
    if (options.some((o) => o.length === 0)) continue;

    const rooms: Room[][] = new Array<Room[]>(N);
    const truth: Truth = { rooms, obj };
    const counts = counters.map(() => 0);
    const assign = (k: number): void => {
      if (k === N) {
        if (counters.every((c, j) => counts[j] === c.n)) found.push({ rooms: rooms.slice(), obj });
        return;
      }
      for (const p of options[k]) {
        if (++work > budget) throw new BudgetExceeded(`${drill.id}: más de ${budget} pasos`);
        let fits = true;
        for (let j = 0; j < counters.length; j++) {
          const now = counts[j] + inCounter(p, j);
          // Ni pasarse ni quedarse corto con las personas que faltan.
          if (now > counters[j].n || now + (N - k - 1) < counters[j].n) fits = false;
        }
        if (!fits) continue;
        rooms[k] = p;
        if (!checkAt[k].every((s) => statementHolds(s, truth, graph))) continue;
        for (let j = 0; j < counters.length; j++) counts[j] += inCounter(p, j);
        assign(k + 1);
        for (let j = 0; j < counters.length; j++) counts[j] -= inCounter(p, j);
      }
    };
    assign(0);
  }
  return found;
}

/** Personas cuyo recorrido decide un enunciado: las suyas, o todas si depende de quién
 * lleve un objeto o de un recuento. */
function stmtPersons(s: Statement, N: number): Sus[] {
  switch (s.k) {
    case 'carry':
    case 'ncarry':
      return [];
    case 'together':
    case 'apart':
    case 'adj':
      return [s.a, s.b];
    case 'count':
    case 'cat':
    case 'cfeat':
    case 'cwith':
      return [...Array(N).keys()];
    default:
      return [s.c];
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)].sort((a, b) => Number(a) - Number(b));
}

/** Respuesta correcta de un ejercicio, calculada desde cero. */
export function computeAnswer(drill: Drill, enumerate: Enumerator = scenarios): Answer {
  const base: Clue[] = [...drill.given, ...drill.facts];
  switch (drill.type) {
    case 'reach': {
      const ask = drill.ask;
      if (!ask || ask.c === null || ask.t === null) throw new Error(`${drill.id}: reach sin persona u hora`);
      const { c, t } = ask;
      return { type: 'reach', rooms: unique(enumerate(drill, base, [c]).map((s) => s.rooms[c][t])) };
    }
    case 'tri': {
      const stmt = drill.stmt;
      if (!stmt) throw new Error(`${drill.id}: tri sin enunciado`);
      const graph = buildGraph(drill.plan);
      const values = enumerate(drill, base, stmtPersons(stmt, drill.N)).map((s) => statementHolds(stmt, s, graph));
      if (values.length === 0) throw new Error(`${drill.id}: las pistas no admiten ningún escenario`);
      const value: Tri = values.every(Boolean) ? 'V' : values.some(Boolean) ? 'NS' : 'F';
      return { type: 'tri', value };
    }
    case 'pick': {
      const ask = drill.ask;
      if (!ask) throw new Error(`${drill.id}: pick sin pregunta`);
      const sols = enumerate(drill, base, []);
      const who = ask.who;
      const what = ask.what;
      const options = who !== null ? unique(sols.map((s) => s.obj.indexOf(who))) : what !== null ? unique(sols.map((s) => s.obj[what])) : [];
      if (options.length === 0) throw new Error(`${drill.id}: las pistas no admiten ningún escenario`);
      return { type: 'pick', value: options.length === 1 ? options[0] : 'NS' };
    }
    case 'clue': {
      const decide = drill.decide;
      if (!decide) throw new Error(`${drill.id}: clue sin "decide"`);
      const td = drill.td;
      const rv = drill.rv;
      const what = decide.what;
      const solved = (sols: Truth[]): number[] =>
        decide.culprit && td !== null && rv !== null
          ? unique(sols.map((s) => s.rooms.findIndex((p) => p[td] === rv)))
          : what !== null
            ? unique(sols.map((s) => s.obj[what]))
            : [];
      const all = solved(enumerate(drill, [...base, ...drill.clues], []));
      if (all.length !== 1) throw new Error(`${drill.id}: con todas las pistas la respuesta no es única (${all.join(', ')})`);
      const decisive = drill.clues
        .map((_, i) => i)
        .filter((i) => !drill.used[i] && solved(enumerate(drill, [...base, ...drill.clues.filter((__, j) => j !== i)], [])).length > 1);
      return { type: 'decide', decide: decisive, answer: all[0] };
    }
    case 'contra': {
      const c = drill.hyp;
      const td = drill.td;
      const rv = drill.rv;
      if (c === null || td === null || rv === null) throw new Error(`${drill.id}: contra sin hipótesis o sin regla del crimen`);
      const hyp: Clue = { k: 'at', c, t: td, r: rv };
      if (enumerate(drill, [...base, ...drill.clues, hyp], []).length > 0) throw new Error(`${drill.id}: la hipótesis no se rompe con todas las pistas`);
      const decisive = drill.clues
        .map((_, i) => i)
        .filter((i) => !drill.used[i] && enumerate(drill, [...base, ...drill.clues.filter((__, j) => j !== i), hyp], []).length > 0);
      return { type: 'decide', decide: decisive, answer: null };
    }
  }
}

/** Diferencias entre la respuesta guardada y la calculada; en los remates, además,
 * tiene que haber exactamente una pista decisiva. Vacío: el ejercicio es correcto. */
export function drillErrors(stored: Answer, computed: Answer): string[] {
  const errors: string[] = [];
  if (JSON.stringify(stored) !== JSON.stringify(computed)) errors.push(`respuesta guardada ${JSON.stringify(stored)}, por fuerza bruta ${JSON.stringify(computed)}`);
  if (computed.type === 'decide' && computed.decide.length !== 1) errors.push(`debe haber exactamente una pista decisiva y hay ${computed.decide.length}`);
  return errors;
}
