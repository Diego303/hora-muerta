// Comisario publicado (public/cases/comisario.json): lo que pide el diseño (§11) a cada
// caso. La validación completa (solver exacto, solver humano, banda) está en
// `pnpm bank:validate`; aquí, lo que se puede comprobar al momento.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BankFile } from '../../src/engine/types';

const bank = JSON.parse(readFileSync('public/cases/comisario.json', 'utf8')) as BankFile;
const manifest = JSON.parse(readFileSync('public/cases/manifest.json', 'utf8')) as { counts: Record<string, number> };

describe('banco de Comisario', () => {
  it('5 casos, C-001 a C-005, y el manifiesto lo dice', () => {
    expect(bank.mode).toBe('comisario');
    expect(bank.cases.map((c) => c.id)).toEqual(['C-001', 'C-002', 'C-003', 'C-004', 'C-005']);
    expect(manifest.counts.comisario).toBe(5);
  });

  it.each(bank.cases.map((c) => [c.id, c] as const))('%s: 5 sospechosos, 4 horas, de 10 a 14 pistas, nivel 5 o 6', (_id, c) => {
    expect(c.mode).toBe('comisario');
    expect(c.diff).toBe(2);
    expect(c.N).toBe(5);
    expect(c.T).toBe(4);
    expect(c.clues.length).toBeGreaterThanOrEqual(10);
    expect(c.clues.length).toBeLessThanOrEqual(14);
    expect(c.solve.maxLv).toBeGreaterThanOrEqual(5);
  });

  it('sin firmas repetidas', () => {
    expect(new Set(bank.cases.map((c) => c.sig)).size).toBe(bank.cases.length);
  });
});
