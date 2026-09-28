// Genera public/cases/*.json y manifest.json (§12.2). Determinista: la misma
// BANK_VERSION produce el mismo banco. Uso: tsx scripts/build-bank.ts
//
// Nota (ver docs/DECISIONES.md): esta primera versión genera en serie, no en
// paralelo con worker_threads como pide el diseño. No podía verificar en este
// entorno que el patrón de arranque de workers con tsx funcionara de verdad
// (Node + módulos ES + tsx en un hilo aparte es un punto históricamente
// delicado), y prefería un script que con seguridad se ejecute de principio a
// fin antes de añadir paralelismo. Genera 600 casos: puede tardar varios
// minutos, sobre todo en Comisario.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CAST } from '../src/engine/content/cast';
import { MAPS } from '../src/engine/content/maps';
import type { CaseDraft } from '../src/engine/generate';
import { buildCaseCandidate, draftToCaseDef } from '../src/engine/generate';
import { fnv1a, rngFromSeed, shuffle } from '../src/engine/rng';
import type { CaseDef, CaseMode, MapId, SeriesDef } from '../src/engine/types';
import { BANK_GROUPS, BANK_VERSION, EXPEDIENTE_ID_PREFIX, EXPEDIENTE_SERIES_COUNT } from './bank.config';

const OUT_DIR = path.join(process.cwd(), 'public', 'cases');
const MAP_IDS: MapId[] = MAPS.map((m) => m.id);
const MAX_RETRIES_PER_SLOT = 6;
const EXPEDIENTE_DIFFS = [0, 1, 2] as const;

function padId(prefix: string, index: number, width = 3): string {
  return `${prefix}-${String(index + 1).padStart(width, '0')}`;
}

function generateGroup(mode: Exclude<CaseMode, 'expediente'>, diff: 0 | 1 | 2, count: number, idPrefix: string, seenSignatures: Set<string>): CaseDef[] {
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

/** Series de 3 noches con el mismo mapa y reparto de 5 (§12.2); la de Novato usa los 4 primeros. */
function generateExpedientes(seenSignatures: Set<string>): SeriesDef[] {
  const series: SeriesDef[] = [];
  for (let s = 0; s < EXPEDIENTE_SERIES_COUNT; s++) {
    const mapId = MAP_IDS[s % MAP_IDS.length];
    const castRng = rngFromSeed(`${BANK_VERSION}|expediente|${s}|cast`);
    const sharedCast = shuffle(
      castRng,
      CAST.map((_, i) => i),
    )
      .slice(0, 5)
      .sort((a, b) => CAST[a].name.localeCompare(CAST[b].name, 'es'));

    const seriesCases: CaseDef[] = [];
    for (let n = 0; n < EXPEDIENTE_DIFFS.length; n++) {
      const diff = EXPEDIENTE_DIFFS[n];
      let draft: CaseDraft | null = null;
      for (let retry = 0; retry < MAX_RETRIES_PER_SLOT; retry++) {
        const seed = `${BANK_VERSION}|expediente|${s}|${n}|${retry}`;
        const attempt = buildCaseCandidate(seed, diff, mapId, { castOverride: sharedCast });
        if (attempt && !seenSignatures.has(attempt.sig)) {
          draft = attempt;
          break;
        }
      }
      if (!draft) {
        console.warn(`[build-bank] expediente ${s + 1}: no se pudo generar la noche ${n + 1} (mapa ${mapId}).`);
        break;
      }
      seenSignatures.add(draft.sig);
      seriesCases.push(draftToCaseDef(draft, `${EXPEDIENTE_ID_PREFIX}-${String(s + 1).padStart(2, '0')}-${n + 1}`, 'expediente'));
    }
    if (seriesCases.length === EXPEDIENTE_DIFFS.length) {
      series.push({ id: `${EXPEDIENTE_ID_PREFIX}-${String(s + 1).padStart(2, '0')}`, map: mapId, cast: sharedCast, cases: seriesCases });
    } else {
      console.warn(`[build-bank] expediente ${s + 1} descartado: no completó las 3 noches.`);
    }
  }
  return series;
}

function main(): void {
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

  const series = generateExpedientes(seenSignatures);
  const expedienteContents = JSON.stringify({ version: BANK_VERSION, series });
  writeFileSync(path.join(OUT_DIR, 'expedientes.json'), expedienteContents);
  manifestCounts.expediente = series.length;
  manifestFiles['expedientes.json'] = { count: series.length, hash: fnv1a(expedienteContents).toString(36) };
  console.log(`[build-bank] expediente: ${series.length}/${EXPEDIENTE_SERIES_COUNT} series escritas.`);

  const manifest = { version: BANK_VERSION, counts: manifestCounts, files: manifestFiles };
  writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('[build-bank] manifest.json escrito.');
  console.timeEnd('[build-bank] tiempo total');
}

main();
