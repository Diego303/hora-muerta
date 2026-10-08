// Constantes del Modo Incendio (docs/MODOS.md tabla 2.2). Los tiempos viven solo
// aquí: el resto del módulo los lee y nunca los escribe a mano.

/** Tiempo total del edificio, en segundos (el reloj cuenta hacia atrás). */
export const FIRE_TOTAL_S = 300;
/** Fase de humo: nada arde todavía, pero el humo ya deja ver qué sala prenderá. */
export const FIRE_SMOKE_S = 45;
/** Segundo de ignición del foco. */
export const FIRE_IGNITION_S = 45;
/** Cada puerta que cruza el fuego tarda esto más. */
export const FIRE_STEP_S = 45;
/** Aviso previo: la sala se tiñe de naranja con cuenta atrás este tiempo antes de arder. */
export const FIRE_WARNING_S = 15;
/** La escena del crimen aguanta hasta que queda un minuto. */
export const FIRE_SCENE_MIN_S = 240;
/** Una pista que nombra sala arde esto después de que arda esa sala. */
export const FIRE_CLUE_DELAY_S = 45;
/** Una pista sin sala (rasgos, encuentros...) arde a este segundo fijo. */
export const FIRE_ROOMLESS_CLUE_S = 240;
/** Duración de la animación de quemado de una pista. */
export const FIRE_BURN_ANIM_S = 4;
/** Fotos por caso: cada una salva una pista. */
export const FIRE_PHOTOS = 2;
/** Penalización por acusación errónea, en segundos consumidos. */
export const FIRE_PENALTY_S = 30;
/** Mecha de la pista: cuenta atrás visible cuando le quedan estos segundos o menos. */
export const FIRE_CLUE_WARNING_S = 30;
/** Último minuto: el reloj late, nunca más rápido que 1 Hz (MODOS 2.6). */
export const FIRE_LAST_MINUTE_S = 60;
