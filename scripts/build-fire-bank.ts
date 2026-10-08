// Regenera solo el grupo "incendio" (public/cases/incendio.json), sin tocar el resto
// del banco. Evita duplicados con todos los casos ya publicados, actualiza el
// manifest y escribe el informe en reports/fire-report.md.
// Uso: pnpm exec tsx scripts/build-fire-bank.ts (FIRE_JOBS=n para fijar los trabajos en paralelo)
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { BANK_VERSION } from './bank.config';
import { publishedSignatures, writeGroupFile } from './bank-files';
import { buildFireReport, generateFireGroup } from './fire-bank';
import { createSlotRunner } from './fire-parallel';

const REPORTS_DIR = path.join(process.cwd(), 'reports');

console.time('[build-fire-bank] tiempo total');
const runner = createSlotRunner();
console.log(`[build-fire-bank] ${runner.batchSize} hueco(s) a la vez (FIRE_JOBS para cambiarlo).`);
let generated: Awaited<ReturnType<typeof generateFireGroup>>;
try {
  generated = await generateFireGroup(publishedSignatures('incendio.json'), runner.runSlots, runner.batchSize);
} finally {
  runner.dispose();
}
const { cases, stats } = generated;
const contents = JSON.stringify({ version: BANK_VERSION, stats, cases });
writeGroupFile('incendio.json', 'incendio', contents, cases.length);

const report = buildFireReport(cases, stats);
mkdirSync(REPORTS_DIR, { recursive: true });
writeFileSync(path.join(REPORTS_DIR, 'fire-report.md'), `${report}\n`);
console.log(report);
console.timeEnd('[build-fire-bank] tiempo total');
