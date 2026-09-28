// Caso en curso (§18, hm2:game): guarda el progreso de la partida activa para
// poder "Seguir el caso" si se recarga la página. Abrir la web no lo descarta;
// solo se borra al cerrar el caso (resuelto o archivado).
import type { CaseMode, Hour, Sus } from '../engine/types';
import type { ChalkStroke, GameState, MarkValue } from './store';
import { readJSON, writeJSON } from './storage';

export interface SavedGame {
  caseId: string;
  mode: CaseMode;
  hour: Hour;
  marks: [string, MarkValue][];
  objGrid: [string, MarkValue][];
  discarded: Sus[];
  struck: number[];
  strokes: ChalkStroke[];
  errors: number;
  hintsUsed: number;
  elapsed: number;
  startedAt: number;
}

export function loadSavedGame(): SavedGame | null {
  return readJSON<SavedGame | null>('game', null);
}

export function clearSavedGame(): void {
  writeJSON('game', null);
}

export function saveGame(caseId: string, mode: CaseMode, state: GameState, startedAt: number): void {
  const saved: SavedGame = {
    caseId,
    mode,
    hour: state.hour,
    marks: Array.from(state.marks.entries()),
    objGrid: Array.from(state.objGrid.entries()),
    discarded: Array.from(state.discarded),
    struck: Array.from(state.struck),
    strokes: state.strokes,
    errors: state.errors,
    hintsUsed: state.hintsUsed,
    elapsed: state.elapsed,
    startedAt,
  };
  writeJSON('game', saved);
}
