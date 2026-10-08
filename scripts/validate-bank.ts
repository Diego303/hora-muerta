// Valida el banco ya escrito en public/cases/ (§12.3). Uso: tsx scripts/validate-bank.ts
// Sale con código 1 si algún caso falla una comprobación dura (formato, la
// verdad no cumple sus propias pistas, el solver exacto no da unique, el
// nivel/puntuación no encaja con la dificultad, firma repetida). Las cuotas de
// variedad (§12.1: mapas, arquetipos, hora del crimen) se informan como avisos,
// no como fallo: quien decide si hace falta regenerar es bank-report.ts.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { MAPS } from '../src/engine/content/maps';
import { MAX_READ_LENGTH } from '../src/engine/clues';
import { checkUnique } from '../src/engine/exact';
import type { SolveContext } from '../src/engine/exact';
import { buildGraph } from '../src/engine/graph';
import { buildTextContext, meetsLevelGate, SCORE_BAND } from '../src/engine/generate';
import { holds } from '../src/engine/clues';
import { solveHuman } from '../src/engine/human';
import type { HumanContext } from '../src/engine/human';
import { enumeratePaths } from '../src/engine/paths';
import { clueText, plainText } from '../src/engine/text';
import type { BankFile, CaseDef, MapDef } from '../src/engine/types';
import { BANK_GROUPS, FIRE_GROUPS, MAP_QUOTA_TOLERANCE } from './bank.config';
import { fireCaseErrors } from './fire-bank';
import type { FireCase } from '../src/modes/fire/types';

const OUT_DIR = path.join(process.cwd(), 'public', 'cases');

function readJSON<T>(fileName: string): T {
  const file = path.join(OUT_DIR, fileName);
  if (!existsSync(file)) throw new Error(`Falta ${fileName}. Ejecuta antes "pnpm bank:build".`);
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

function findMap(mapId: string): MapDef {
  const map = MAPS.find((m) => m.id === mapId);
  if (!map) throw new Error(`Mapa desconocido en el banco: ${mapId}`);
  return map;
}

function validateCase(c: CaseDef, errors: string[]): void {
  const fail = (message: string): void => {
    errors.push(`${c.id}: ${message}`);
  };

  if (c.v !== 2) fail(`versión de formato inesperada (${c.v})`);
  if (c.cast.length !== c.N) fail(`cast.length (${c.cast.length}) distinto de N (${c.N})`);
  if (c.objects.length !== c.N) fail(`objects.length (${c.objects.length}) distinto de N (${c.N})`);
  if (c.truth.rooms.length !== c.N) fail('truth.rooms.length distinto de N');
  if (c.truth.obj.length !== c.N) fail('truth.obj.length distinto de N');
  if (c.truth.rooms.some((path) => path.length !== c.T)) fail(`algún recorrido no tiene T=${c.T} horas`);
  if (c.clues.length === 0) fail('sin pistas');
  if (new Set(c.cast).size !== c.cast.length) fail('cast con sospechosos repetidos');
  if (new Set(c.objects).size !== c.objects.length) fail('objects con objetos repetidos');

  let map: MapDef;
  try {
    map = findMap(c.map);
  } catch (error) {
    fail(String(error instanceof Error ? error.message : error));
    return;
  }
  const graph = buildGraph(map);

  if (!c.clues.every((clue) => holds(clue, c.truth, graph))) fail('alguna pista no es verdad sobre la verdad');
  if (c.truth.rooms[c.culprit][c.td] !== c.rv) fail('el culpable no está en la sala del crimen a la hora del crimen');
  if (c.truth.rooms.some((path, s) => s !== c.culprit && path[c.td] === c.rv)) fail('alguien más coincide con la víctima a la hora del crimen');
  if (c.truth.obj[c.culprit] !== c.weapon) fail('el arma no es el objeto del culpable');

  const paths = enumeratePaths(graph.adj, map.rooms.length, c.T);
  const solveCtx: SolveContext = { N: c.N, T: c.T, paths, rv: c.rv, td: c.td, graph };
  const result = checkUnique(solveCtx, c.culprit, c.weapon, c.clues);
  if (result.status !== 'unique') fail(`el solver exacto no da unique (${result.status})`);

  // Se vuelve a resolver con el solver humano (no basta con confiar en lo guardado):
  // así se detecta si el motor cambió y el caso guardado ya no es coherente con él.
  const humanCtx: HumanContext = { N: c.N, T: c.T, graph, rv: c.rv, td: c.td };
  const solved = solveHuman(humanCtx, c.clues);
  if (!solved) {
    fail('el solver humano ya no resuelve este caso (¿cambió el motor desde que se generó?)');
  } else {
    if (solved.maxLv !== c.solve.maxLv) fail(`maxLv guardado (${c.solve.maxLv}) no coincide con el recalculado (${solved.maxLv})`);
    if (solved.score !== c.solve.score) fail(`score guardado (${c.solve.score}) no coincide con el recalculado (${solved.score})`);
    if (!meetsLevelGate(c.diff, solved.maxLv, solved.maxLvStepCount)) fail(`nivel/tope fuera de lo permitido para la dificultad (maxLv=${solved.maxLv})`);
  }
  const [scoreMin, scoreMax] = SCORE_BAND[c.diff];
  if (c.solve.score < scoreMin || c.solve.score > scoreMax) fail(`puntuación ${c.solve.score} fuera de la banda [${scoreMin}, ${scoreMax}]`);
  if (c.solve.key < 0 || c.solve.key >= c.solve.steps.length) fail('solve.key fuera de rango');
  if (!c.solve.steps.every((s) => s.crit)) fail('solve.steps contiene pasos marcados como no críticos');

  const textCtx = buildTextContext(map, c.cast, c.objects);
  const readLength = c.clues.reduce((sum, clue) => sum + plainText(clueText(clue, textCtx)).length, 0);
  if (readLength > MAX_READ_LENGTH[c.diff]) fail(`longitud de lectura ${readLength} > ${MAX_READ_LENGTH[c.diff]}`);
}

function reportMapQuota(label: string, cases: CaseDef[], warnings: string[]): void {
  if (cases.length === 0) return;
  const counts = new Map<string, number>();
  for (const c of cases) counts.set(c.map, (counts.get(c.map) ?? 0) + 1);
  const target = cases.length / MAPS.length;
  for (const map of MAPS) {
    const n = counts.get(map.id) ?? 0;
    if (Math.abs(n - target) > MAP_QUOTA_TOLERANCE + 1) {
      warnings.push(`${label}: ${map.id} tiene ${n} casos (objetivo ≈ ${target.toFixed(1)} ± ${MAP_QUOTA_TOLERANCE}).`);
    }
  }
}

function main(): void {
  const errors: string[] = [];
  const warnings: string[] = [];
  const allCases: CaseDef[] = [];
  const signatures = new Map<string, string>();

  for (const group of BANK_GROUPS) {
    const bank = readJSON<BankFile>(`${group.mode}.json`);
    for (const c of bank.cases) {
      validateCase(c, errors);
      // Tope estricto del grupo (Comisario: 14 pistas, §11).
      if (group.maxClues !== undefined && c.clues.length > group.maxClues) errors.push(`${c.id}: ${c.clues.length} pistas (máximo ${group.maxClues})`);
      allCases.push(c);
      const owner = signatures.get(c.sig);
      if (owner) errors.push(`${c.id}: firma repetida con ${owner}`);
      else signatures.set(c.sig, c.id);
    }
    reportMapQuota(group.mode, bank.cases, warnings);
  }

  // Modo Incendio (docs/MODOS.md 2.5): además de todo lo del caso normal, el foco,
  // los tiempos, los textos y las garantías de justicia.
  const fireFile = path.join(OUT_DIR, 'incendio.json');
  if (existsSync(fireFile)) {
    const { cases: fireCases } = JSON.parse(readFileSync(fireFile, 'utf8')) as { cases: FireCase[] };
    for (const f of fireCases) {
      validateCase(f.caseData, errors);
      for (const e of fireCaseErrors(f)) errors.push(`${f.caseData.id}: ${e}`);
      allCases.push(f.caseData);
      const owner = signatures.get(f.caseData.sig);
      if (owner) errors.push(`${f.caseData.id}: firma repetida con ${owner}`);
      else signatures.set(f.caseData.sig, f.caseData.id);
    }
    for (const g of FIRE_GROUPS) {
      const n = fireCases.filter((f) => f.fire.level === g.level).length;
      if (n !== g.count) warnings.push(`incendio: ${g.level} tiene ${n} casos (objetivo ${g.count}).`);
    }
  } else {
    warnings.push('incendio.json no existe todavía.');
  }

  console.log(`[validate-bank] ${allCases.length} casos comprobados.`);
  if (warnings.length > 0) {
    console.warn(`[validate-bank] ${warnings.length} avisos de cuota:`);
    for (const w of warnings) console.warn(`  - ${w}`);
  }
  if (errors.length > 0) {
    console.error(`[validate-bank] ${errors.length} errores:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }
  console.log('[validate-bank] todo correcto.');
}

main();
