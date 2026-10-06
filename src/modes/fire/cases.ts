// Carga de los casos de incendio (public/cases/incendio.json). Los genera
// scripts/build-fire-fixtures.ts (F1) y, a partir de F3, el generador del banco.
import type { FireCase } from './types';

export async function loadFireCases(): Promise<FireCase[]> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}cases/incendio.json`);
  if (!res.ok) throw new Error(`No se pudo cargar incendio.json (${res.status}).`);
  const data = (await res.json()) as { cases: FireCase[] };
  return data.cases;
}
