// Ejecución en paralelo de los scripts del banco: procesos hijo (no hilos), cada uno
// arrancado con el mismo cargador de TypeScript que el padre (tsx), que es lo fiable
// en este proyecto. Cada hijo escribe su resultado como JSON en la salida estándar.
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';

/** Trabajos a la vez: la variable de entorno `envVar` si es un entero ≥ 1; si no, los núcleos menos uno. */
export function parallelJobs(envVar: string): number {
  const fromEnv = Number(process.env[envVar]);
  if (Number.isInteger(fromEnv) && fromEnv >= 1) return fromEnv;
  return Math.max(1, availableParallelism() - 1);
}

/** Solo se puede lanzar hijos si el padre corre con tsx (los hijos lo heredan). */
export function canSpawnChildren(): boolean {
  return process.execArgv.some((arg) => arg.includes('tsx'));
}

/** Lanza `script` con `args` y devuelve lo que escriba por la salida estándar, ya parseado. */
export function runChild<T>(script: string, args: string[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...process.execArgv, script, ...args], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      out += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${script} ${args.join(' ')} terminó con código ${code}.`));
        return;
      }
      try {
        resolve(JSON.parse(out) as T);
      } catch {
        reject(new Error(`${script} ${args.join(' ')} no devolvió un JSON válido.`));
      }
    });
  });
}

/** Aplica `fn` a cada elemento con como mucho `jobs` a la vez; los resultados, en el orden de entrada. */
export async function mapLimit<I, O>(items: readonly I[], jobs: number, fn: (item: I) => Promise<O>): Promise<O[]> {
  const results = new Array<O>(items.length);
  let next = 0;
  async function lane(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(jobs, items.length) }, lane));
  return results;
}
