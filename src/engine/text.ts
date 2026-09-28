// Apéndice B del diseño técnico: textos exactos de las 16 pistas. Apéndice C:
// explicación de cada paso y frase de la deducción clave por arquetipo. Produce
// cadenas con marcado ligero (nombres coloreados, salas en negrita, horas
// destacadas, objetos en cursiva) que la interfaz inserta tal cual; el motor no
// toca el DOM.
import { MOTIVES, VICTIMS } from './content/cast';
import type { ObjectDef } from './content/cast';
import type { CaseDef, Clue, Conclusion, FeatureDef, Hour, Obj, Room, RoomDef, Step, Sus } from './types';

/** "21:00", "22:00"... (§3: solo horas en punto, 21:00 es la hora 0). */
export function timeLabel(t: Hour): string {
  const h = (21 + t) % 24;
  return `${String(h).padStart(2, '0')}:00`;
}

export interface SuspectRef {
  name: string;
  color: string;
  role: string;
}

export interface ClueTextContext {
  rooms: RoomDef[];
  features: [FeatureDef, FeatureDef];
  unit: 'sala' | 'vagón';
  suspects: SuspectRef[];
  objects: ObjectDef[];
}

function roomText(room: RoomDef): string {
  return `${room.art} <b class="rm">${room.name}</b>`;
}

function who(suspect: SuspectRef): string {
  return `<span class="who" style="--c:${suspect.color}">${suspect.name}</span>`;
}

function objText(obj: ObjectDef): string {
  return `${obj.article} <span class="obj">${obj.name}</span>`;
}

function timeSpan(t: Hour): string {
  return `<span class="tm">${timeLabel(t)}</span>`;
}

function featureText(ctx: ClueTextContext, f: 0 | 1, neg: boolean): string {
  const feature = ctx.features[f];
  const unitPhrase = ctx.unit === 'vagón' ? 'un vagón' : 'una sala';
  return `en ${unitPhrase} ${neg ? feature.neg : feature.txt}`;
}

const COUNT_WORDS = ['', '', 'dos', 'tres', 'cuatro', 'cinco'];

function countPhrase(n: number): string {
  if (n === 0) return 'nadie';
  if (n === 1) return 'una persona';
  return `${COUNT_WORDS[n] ?? n} personas`;
}

/** Texto exacto de una pista (Apéndice B), con los nombres/salas/horas/objetos marcados. */
export function clueText(clue: Clue, ctx: ClueTextContext): string {
  const suspect = (s: Sus): string => who(ctx.suspects[s]);
  const room = (r: Room): string => roomText(ctx.rooms[r]);
  const obj = (o: Obj): string => objText(ctx.objects[o]);
  const isVagon = ctx.unit === 'vagón';

  switch (clue.k) {
    case 'at':
      return `A las ${timeSpan(clue.t)}, ${suspect(clue.c)} estaba en ${room(clue.r)}.`;
    case 'notat':
      return `A las ${timeSpan(clue.t)}, ${suspect(clue.c)} no estaba en ${room(clue.r)}.`;
    case 'feat':
      return `A las ${timeSpan(clue.t)}, ${suspect(clue.c)} estaba ${featureText(ctx, clue.f, clue.neg)}.`;
    case 'never':
      return `${suspect(clue.c)} no pisó ${room(clue.r)} en toda la noche.`;
    case 'visited':
      return `${suspect(clue.c)} estuvo en ${room(clue.r)} al menos una vez.`;
    case 'stayed':
      return `${suspect(clue.c)} no se movió de su ${ctx.unit} en toda la noche.`;
    case 'moved':
      return `Entre las ${timeSpan(clue.t)} y las ${timeSpan(clue.t + 1)}, ${suspect(clue.c)} cruzó una puerta.`;
    case 'still':
      return `Entre las ${timeSpan(clue.t)} y las ${timeSpan(clue.t + 1)}, ${suspect(clue.c)} no se movió.`;
    case 'together':
      return `A las ${timeSpan(clue.t)}, ${suspect(clue.a)} y ${suspect(clue.b)} estaban en ${isVagon ? 'el mismo vagón' : 'la misma sala'}.`;
    case 'apart':
      return `${suspect(clue.a)} y ${suspect(clue.b)} no coincidieron en ningún momento.`;
    case 'adj':
      return `A las ${timeSpan(clue.t)}, ${suspect(clue.a)} estaba ${isVagon ? 'en un vagón contiguo al' : 'en una sala contigua a la'} de ${suspect(clue.b)}.`;
    case 'count':
      return clue.n === 0
        ? `A las ${timeSpan(clue.t)} no había nadie en ${room(clue.r)}.`
        : `A las ${timeSpan(clue.t)} había exactamente ${countPhrase(clue.n)} en ${room(clue.r)}.`;
    case 'cat':
      return `A las ${timeSpan(clue.t)}, quien llevaba ${obj(clue.o)} estaba en ${room(clue.r)}.`;
    case 'cfeat':
      return `A las ${timeSpan(clue.t)}, quien llevaba ${obj(clue.o)} estaba ${featureText(ctx, clue.f, clue.neg)}.`;
    case 'ncarry':
      return `${suspect(clue.c)} no llevaba ${obj(clue.o)}.`;
    case 'cwith':
      return `A las ${timeSpan(clue.t)}, quien llevaba ${obj(clue.o)} estaba con ${suspect(clue.c)}.`;
  }
}

/** Texto plano (sin el marcado de clueText), para medir la longitud de lectura (§6.3). */
export function plainText(markedUp: string): string {
  return markedUp.replace(/<[^>]*>/g, '');
}

/** "{Culpable}, {rol}, estuvo a solas con {víctima} en {sala} a las {hora}. Llevaba {arma}. Motivo: {motivo}." (§14.4). */
export function closingText(caseData: CaseDef, ctx: ClueTextContext): string {
  const culprit = ctx.suspects[caseData.culprit];
  const weapon = ctx.objects[caseData.weapon];
  const room = ctx.rooms[caseData.rv];
  return `${who(culprit)}, ${culprit.role}, estuvo a solas con ${VICTIMS[caseData.victim]} en ${roomText(room)} a las ${timeSpan(caseData.td)}. Llevaba ${objText(weapon)}. Motivo: ${MOTIVES[caseData.motive]}.`;
}

function pistaRef(cl: number[]): string {
  return cl.map((i) => `p. ${i + 1}`).join(', ');
}

function notCulpritSuspects(step: Step): Sus[] {
  return step.concl.filter((c): c is Extract<Conclusion, { k: 'notCulprit' }> => c.k === 'notCulprit').map((c) => c.c);
}
function culpritOf(step: Step): Sus | null {
  const found = step.concl.find((c) => c.k === 'culprit');
  return found && found.k === 'culprit' ? found.c : null;
}
function carryOf(step: Step): { c: Sus; o: Obj } | null {
  const found = step.concl.find((c) => c.k === 'carry');
  return found && found.k === 'carry' ? { c: found.c, o: found.o } : null;
}
function notCarryOf(step: Step): { c: Sus; o: Obj }[] {
  return step.concl.filter((c): c is Extract<Conclusion, { k: 'notCarry' }> => c.k === 'notCarry').map((c) => ({ c: c.c, o: c.o }));
}
function isRoomOf(step: Step): { c: Sus; t: Hour; r: Room } | null {
  const found = step.concl.find((c) => c.k === 'isRoom');
  return found && found.k === 'isRoom' ? { c: found.c, t: found.t, r: found.r } : null;
}
function primaryCell(step: Step): { c: Sus; t: Hour } | null {
  for (const con of step.concl) if (con.k === 'notRoom' || con.k === 'isRoom') return { c: con.c, t: con.t };
  return null;
}

/** Describe el resultado de una eliminación sobre `poss[c][t]` sin acceso al estado en
 * vivo (Apéndice C pide a veces "solo puede ser X, Y"): si colapsó a una sola sala se
 * nombra esa; si no, se listan las salas recién descartadas con el verbo alternativo.
 * Ver docs/DECISIONES.md, "Apéndice C: explicaciones de paso sin estado en vivo". */
function resultClause(step: Step, c: Sus, t: Hour, ctx: ClueTextContext, verbSingle: string, verbExcluded: string): string {
  const iso = step.concl.find((x) => x.k === 'isRoom' && x.c === c && x.t === t);
  if (iso && iso.k === 'isRoom') return `${verbSingle} ${roomText(ctx.rooms[iso.r])}`;
  const excluded = step.concl.filter((x): x is Extract<Conclusion, { k: 'notRoom' }> => x.k === 'notRoom' && x.c === c && x.t === t).map((x) => x.r);
  if (excluded.length === 0) return '';
  return `${verbExcluded} ${excluded.map((r) => roomText(ctx.rooms[r])).join(' ni en ')}`;
}

/** Suspects ya fijados en (t, r) por pasos anteriores de la cadena (para reconstruir
 * "y ya son {nombres}" sin guardar el estado completo por paso). */
function knownAt(allSteps: Step[], uptoIndex: number, t: Hour, r: Room): Sus[] {
  const out: Sus[] = [];
  for (let i = 0; i < uptoIndex; i++) {
    const iso = isRoomOf(allSteps[i]);
    if (iso && iso.t === t && iso.r === r) out.push(iso.c);
  }
  return out;
}

/** El único sospechoso que, por pasos anteriores, ya lleva exactamente `o` (para R5_SUS_SINGLE). */
function whoCarriesExactly(allSteps: Step[], uptoIndex: number, o: Obj): Sus | null {
  for (let i = uptoIndex - 1; i >= 0; i--) {
    const found = allSteps[i].concl.find((x) => x.k === 'carry' && x.o === o);
    if (found && found.k === 'carry') return found.c;
  }
  return null;
}

/** Quien ya se sabe que estaba a solas con la víctima, por pasos anteriores (para R2_TAKEN). */
function culpritKnownBefore(allSteps: Step[], uptoIndex: number, td: Hour, rv: Room): Sus | null {
  for (let i = 0; i < uptoIndex; i++) {
    const cul = culpritOf(allSteps[i]);
    if (cul !== null) return cul;
    const iso = isRoomOf(allSteps[i]);
    if (iso && iso.t === td && iso.r === rv) return iso.c;
  }
  return null;
}

/**
 * Explicación de un paso de la cadena crítica (Apéndice C), para la fase 2 de la
 * pista del inspector y la cadena de deducción del cierre. `allSteps` es la cadena
 * completa (`CaseDef.solve.steps`) e `index` la posición de `step` en ella, porque
 * algunas reglas (R2_TAKEN, R4_COUNT_FULL, R5_SUS_SINGLE) solo concluyen la parte
 * nueva y hay que mirar atrás para nombrar lo que ya se sabía.
 */
export function stepExplanation(step: Step, index: number, allSteps: Step[], caseData: CaseDef, ctx: ClueTextContext): string {
  const clues = caseData.clues;
  const suspect = (s: Sus): string => who(ctx.suspects[s]);
  const room = (r: Room): string => roomText(ctx.rooms[r]);
  const obj = (o: Obj): string => objText(ctx.objects[o]);
  const pista = pistaRef(step.cl);

  switch (step.rule) {
    case 'R1_AT': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'at' }>;
      return `${suspect(clue.c)} estaba en ${room(clue.r)} a las ${timeSpan(clue.t)} (${pista}).`;
    }
    case 'R1_NOTAT': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'notat' }>;
      return `Por la pista ${step.cl[0] + 1}, ${suspect(clue.c)} no estaba en ${room(clue.r)} a las ${timeSpan(clue.t)}.`;
    }
    case 'R1_NEVER': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'never' }>;
      return `Por la pista ${step.cl[0] + 1}, ${suspect(clue.c)} no estaba en ${room(clue.r)} en toda la noche.`;
    }
    case 'R1_FEAT': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'feat' }>;
      const clause = resultClause(step, clue.c, clue.t, ctx, 'solo puede ser', 'ya no puede ser');
      return `A las ${timeSpan(clue.t)}, ${suspect(clue.c)} estaba ${featureText(ctx, clue.f, clue.neg)} (${pista})${clause ? `: ${clause}` : ''}.`;
    }
    case 'R1_STAYED': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'stayed' }>;
      return `${suspect(clue.c)} no se movió en toda la noche (${pista}): estuvo siempre en la misma sala.`;
    }
    case 'R1_NCARRY': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'ncarry' }>;
      return `${suspect(clue.c)} no llevaba ${obj(clue.o)} (${pista}).`;
    }
    case 'R1_EMPTY': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'count' }>;
      return `A las ${timeSpan(clue.t)} no había nadie en ${room(clue.r)} (${pista}).`;
    }
    case 'R2_CANT_BE_THERE': {
      const notCulprit = step.concl.find((c): c is Extract<Conclusion, { k: 'notCulprit' }> => c.k === 'notCulprit');
      if (!notCulprit) return '';
      return `${suspect(notCulprit.c)} no pudo estar en ${room(caseData.rv)} a las ${timeSpan(caseData.td)}, así que no es el culpable.`;
    }
    case 'R2_ONLY_ONE': {
      const culprit = culpritOf(step);
      if (culprit !== null) {
        return `Solo ${suspect(culprit)} pudo estar a solas con la víctima en ${room(caseData.rv)} a las ${timeSpan(caseData.td)}: es el culpable.`;
      }
      const iso = isRoomOf(step);
      return iso
        ? `Ya se sabe que ${suspect(iso.c)} es el culpable: a las ${timeSpan(caseData.td)} tuvo que estar en ${room(caseData.rv)}.`
        : '';
    }
    case 'R2_TAKEN': {
      const taken = culpritKnownBefore(allSteps, index, caseData.td, caseData.rv);
      if (taken === null) return '';
      return `${suspect(taken)} estaba con la víctima a las ${timeSpan(caseData.td)}; nadie más podía estar en ${room(caseData.rv)}.`;
    }
    case 'R3_REACH_FWD': {
      const cell = primaryCell(step);
      if (!cell) return '';
      const clause = resultClause(step, cell.c, cell.t, ctx, 'solo pudo estar en', 'ya no pudo estar en');
      return `Una puerta por hora: por dónde estaba ${suspect(cell.c)} a las ${timeSpan(cell.t - 1)}, a las ${timeSpan(cell.t)} ${clause}.`;
    }
    case 'R3_REACH_BWD': {
      const cell = primaryCell(step);
      if (!cell) return '';
      const clause = resultClause(step, cell.c, cell.t, ctx, 'solo pudo estar en', 'ya no pudo estar en');
      return `Una puerta por hora: por dónde estaba ${suspect(cell.c)} a las ${timeSpan(cell.t + 1)}, a las ${timeSpan(cell.t)} ${clause}.`;
    }
    case 'R3_STILL': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'still' }>;
      const clause = resultClause(step, clue.c, clue.t, ctx, 'estuvo en', 'ya no pudo estar en') || resultClause(step, clue.c, clue.t + 1, ctx, 'estuvo en', 'ya no pudo estar en');
      return `${suspect(clue.c)} no se movió entre las ${timeSpan(clue.t)} y las ${timeSpan(clue.t + 1)} (${pista})${clause ? `: a ambas horas ${clause}` : ''}.`;
    }
    case 'R3_MOVED': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'moved' }>;
      const removed = step.concl.filter((x): x is Extract<Conclusion, { k: 'notRoom' }> => x.k === 'notRoom').map((x) => room(x.r));
      return `${suspect(clue.c)} cruzó una puerta entre las ${timeSpan(clue.t)} y las ${timeSpan(clue.t + 1)} (${pista})${removed.length ? `: no pudo seguir en ${removed.join(' ni en ')}` : ''}.`;
    }
    case 'R4_TOGETHER': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'together' }>;
      const pair = notCulpritSuspects(step);
      if (pair.length >= 2) {
        return `${suspect(clue.a)} y ${suspect(clue.b)} estaban juntos a las ${timeSpan(clue.t)} (${pista}); si alguno hubiera estado a solas con la víctima, el otro también, y solo hay un culpable. Ninguno de los dos lo es.`;
      }
      const clause = resultClause(step, clue.a, clue.t, ctx, 'solo pudo estar en', 'ya no pudo estar en') || resultClause(step, clue.b, clue.t, ctx, 'solo pudo estar en', 'ya no pudo estar en');
      return `${suspect(clue.a)} y ${suspect(clue.b)} estaban juntos a las ${timeSpan(clue.t)} (${pista})${clause ? `: ${clause}` : ''}.`;
    }
    case 'R4_ADJ': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'adj' }>;
      const clause = resultClause(step, clue.a, clue.t, ctx, 'solo encaja', 'ya no encaja') || resultClause(step, clue.b, clue.t, ctx, 'solo encaja', 'ya no encaja');
      return `${suspect(clue.a)} estaba en una sala contigua a la de ${suspect(clue.b)} a las ${timeSpan(clue.t)} (${pista})${clause ? `: ${clause}` : ''}.`;
    }
    case 'R4_APART': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'apart' }>;
      const removed = step.concl.find((x): x is Extract<Conclusion, { k: 'notRoom' }> => x.k === 'notRoom');
      if (!removed) return `${suspect(clue.a)} y ${suspect(clue.b)} nunca coincidieron (${pista}).`;
      const anchor = removed.c === clue.a ? clue.b : clue.a;
      return `${suspect(clue.a)} y ${suspect(clue.b)} nunca coincidieron (${pista}), y ${suspect(anchor)} estaba en ${room(removed.r)} a las ${timeSpan(removed.t)}: ${suspect(removed.c)} no.`;
    }
    case 'R4_COUNT_FULL': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'count' }>;
      const already = knownAt(allSteps, index, clue.t, clue.r).map((c) => suspect(c));
      const excluded = step.concl.filter((x): x is Extract<Conclusion, { k: 'notRoom' }> => x.k === 'notRoom').map((x) => suspect(x.c));
      const notThere = excluded.length === 1 ? `${excluded[0]} no estaba allí` : `${excluded.join(', ')} no estaban allí`;
      return `A las ${timeSpan(clue.t)} había exactamente ${countPhrase(clue.n)} en ${room(clue.r)} (${pista})${already.length ? ` y ya son ${already.join(', ')}` : ''}: ${notThere}.`;
    }
    case 'R4_COUNT_NEED': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'count' }>;
      const names = step.concl.filter((x): x is Extract<Conclusion, { k: 'isRoom' }> => x.k === 'isRoom').map((x) => suspect(x.c));
      return `A las ${timeSpan(clue.t)} había exactamente ${countPhrase(clue.n)} en ${room(clue.r)} (${pista}) y solo podían estar ${names.join(', ')}: estaban todos.`;
    }
    case 'R4_OBJ_WHERE': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'cat' } | { k: 'cfeat' }>;
      const whereText = clue.k === 'cat' ? `en ${room(clue.r)}` : featureText(ctx, clue.f, clue.neg);
      const notCarried = notCarryOf(step);
      if (notCarried.length) {
        return `Quien llevaba ${obj(clue.o)} estaba ${whereText} a las ${timeSpan(clue.t)} (${pista}). ${notCarried.map((x) => suspect(x.c)).join(', ')} no pudo estar allí, así que no lo llevaba.`;
      }
      const iso = isRoomOf(step);
      return `Solo quien llevaba ${obj(clue.o)} pudo estar ${whereText} a las ${timeSpan(clue.t)} (${pista})${iso ? `: por eso ${suspect(iso.c)} estuvo en ${room(iso.r)}` : ''}.`;
    }
    case 'R4_OBJ_WITH': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'cwith' }>;
      const notCarried = notCarryOf(step);
      if (notCarried.length === 1 && notCarried[0].c === clue.c) {
        return `Quien llevaba ${obj(clue.o)} estaba con ${suspect(clue.c)} a las ${timeSpan(clue.t)} (${pista}): no podía ser ${suspect(clue.c)} mismo, así que no lo llevaba.`;
      }
      if (notCarried.length) {
        return `Quien llevaba ${obj(clue.o)} estaba con ${suspect(clue.c)} a las ${timeSpan(clue.t)} (${pista}). ${notCarried.map((x) => suspect(x.c)).join(', ')} no pudo coincidir con ${suspect(clue.c)}: no lo llevaba.`;
      }
      const iso = isRoomOf(step);
      return `Solo quien llevaba ${obj(clue.o)} pudo coincidir con ${suspect(clue.c)} a las ${timeSpan(clue.t)} (${pista})${iso ? `: por eso estuvo en ${room(iso.r)}` : ''}.`;
    }
    case 'R4_VISITED': {
      const clue = clues[step.cl[0]] as Extract<Clue, { k: 'visited' }>;
      const iso = isRoomOf(step);
      return `${suspect(clue.c)} estuvo en ${room(clue.r)} alguna vez (${pista})${iso ? ` y solo pudo ser a las ${timeSpan(iso.t)}` : ''}.`;
    }
    case 'R5_OBJ_SINGLE': {
      const carry = carryOf(step);
      return carry ? `Solo ${suspect(carry.c)} puede llevar ${obj(carry.o)}: lo llevaba.` : '';
    }
    case 'R5_SUS_SINGLE': {
      const notCarried = notCarryOf(step);
      const o = notCarried[0]?.o;
      const d = o !== undefined ? whoCarriesExactly(allSteps, index, o) : null;
      return d !== null && o !== undefined ? `A ${suspect(d)} solo le quedaba ${obj(o)}: lo llevaba.` : 'A alguien solo le quedaba un objeto posible: lo llevaba.';
    }
    case 'R5_WEAPON': {
      const carry = carryOf(step);
      return carry ? `El culpable es ${suspect(carry.c)} y llevaba ${obj(carry.o)}: esa es el arma.` : '';
    }
    case 'R6_HYPOTHESIS': {
      const notCulprit = step.concl.find((x): x is Extract<Conclusion, { k: 'notCulprit' }> => x.k === 'notCulprit');
      if (notCulprit) return `Suponer que ${suspect(notCulprit.c)} fue el culpable lleva a una contradicción con las pistas: no pudo serlo.`;
      const notRoom = step.concl.find((x): x is Extract<Conclusion, { k: 'notRoom' }> => x.k === 'notRoom');
      return notRoom ? `Suponer que ${suspect(notRoom.c)} estuvo en ${room(notRoom.r)} a las ${timeSpan(notRoom.t)} lleva a una contradicción con las pistas: no pudo ser ahí.` : 'Una hipótesis llevaba a una contradicción con las pistas.';
    }
    default:
      return '';
  }
}

/** Frase de la deducción clave por arquetipo (Apéndice C), para el encabezado del cierre. */
export function keyDeductionText(caseData: CaseDef, ctx: ClueTextContext): string {
  const archetype = caseData.solve.arch[0];
  const step = caseData.solve.steps[caseData.solve.key];
  const suspect = (s: Sus): string => who(ctx.suspects[s]);
  const room = (r: Room): string => roomText(ctx.rooms[r]);
  const obj = (o: Obj): string => objText(ctx.objects[o]);
  if (!archetype || !step) return '';

  switch (archetype) {
    case 'coartada': {
      const notCulprit = step.concl.find((c): c is Extract<Conclusion, { k: 'notCulprit' }> => c.k === 'notCulprit');
      return notCulprit ? `La clave: ${suspect(notCulprit.c)} no podía llegar a tiempo a ${roomText(ctx.rooms[caseData.rv])}.` : '';
    }
    case 'paso': {
      const clue = caseData.clues[step.cl[0]];
      return clue && clue.k === 'count' ? `La clave: el único camino a ${roomText(ctx.rooms[caseData.rv])} pasaba por ${room(clue.r)}, y estaba vacía.` : '';
    }
    case 'pareja': {
      const pair = notCulpritSuspects(step);
      return pair.length >= 2 ? `La clave: ${suspect(pair[0])} y ${suspect(pair[1])} iban juntos; ninguno pudo estar a solas con la víctima.` : '';
    }
    case 'recuento': {
      const clue = caseData.clues[step.cl[0]];
      if (!clue || clue.k !== 'count') return '';
      const excluded = step.concl.find((c): c is Extract<Conclusion, { k: 'notRoom' }> => c.k === 'notRoom');
      if (excluded) return `La clave: el recuento de ${room(clue.r)} a las ${timeSpan(clue.t)} dejaba fuera a ${suspect(excluded.c)}.`;
      const included = step.concl.find((c): c is Extract<Conclusion, { k: 'isRoom' }> => c.k === 'isRoom');
      return included ? `La clave: el recuento de ${room(clue.r)} a las ${timeSpan(clue.t)} obligaba a ${suspect(included.c)} a estar allí.` : '';
    }
    case 'objeto': {
      const carry = carryOf(step);
      if (carry) return `La clave: ${obj(carry.o)} solo podía estar en manos de ${suspect(carry.c)}.`;
      const notCarried = notCarryOf(step);
      const o = notCarried[0]?.o;
      return o !== undefined ? `La clave: ${obj(o)} solo podía estar en manos de una persona.` : '';
    }
    case 'vacia': {
      const clue = caseData.clues[step.cl[0]];
      return clue && clue.k === 'count' ? `La clave: ${room(clue.r)} estaba vacía a las ${timeSpan(clue.t)} y cortaba el paso.` : '';
    }
    case 'callejon': {
      const notCulprit = step.concl.find((c): c is Extract<Conclusion, { k: 'notCulprit' }> => c.k === 'notCulprit');
      return notCulprit ? `La clave: suponer que fue ${suspect(notCulprit.c)} llevaba a una contradicción.` : 'La clave: una hipótesis llevaba a una contradicción.';
    }
    default:
      return '';
  }
}

export interface StepFocus {
  rooms: Room[];
  hour: Hour | null;
  suspects: Sus[];
}

/** Dónde y sobre quién resaltar en el plano para un paso (pista del inspector, §15.1),
 * a partir solo de sus conclusiones: no hace falta un interruptor por regla porque
 * `Conclusion` ya dice de qué sala/hora/sospechoso se trata en cada caso. */
export function stepFocus(step: Step, caseData: CaseDef): StepFocus {
  const rooms = new Set<Room>();
  const suspects = new Set<Sus>();
  let hour: Hour | null = null;
  for (const c of step.concl) {
    switch (c.k) {
      case 'notRoom':
      case 'isRoom':
        rooms.add(c.r);
        suspects.add(c.c);
        hour = c.t;
        break;
      case 'notCarry':
      case 'carry':
        suspects.add(c.c);
        break;
      case 'notCulprit':
      case 'culprit':
        suspects.add(c.c);
        rooms.add(caseData.rv);
        hour = caseData.td;
        break;
    }
  }
  return { rooms: [...rooms], hour, suspects: [...suspects] };
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

/** El empujón (fase 1, §15.1/Apéndice C): "Fíjate en {pistas} y en {sospechoso o sala} a
 * las {hora}." Nunca da la conclusión, solo apunta dónde mirar. */
export function hintPush(step: Step, caseData: CaseDef, ctx: ClueTextContext): string {
  const suspect = (s: Sus): string => who(ctx.suspects[s]);
  const focus = stepFocus(step, caseData);
  const pistaPart = step.cl.length ? `${pistaRef(step.cl)} y en ` : '';
  const names = focus.suspects.map(suspect);
  const whoText = names.length ? joinNames(names) : null;
  if (focus.hour !== null && whoText) {
    return `Fíjate en ${pistaPart}dónde podía estar ${whoText} a las ${timeSpan(focus.hour)}.`;
  }
  if (whoText) {
    return `Fíjate en ${pistaPart}qué llevaba ${whoText}.`;
  }
  return `Fíjate en ${pistaPart}las pistas ya reveladas.`;
}
