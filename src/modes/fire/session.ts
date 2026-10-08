// Reloj del Modo Incendio (docs/MODOS.md 2.2 y 2.3): el tiempo consumido se
// detiene si la pestaña queda oculta, las penalizaciones se suman y, al llegar a
// 300 s, el edificio se derrumba. Lo que arde se deduce de ese tiempo (timeline.ts):
// este módulo no guarda nada del fuego, solo cuánto se ha consumido.
import type { Room } from '../../engine/types';
import { FIRE_PENALTY_S, FIRE_TOTAL_S } from './config';
import { roomState, type RoomFire } from './timeline';

export interface FireClock {
  /** Milisegundos consumidos hasta ahora, sin contar el tramo que corre. */
  consumedMs: number;
  /** Instante (ms del reloj) desde el que corre, o null si está parado. */
  runningSince: number | null;
}

export function startClock(now: number): FireClock {
  return { consumedMs: 0, runningSince: now };
}

/** Segundos consumidos en el instante `now`. */
export function consumedAt(clock: FireClock, now: number): number {
  const running = clock.runningSince === null ? 0 : now - clock.runningSince;
  return (clock.consumedMs + running) / 1000;
}

export function pauseClock(clock: FireClock, now: number): FireClock {
  if (clock.runningSince === null) return clock;
  return { consumedMs: clock.consumedMs + (now - clock.runningSince), runningSince: null };
}

export function resumeClock(clock: FireClock, now: number): FireClock {
  if (clock.runningSince !== null) return clock;
  return { consumedMs: clock.consumedMs, runningSince: now };
}

export function addPenalty(clock: FireClock, seconds: number): FireClock {
  return { ...clock, consumedMs: clock.consumedMs + seconds * 1000 };
}

export function collapsedAt(clock: FireClock, now: number): boolean {
  return consumedAt(clock, now) >= FIRE_TOTAL_S;
}

export interface FireRun {
  /** Segundos consumidos ahora. */
  consumed(): number;
  /** Segundos que quedan, sin bajar de cero. */
  remaining(): number;
  paused(): boolean;
  collapsed(): boolean;
  pause(): void;
  resume(): void;
  penalize(): void;
  roomState(room: Room): RoomFire;
  roomBurning(room: Room): boolean;
}

/** Un intento de caso de incendio: el reloj con su `now` inyectado y los tiempos de fuego. */
export function createFireRun(ign: readonly number[], now: () => number): FireRun {
  let clock = startClock(now());
  const consumed = (): number => consumedAt(clock, now());
  return {
    consumed,
    remaining: () => Math.max(0, FIRE_TOTAL_S - consumed()),
    paused: () => clock.runningSince === null,
    collapsed: () => collapsedAt(clock, now()),
    pause() {
      clock = pauseClock(clock, now());
    },
    resume() {
      clock = resumeClock(clock, now());
    },
    penalize() {
      clock = addPenalty(clock, FIRE_PENALTY_S);
    },
    roomState: (room) => roomState(ign, room, consumed()),
    roomBurning: (room) => roomState(ign, room, consumed()) === 'burning',
  };
}
