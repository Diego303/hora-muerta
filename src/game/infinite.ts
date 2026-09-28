// Modo infinito (§13): gestiona el Web Worker del generador y la pregeneración
// del siguiente caso mientras se juega el actual, para que "Siguiente caso"
// no tenga que esperar los ~8 s de presupuesto del generador.
import type { DiffIndex } from '../engine/clues';
import type { CaseDef, MapId } from '../engine/types';
import type { GenerateRequest, GenerateResult } from '../workers/generator.worker';

export interface InfiniteSession {
  /** El siguiente caso: el pregenerado si ya estaba listo, o uno nuevo si no. */
  next(): Promise<CaseDef | null>;
  /** Empieza a generar el siguiente en segundo plano, sin esperar el resultado. */
  pregenerate(): void;
  destroy(): void;
}

/** Reproduce un caso exacto de modo infinito a partir de su semilla (enlaces
 * #gen=<semilla>&n=<nivel>&m=<mapa>, §12.5): un worker de usar y tirar, no
 * hace falta una sesión completa para un solo caso conocido. */
export function reproduceCase(seed: string, diff: DiffIndex, mapId?: MapId): Promise<CaseDef | null> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('../workers/generator.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<GenerateResult>) => {
      resolve(event.data.caseData);
      worker.terminate();
    };
    const req: GenerateRequest = { type: 'generate', requestId: 'reproduce', diff, mapId, seed };
    worker.postMessage(req);
  });
}

export function startInfiniteSession(diff: DiffIndex, mapId: MapId | null): InfiniteSession {
  const worker = new Worker(new URL('../workers/generator.worker.ts', import.meta.url), { type: 'module' });
  const pending = new Map<string, (result: CaseDef | null) => void>();
  let pregenerated: Promise<CaseDef | null> | null = null;

  worker.onmessage = (event: MessageEvent<GenerateResult>) => {
    const { requestId, caseData } = event.data;
    const resolve = pending.get(requestId);
    if (!resolve) return;
    pending.delete(requestId);
    resolve(caseData);
  };

  function requestOne(): Promise<CaseDef | null> {
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const promise = new Promise<CaseDef | null>((resolve) => {
      pending.set(requestId, resolve);
    });
    const req: GenerateRequest = { type: 'generate', requestId, diff, mapId: mapId ?? undefined };
    worker.postMessage(req);
    return promise;
  }

  return {
    next() {
      const result = pregenerated ?? requestOne();
      pregenerated = null;
      return result;
    },
    pregenerate() {
      pregenerated ??= requestOne();
    },
    destroy() {
      worker.terminate();
    },
  };
}
