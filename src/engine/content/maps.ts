import type { MapDef } from '../types';

// Apéndice A del diseño técnico. Rejilla de 12 × 9; cada sala es un rectángulo
// alineado a la rejilla, mínimo 3 de ancho y 2 de alto. La geometría de los 6
// mapas se valida en tests/engine/maps.test.ts (sin solapes, puertas sobre
// pared compartida salvo la pasarela del tren, grafos conexos).

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

export const TREN: MapDef = {
  id: 'tren',
  name: 'Expreso Boreal',
  place: 'el tren',
  unit: 'vagón',
  w: 12,
  h: 9,
  unlock: 'start',
  intro: 'Tren nocturno sin paradas hasta el amanecer. Las puertas exteriores van cerradas con llave.',
  features: [
    { id: 'lit', icon: 'bed', txt: 'con literas', neg: 'sin literas', label: 'Literas' },
    { id: 'vtn', icon: 'window', txt: 'con la ventanilla abierta', neg: 'con las ventanillas cerradas', label: 'Ventanilla abierta' },
  ],
  rooms: [
    { id: 'mir', name: 'Mirador', art: 'el', x: 0, y: 0, w: 3, h: 4, f: ['vtn'] },
    { id: 'bar', name: 'Vagón bar', art: 'el', x: 3, y: 0, w: 3, h: 4, f: [] },
    { id: 'res', name: 'Restaurante', art: 'el', x: 6, y: 0, w: 3, h: 4, f: ['vtn'] },
    { id: 'coc', name: 'Cocina', art: 'la', x: 9, y: 0, w: 3, h: 4, f: [] },
    { id: 'cma', name: 'Coche A', art: 'el', x: 9, y: 5, w: 3, h: 4, f: ['lit'] },
    { id: 'cmb', name: 'Coche B', art: 'el', x: 6, y: 5, w: 3, h: 4, f: ['lit', 'vtn'] },
    { id: 'equ', name: 'Furgón', art: 'el', x: 3, y: 5, w: 3, h: 4, f: [] },
    { id: 'cmc', name: 'Coche C', art: 'el', x: 0, y: 5, w: 3, h: 4, f: ['lit'] },
  ],
  // coc–cma cruza el hueco de 1 unidad entre vagones (la pasarela, §17.4): no comparten pared.
  edges: [
    ['mir', 'bar'],
    ['bar', 'res'],
    ['res', 'coc'],
    ['coc', 'cma'],
    ['cma', 'cmb'],
    ['cmb', 'equ'],
    ['equ', 'cmc'],
  ],
};

export const MUSEO: MapDef = {
  id: 'museo',
  name: 'Museo Aldana',
  place: 'el museo',
  unit: 'sala',
  w: 12,
  h: 9,
  unlock: 'start',
  intro: 'Gala privada a puerta cerrada. El museo se clausuró a las nueve y nadie salió.',
  features: [
    { id: 'vit', icon: 'case', txt: 'con vitrinas', neg: 'sin vitrinas', label: 'Vitrinas' },
    { id: 'cla', icon: 'sky', txt: 'con claraboya', neg: 'sin claraboya', label: 'Claraboya' },
  ],
  rooms: [
    { id: 'egi', name: 'Sala Egipcia', art: 'la', x: 0, y: 0, w: 4, h: 3, f: ['vit'] },
    { id: 'nor', name: 'Galería Norte', art: 'la', x: 4, y: 0, w: 4, h: 3, f: ['cla'] },
    { id: 'map', name: 'Sala de Mapas', art: 'la', x: 8, y: 0, w: 4, h: 3, f: ['vit'] },
    { id: 'pin', name: 'Pinacoteca', art: 'la', x: 0, y: 3, w: 4, h: 3, f: ['cla'] },
    { id: 'pat', name: 'Patio', art: 'el', x: 4, y: 3, w: 4, h: 3, f: ['cla'] },
    { id: 'esc', name: 'Sala de Esculturas', art: 'la', x: 8, y: 3, w: 4, h: 3, f: ['vit', 'cla'] },
    { id: 'rec', name: 'Recepción', art: 'la', x: 0, y: 6, w: 4, h: 3, f: [] },
    { id: 'tie', name: 'Tienda', art: 'la', x: 4, y: 6, w: 4, h: 3, f: ['vit'] },
    { id: 'arc', name: 'Archivo', art: 'el', x: 8, y: 6, w: 4, h: 3, f: [] },
  ],
  edges: [
    ['egi', 'nor'],
    ['nor', 'map'],
    ['map', 'esc'],
    ['esc', 'arc'],
    ['arc', 'tie'],
    ['tie', 'rec'],
    ['rec', 'pin'],
    ['pin', 'egi'],
    ['pat', 'nor'],
    ['pat', 'tie'],
  ],
};

export const HOTEL: MapDef = {
  id: 'hotel',
  name: 'Hotel Miramar',
  place: 'el hotel',
  unit: 'sala',
  w: 12,
  h: 9,
  unlock: 'detective',
  intro: 'Noche de temporal en el hotel. El ascensor está averiado: entre plantas solo queda la escalera.',
  features: [
    { id: 'bal', icon: 'balcony', txt: 'con balcón', neg: 'sin balcón', label: 'Balcón' },
    { id: 'chim', icon: 'fire', txt: 'con chimenea', neg: 'sin chimenea', label: 'Chimenea' },
  ],
  rooms: [
    { id: 'h101', name: 'Habitación 101', art: 'la', x: 0, y: 0, w: 3, h: 3, f: ['bal'] },
    { id: 'h102', name: 'Habitación 102', art: 'la', x: 3, y: 0, w: 3, h: 3, f: ['bal'] },
    { id: 'h103', name: 'Habitación 103', art: 'la', x: 6, y: 0, w: 3, h: 3, f: ['chim'] },
    { id: 'rel', name: 'Rellano', art: 'el', x: 0, y: 3, w: 9, h: 2, f: [] },
    { id: 'esc', name: 'Escalera', art: 'la', x: 9, y: 0, w: 3, h: 5, f: [] },
    { id: 'rec', name: 'Recepción', art: 'la', x: 8, y: 5, w: 4, h: 4, f: ['chim'] },
    { id: 'bar', name: 'Bar', art: 'el', x: 4, y: 5, w: 4, h: 4, f: [] },
    { id: 'te', name: 'Salón de té', art: 'el', x: 0, y: 5, w: 4, h: 4, f: ['chim'] },
  ],
  edges: [
    ['h101', 'rel'],
    ['h102', 'rel'],
    ['h103', 'rel'],
    ['rel', 'esc'],
    ['esc', 'rec'],
    ['rec', 'bar'],
    ['bar', 'te'],
  ],
};

export const BARCO: MapDef = {
  id: 'barco',
  name: 'Transatlántico Aurora',
  place: 'el barco',
  unit: 'sala',
  w: 12,
  h: 9,
  unlock: 'inspector',
  intro: 'Travesía nocturna del Aurora. Dos escaleras, a proa y a popa, unen las cubiertas.',
  features: [
    { id: 'int', icon: 'wave', txt: 'a la intemperie', neg: 'a cubierto', label: 'Intemperie' },
    { id: 'oj', icon: 'porthole', txt: 'con ojos de buey', neg: 'sin ojos de buey', label: 'Ojos de buey' },
  ],
  rooms: [
    { id: 'pue', name: 'Puente de mando', art: 'el', x: 0, y: 0, w: 4, h: 3, f: ['int'] },
    { id: 'pas', name: 'Cubierta de paseo', art: 'la', x: 4, y: 0, w: 5, h: 3, f: ['int'] },
    { id: 'bib', name: 'Biblioteca', art: 'la', x: 9, y: 0, w: 3, h: 3, f: ['oj'] },
    { id: 'epr', name: 'Proa', art: 'la', x: 0, y: 3, w: 3, h: 3, f: [] },
    { id: 'com', name: 'Gran comedor', art: 'el', x: 3, y: 3, w: 6, h: 3, f: ['oj'] },
    { id: 'epo', name: 'Popa', art: 'la', x: 9, y: 3, w: 3, h: 3, f: [] },
    { id: 'cam', name: 'Camarotes', art: 'los', x: 0, y: 6, w: 5, h: 3, f: ['oj'] },
    { id: 'maq', name: 'Sala de máquinas', art: 'la', x: 5, y: 6, w: 4, h: 3, f: [] },
    { id: 'bod', name: 'Bodega', art: 'la', x: 9, y: 6, w: 3, h: 3, f: [] },
  ],
  // "Proa" y "Popa" son las escaleras entre cubiertas; con unit "sala" se nombran como tales.
  edges: [
    ['pue', 'pas'],
    ['pas', 'bib'],
    ['pue', 'epr'],
    ['bib', 'epo'],
    ['epr', 'com'],
    ['com', 'epo'],
    ['epr', 'cam'],
    ['epo', 'bod'],
    ['cam', 'maq'],
    ['maq', 'bod'],
  ],
};

export const TEATRO: MapDef = {
  id: 'teatro',
  name: 'Teatro Lírico',
  place: 'el teatro',
  unit: 'sala',
  w: 12,
  h: 9,
  unlock: 'inspector_jefe',
  intro: 'Noche de estreno en el Teatro Lírico. Las puertas se cerraron al subir el telón.',
  features: [
    { id: 'vis', icon: 'stage', txt: 'con vista al escenario', neg: 'sin vista al escenario', label: 'Vista al escenario' },
    { id: 'esp', icon: 'mirror', txt: 'con espejos', neg: 'sin espejos', label: 'Espejos' },
  ],
  rooms: [
    { id: 'tra', name: 'Tramoya', art: 'la', x: 0, y: 0, w: 3, h: 4, f: ['vis'] },
    { id: 'esc', name: 'Escenario', art: 'el', x: 3, y: 0, w: 6, h: 3, f: [] },
    { id: 'alm', name: 'Almacén', art: 'el', x: 9, y: 0, w: 3, h: 4, f: [] },
    { id: 'pla', name: 'Platea', art: 'la', x: 3, y: 3, w: 6, h: 3, f: ['vis'] },
    { id: 'cam', name: 'Camerinos', art: 'los', x: 0, y: 4, w: 3, h: 5, f: ['esp'] },
    { id: 'foy', name: 'Foyer', art: 'el', x: 3, y: 6, w: 6, h: 3, f: ['esp'] },
    { id: 'pal', name: 'Palco', art: 'el', x: 9, y: 4, w: 3, h: 2, f: ['vis'] },
    { id: 'amb', name: 'Ambigú', art: 'el', x: 9, y: 6, w: 3, h: 3, f: ['esp'] },
  ],
  // Almacén y Palco son callejones sin salida: una sola puerta cada uno.
  edges: [
    ['tra', 'esc'],
    ['esc', 'alm'],
    ['esc', 'pla'],
    ['tra', 'cam'],
    ['cam', 'foy'],
    ['pla', 'foy'],
    ['foy', 'amb'],
    ['amb', 'pal'],
  ],
};

export const MAPS: MapDef[] = [MANSION, TREN, MUSEO, HOTEL, BARCO, TEATRO];
