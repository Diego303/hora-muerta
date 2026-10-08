// Contenido fijo del calentamiento: la "Casa de prácticas" (un plano solo de
// ejercicios, decisión D2), el reparto y los objetos. Todo tal cual en el prototipo.
import { CHIP_COLORS, type ObjectDef } from '../../engine/content/cast';
import { MANSION } from '../../engine/content/maps';
import type { FloorPlan } from '../../engine/types';
import type { GymMapId, GymName, GymObject, Tech } from './types';

/** Casa de 5 salas de la Academia: pequeña para que los ejercicios se lean de un vistazo. */
export const PRACTICE_PLAN: FloorPlan = {
  id: 'practica',
  name: 'Casa de prácticas',
  unit: 'sala',
  w: 9,
  h: 6,
  features: [
    { id: 'chim', icon: 'fire', txt: 'con chimenea', neg: 'sin chimenea', label: 'Chimenea' },
    { id: 'vent', icon: 'window', txt: 'con ventana', neg: 'sin ventana', label: 'Ventana' },
  ],
  rooms: [
    { id: 'bib', name: 'Biblioteca', art: 'la', x: 0, y: 0, w: 3, h: 3, f: ['chim'] },
    { id: 'sal', name: 'Salón', art: 'el', x: 3, y: 0, w: 3, h: 3, f: ['chim', 'vent'] },
    { id: 'coc', name: 'Cocina', art: 'la', x: 6, y: 0, w: 3, h: 3, f: ['vent'] },
    { id: 'ves', name: 'Vestíbulo', art: 'el', x: 0, y: 3, w: 5, h: 3, f: [] },
    { id: 'inv', name: 'Invernadero', art: 'el', x: 5, y: 3, w: 4, h: 3, f: ['vent'] },
  ],
  edges: [
    ['bib', 'sal'],
    ['sal', 'coc'],
    ['bib', 'ves'],
    ['sal', 'ves'],
    ['coc', 'inv'],
    ['ves', 'inv'],
  ],
};

/** Plano vacío de una sala, para los ejercicios de solo tabla (sin plano que enseñar). */
export const NO_PLAN: FloorPlan = {
  id: 'ninguno',
  name: '—',
  unit: 'sala',
  w: 1,
  h: 1,
  features: PRACTICE_PLAN.features,
  rooms: [{ id: 'x', name: '—', art: '', x: 0, y: 0, w: 1, h: 1, f: [] }],
  edges: [],
};

export const GYM_PLANS: Record<GymMapId, FloorPlan> = { practica: PRACTICE_PLAN, mansion: MANSION };

/** Cada persona con su papel y su color fijo, sea cual sea su posición en el ejercicio. */
export const GYM_CAST: Record<GymName, { role: string; color: string }> = {
  Bruno: { role: 'el sobrino', color: CHIP_COLORS[0] },
  Celia: { role: 'la pianista', color: CHIP_COLORS[1] },
  Dora: { role: 'la cocinera', color: CHIP_COLORS[2] },
  Elías: { role: 'el notario', color: CHIP_COLORS[3] },
};

export const GYM_OBJECTS: Record<GymObject, ObjectDef> = {
  candelabro: { article: 'el', name: 'candelabro', label: 'Candelabro' },
  cuerda: { article: 'la', name: 'cuerda', label: 'Cuerda' },
  abrecartas: { article: 'el', name: 'abrecartas', label: 'Abrecartas' },
  veneno: { article: 'el', name: 'frasco de veneno', label: 'Veneno' },
};

export const TECHS: Record<Tech, { name: string; desc: string }> = {
  alcance: { name: 'Contar puertas', desc: 'Dónde pudo estar alguien una hora antes o después.' },
  seguro: { name: 'Seguro o solo posible', desc: 'Distinguir lo demostrado de lo que solo puede ser.' },
  tabla: { name: 'La tabla de objetos', desc: 'Cruzar objetos con personas y lugares hasta que solo quede uno.' },
  remate: { name: 'Remates con dos', desc: 'Desempatar cuando quedan dos sospechosos o dos objetos.' },
};
