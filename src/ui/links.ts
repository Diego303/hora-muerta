// Enlaces compartibles a un caso (§12.5): #caso=<id> para los del banco
// (novato/inspector/comisario/diario, prefijos N/I/C/D) y #gen=<semilla>&n=&m=
// para modo infinito (prefijo INF-, reproducible). Un expediente (prefijo E-)
// no tiene formato de enlace propio (§12.5 no define uno para series): se
// devuelve null para que quien llama pueda ocultar el botón en vez de copiar
// un enlace que routeFromHash() no sabría abrir.
import type { DiffIndex } from '../engine/clues';
import type { MapId } from '../engine/types';

export interface CaseLinkRef {
  id: string;
  diff: DiffIndex;
  map: MapId;
}

export function linkForCase(ref: CaseLinkRef): string | null {
  const base = `${location.origin}${import.meta.env.BASE_URL}`;
  if (ref.id.startsWith('INF-')) return `${base}#gen=${ref.id.slice('INF-'.length)}&n=${ref.diff}&m=${ref.map}`;
  if (ref.id.startsWith('E-')) return null;
  return `${base}#caso=${ref.id}`;
}
