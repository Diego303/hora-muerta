// Ejecutor en paralelo de los huecos del grupo incendio: un proceso hijo por hueco
// (scripts/fire-slot-worker.ts), como mucho `FIRE_JOBS` a la vez (scripts/parallel.ts).
// Si el padre no corre con tsx, o se pide 1 trabajo, se genera en el propio proceso:
// el resultado es el mismo, solo más lento.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSlotsInProcess, type SlotOutcome, type SlotRunner } from './fire-bank';
import { canSpawnChildren, parallelJobs, runChild } from './parallel';

const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fire-slot-worker.ts');

/** Devuelve el ejecutor de huecos y cuántos lanzar por tanda, más cómo limpiar al final. */
export function createSlotRunner(): { runSlots: SlotRunner; batchSize: number; dispose: () => void } {
  const jobs = parallelJobs('FIRE_JOBS');
  if (jobs === 1 || !canSpawnChildren()) return { runSlots: runSlotsInProcess, batchSize: 1, dispose: () => undefined };

  const dir = mkdtempSync(path.join(tmpdir(), 'hm-incendio-'));
  let written: ReadonlySet<string> | null = null;
  const signaturesFile = path.join(dir, 'firmas.json');
  const runSlots: SlotRunner = async (groupIndex, slots, known) => {
    // Las firmas conocidas no cambian durante la generación: se escriben una vez.
    if (written !== known) {
      writeFileSync(signaturesFile, JSON.stringify([...known]));
      written = known;
    }
    return Promise.all(slots.map((slot) => runChild<SlotOutcome>(WORKER, [String(groupIndex), String(slot), signaturesFile])));
  };
  return { runSlots, batchSize: jobs, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}
