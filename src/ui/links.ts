// Enlaces compartibles a un caso (§12.5): #caso=<id> para los del banco
// (novato/inspector/comisario/diario, prefijos N/I/C/D) y #gen=<semilla>&n=&m=
// para modo infinito (prefijo INF-, reproducible). Los casos que no se pueden
// abrir por enlace (el tutorial) devuelven null, para que quien llama oculte el
// botón en vez de copiar un enlace que routeFromHash() no sabría abrir.
import type { DiffIndex } from '../engine/clues';
import type { MapId } from '../engine/types';

/** Ids de los casos del banco que main.ts sabe abrir con #caso= (ID_PREFIX_TO_MODE). */
const BANK_ID = /^[NICD]-/;

export interface CaseLinkRef {
  id: string;
  diff: DiffIndex;
  map: MapId;
}

export function linkForCase(ref: CaseLinkRef): string | null {
  const base = `${location.origin}${import.meta.env.BASE_URL}`;
  if (ref.id.startsWith('INF-')) return `${base}#gen=${ref.id.slice('INF-'.length)}&n=${ref.diff}&m=${ref.map}`;
  if (BANK_ID.test(ref.id)) return `${base}#caso=${ref.id}`;
  return null;
}
