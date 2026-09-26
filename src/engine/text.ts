// Apéndice B del diseño técnico: textos exactos de las 16 pistas. Produce cadenas
// con marcado ligero (nombres coloreados, salas en negrita, horas destacadas,
// objetos en cursiva) que la interfaz inserta tal cual; el motor no toca el DOM.
import type { ObjectDef } from './content/cast';
import type { Clue, FeatureDef, Hour, Obj, Room, RoomDef, Sus } from './types';

/** "21:00", "22:00"... (§3: solo horas en punto, 21:00 es la hora 0). */
export function timeLabel(t: Hour): string {
  const h = (21 + t) % 24;
  return `${String(h).padStart(2, '0')}:00`;
}

export interface SuspectRef {
  name: string;
  color: string;
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
