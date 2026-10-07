// Verificación por fuerza bruta de los ejercicios (docs/MODOS.md 3.8): se enumeran
// TODOS los escenarios del ejercicio (recorrido de cada persona por el plano, una
// puerta por hora, y reparto de objetos) y la respuesta es la que dejan las pistas.
// Puro y sin DOM. Los ejercicios son pequeños a propósito (hasta 4 personas, 3 horas,
// 9 salas), así que enumerar es viable; para ir rápido, las pistas que no dependen
// de los objetos se comprueban antes de probar repartos de objetos.
import { holds } from '../../engine/clues';
import { buildGraph } from '../../engine/graph';
import type { Clue, Graph, Room, Truth } from '../../engine/types';
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

/** Todos los escenarios que cumplen `statements` (y `extra` sobre las salas, si se da). */
export function scenarios(drill: Drill, statements: readonly Statement[], extra?: (rooms: Room[][]) => boolean): Truth[] {
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
      if (extra && !extra(rooms)) return;
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
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)].sort((a, b) => Number(a) - Number(b));
}

/** Respuesta correcta de un ejercicio, calculada desde cero. */
export function computeAnswer(drill: Drill): Answer {
  const base: Clue[] = [...drill.given, ...drill.facts];
  switch (drill.type) {
    case 'reach': {
      const ask = drill.ask;
      if (!ask || ask.c === null || ask.t === null) throw new Error(`${drill.id}: reach sin persona u hora`);
      const { c, t } = ask;
      return { type: 'reach', rooms: unique(scenarios(drill, base).map((s) => s.rooms[c][t])) };
    }
    case 'tri': {
      const stmt = drill.stmt;
      if (!stmt) throw new Error(`${drill.id}: tri sin enunciado`);
      const graph = buildGraph(drill.plan);
      const values = scenarios(drill, base).map((s) => statementHolds(stmt, s, graph));
      if (values.length === 0) throw new Error(`${drill.id}: las pistas no admiten ningún escenario`);
      const value: Tri = values.every(Boolean) ? 'V' : values.some(Boolean) ? 'NS' : 'F';
      return { type: 'tri', value };
    }
    case 'pick': {
      const ask = drill.ask;
      if (!ask) throw new Error(`${drill.id}: pick sin pregunta`);
      const sols = scenarios(drill, base);
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
      const all = solved(scenarios(drill, [...base, ...drill.clues]));
      if (all.length !== 1) throw new Error(`${drill.id}: con todas las pistas la respuesta no es única (${all.join(', ')})`);
      const decisive = drill.clues
        .map((_, i) => i)
        .filter((i) => !drill.used[i] && solved(scenarios(drill, [...base, ...drill.clues.filter((__, j) => j !== i)])).length > 1);
      return { type: 'decide', decide: decisive, answer: all[0] };
    }
    case 'contra': {
      const c = drill.hyp;
      const td = drill.td;
      const rv = drill.rv;
      if (c === null || td === null || rv === null) throw new Error(`${drill.id}: contra sin hipótesis o sin regla del crimen`);
      const hyp = (rooms: Room[][]): boolean => rooms[c][td] === rv;
      if (scenarios(drill, [...base, ...drill.clues], hyp).length > 0) throw new Error(`${drill.id}: la hipótesis no se rompe con todas las pistas`);
      const decisive = drill.clues
        .map((_, i) => i)
        .filter((i) => !drill.used[i] && scenarios(drill, [...base, ...drill.clues.filter((__, j) => j !== i)], hyp).length > 0);
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
