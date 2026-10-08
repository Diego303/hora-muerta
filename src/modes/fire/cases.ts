// Carga del banco del Modo Incendio (public/cases/incendio.json, grupo "incendio"
// de scripts/build-bank.ts).
import type { FireCase } from './types';

export interface FireBank {
  version: string;
  cases: FireCase[];
}

export async function loadFireCases(): Promise<FireBank> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}cases/incendio.json`);
  if (!res.ok) throw new Error(`No se pudo cargar incendio.json (${res.status}).`);
  const data = (await res.json()) as FireBank;
  return { version: data.version, cases: data.cases };
}
