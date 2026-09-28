import { describe, expect, it } from 'vitest';
import { BANK_GROUPS, EXPEDIENTE_SERIES_COUNT, MIN_BANK_GROUPS } from '../../scripts/bank.config';

describe('bank.config: composición por defecto (§12.1)', () => {
  it('suma 600 casos: 170+190+120+60 de los grupos, más 20×3 de expediente', () => {
    const groupTotal = BANK_GROUPS.reduce((sum, g) => sum + g.count, 0);
    const expedienteTotal = EXPEDIENTE_SERIES_COUNT * 3;
    expect(groupTotal).toBe(540);
    expect(expedienteTotal).toBe(60);
    expect(groupTotal + expedienteTotal).toBe(600);
  });

  it('cada grupo tiene un modo y un prefijo de id distintos', () => {
    const modes = BANK_GROUPS.map((g) => g.mode);
    const prefixes = BANK_GROUPS.map((g) => g.idPrefix);
    expect(new Set(modes).size).toBe(modes.length);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it('el mínimo razonable (200) suma 70+70+40+20', () => {
    const total = MIN_BANK_GROUPS.reduce((sum, g) => sum + g.count, 0);
    expect(total).toBe(200);
  });
});
