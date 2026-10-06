// Datos de un caso de incendio (docs/MODOS.md 2.4). Un caso de incendio es un caso
// normal del banco más estos tiempos ya calculados: el navegador no calcula nada.
import type { CaseDef, Room } from '../../engine/types';

export interface FireData {
  /** Foco del incendio. */
  origin: Room;
  /** Segundo de ignición de cada sala (índice = Room). */
  ign: number[];
  /** Segundo de quemado de cada pista (índice = posición en `caseData.clues`). */
  burnAt: number[];
  level: 'Novato' | 'Inspector exprés';
  title: string;
  intro: string;
}

export interface FireCase {
  caseData: CaseDef;
  fire: FireData;
}
