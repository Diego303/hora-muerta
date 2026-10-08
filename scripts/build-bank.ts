// Genera public/cases/*.json y manifest.json (§12.2). Determinista: la misma
// BANK_VERSION produce el mismo banco. Uso: tsx scripts/build-bank.ts
//
// Nota (ver docs/DECISIONES.md): esta primera versión genera en serie, no en
// paralelo con worker_threads como pide el diseño. No podía verificar en este
// entorno que el patrón de arranque de workers con tsx funcionara de verdad
// (Node + módulos ES + tsx en un hilo aparte es un punto históricamente
// delicado), y prefería un script que con seguridad se ejecute de principio a
// fin antes de añadir paralelismo. Genera 540 casos: puede tardar varios
// minutos, sobre todo en Comisario.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAPS } from '../src/engine/content/maps';
import type { CaseDraft } from '../src/engine/generate';
import { buildCaseCandidate, draftToCaseDef } from '../src/engine/generate';
import { fnv1a } from '../src/engine/rng';
import type { CaseDef, CaseMode, MapId } from '../src/engine/types';
import { BANK_GROUPS, BANK_VERSION } from './bank.config';
import { buildFireReport, generateFireGroup } from './fire-bank';
import { createSlotRunner } from './fire-parallel';

const OUT_DIR = path.join(process.cwd(), 'public', 'cases');
const MAP_IDS: MapId[] = MAPS.map((m) => m.id);
const MAX_RETRIES_PER_SLOT = 6;

function padId(prefix: string, index: number, width = 3): string {
  return `${prefix}-${String(index + 1).padStart(width, '0')}`;
}

/** Exportada para poder regenerar un único grupo (p. ej. tras arreglar un bug
 * del generador que solo afecta a un nivel) sin tener que relanzar el banco
 * entero; ver docs/DECISIONES.md. */
export function generateGroup(mode: CaseMode, diff: 0 | 1 | 2, count: number, idPrefix: string, seenSignatures: Set<string>): CaseDef[] {
  const cases: CaseDef[] = [];
  for (let slot = 0; slot < count; slot++) {
    const mapId = MAP_IDS[slot % MAP_IDS.length];
    let draft: CaseDraft | null = null;
    for (let retry = 0; retry < MAX_RETRIES_PER_SLOT; retry++) {
      const seed = `${BANK_VERSION}|${mode}|${slot}|${retry}`;
      const attempt = buildCaseCandidate(seed, diff, mapId);
      if (attempt && !seenSignatures.has(attempt.sig)) {
        draft = attempt;
        break;
      }
    }
    if (!draft) {
      console.warn(`[build-bank] no se pudo generar ${mode} #${slot + 1} (mapa ${mapId}) tras ${MAX_RETRIES_PER_SLOT} intentos.`);
      continue;
    }
    seenSignatures.add(draft.sig);
    cases.push(draftToCaseDef(draft, padId(idPrefix, cases.length), mode));
  }
  return cases;
}

async function main(): Promise<void> {
  console.time('[build-bank] tiempo total');
  mkdirSync(OUT_DIR, { recursive: true });
  const seenSignatures = new Set<string>();
  const manifestCounts: Record<string, number> = {};
  const manifestFiles: Record<string, { count: number; hash: string }> = {};

  for (const group of BANK_GROUPS) {
    const cases = generateGroup(group.mode, group.diff, group.count, group.idPrefix, seenSignatures);
    const fileName = `${group.mode}.json`;
    const contents = JSON.stringify({ version: BANK_VERSION, mode: group.mode, cases });
    writeFileSync(path.join(OUT_DIR, fileName), contents);
    manifestCounts[group.mode] = cases.length;
    manifestFiles[fileName] = { count: cases.length, hash: fnv1a(contents).toString(36) };
    console.log(`[build-bank] ${group.mode}: ${cases.length}/${group.count} casos escritos en ${fileName}.`);
  }

  // Modo Incendio (docs/MODOS.md 2.5): va el último para no repetir ningún caso de los demás grupos.
  const runner = createSlotRunner();
  let fire: Awaited<ReturnType<typeof generateFireGroup>>;
  try {
    fire = await generateFireGroup(seenSignatures, runner.runSlots, runner.batchSize);
  } finally {
    runner.dispose();
  }
  const fireContents = JSON.stringify({ version: BANK_VERSION, stats: fire.stats, cases: fire.cases });
  writeFileSync(path.join(OUT_DIR, 'incendio.json'), fireContents);
  manifestCounts.incendio = fire.cases.length;
  manifestFiles['incendio.json'] = { count: fire.cases.length, hash: fnv1a(fireContents).toString(36) };
  mkdirSync(path.join(process.cwd(), 'reports'), { recursive: true });
  writeFileSync(path.join(process.cwd(), 'reports', 'fire-report.md'), `${buildFireReport(fire.cases, fire.stats)}\n`);
  console.log(`[build-bank] incendio: ${fire.cases.length} casos escritos.`);

  const manifest = { version: BANK_VERSION, counts: manifestCounts, files: manifestFiles };
  writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('[build-bank] manifest.json escrito.');
  console.timeEnd('[build-bank] tiempo total');
}

// Solo al ejecutarse directamente (`pnpm bank:build`), no al importar
// `generateGroup` desde otro script (p. ej. para regenerar un único grupo).
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
