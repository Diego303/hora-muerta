// Estado de un intento de incendio: el reloj, las fotos, los errores y si ya ha
// terminado. Lo comparten el tablero (bloqueos, pistas) y la interfaz del modo.
// Lo que arde se sigue deduciendo del tiempo consumido (timeline.ts).
import type { MapDef } from '../../engine/types';
import { FIRE_PHOTOS } from './config';
import { createFireRun, type FireRun } from './session';
import { clueState, type ClueFire } from './timeline';
import type { FireCase } from './types';

export interface FirePlay {
  readonly fire: FireCase;
  readonly map: MapDef;
  readonly run: FireRun;
  readonly saved: Set<number>;
  photosLeft: number;
  wrongAccusations: number;
  /** El derrumbe se ha procesado: el tablero queda congelado. */
  collapsed: boolean;
  /** Resuelto: el reloj se detiene. */
  solved: boolean;
  clueState(i: number): ClueFire;
  /** Segundos hasta que arde la pista, o null si no arde (salvada). */
  clueSecondsLeft(i: number): number | null;
}

export function createFirePlay(fire: FireCase, map: MapDef, now: () => number): FirePlay {
  const run = createFireRun(fire.fire.ign, now);
  const saved = new Set<number>();
  return {
    fire,
    map,
    run,
    saved,
    photosLeft: FIRE_PHOTOS,
    wrongAccusations: 0,
    collapsed: false,
    solved: false,
    clueState: (i) => clueState(fire.fire.burnAt[i], run.consumed(), saved.has(i)),
    clueSecondsLeft: (i) => (saved.has(i) ? null : fire.fire.burnAt[i] - run.consumed()),
  };
}
