// De la forma de autor (nombres, ids de sala, claves de objeto) a índices. Falla con
// un error claro si un ejercicio cita algo que no existe: así un error de escritura
// en seed.ts se detecta al validar, no en mitad de una sesión.
import { timeLabel } from '../../engine/text';
import type { Clue } from '../../engine/types';
import { GYM_CAST, GYM_OBJECTS, GYM_PLANS, NO_PLAN } from './content';
import type { Answer, Drill, SeedAnswer, SeedClue, SeedDrill, Statement } from './types';

export function normalizeDrill(seed: SeedDrill): Drill {
  const plan = seed.map ? GYM_PLANS[seed.map] : NO_PLAN;
  const objs = seed.objs ?? [];
  const room = (id: string): number => {
    const i = plan.rooms.findIndex((r) => r.id === id);
    if (i < 0) throw new Error(`${seed.id}: sala desconocida "${id}" en ${plan.id}`);
    return i;
  };
  const person = (name: string): number => {
    const i = seed.cast.indexOf(name as SeedDrill['cast'][number]);
    if (i < 0) throw new Error(`${seed.id}: persona "${name}" fuera del reparto`);
    return i;
  };
  const object = (key: string): number => {
    const i = objs.indexOf(key as (typeof objs)[number]);
    if (i < 0) throw new Error(`${seed.id}: objeto "${key}" fuera de la lista`);
    return i;
  };
  const feature = (id: string): 0 | 1 => {
    const i = plan.features.findIndex((f) => f.id === id);
    if (i !== 0 && i !== 1) throw new Error(`${seed.id}: rasgo desconocido "${id}"`);
    return i;
  };
  const clue = (c: SeedClue): Clue => {
    const out: Record<string, unknown> = { ...c };
    for (const key of ['c', 'a', 'b'] as const) if (key in c) out[key] = person((c as Record<string, string>)[key]);
    if ('r' in c) out.r = room(c.r);
    if ('o' in c) out.o = object(c.o);
    if ('f' in c) out.f = feature(c.f);
    delete out.used;
    return out as unknown as Clue;
  };

  const stmt: Statement | null = !seed.stmt
    ? null
    : seed.stmt.k === 'carry'
      ? { k: 'carry', c: person(seed.stmt.c), o: object(seed.stmt.o) }
      : clue(seed.stmt);

  return {
    id: seed.id,
    tech: seed.tech,
    type: seed.type,
    plan,
    hasPlan: seed.map !== null,
    T: seed.T,
    N: seed.cast.length,
    nObjs: objs.length,
    ctx: {
      rooms: plan.rooms,
      features: plan.features,
      unit: plan.unit,
      suspects: seed.cast.map((name) => ({ name, role: GYM_CAST[name].role, color: GYM_CAST[name].color })),
      objects: objs.map((key) => GYM_OBJECTS[key]),
    },
    given: (seed.given ?? []).map(clue),
    facts: (seed.facts ?? []).map(clue),
    clues: (seed.clues ?? []).map(clue),
    used: (seed.clues ?? []).map((c) => c.used === true),
    stmt,
    ask: seed.ask
      ? {
          c: seed.ask.c ? person(seed.ask.c) : null,
          t: seed.ask.t ?? null,
          who: seed.ask.who ? object(seed.ask.who) : null,
          what: seed.ask.what ? person(seed.ask.what) : null,
        }
      : null,
    rv: seed.rv ? room(seed.rv) : null,
    td: seed.td ?? null,
    hyp: seed.hyp ? person(seed.hyp.culprit) : null,
    decide: seed.decide ? { culprit: seed.decide.culprit === true, what: seed.decide.what ? person(seed.decide.what) : null } : null,
    tokens: (seed.tokens ?? []).map((t) => ({ c: person(t.c), r: room(t.r), caption: t.h, hyp: true })),
    show: { rooms: (seed.show?.rooms ?? []).map(room), path: (seed.show?.path ?? []).map(room) },
    prompt: seed.prompt ?? '',
    context: seed.context ?? '',
    explain: seed.explain,
  };
}

/** Respuesta de autor a índices del ejercicio ya normalizado. */
export function normalizeAnswer(seed: SeedDrill, answer: SeedAnswer): Answer {
  const plan = seed.map ? GYM_PLANS[seed.map] : NO_PLAN;
  const objs: string[] = seed.objs ?? [];
  const cast: string[] = seed.cast;
  const pickIndex = (v: string): number => {
    const i = cast.includes(v) ? cast.indexOf(v) : objs.indexOf(v);
    if (i < 0) throw new Error(`${seed.id}: respuesta desconocida "${v}"`);
    return i;
  };
  switch (answer.type) {
    case 'reach':
      return {
        type: 'reach',
        rooms: answer.rooms
          .map((id) => {
            const i = plan.rooms.findIndex((r) => r.id === id);
            if (i < 0) throw new Error(`${seed.id}: sala desconocida "${id}" en la respuesta`);
            return i;
          })
          .sort((a, b) => a - b),
      };
    case 'tri':
      return answer;
    case 'pick':
      return { type: 'pick', value: answer.value === 'NS' ? 'NS' : pickIndex(answer.value) };
    case 'decide':
      return { type: 'decide', decide: [...answer.decide].sort((a, b) => a - b), answer: answer.answer === undefined ? null : pickIndex(answer.answer) };
  }
}

/** Fichas de lo que se sabe: cada "X estaba en S a las H" de lo dado y de los hechos, más las de la hipótesis. */
export function knownTokens(drill: Drill): Drill['tokens'] {
  const known = [...drill.given, ...drill.facts]
    .filter((c): c is Extract<Clue, { k: 'at' }> => c.k === 'at')
    .map((c) => ({ c: c.c, r: c.r, caption: timeLabel(c.t), hyp: false }));
  return [...known, ...drill.tokens];
}
