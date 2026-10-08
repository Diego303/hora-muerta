// Informe del banco ya escrito en public/cases/ (§12.3): puntuación, número de
// pistas, tipos, arquetipos, mapas y hora del crimen, por grupo. Salida en
// consola y en reports/bank-report.md. Uso: tsx scripts/bank-report.ts
//
// No incluye motivos de rechazo ni tiempo de generación por intento: build-bank.ts
// no instrumenta esos datos internos del generador (solo el tiempo total, con
// console.time); ver docs/DECISIONES.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { BankFile, CaseDef } from '../src/engine/types';
import { BANK_GROUPS } from './bank.config';

const CASES_DIR = path.join(process.cwd(), 'public', 'cases');
const REPORTS_DIR = path.join(process.cwd(), 'reports');

function readJSON<T>(fileName: string): T | null {
  const file = path.join(CASES_DIR, fileName);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

function countBy<T extends string | number>(items: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}

function formatCounts<T extends string | number>(counts: Map<T, number>, total: number): string[] {
  return Array.from(counts.entries())
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([key, n]) => `  - ${key}: ${n} (${total > 0 ? ((n / total) * 100).toFixed(0) : '0'}%)`);
}

function reportGroup(mode: string, cases: CaseDef[], lines: string[]): void {
  lines.push(`### ${mode} (${cases.length} casos)`);
  if (cases.length === 0) {
    lines.push('  (vacío)');
    return;
  }
  const scores = cases.map((c) => c.solve.score);
  const clueCounts = cases.map((c) => c.clues.length);
  lines.push(`- Puntuación: mínima ${Math.min(...scores)}, máxima ${Math.max(...scores)}, media ${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)}`);
  lines.push(`- Pistas por caso: mínimo ${Math.min(...clueCounts)}, máximo ${Math.max(...clueCounts)}`);
  lines.push('- Mapas:');
  lines.push(...formatCounts(countBy(cases.map((c) => c.map)), cases.length));
  lines.push('- Hora del crimen:');
  lines.push(...formatCounts(countBy(cases.map((c) => c.td)), cases.length));
  lines.push('- Arquetipo de la deducción clave:');
  lines.push(...formatCounts(countBy(cases.map((c) => c.solve.arch[0] ?? '(ninguno)')), cases.length));
  const clueKinds = cases.flatMap((c) => c.clues.map((clue) => clue.k));
  lines.push('- Tipos de pista:');
  lines.push(...formatCounts(countBy(clueKinds), clueKinds.length));
}

function main(): void {
  const lines: string[] = ['# Informe del banco de casos', ''];
  const allCases: CaseDef[] = [];

  for (const group of BANK_GROUPS) {
    const bank = readJSON<BankFile>(`${group.mode}.json`);
    const cases = bank?.cases ?? [];
    allCases.push(...cases);
    reportGroup(group.mode, cases, lines);
    lines.push('');
  }

  lines.push(`## Total: ${allCases.length} casos`);
  lines.push('');
  lines.push('Nota: sin motivos de rechazo ni tiempo de generación por intento (ver docs/DECISIONES.md).');

  const report = lines.join('\n');
  console.log(report);

  mkdirSync(REPORTS_DIR, { recursive: true });
  writeFileSync(path.join(REPORTS_DIR, 'bank-report.md'), `${report}\n`);
  console.log(`\n[bank-report] escrito en reports/bank-report.md`);
}

main();
