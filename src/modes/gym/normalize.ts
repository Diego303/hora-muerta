// De la forma de autor (nombres, ids de sala, claves de objeto) a índices. Falla con
// un error claro si un ejercicio cita algo que no existe: así un error de escritura
// en seed.ts se detecta al validar, no en mitad de una sesión.
import { CAST, CHIP_COLORS, OBJECTS } from '../../engine/content/cast';
import { MAPS } from '../../engine/content/maps';
import { timeLabel } from '../../engine/text';
import type { Clue } from '../../engine/types';
import { GYM_CAST, GYM_OBJECTS, GYM_PLANS, NO_PLAN } from './content';
import type { ClueTextContext } from '../../engine/text';
import type { Answer, Drill, DrillDef, PackedDrillDef, SeedAnswer, SeedClue, SeedDrill, Statement } from './types';

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

/** De las marcas compactas de una explicación generada al HTML de las pistas. */
export function expandMarkup(text: string, ctx: ClueTextContext): string {
  return text
    .replace(/\{c:(\d+)\}/g, (_, k: string) => `<span class="who" style="--c:${ctx.suspects[Number(k)].color}">${ctx.suspects[Number(k)].name}</span>`)
    .replace(/\{r:(\d+)\}/g, (_, k: string) => `<b class="rm">${ctx.rooms[Number(k)].name}</b>`)
    .replace(/\{o:(\d+)\}/g, (_, k: string) => `<span class="obj">${ctx.objects[Number(k)].name}</span>`)
    .replace(/\{t:([\d:]+)\}/g, (_, t: string) => `<span class="tm">${t}</span>`);
}

/** Lo contrario de `expandMarkup`: falla si nombra algo que no está en el ejercicio. */
export function compactMarkup(html: string, ctx: ClueTextContext): string {
  const index = (list: { name: string }[], name: string, kind: string): number => {
    const i = list.findIndex((x) => x.name === name);
    if (i < 0) throw new Error(`${kind} desconocido en la explicación: ${name}`);
    return i;
  };
  return html
    .replace(/<span class="who" style="--c:[^"]*">([^<]*)<\/span>/g, (_, n: string) => `{c:${index(ctx.suspects, n, 'persona')}}`)
    .replace(/<b class="rm">([^<]*)<\/b>/g, (_, n: string) => `{r:${index(ctx.rooms, n, 'sala')}}`)
    .replace(/<span class="obj">([^<]*)<\/span>/g, (_, n: string) => `{o:${index(ctx.objects, n, 'objeto')}}`)
    .replace(/<span class="tm">([^<]*)<\/span>/g, (_, t: string) => `{t:${t}}`);
}

/** Para public/drills.json: sin los campos vacíos. */
export function packDef(def: DrillDef): PackedDrillDef {
  const isEmpty = ([k, v]: [string, unknown]): boolean =>
    k !== 'map' && (v === null || v === '' || (Array.isArray(v) && v.length === 0) || (k === 'show' && def.show.rooms.length === 0 && def.show.path.length === 0));
  return Object.fromEntries(Object.entries(def).filter((e) => !isEmpty(e))) as PackedDrillDef;
}

export function unpackDef(p: PackedDrillDef): DrillDef {
  const clues = p.clues ?? [];
  return {
    objs: [],
    given: [],
    facts: [],
    clues,
    used: p.used ?? clues.map(() => false),
    stmt: null,
    ask: null,
    rv: null,
    td: null,
    hyp: null,
    decide: null,
    show: { rooms: [], path: [] },
    prompt: '',
    context: '',
    ...p,
  };
}

/** Un ejercicio generado (public/drills.json) a la forma que usa el reproductor. */
export function drillFromDef(def: DrillDef): Drill {
  const map = def.map ? MAPS.find((m) => m.id === def.map) : null;
  if (def.map && !map) throw new Error(`${def.id}: plano desconocido "${def.map}"`);
  const plan = map ?? NO_PLAN;
  const ctx: ClueTextContext = {
    rooms: plan.rooms,
    features: plan.features,
    unit: plan.unit,
    suspects: def.cast.map((i, k) => ({ name: CAST[i].name, role: CAST[i].role, color: CHIP_COLORS[k] })),
    objects: def.objs.map((i) => OBJECTS[i]),
  };
  return {
    id: def.id,
    tech: def.tech,
    type: def.type,
    plan,
    hasPlan: map !== null,
    T: def.T,
    N: def.cast.length,
    nObjs: def.objs.length,
    ctx,
    given: def.given,
    facts: def.facts,
    clues: def.clues,
    used: def.used,
    stmt: def.stmt,
    ask: def.ask,
    rv: def.rv,
    td: def.td,
    hyp: def.hyp,
    decide: def.decide,
    // La hipótesis de un "contra" se dibuja en el plano: la persona con la víctima.
    tokens: def.hyp !== null && def.rv !== null && def.td !== null ? [{ c: def.hyp, r: def.rv, caption: timeLabel(def.td), hyp: true }] : [],
    show: def.show,
    prompt: def.prompt,
    context: def.context,
    explain: expandMarkup(def.explain, ctx),
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
