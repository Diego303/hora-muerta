import { describe, expect, it } from 'vitest';
import {
  ARCHETYPE_LABELS,
  ARCHETYPE_ORDER,
  RANKS,
  computeDailyStreak,
  isMapUnlocked,
  medianTime,
  rankForStars,
  rankProgress,
  recordClosure,
  recordSeriesCompletion,
} from '../../src/game/progression';
import { DEFAULT_PROFILE } from '../../src/game/storage';
import type { CaseDef } from '../../src/engine/types';

function makeCase(overrides: Partial<CaseDef> = {}): CaseDef {
  return {
    v: 2,
    id: 'N-001',
    mode: 'novato',
    diff: 0,
    map: 'mansion',
    cast: [0, 1, 2, 3],
    objects: [0, 1, 2, 3],
    victim: 0,
    motive: 0,
    N: 4,
    T: 3,
    rv: 0,
    td: 1,
    culprit: 0,
    weapon: 0,
    truth: { rooms: [[0, 0, 0], [1, 1, 1], [2, 2, 2], [3, 3, 3]], obj: [0, 1, 2, 3] },
    clues: [],
    solve: { steps: [], key: 0, arch: ['coartada'], maxLv: 1, score: 0 },
    sig: 'test',
    ...overrides,
  };
}

describe('game/progression: rango (§16.1)', () => {
  it('rankForStars devuelve el rango más alto alcanzado por las estrellas dadas', () => {
    expect(rankForStars(0).id).toBe('agente');
    expect(rankForStars(9).id).toBe('agente');
    expect(rankForStars(10).id).toBe('cabo');
    expect(rankForStars(29).id).toBe('cabo');
    expect(rankForStars(30).id).toBe('detective');
    expect(rankForStars(74).id).toBe('detective');
    expect(rankForStars(75).id).toBe('inspector');
    expect(rankForStars(149).id).toBe('inspector');
    expect(rankForStars(150).id).toBe('inspector_jefe');
    expect(rankForStars(299).id).toBe('inspector_jefe');
    expect(rankForStars(300).id).toBe('comisario');
    expect(rankForStars(1000).id).toBe('comisario');
  });

  it('rankProgress da el siguiente rango y cuánto falta', () => {
    const p = rankProgress(5);
    expect(p.rank.id).toBe('agente');
    expect(p.next?.id).toBe('cabo');
    expect(p.starsToNext).toBe(5);
  });

  it('rankProgress con el rango máximo no tiene siguiente', () => {
    const p = rankProgress(500);
    expect(p.rank.id).toBe('comisario');
    expect(p.next).toBeNull();
    expect(p.starsToNext).toBe(0);
  });

  it('RANKS está ordenado de menos a más estrellas', () => {
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i].stars).toBeGreaterThan(RANKS[i - 1].stars);
  });
});

describe('game/progression: escenarios desbloqueados (§16.1)', () => {
  it('"start" siempre está desbloqueado', () => {
    expect(isMapUnlocked('start', 0)).toBe(true);
  });

  it('un escenario se desbloquea justo al llegar al rango, no antes', () => {
    expect(isMapUnlocked('detective', 29)).toBe(false);
    expect(isMapUnlocked('detective', 30)).toBe(true);
    expect(isMapUnlocked('inspector', 74)).toBe(false);
    expect(isMapUnlocked('inspector', 75)).toBe(true);
    expect(isMapUnlocked('inspector_jefe', 149)).toBe(false);
    expect(isMapUnlocked('inspector_jefe', 150)).toBe(true);
  });
});

describe('game/progression: archivo de arquetipos (§16.2)', () => {
  it('ARCHETYPE_LABELS y ARCHETYPE_ORDER cubren los 7 arquetipos del §10.2', () => {
    expect(ARCHETYPE_ORDER).toHaveLength(7);
    for (const a of ARCHETYPE_ORDER) expect(ARCHETYPE_LABELS[a]).toBeTruthy();
  });

  it('recordClosure suma estrellas, recuentos por nivel y detecta un arquetipo nuevo', () => {
    const { profile, newArchetypes } = recordClosure(DEFAULT_PROFILE, {
      caseData: makeCase({ diff: 0, solve: { steps: [], key: 0, arch: ['coartada'], maxLv: 1, score: 0 } }),
      stars: 3,
      errors: 0,
      elapsed: 180,
    });
    expect(profile.stars).toBe(3);
    expect(profile.rank).toBe('agente');
    expect(profile.solved).toEqual({ n: 1, i: 0, c: 0 });
    expect(profile.perfect).toEqual({ n: 1, i: 0, c: 0 });
    expect(profile.firstTry).toEqual({ n: 1, i: 0, c: 0 });
    expect(profile.times.n).toEqual([180]);
    expect(profile.arch.coartada).toBe(1);
    expect(profile.archExample.coartada).toEqual({ id: 'N-001', diff: 0, map: 'mansion' });
    expect(newArchetypes).toEqual(['coartada']);
  });

  it('un segundo caso con el mismo arquetipo no lo cuenta como nuevo otra vez', () => {
    const first = recordClosure(DEFAULT_PROFILE, {
      caseData: makeCase({ id: 'N-001' }),
      stars: 2,
      errors: 1,
      elapsed: 200,
    });
    const second = recordClosure(first.profile, {
      caseData: makeCase({ id: 'N-002' }),
      stars: 3,
      errors: 0,
      elapsed: 150,
    });
    expect(second.newArchetypes).toEqual([]);
    expect(second.profile.arch.coartada).toBe(2);
    expect(second.profile.archExample.coartada?.id).toBe('N-001'); // conserva el primer ejemplo
  });

  it('con 2 errores o alguna pista no cuenta como perfecto ni a la primera', () => {
    const { profile } = recordClosure(DEFAULT_PROFILE, {
      caseData: makeCase(),
      stars: 1,
      errors: 1,
      elapsed: 100,
    });
    expect(profile.perfect).toEqual({ n: 0, i: 0, c: 0 });
    expect(profile.firstTry).toEqual({ n: 0, i: 0, c: 0 });
    expect(profile.solved).toEqual({ n: 1, i: 0, c: 0 });
  });

  it('un caso con varios arquetipos en la cadena suma cada uno', () => {
    const { profile, newArchetypes } = recordClosure(DEFAULT_PROFILE, {
      caseData: makeCase({ solve: { steps: [], key: 0, arch: ['coartada', 'vacia'], maxLv: 1, score: 0 } }),
      stars: 3,
      errors: 0,
      elapsed: 100,
    });
    expect(profile.arch.coartada).toBe(1);
    expect(profile.arch.vacia).toBe(1);
    expect(newArchetypes.sort()).toEqual(['coartada', 'vacia']);
  });

  it('recordSeriesCompletion suma un expediente sin tocar el resto del perfil', () => {
    const profile = recordSeriesCompletion(DEFAULT_PROFILE);
    expect(profile.series).toBe(1);
    expect(profile.stars).toBe(0);
  });
});

describe('game/progression: medianTime (§16.3)', () => {
  it('sin muestras da null', () => {
    expect(medianTime([])).toBeNull();
  });

  it('con un número impar de muestras da la del medio', () => {
    expect(medianTime([300, 100, 200])).toBe(200);
  });

  it('con un número par de muestras promedia las dos del medio', () => {
    expect(medianTime([100, 200, 300, 400])).toBe(250);
  });
});

describe('game/progression: racha diaria (§16.3)', () => {
  it('sin ningún día jugado, racha 0', () => {
    expect(computeDailyStreak([], '2026-01-10')).toEqual({ current: 0, best: 0 });
  });

  it('cuenta días consecutivos terminando hoy', () => {
    const streak = computeDailyStreak(['2026-01-08', '2026-01-09', '2026-01-10'], '2026-01-10');
    expect(streak.current).toBe(3);
  });

  it('si hoy todavía no se ha jugado, la racha de ayer sigue viva', () => {
    const streak = computeDailyStreak(['2026-01-08', '2026-01-09'], '2026-01-10');
    expect(streak.current).toBe(2);
  });

  it('un hueco corta la racha actual', () => {
    const streak = computeDailyStreak(['2026-01-05', '2026-01-09', '2026-01-10'], '2026-01-10');
    expect(streak.current).toBe(2);
  });

  it('la mejor racha histórica se mantiene aunque la racha actual sea más corta', () => {
    const streak = computeDailyStreak(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-10'], '2026-01-10');
    expect(streak.current).toBe(1);
    expect(streak.best).toBe(3);
  });

  it('cruza el fin de mes correctamente', () => {
    const streak = computeDailyStreak(['2026-01-30', '2026-01-31', '2026-02-01'], '2026-02-01');
    expect(streak.current).toBe(3);
  });
});
