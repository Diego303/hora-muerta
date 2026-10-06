// Textos del estado del incendio (docs/MODOS.md 2.6): reloj, línea de estado y
// anuncios para lectores de pantalla. Funciones puras.
import type { RoomDef } from '../../engine/types';

/** m:ss, redondeando hacia arriba (a 0,4 s del final el reloj aún dice 0:01). */
export function clockText(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function roomName(room: RoomDef): string {
  return `${room.art} ${room.name}`;
}

/** "la Cocina", "la Cocina y el Comedor", "la Cocina, el Salón y el Comedor". */
export function joinRooms(rooms: readonly RoomDef[]): string {
  const names = rooms.map(roomName);
  if (names.length < 2) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

/** Línea de estado bajo las horas: qué arde y qué viene después (MODOS 2.6). */
export function fireStatusText(rooms: readonly RoomDef[], ign: readonly number[], t: number): string {
  const burning = rooms.filter((_, r) => t >= ign[r]);
  const upcoming = ign.filter((at) => at > t && Number.isFinite(at));
  const nextAt = upcoming.length > 0 ? Math.min(...upcoming) : null;
  const nextRooms = nextAt === null ? [] : rooms.filter((_, r) => ign[r] === nextAt);
  const after = nextAt === null ? '' : `${joinRooms(nextRooms)}, dentro de ${clockText(nextAt - t)}`;
  if (burning.length === 0) return nextAt === null ? 'Humo en el edificio.' : `Humo. Prende ${after}.`;
  if (nextAt === null) return `Arden: ${joinRooms(burning)}.`;
  return `Arden: ${joinRooms(burning)}. Después: ${after}.`;
}

/** "La Cocina arde": primera letra en mayúscula. */
export function roomIgnitedText(room: RoomDef): string {
  const name = roomName(room);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} arde.`;
}
