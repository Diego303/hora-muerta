// Motor de "pines" del plano de casos: de los cientos de casos del banco,
// enseña como mucho unos pocos a la vez, cada uno durante un tiempo fijo, y
// los va renovando — el banco entero no cabría de golpe en un plano. Sin DOM:
// solo lleva la cuenta de qué pines están vivos, dónde y hasta cuándo; quien
// llama (ui/casemap.ts) decide cuándo repintar.
import type { CaseDef } from '../engine/types';
import { randomPlacement } from './citymap';

export const MAX_LIVE_PINS = 15;
export const PIN_LIFETIME_MS = 10000;
const SPAWN_MIN_GAP_MS = 700;
const SPAWN_MAX_GAP_MS = 1800;
/** Intentos para separar un pin nuevo de los que ya hay cerca, antes de
 * aceptar sin más la mejor posición encontrada. */
const PLACEMENT_ATTEMPTS = 6;
const MIN_PIN_DISTANCE = 46;

export interface LivePin {
  /** Clave estable de esta aparición (no el id del caso: si el mismo caso
   * reapareciera más tarde, cada vez es una aparición distinta). */
  key: string;
  caseData: CaseDef;
  x: number;
  y: number;
  /** Barrio/lugar y cuadrícula de Valdeniebla (game/citymap.ts), calculados
   * una vez al aparecer para que la ficha del caso no tenga que recalcularlos. */
  where: string;
  grid: string;
  bornAt: number;
  selected: boolean;
}

export interface PinEngineOptions {
  now?: () => number;
  random?: () => number;
}

export class PinEngine {
  private readonly pool: CaseDef[];
  private readonly now: () => number;
  private readonly random: () => number;
  private live: LivePin[] = [];
  private nextSpawnAt: number;
  private nextKey = 0;

  constructor(pool: CaseDef[], options: PinEngineOptions = {}) {
    this.pool = pool;
    this.now = options.now ?? (() => Date.now());
    this.random = options.random ?? Math.random;
    this.nextSpawnAt = this.now();
  }

  getLive(): LivePin[] {
    return this.live;
  }

  /** Quita los caducados (que no estén seleccionados) y, si toca, añade uno
   * nuevo. Se llama desde un intervalo corto (ui/casemap.ts); no hace nada
   * pesado por sí sola. Devuelve `true` si algo cambió (para repintar). */
  tick(): boolean {
    const now = this.now();
    const before = this.live.length;
    this.live = this.live.filter((pin) => pin.selected || now - pin.bornAt < PIN_LIFETIME_MS);
    let changed = this.live.length !== before;
    if (this.live.length < MAX_LIVE_PINS && now >= this.nextSpawnAt) {
      if (this.spawnOne(now)) changed = true;
      this.nextSpawnAt = now + SPAWN_MIN_GAP_MS + this.random() * (SPAWN_MAX_GAP_MS - SPAWN_MIN_GAP_MS);
    }
    return changed;
  }

  select(key: string): void {
    for (const pin of this.live) pin.selected = pin.key === key;
  }

  deselectAll(): void {
    for (const pin of this.live) pin.selected = false;
  }

  private spawnOne(now: number): boolean {
    if (this.pool.length === 0) return false;
    const liveIds = new Set(this.live.map((p) => p.caseData.id));
    const candidates = this.pool.filter((c) => !liveIds.has(c.id));
    if (candidates.length === 0) return false;
    const caseData = candidates[Math.floor(this.random() * candidates.length)];

    let best: ReturnType<typeof randomPlacement> | null = null;
    let bestScore = -Infinity;
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
      const placement = randomPlacement(caseData.map, this.random);
      const minDist = this.live.reduce((min, pin) => Math.min(min, Math.hypot(pin.x - placement.x, pin.y - placement.y)), Infinity);
      if (minDist > bestScore) {
        bestScore = minDist;
        best = placement;
      }
      if (minDist >= MIN_PIN_DISTANCE) break;
    }
    if (!best) return false;
    this.live.push({ key: `p${this.nextKey++}`, caseData, x: best.x, y: best.y, where: best.where, grid: best.grid, bornAt: now, selected: false });
    return true;
  }
}
