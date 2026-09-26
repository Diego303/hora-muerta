// Script de consola de M1: genera un caso y lo imprime con sus pistas en texto,
// para revisar a ojo que el motor (mapas, noche, pistas, solver exacto) encaja.
// Uso: tsx scripts/print-case.ts [semilla] [0|1|2]
import { CAST, MOTIVES, VICTIMS } from '../src/engine/content/cast';
import type { DiffIndex } from '../src/engine/clues';
import { buildCaseCandidate, buildTextContext } from '../src/engine/generate';
import { clueText, plainText } from '../src/engine/text';

const DIFF_NAMES: Record<DiffIndex, string> = { 0: 'Novato', 1: 'Inspector', 2: 'Comisario' };

function parseDiff(raw: string | undefined): DiffIndex {
  const n = Number(raw ?? '0');
  return n === 1 || n === 2 ? n : 0;
}

function main(): void {
  const seed = process.argv[2] ?? `demo-${Date.now()}`;
  const diff = parseDiff(process.argv[3]);

  const candidate = buildCaseCandidate(seed, diff);
  if (!candidate) {
    console.error(`No se pudo generar un caso para la semilla "${seed}" en dificultad ${DIFF_NAMES[diff]}.`);
    process.exitCode = 1;
    return;
  }

  const ctx = buildTextContext(candidate.map, candidate.castIndices, candidate.objectIndices);
  const crimeRoom = candidate.map.rooms[candidate.rv];
  const culpritName = CAST[candidate.castIndices[candidate.culprit]].name;

  console.log(`Hora Muerta — ${DIFF_NAMES[diff]} — semilla "${seed}"`);
  console.log(`Escenario: ${candidate.map.name} (${candidate.map.place})`);
  console.log(candidate.map.intro);
  console.log('');
  console.log(`Víctima: ${VICTIMS[candidate.victim]}`);
  console.log(`Sala del crimen: ${crimeRoom.art} ${crimeRoom.name}, hora ${1 + candidate.td}`);
  console.log('');
  console.log('Reparto:');
  for (const suspect of ctx.suspects) console.log(`  - ${suspect.name}`);
  console.log('');
  console.log(`Pistas (${candidate.clues.length}):`);
  candidate.clues.forEach((clue, i) => {
    console.log(`  ${i + 1}. ${plainText(clueText(clue, ctx))}`);
  });
  console.log('');
  console.log(`Solución: ${culpritName} llevaba ${ctx.objects[candidate.weapon].name}. Motivo: ${MOTIVES[candidate.motive]}.`);
}

main();
