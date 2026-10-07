// Corrección de un ejercicio y reglas de error (docs/MODOS.md 3.5). Pura y sin DOM.
// Se aplica la primera regla que encaje; si ninguna encaja, solo hay explicación.
// El tono es de entrenador: cada mensaje dice qué no se vio, sin castigo.
import { buildGraph } from '../../engine/graph';
import type { Clue, Room } from '../../engine/types';
import type { Answer, Drill, Reply } from './types';

export type ErrorRule =
  | 'reach-stay'
  | 'reach-no-door'
  | 'reach-far'
  | 'reach-feature'
  | 'reach-both-hours'
  | 'not-proven'
  | 'knowable'
  | 'reversed'
  | 'clue-irrelevant'
  | 'contra-holds';

export interface Grade {
  ok: boolean;
  /** Regla de error que encajó, o null (acierto, o fallo sin regla: solo explicación). */
  rule: ErrorRule | null;
  /** Pista concreta sobre el error; vacía si no hay regla. */
  hint: string;
}

const NUMBERS = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function hoursText(n: number): string {
  return n === 1 ? 'una hora' : `${NUMBERS[n] ?? n} horas`;
}

function doorsText(n: number): string {
  return n === 1 ? 'una puerta' : `${NUMBERS[n] ?? n} puertas`;
}

function sameSet(a: readonly number[], b: readonly number[]): boolean {
  const sa = new Set(a);
  return sa.size === new Set(b).size && b.every((x) => sa.has(x));
}

/** Las salas comparten un trozo de pared (no solo una esquina). */
function touching(drill: Drill, a: Room, b: Room): boolean {
  const A = drill.plan.rooms[a];
  const B = drill.plan.rooms[b];
  const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
  const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
  return (ox > 0 && oy === 0) || (oy > 0 && ox === 0);
}

function gradeReach(drill: Drill, answer: Room[], picked: Room[]): Grade {
  if (sameSet(answer, picked)) return { ok: true, rule: null, hint: '' };
  const ask = drill.ask;
  const fail = (rule: ErrorRule, hint: string): Grade => ({ ok: false, rule, hint });
  if (!ask || ask.c === null || ask.t === null) return { ok: false, rule: null, hint: '' };
  const who = ask.c;
  const at = ask.t;
  const graph = buildGraph(drill.plan);
  const name = (r: Room): string => `${drill.plan.rooms[r].art} ${drill.plan.rooms[r].name}`;
  const known: Clue[] = [...drill.given, ...drill.facts];
  // Dónde se sabe que estaba esa persona a otras horas, y cuántas horas hay hasta la pedida.
  const anchors = known
    .filter((c): c is Extract<Clue, { k: 'at' }> => c.k === 'at' && c.c === who && c.t !== at)
    .map((c) => ({ room: c.r, hours: Math.abs(c.t - at) }));
  const features = known.filter((c): c is Extract<Clue, { k: 'feat' }> => c.k === 'feat' && c.c === who && c.t === at);
  const wrong = picked.filter((r) => !answer.includes(r));
  const reachable = (w: Room, a: { room: Room; hours: number }): boolean => graph.dist[a.room][w] <= a.hours;

  // 1. Falta la sala de partida: en una hora también se puede quedar.
  const stay = anchors.find((a) => a.hours === 1 && answer.includes(a.room) && !picked.includes(a.room));
  if (stay) return fail('reach-stay', `En una hora también puede quedarse donde estaba: ${name(stay.room)} también vale.`);

  // 2. Una sala que toca la de partida, pero sin puerta.
  for (const w of wrong) {
    const a = anchors.find((x) => x.hours === 1 && !graph.adjM[x.room][w] && touching(drill, x.room, w));
    if (a) return fail('reach-no-door', `${cap(name(w))} y ${name(a.room)} se tocan, pero no hay puerta entre ellas.`);
  }

  // 3. Una sala a la que no se llega desde ninguna hora conocida.
  for (const w of wrong) {
    if (anchors.length === 0 || anchors.some((a) => reachable(w, a))) continue;
    const a = anchors.reduce((best, x) => (x.hours < best.hours ? x : best));
    return fail('reach-far', `${cap(name(w))} está a ${doorsText(graph.dist[a.room][w])}: no da tiempo en ${hoursText(a.hours)}.`);
  }

  // 4. Una sala que no cumple un rasgo pedido.
  for (const w of wrong) {
    const f = features.find((c) => graph.feat[w][c.f] === c.neg);
    if (f) {
      const label = drill.plan.features[f.f].label.toLowerCase();
      return fail('reach-feature', `${cap(name(w))} ${f.neg ? 'tiene' : 'no tiene'} ${label}.`);
    }
  }

  // 5. Una sala que encaja con una hora conocida pero no con la otra.
  if (anchors.length >= 2 && wrong.some((w) => anchors.some((a) => reachable(w, a)) && !anchors.every((a) => reachable(w, a)))) {
    return fail('reach-both-hours', 'Tiene que encajar con las dos horas a la vez.');
  }
  return { ok: false, rule: null, hint: '' };
}

const NOT_PROVEN = 'Es posible, pero no está demostrado. Responder eso sería una corazonada.';
const KNOWABLE = 'Sí se puede saber: hay una deducción que lo cierra.';

export function grade(drill: Drill, answer: Answer, reply: Reply): Grade {
  if (answer.type === 'reach' && reply.type === 'reach') return gradeReach(drill, answer.rooms, reply.rooms);

  if (answer.type === 'tri' && reply.type === 'tri') {
    if (reply.value === answer.value) return { ok: true, rule: null, hint: '' };
    if (answer.value === 'NS') return { ok: false, rule: 'not-proven', hint: NOT_PROVEN };
    if (reply.value === 'NS') return { ok: false, rule: 'knowable', hint: KNOWABLE };
    return { ok: false, rule: 'reversed', hint: 'Es justo al revés.' };
  }

  if (answer.type === 'pick' && reply.type === 'pick') {
    if (reply.value === answer.value) return { ok: true, rule: null, hint: '' };
    if (answer.value === 'NS') return { ok: false, rule: 'not-proven', hint: NOT_PROVEN };
    if (reply.value === 'NS') return { ok: false, rule: 'knowable', hint: KNOWABLE };
    return { ok: false, rule: null, hint: '' };
  }

  if (answer.type === 'decide' && reply.type === 'decide') {
    if (answer.decide.includes(reply.pick)) return { ok: true, rule: null, hint: '' };
    return drill.type === 'contra'
      ? { ok: false, rule: 'contra-holds', hint: 'Con esa pista la hipótesis sigue en pie.' }
      : { ok: false, rule: 'clue-irrelevant', hint: 'Esa pista no cambia nada entre los dos que quedan.' };
  }

  throw new Error(`${drill.id}: la respuesta (${reply.type}) no corresponde al tipo de ejercicio (${answer.type}).`);
}
