// Contenido fijo del diseño (§4.2, §4.3). No se inventa contenido fuera de estas listas.

export interface CastMember {
  name: string;
  role: string;
}

/** Reparto completo, ya en orden alfabético (las 18 iniciales son distintas). */
export const CAST: CastMember[] = [
  { name: 'Adela', role: 'el ama de llaves' },
  { name: 'Bruno', role: 'el sobrino' },
  { name: 'Celia', role: 'la pianista' },
  { name: 'Darío', role: 'el chófer' },
  { name: 'Elena', role: 'la doctora' },
  { name: 'Fausto', role: 'el notario' },
  { name: 'Greta', role: 'la fotógrafa' },
  { name: 'Hugo', role: 'el jardinero' },
  { name: 'Irene', role: 'la heredera' },
  { name: 'Julián', role: 'el coronel' },
  { name: 'Lola', role: 'la periodista' },
  { name: 'Mateo', role: 'el cocinero' },
  { name: 'Nuria', role: 'la restauradora' },
  { name: 'Octavio', role: 'el marchante' },
  { name: 'Paula', role: 'la secretaria' },
  { name: 'Rómulo', role: 'el mayordomo' },
  { name: 'Sara', role: 'la botánica' },
  { name: 'Tomás', role: 'el socio' },
];

/**
 * Colores de ficha, en orden de asignación. Se asignan por posición dentro del
 * reparto de UN caso concreto, una vez ordenado alfabéticamente (§4.2), no por
 * posición dentro de CAST. El color nunca es la única señal: la ficha siempre
 * lleva la inicial.
 */
export const CHIP_COLORS = ['#1f9e8c', '#d99a1c', '#8b5cd6', '#d6457a', '#4f9f2f', '#3d7ddc'] as const;

/** Víctimas (§4.3). */
export const VICTIMS: string[] = [
  'Don Aurelio Valdemar',
  'La condesa Brígida',
  'El doctor Anselmo Ferrer',
  'Madame Solange',
  'El profesor Ibarra',
  'Doña Leonor Quintana',
  'El señor Casimiro Roel',
  'La baronesa Amparo Leal',
  'El capitán Ulises Mora',
  'Doña Fermina Castro',
  'El maestro Gaspar Vidal',
  'Lady Margaret Hale',
];

export interface ObjectDef {
  /** Artículo que precede al nombre en los textos ("no llevaba la cuerda"). */
  article: string;
  name: string;
  /** Etiqueta corta para la tabla de objetos. */
  label: string;
}

/** Objetos (§4.3); el arma es siempre el objeto del culpable. */
export const OBJECTS: ObjectDef[] = [
  { article: 'el', name: 'candelabro', label: 'Candelabro' },
  { article: 'la', name: 'cuerda', label: 'Cuerda' },
  { article: 'el', name: 'abrecartas', label: 'Abrecartas' },
  { article: 'el', name: 'frasco de veneno', label: 'Veneno' },
  { article: 'la', name: 'llave inglesa', label: 'Llave inglesa' },
  { article: 'el', name: 'bastón', label: 'Bastón' },
  { article: 'las', name: 'tijeras de podar', label: 'Tijeras' },
  { article: 'el', name: 'pisapapeles', label: 'Pisapapeles' },
  { article: 'el', name: 'atizador', label: 'Atizador' },
  { article: 'la', name: 'estatuilla', label: 'Estatuilla' },
];

/** Motivos (§4.3): solo para la frase de cierre, nunca se deducen. */
export const MOTIVES: string[] = [
  'una herencia que no iba a llegar',
  'una deuda de juego',
  'un chantaje que duraba años',
  'celos',
  'un testamento recién cambiado',
  'un secreto de familia',
  'una sociedad a punto de romperse',
  'una carta que nunca debió leerse',
  'una promesa rota',
  'un cuadro falsificado',
  'una venganza antigua',
  'una estafa descubierta',
];
