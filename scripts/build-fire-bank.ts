// Regenera solo el grupo "incendio" (public/cases/incendio.json), sin tocar el resto
// del banco. Evita duplicados con todos los casos ya publicados, actualiza el
// manifest y escribe el informe en reports/fire-report.md.
// Uso: pnpm exec tsx scripts/build-fire-bank.ts (FIRE_JOBS=n para fijar los trabajos en paralelo)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fnv1a } from '../src/engine/rng';
import type { BankFile, SeriesDef } from '../src/engine/types';
import { BANK_GROUPS, BANK_VERSION } from './bank.config';
import { buildFireReport, generateFireGroup } from './fire-bank';
import { createSlotRunner } from './fire-parallel';

const OUT_DIR = path.join(process.cwd(), 'public', 'cases');
const REPORTS_DIR = path.join(process.cwd(), 'reports');

function knownSignatures(): Set<string> {
  const seen = new Set<string>();
  for (const group of BANK_GROUPS) {
    const file = path.join(OUT_DIR, `${group.mode}.json`);
    if (!existsSync(file)) continue;
    for (const c of (JSON.parse(readFileSync(file, 'utf8')) as BankFile).cases) seen.add(c.sig);
  }
  const expedientes = path.join(OUT_DIR, 'expedientes.json');
  if (existsSync(expedientes)) {
    for (const s of (JSON.parse(readFileSync(expedientes, 'utf8')) as { series: SeriesDef[] }).series) for (const c of s.cases) seen.add(c.sig);
  }
  return seen;
}

console.time('[build-fire-bank] tiempo total');
const runner = createSlotRunner();
console.log(`[build-fire-bank] ${runner.batchSize} hueco(s) a la vez (FIRE_JOBS para cambiarlo).`);
let generated: Awaited<ReturnType<typeof generateFireGroup>>;
try {
  generated = await generateFireGroup(knownSignatures(), runner.runSlots, runner.batchSize);
} finally {
  runner.dispose();
}
const { cases, stats } = generated;
const contents = JSON.stringify({ version: BANK_VERSION, stats, cases });
writeFileSync(path.join(OUT_DIR, 'incendio.json'), contents);

const manifestPath = path.join(OUT_DIR, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  counts: Record<string, number>;
  files: Record<string, { count: number; hash: string }>;
};
manifest.counts.incendio = cases.length;
manifest.files['incendio.json'] = { count: cases.length, hash: fnv1a(contents).toString(36) };
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

const report = buildFireReport(cases, stats);
mkdirSync(REPORTS_DIR, { recursive: true });
writeFileSync(path.join(REPORTS_DIR, 'fire-report.md'), `${report}\n`);
console.log(report);
console.timeEnd('[build-fire-bank] tiempo total');
