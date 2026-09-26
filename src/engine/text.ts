import type { Hour } from './types';

/** "21:00", "22:00"... (§3: solo horas en punto, 21:00 es la hora 0). */
export function timeLabel(t: Hour): string {
  const h = (21 + t) % 24;
  return `${String(h).padStart(2, '0')}:00`;
}
