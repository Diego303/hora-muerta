// Ejecutor en paralelo de los huecos del grupo incendio: un proceso hijo por hueco
// (scripts/fire-slot-worker.ts), como mucho `jobs` a la vez. Procesos y no hilos:
// cada hijo arranca con el mismo cargador de TypeScript que el padre (tsx), que es lo
// fiable en este proyecto. Si el padre no corre con tsx, o se pide 1 trabajo, se
// genera en el propio proceso: el resultado es el mismo, solo más lento.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSlotsInProcess, type SlotOutcome, type SlotRunner } from './fire-bank';

const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fire-slot-worker.ts');

/** Trabajos en paralelo: FIRE_JOBS si está definido; si no, los núcleos menos uno. */
export function fireJobs(): number {
  const fromEnv = Number(process.env.FIRE_JOBS);
  if (Number.isInteger(fromEnv) && fromEnv >= 1) return fromEnv;
  return Math.max(1, availableParallelism() - 1);
}

function runWorker(groupIndex: number, slot: number, signaturesFile: string): Promise<SlotOutcome> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...process.execArgv, WORKER, String(groupIndex), String(slot), signaturesFile], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let out = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      out += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`El hueco ${slot} del grupo ${groupIndex} terminó con código ${code}.`));
        return;
      }
      try {
        resolve(JSON.parse(out) as SlotOutcome);
      } catch {
        reject(new Error(`El hueco ${slot} del grupo ${groupIndex} no devolvió un resultado válido.`));
      }
    });
  });
}

/** Devuelve el ejecutor de huecos y cuántos lanzar por tanda, más cómo limpiar al final. */
export function createSlotRunner(): { runSlots: SlotRunner; batchSize: number; dispose: () => void } {
  const jobs = fireJobs();
  const canSpawn = process.execArgv.some((arg) => arg.includes('tsx'));
  if (jobs === 1 || !canSpawn) return { runSlots: runSlotsInProcess, batchSize: 1, dispose: () => undefined };

  const dir = mkdtempSync(path.join(tmpdir(), 'hm-incendio-'));
  let written: ReadonlySet<string> | null = null;
  const signaturesFile = path.join(dir, 'firmas.json');
  const runSlots: SlotRunner = async (groupIndex, slots, known) => {
    // Las firmas conocidas no cambian durante la generación: se escriben una vez.
    if (written !== known) {
      writeFileSync(signaturesFile, JSON.stringify([...known]));
      written = known;
    }
    return Promise.all(slots.map((slot) => runWorker(groupIndex, slot, signaturesFile)));
  };
  return { runSlots, batchSize: jobs, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}
