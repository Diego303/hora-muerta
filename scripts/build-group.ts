// Genera un solo grupo del banco (public/cases/<modo>.json) sin tocar el resto:
// evita duplicados con todos los casos publicados, actualiza solo su entrada del
// manifiesto y reparte el trabajo entre los núcleos (un proceso por intento).
//
// Uso: pnpm bank:group <modo> <cantidad> [--simulacro]     p. ej.  pnpm bank:group comisario 5
//      --simulacro genera y lo cuenta, pero no escribe nada.
//      BANK_JOBS=n fija los trabajos a la vez (por defecto, los núcleos menos uno).
//
// Mismas semillas y reglas que la generación en serie (scripts/bank-group.ts). Los
// huecos se procesan por tandas: dentro de una tanda todos sus intentos corren a la vez
// y después se elige en orden (hueco a hueco, el primer intento que da un caso nuevo),
// así que el resultado es el mismo con cualquier número de núcleos. Si un hueco agota
// sus intentos se pasa al siguiente, hasta tener la cantidad pedida. Si no se llega,
// no se escribe nada.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CaseDraft } from '../src/engine/generate';
import type { CaseDef } from '../src/engine/types';
import { BANK_VERSION } from './bank.config';
import { publishedSignatures, writeGroupFile } from './bank-files';
import { findGroup, MAX_RETRIES_PER_SLOT, slotCandidate, slotMap, toCaseDef } from './bank-group';
import { canSpawnChildren, mapLimit, parallelJobs, runChild } from './parallel';

const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'group-slot-worker.ts');
/** Como mucho tantos huecos por caso pedido antes de rendirse. Comisario, con su tope
 * estricto de pistas, da caso en ~1 de cada 5 huecos: 12 deja margen de sobra. */
const SLOTS_PER_CASE = 12;

function usage(message: string): never {
  console.error(`[build-group] ${message}\nUso: pnpm bank:group <modo> <cantidad> [--simulacro]   (p. ej. pnpm bank:group comisario 5)`);
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--simulacro');
  const [mode, countArg] = args.filter((a) => !a.startsWith('--'));
  if (!mode || !countArg) usage('Faltan argumentos.');
  const count = Number(countArg);
  if (!Number.isInteger(count) || count < 1) usage(`Cantidad no válida: "${countArg}".`);
  const group = findGroup(mode);
  const fileName = `${group.mode}.json`;

  const started = Date.now();
  const seconds = (): string => ((Date.now() - started) / 1000).toFixed(0);
  const known = publishedSignatures(fileName);
  const jobs = parallelJobs('BANK_JOBS');
  const parallel = jobs > 1 && canSpawnChildren();
  const candidate = (slot: number, retry: number): Promise<CaseDraft | null> =>
    parallel ? runChild<CaseDraft | null>(WORKER, [group.mode, String(slot), String(retry)]) : Promise.resolve(slotCandidate(group, slot, retry));
  // Tandas de unas dos rondas de trabajos, para que ningún núcleo espere mucho.
  const slotsPerWave = Math.max(1, Math.ceil((2 * (parallel ? jobs : 1)) / MAX_RETRIES_PER_SLOT));
  const maxSlots = count * SLOTS_PER_CASE;
  console.log(`[build-group] ${group.mode}: ${count} casos, ${parallel ? jobs : 1} trabajo(s) a la vez, ${known.size} firmas publicadas.`);

  const cases: CaseDef[] = [];
  for (let first = 0; first < maxSlots && cases.length < count; first += slotsPerWave) {
    const slots = Array.from({ length: Math.min(slotsPerWave, maxSlots - first) }, (_, i) => first + i);
    const tasks = slots.flatMap((slot) => Array.from({ length: MAX_RETRIES_PER_SLOT }, (_, retry) => ({ slot, retry })));
    const drafts = await mapLimit(tasks, parallel ? jobs : 1, (t) => candidate(t.slot, t.retry));
    for (const slot of slots) {
      if (cases.length >= count) break;
      const draft = tasks.map((t, i) => (t.slot === slot ? drafts[i] : null)).find((d): d is CaseDraft => d !== null && !known.has(d.sig));
      if (!draft) {
        console.log(`[build-group]   hueco ${slot + 1} (${slotMap(slot)}): sin caso tras ${MAX_RETRIES_PER_SLOT} intentos.`);
        continue;
      }
      known.add(draft.sig);
      const c = toCaseDef(group, draft, cases.length);
      cases.push(c);
      console.log(`[build-group]   ${c.id}: hueco ${slot + 1}, ${c.map}, ${c.clues.length} pistas, nivel ${c.solve.maxLv}, puntuación ${c.solve.score}, ${c.solve.arch.join(', ') || 'sin arquetipo'} (${seconds()} s)`);
    }
  }

  if (cases.length < count) {
    console.error(`[build-group] Solo ${cases.length} de ${count} casos tras ${maxSlots} huecos: no se escribe nada.`);
    process.exitCode = 1;
    return;
  }
  if (dryRun) {
    console.log(`[build-group] Simulacro: ${cases.length} casos generados, no se escribe nada (${seconds()} s).`);
    return;
  }
  writeGroupFile(fileName, group.mode, JSON.stringify({ version: BANK_VERSION, mode: group.mode, cases }), cases.length);
  console.log(`[build-group] ${cases.length} casos escritos en public/cases/${fileName} y en el manifiesto (${seconds()} s). Comprueba con "pnpm bank:validate".`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
