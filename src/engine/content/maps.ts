import type { MapDef } from '../types';

// Apéndice A del diseño técnico. Rejilla de 12 × 9; cada sala es un rectángulo
// alineado a la rejilla, mínimo 3 de ancho y 2 de alto.

export const MANSION: MapDef = {
  id: 'mansion',
  name: 'Casa Valdemar',
  place: 'la mansión',
  unit: 'sala',
  w: 12,
  h: 9,
  unlock: 'start',
  intro: 'Cena de aniversario en la mansión. La tormenta ha cortado el camino y nadie ha podido marcharse.',
  features: [
    { id: 'chim', icon: 'fire', txt: 'con chimenea', neg: 'sin chimenea', label: 'Chimenea' },
    { id: 'vent', icon: 'window', txt: 'con ventana', neg: 'sin ventana', label: 'Ventana' },
  ],
  rooms: [
    { id: 'bib', name: 'Biblioteca', art: 'la', x: 0, y: 0, w: 4, h: 3, f: ['chim'] },
    { id: 'est', name: 'Estudio', art: 'el', x: 4, y: 0, w: 3, h: 3, f: ['vent'] },
    { id: 'inv', name: 'Invernadero', art: 'el', x: 7, y: 0, w: 5, h: 4, f: ['vent'] },
    { id: 'sal', name: 'Salón', art: 'el', x: 0, y: 3, w: 4, h: 4, f: ['chim', 'vent'] },
    { id: 'ves', name: 'Vestíbulo', art: 'el', x: 4, y: 3, w: 3, h: 6, f: [] },
    { id: 'com', name: 'Comedor', art: 'el', x: 7, y: 4, w: 5, h: 3, f: ['chim'] },
    { id: 'bod', name: 'Bodega', art: 'la', x: 0, y: 7, w: 4, h: 2, f: [] },
    { id: 'coc', name: 'Cocina', art: 'la', x: 7, y: 7, w: 5, h: 2, f: ['vent'] },
  ],
  edges: [
    ['bib', 'est'],
    ['bib', 'sal'],
    ['est', 'ves'],
    ['est', 'inv'],
    ['inv', 'com'],
    ['sal', 'ves'],
    ['ves', 'com'],
    ['com', 'coc'],
    ['ves', 'bod'],
    ['sal', 'bod'],
  ],
};

/**
 * El Expreso Boreal, el Museo Aldana, el Hotel Miramar, el Transatlántico Aurora
 * y el Teatro Lírico se añaden en el hito M1 junto con la validación geométrica
 * de los 6 mapas (docs/PLAN.md, hito M1). De momento solo existe Casa Valdemar,
 * suficiente para portar la portada (M0).
 */
export const MAPS: MapDef[] = [MANSION];
