// Adaptación del calentamiento (docs/MODOS.md 3.6) con historiales sintéticos.
import { describe, expect, it } from 'vitest';
import {
  dueReviews,
  HIST_SIZE,
  isFirstTime,
  SESSIONS_KEPT,
  techOfDay,
  withAnswer,
  withReview,
  withSession,
  withStreak,
  type Level,
} from '../../src/modes/gym/adapt';
import { emptyProgress, techProgress, type GymProgress } from '../../src/modes/gym/progress';
import type { Tech } from '../../src/modes/gym/types';

/** Aplica una ristra de resultados ('1' acierto, '0' fallo) a una técnica. */
function play(p: GymProgress, tech: Tech, results: string): { progress: GymProgress; changes: [Level, Level][] } {
  const changes: [Level, Level][] = [];
  for (const r of results) {
    const next = withAnswer(p, tech, r === '1');
    p = next.progress;
    if (next.levelChange) changes.push(next.levelChange);
  }
  return { progress: p, changes };
}

/** Progreso con un acierto reciente concreto por técnica (20 respuestas de cada una). */
function withRates(rates: Partial<Record<Tech, number>>): GymProgress {
  let p = emptyProgress();
  for (const [tech, rate] of Object.entries(rates) as [Tech, number][]) {
    const ok = Math.round(rate * HIST_SIZE);
    const hist = Array.from({ length: HIST_SIZE }, (_, i) => (i < ok ? 1 : 0) as 0 | 1);
    p = { ...p, tech: { ...p.tech, [tech]: { level: 1, hist, ok, n: HIST_SIZE, atLevel: 5 } } };
  }
  return p;
}

const session = (date: string, tech: Tech) => ({ date, score: 10, n: 13, tech });

describe('niveles por técnica', () => {
  it('sube con 8 de los últimos 10 del nivel actual', () => {
    const { progress, changes } = play(emptyProgress(), 'alcance', '1111111100');
    expect(changes).toEqual([[1, 2]]);
    expect(techProgress(progress, 'alcance')).toMatchObject({ level: 2, atLevel: 0, n: 10, ok: 8 });
  });

  it('con 7 de 10 no cambia; sigue contando en ventana deslizante', () => {
    const seven = play(emptyProgress(), 'alcance', '0111011011');
    expect(seven.changes).toEqual([]);
    expect(techProgress(seven.progress, 'alcance').level).toBe(1);
    // Un acierto más deja 8 de los últimos 10.
    expect(play(seven.progress, 'alcance', '1').changes).toEqual([[1, 2]]);
  });

  it('al subir, los aciertos del nivel anterior ya no cuentan para el siguiente salto', () => {
    const up = play(emptyProgress(), 'tabla', '1111111111').progress;
    expect(techProgress(up, 'tabla').level).toBe(2);
    const nine = play(up, 'tabla', '111111111');
    expect(nine.changes).toEqual([]);
    expect(play(nine.progress, 'tabla', '1').changes).toEqual([[2, 3]]);
  });

  it('baja con 4 o menos de los últimos 10 y nunca de 1 ni por encima de 3', () => {
    let p = play(emptyProgress(), 'seguro', '1111111111').progress;
    p = play(p, 'seguro', '1111111111').progress;
    expect(techProgress(p, 'seguro').level).toBe(3);
    expect(play(p, 'seguro', '1111111111').changes).toEqual([]);
    const down = play(p, 'seguro', '0000110100');
    expect(down.changes).toEqual([[3, 2]]);
    expect(play(emptyProgress(), 'seguro', '0000000000').changes).toEqual([]);
  });

  it('con 5 de 10 se queda donde está', () => {
    const p = play(emptyProgress(), 'tabla', '1111111111').progress;
    expect(play(p, 'tabla', '1010101010').changes).toEqual([]);
  });

  it('guarda solo los últimos 20 resultados, pero cuenta todos', () => {
    const { progress } = play(emptyProgress(), 'remate', '10'.repeat(15));
    const t = techProgress(progress, 'remate');
    expect(t.hist).toHaveLength(HIST_SIZE);
    expect(t.n).toBe(30);
    expect(t.ok).toBe(15);
  });
});

describe('técnica del día', () => {
  it('primero las que no se han practicado, en orden: seguro, tabla, alcance', () => {
    expect(techOfDay(emptyProgress(), '2026-10-08')).toEqual({ tech: 'seguro', why: 'Todavía no la has practicado.' });
    expect(techOfDay(withRates({ seguro: 1 }), '2026-10-08').tech).toBe('tabla');
    expect(techOfDay(withRates({ seguro: 1, tabla: 1 }), '2026-10-08').tech).toBe('alcance');
  });

  it('con todas practicadas, la de menor acierto en sus últimos 20', () => {
    const p = withRates({ seguro: 0.9, tabla: 0.5, alcance: 0.7 });
    expect(techOfDay(p, '2026-10-08')).toEqual({ tech: 'tabla', why: 'Es tu técnica con menos aciertos (50 %).' });
  });

  it('no repite la del día anterior si la siguiente está a 15 puntos o menos', () => {
    const p = { ...withRates({ seguro: 0.9, tabla: 0.5, alcance: 0.65 }), sessions: [session('2026-10-07', 'tabla')] };
    expect(techOfDay(p, '2026-10-08').tech).toBe('alcance');
  });

  it('sí la repite si está más de 15 puntos por debajo de la siguiente', () => {
    const p = { ...withRates({ seguro: 0.9, tabla: 0.5, alcance: 0.7 }), sessions: [session('2026-10-07', 'tabla')] };
    expect(techOfDay(p, '2026-10-08').tech).toBe('tabla');
  });

  it('una sesión de hoy no cuenta como "día anterior"; una de remates tampoco', () => {
    const rates = withRates({ seguro: 0.9, tabla: 0.5, alcance: 0.6 });
    expect(techOfDay({ ...rates, sessions: [session('2026-10-08', 'tabla')] }, '2026-10-08').tech).toBe('tabla');
    const withRemates = { ...rates, sessions: [session('2026-10-06', 'tabla'), session('2026-10-07', 'remate')] };
    expect(techOfDay(withRemates, '2026-10-08').tech).toBe('alcance');
  });
});

describe('repaso de fallados', () => {
  it('un fallo vuelve 3 sesiones después; un acierto lo saca', () => {
    let p = withReview(emptyProgress(), 't2c', false);
    for (let i = 0; i < 2; i++) {
      p = withSession(p, session(`2026-10-0${i + 1}`, 'seguro'));
      expect(dueReviews(p)).toEqual([]);
    }
    p = withSession(p, session('2026-10-03', 'seguro'));
    expect(dueReviews(p)).toEqual(['t2c']);
    p = withReview(p, 't2c', true);
    expect(p.review).toEqual([]);
  });

  it('volver a fallarlo lo aplaza otra vez, sin duplicarlo', () => {
    let p = withReview(emptyProgress(), 'r1', false);
    p = withSession(p, session('2026-10-01', 'tabla'));
    p = withReview(p, 'r1', false);
    expect(p.review).toEqual([{ id: 'r1', due: 4 }]);
  });

  it('las sesiones se siguen contando aunque solo se guarden las 30 últimas', () => {
    let p = emptyProgress();
    for (let i = 0; i < 40; i++) p = withSession(p, session('2026-10-01', 'tabla'));
    expect(p.sessions).toHaveLength(SESSIONS_KEPT);
    expect(p.done).toBe(40);
    p = withReview(p, 'a1', false);
    for (let i = 0; i < 3; i++) p = withSession(p, session('2026-10-01', 'tabla'));
    expect(dueReviews(p)).toEqual(['a1']);
  });
});

describe('racha', () => {
  it('sigue si el último día fue ayer, se queda igual el mismo día y vuelve a 1 tras un hueco', () => {
    let p = withStreak(emptyProgress(), '2026-10-01');
    expect(p.streak).toEqual({ last: '2026-10-01', count: 1, best: 1 });
    p = withStreak(p, '2026-10-01');
    expect(p.streak.count).toBe(1);
    p = withStreak(withStreak(p, '2026-10-02'), '2026-10-03');
    expect(p.streak).toEqual({ last: '2026-10-03', count: 3, best: 3 });
    p = withStreak(p, '2026-10-05');
    expect(p.streak).toEqual({ last: '2026-10-05', count: 1, best: 3 });
  });

  it('cruza fin de mes y de año', () => {
    const p = withStreak(withStreak(emptyProgress(), '2026-12-31'), '2027-01-01');
    expect(p.streak.count).toBe(2);
  });
});

describe('primera vez', () => {
  it('es diagnóstico sin sesiones ni respuestas; deja de serlo al responder', () => {
    expect(isFirstTime(emptyProgress())).toBe(true);
    expect(isFirstTime(withAnswer(emptyProgress(), 'alcance', false).progress)).toBe(false);
  });
});
