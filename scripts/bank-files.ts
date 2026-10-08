// Ficheros del banco publicado (public/cases/): las firmas que ya están en uso y la
// escritura de un grupo con su entrada del manifiesto. Lo comparten los scripts que
// regeneran un solo grupo sin tocar el resto (build-fire-bank.ts, build-group.ts).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fnv1a } from '../src/engine/rng';
import type { BankFile } from '../src/engine/types';
import type { FireCase } from '../src/modes/fire/types';
import { BANK_GROUPS } from './bank.config';

export const CASES_DIR = path.join(process.cwd(), 'public', 'cases');
const FIRE_FILE = 'incendio.json';

function readIfExists<T>(fileName: string): T | null {
  const file = path.join(CASES_DIR, fileName);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : null;
}

/** Firmas de todos los casos publicados (§12.4), salvo los de `skipFile`, que es el
 * grupo que se va a regenerar. Un caso nuevo no puede repetir ninguna. */
export function publishedSignatures(skipFile: string): Set<string> {
  const seen = new Set<string>();
  for (const group of BANK_GROUPS) {
    const fileName = `${group.mode}.json`;
    if (fileName === skipFile) continue;
    for (const c of readIfExists<BankFile>(fileName)?.cases ?? []) seen.add(c.sig);
  }
  if (skipFile !== FIRE_FILE) for (const f of readIfExists<{ cases: FireCase[] }>(FIRE_FILE)?.cases ?? []) seen.add(f.caseData.sig);
  return seen;
}

/** Escribe el fichero de un grupo y actualiza solo su entrada del manifiesto. */
export function writeGroupFile(fileName: string, manifestKey: string, contents: string, count: number): void {
  writeFileSync(path.join(CASES_DIR, fileName), contents);
  const manifestPath = path.join(CASES_DIR, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    counts: Record<string, number>;
    files: Record<string, { count: number; hash: string }>;
  };
  manifest.counts[manifestKey] = count;
  manifest.files[fileName] = { count, hash: fnv1a(contents).toString(36) };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}
