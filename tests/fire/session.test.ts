import { describe, expect, it } from 'vitest';
import { FIRE_PENALTY_S } from '../../src/modes/fire/config';
import {
  addPenalty,
  collapsedAt,
  consumedAt,
  createFireRun,
  pauseClock,
  resumeClock,
  startClock,
} from '../../src/modes/fire/session';

describe('reloj del incendio: cuenta hacia atrás y se detiene al ocultarse', () => {
  it('consume tiempo mientras corre', () => {
    const clock = startClock(1_000);
    expect(consumedAt(clock, 1_000)).toBe(0);
    expect(consumedAt(clock, 4_500)).toBe(3.5);
  });

  it('una pausa no consume tiempo, y reanudar sigue desde ahí', () => {
    let clock = startClock(0);
    clock = pauseClock(clock, 10_000);
    expect(consumedAt(clock, 60_000)).toBe(10);
    clock = resumeClock(clock, 60_000);
    expect(consumedAt(clock, 65_000)).toBe(15);
  });

  it('pausar dos veces o reanudar algo que ya corre no cambia nada', () => {
    const running = startClock(0);
    expect(resumeClock(running, 5_000)).toBe(running);
    const paused = pauseClock(running, 2_000);
    expect(pauseClock(paused, 9_000)).toBe(paused);
  });

  it('una penalización suma segundos al tiempo consumido', () => {
    const clock = addPenalty(startClock(0), FIRE_PENALTY_S);
    expect(FIRE_PENALTY_S).toBe(30);
    expect(consumedAt(clock, 5_000)).toBe(35);
  });
});

describe('derrumbe: a los 300 s consumidos, o antes si una penalización lo lleva ahí', () => {
  it('no se derrumba antes de 300 s', () => {
    const clock = startClock(0);
    expect(collapsedAt(clock, 299_999)).toBe(false);
    expect(collapsedAt(clock, 300_000)).toBe(true);
  });

  it('una penalización que deja el reloj por debajo de cero se derrumba al momento', () => {
    const clock = addPenalty(startClock(0), 300);
    expect(collapsedAt(clock, 0)).toBe(true);
  });
});

describe('createFireRun: el reloj con su tiempo inyectado', () => {
  it('queda y consume al ritmo del reloj', () => {
    let now = 0;
    const run = createFireRun([45], () => now);
    now = 10_000;
    expect(run.consumed()).toBe(10);
    expect(run.remaining()).toBe(290);
  });

  it('en pausa no consume, y reanudar retoma', () => {
    let now = 0;
    const run = createFireRun([45], () => now);
    now = 5_000;
    run.pause();
    now = 60_000;
    expect(run.paused()).toBe(true);
    expect(run.consumed()).toBe(5);
    run.resume();
    now = 62_000;
    expect(run.consumed()).toBe(7);
  });

  it('la penalización de 30 s se suma y puede llevar al derrumbe', () => {
    let now = 0;
    const run = createFireRun([45], () => now);
    now = 280_000;
    expect(run.collapsed()).toBe(false);
    run.penalize();
    expect(run.collapsed()).toBe(true);
    expect(run.remaining()).toBe(0);
  });

  it('roomState y roomBurning salen del tiempo consumido, no de un estado acumulado', () => {
    let now = 0;
    const run = createFireRun([45, 240], () => now);
    expect(run.roomState(0)).toBe('cold');
    expect(run.roomBurning(0)).toBe(false);
    now = 45_000;
    expect(run.roomBurning(0)).toBe(true);
    expect(run.roomBurning(1)).toBe(false);
    now = 0;
    expect(run.roomBurning(0)).toBe(false);
  });
});
