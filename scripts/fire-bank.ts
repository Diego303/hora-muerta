// Grupo "incendio" del banco (docs/MODOS.md 2.4 y 2.5): generación con la tubería
// normal, foco determinista, tiempos precalculados, textos y garantías de justicia,
// más el informe (focos, pistas quemadas por minuto y rechazos por garantía).
// Lo usan scripts/build-bank.ts (banco completo) y scripts/build-fire-bank.ts (solo este grupo).
import { MAPS } from '../src/engine/content/maps';
import { buildCaseCandidate, draftToCaseDef, SCORE_BAND } from '../src/engine/generate';
import { buildGraph } from '../src/engine/graph';
import type { CaseDef, MapDef, MapId } from '../src/engine/types';
import { FIRE_BURN_ANIM_S } from '../src/modes/fire/config';
import { chooseOrigin, criticalClues, fairnessFailures, GUARANTEE_TEXT, GUARANTEES, type Guarantee } from '../src/modes/fire/fairness';
import { fireIntro, fireTitle } from '../src/modes/fire/texts';
import { clueRoom, doorDistances, fireTimes } from '../src/modes/fire/timeline';
import type { FireCase } from '../src/modes/fire/types';
import { BANK_VERSION, FIRE_GROUPS, FIRE_MAX_RETRIES_PER_SLOT, type FireGroupConfig } from './bank.config';

const MAP_IDS: MapId[] = MAPS.map((m) => m.id);

export interface FireGenerationStats {
  /** Candidatos que el generador produjo (antes de las garantías). */
  candidates: number;
  /** Candidatos descartados por cada garantía (uno puede fallar varias). */
  rejections: Record<Guarantee, number>;
  /** Candidatos descartados por estar repetidos en el banco. */
  duplicates: number;
  /** Huecos que se quedaron sin caso tras todos los reintentos. */
  emptySlots: number;
}

function findMap(id: MapId): MapDef {
  const map = MAPS.find((m) => m.id === id);
  if (!map) throw new Error(`Mapa desconocido: ${id}`);
  return map;
}

/** Convierte un caso normal en caso de incendio (foco, tiempos y textos). Puro y determinista. */
export function toFireCase(caseData: CaseDef, level: FireGroupConfig['level'], variant: number): FireCase {
  const map = findMap(caseData.map);
  const graph = buildGraph(map);
  const clueRooms = caseData.clues.map(clueRoom);
  const origin = chooseOrigin(graph.adj, caseData.rv, clueRooms);
  const times = fireTimes({ adj: graph.adj, origin, crime: caseData.rv, clueRooms });
  return {
    caseData,
    fire: { origin, ign: times.ign, burnAt: times.burnAt, level, title: fireTitle(map), intro: fireIntro(map, origin, variant) },
  };
}

/** Garantías que no cumple un caso de incendio ya construido. */
export function fireFailures(fire: FireCase): Guarantee[] {
  const { caseData } = fire;
  const graph = buildGraph(findMap(caseData.map));
  return fairnessFailures({
    adj: graph.adj,
    origin: fire.fire.origin,
    crime: caseData.rv,
    burnAt: fire.fire.burnAt,
    critical: criticalClues(caseData),
    score: caseData.solve.score,
    band: SCORE_BAND[caseData.diff],
  });
}

function emptyStats(): FireGenerationStats {
  return { candidates: 0, rejections: { foco: 0, lectura: 0, ritmo: 0, cadena: 0, puntuacion: 0 }, duplicates: 0, emptySlots: 0 };
}

/** Resultado de un hueco, con sus cifras de generación. */
export interface SlotOutcome {
  slot: number;
  /** Caso aceptado (con id provisional vacío), o null si ningún reintento cumplió las garantías. */
  fire: FireCase | null;
  candidates: number;
  duplicates: number;
  rejections: Record<Guarantee, number>;
}

/**
 * Genera un hueco del grupo `groupIndex` de FIRE_GROUPS. Es una función pura de
 * (grupo, hueco, firmas ya publicadas): no mira lo aceptado en otros huecos del mismo
 * grupo, y por eso el resultado es el mismo se ejecuten los huecos en serie o en
 * paralelo. Los repetidos dentro del grupo se resuelven al juntar (generateFireGroup).
 */
export function generateFireSlot(groupIndex: number, slot: number, known: ReadonlySet<string>): SlotOutcome {
  const group = FIRE_GROUPS[groupIndex];
  const mapId = MAP_IDS[slot % MAP_IDS.length];
  const outcome: SlotOutcome = { slot, fire: null, candidates: 0, duplicates: 0, rejections: emptyStats().rejections };
  for (let retry = 0; retry < FIRE_MAX_RETRIES_PER_SLOT; retry++) {
    const seed = `${BANK_VERSION}|incendio|${group.mode}|${slot}|${retry}`;
    const draft = buildCaseCandidate(seed, group.diff, mapId, { maxClues: group.maxClues });
    if (!draft) continue;
    outcome.candidates += 1;
    if (known.has(draft.sig)) {
      outcome.duplicates += 1;
      continue;
    }
    const candidate = toFireCase(draftToCaseDef(draft, '', group.mode), group.level, slot);
    const failed = fireFailures(candidate);
    for (const g of failed) outcome.rejections[g] += 1;
    if (failed.length === 0) {
      outcome.fire = candidate;
      return outcome;
    }
  }
  return outcome;
}

/** Ejecuta varios huecos de un grupo y devuelve sus resultados (en cualquier orden). */
export type SlotRunner = (groupIndex: number, slots: number[], known: ReadonlySet<string>) => Promise<SlotOutcome[]>;

export const runSlotsInProcess: SlotRunner = (groupIndex, slots, known) => Promise.resolve(slots.map((slot) => generateFireSlot(groupIndex, slot, known)));

/**
 * Genera el grupo entero por tandas de huecos (`batchSize` a la vez) y junta los
 * resultados en orden de hueco. Si un hueco se queda vacío o repite un caso ya
 * aceptado en el grupo, se sigue con el siguiente (otro escenario) hasta llenar el
 * cupo, con un tope de 3 × cupo. Los huecos calculados de más en la última tanda se
 * descartan sin contar en las cifras: el resultado no depende del tamaño de la tanda.
 */
export async function generateFireGroup(
  known: ReadonlySet<string>,
  runSlots: SlotRunner = runSlotsInProcess,
  batchSize = 1,
  log: (line: string) => void = console.log,
  groups: readonly Pick<FireGroupConfig, 'level' | 'count' | 'idPrefix'>[] = FIRE_GROUPS,
): Promise<{ cases: FireCase[]; stats: FireGenerationStats }> {
  const stats = emptyStats();
  const cases: FireCase[] = [];
  const accepted = new Set<string>();
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const limit = group.count * 3;
    let written = 0;
    for (let next = 0; written < group.count && next < limit; ) {
      const slots = Array.from({ length: Math.min(Math.max(1, batchSize), limit - next) }, (_, i) => next + i);
      next += slots.length;
      const outcomes = (await runSlots(gi, slots, known)).sort((a, b) => a.slot - b.slot);
      for (const o of outcomes) {
        if (written >= group.count) break;
        stats.candidates += o.candidates;
        stats.duplicates += o.duplicates;
        for (const g of GUARANTEES) stats.rejections[g] += o.rejections[g];
        const mapId = MAP_IDS[o.slot % MAP_IDS.length];
        if (!o.fire || accepted.has(o.fire.caseData.sig)) {
          if (o.fire) stats.duplicates += 1;
          stats.emptySlots += 1;
          log(`[incendio] ${group.level}, hueco ${o.slot + 1} (${mapId}): sin caso válido; se prueba el siguiente.`);
          continue;
        }
        const id = `${group.idPrefix}-${String(written + 1).padStart(2, '0')}`;
        accepted.add(o.fire.caseData.sig);
        cases.push({ ...o.fire, caseData: { ...o.fire.caseData, id } });
        written += 1;
        log(`[incendio] ${id} (${mapId}) listo.`);
      }
    }
    if (written < group.count) log(`[incendio] ${group.level}: solo ${written} de ${group.count} casos tras ${limit} huecos.`);
  }
  return { cases, stats };
}

/** Pistas quemadas al final de cada minuto consumido (acumulado), en porcentaje. */
export function burntShareByMinute(cases: readonly FireCase[]): number[] {
  const all = cases.flatMap((c) => c.fire.burnAt);
  return [1, 2, 3, 4, 5].map((m) => (all.length === 0 ? 0 : (100 * all.filter((at) => at + FIRE_BURN_ANIM_S <= m * 60).length) / all.length));
}

function pct(x: number): string {
  return `${x.toFixed(0)} %`;
}

export function buildFireReport(cases: readonly FireCase[], stats: FireGenerationStats | null): string {
  const lines: string[] = ['# Informe del grupo incendio', '', `Versión del banco: ${BANK_VERSION}. Casos: ${cases.length}.`, ''];

  for (const level of ['Novato', 'Inspector exprés'] as const) {
    const group = cases.filter((c) => c.fire.level === level);
    lines.push(`## ${level} (${group.length} casos)`, '');
    if (group.length === 0) continue;

    lines.push('### Focos', '', '| Escenario | Foco | Casos | Puertas hasta la escena |', '|---|---|---|---|');
    const byFocus = new Map<string, { map: string; room: string; n: number; doors: number[] }>();
    for (const c of group) {
      const map = findMap(c.caseData.map);
      const key = `${map.id}:${c.fire.origin}`;
      const doors = doorDistances(buildGraph(map).adj, c.fire.origin)[c.caseData.rv];
      const entry = byFocus.get(key) ?? { map: map.name, room: `${map.rooms[c.fire.origin].art} ${map.rooms[c.fire.origin].name}`, n: 0, doors: [] };
      entry.n += 1;
      entry.doors.push(doors);
      byFocus.set(key, entry);
    }
    for (const e of [...byFocus.values()].sort((a, b) => a.map.localeCompare(b.map) || b.n - a.n)) {
      lines.push(`| ${e.map} | ${e.room} | ${e.n} | ${[...new Set(e.doors)].sort().join(', ')} |`);
    }
    lines.push('');

    const share = burntShareByMinute(group);
    lines.push('### Pistas quemadas (acumulado al final de cada minuto consumido)', '', '| 1:00 | 2:00 | 3:00 | 4:00 | 5:00 |', '|---|---|---|---|---|');
    lines.push(`| ${share.map(pct).join(' | ')} |`, '');
    const perMinute = share.map((s, i) => s - (i === 0 ? 0 : share[i - 1]));
    lines.push(`Nuevas cada minuto: ${perMinute.map(pct).join(', ')}.`, '');

    const clues = group.map((c) => c.caseData.clues.length);
    const scores = group.map((c) => c.caseData.solve.score);
    const critical = group.map((c) => {
      const crit = criticalClues(c.caseData);
      return crit.length === 0 ? 100 : (100 * crit.filter((i) => c.fire.burnAt[i] > 150).length) / crit.length;
    });
    lines.push(
      `Pistas por caso: ${Math.min(...clues)} a ${Math.max(...clues)}. Puntuación: ${Math.min(...scores)} a ${Math.max(...scores)}. ` +
        `Cadena crítica que sobrevive a las 2:30: media ${pct(critical.reduce((a, b) => a + b, 0) / critical.length)}, mínimo ${pct(Math.min(...critical))}.`,
      '',
    );
  }

  lines.push('## Rechazos en la generación', '');
  if (!stats) {
    lines.push('(Sin datos de generación: este informe se ha hecho a partir de incendio.json.)', '');
  } else {
    lines.push(`Candidatos generados: ${stats.candidates}. Repetidos: ${stats.duplicates}. Huecos vacíos: ${stats.emptySlots}.`, '');
    lines.push('| Garantía | Rechazos |', '|---|---|');
    for (const g of GUARANTEES) lines.push(`| ${GUARANTEE_TEXT[g]} | ${stats.rejections[g]} |`);
    lines.push('', 'Un mismo candidato puede fallar varias garantías.', '');
  }
  return lines.join('\n');
}

const LEVEL_DIFF: Record<FireGroupConfig['level'], 0 | 1> = { Novato: 0, 'Inspector exprés': 1 };

/** Comprobaciones propias de un caso de incendio (las del caso normal van aparte, en
 * validate-bank). Devuelve los errores encontrados; vacío si todo cuadra. */
export function fireCaseErrors(fire: FireCase): string[] {
  const errors: string[] = [];
  const { caseData } = fire;
  const map = findMap(caseData.map);
  const group = FIRE_GROUPS.find((g) => g.level === fire.fire.level);
  if (!group) errors.push(`nivel desconocido: ${fire.fire.level}`);
  if (caseData.diff !== LEVEL_DIFF[fire.fire.level]) errors.push(`el nivel ${fire.fire.level} no corresponde a la dificultad ${caseData.diff}`);
  if (group?.maxClues !== undefined && caseData.clues.length > group.maxClues) errors.push(`${caseData.clues.length} pistas, más del tope de ${group.maxClues}`);

  const expected = toFireCase(caseData, fire.fire.level, 0);
  if (fire.fire.origin !== expected.fire.origin) errors.push(`el foco (${fire.fire.origin}) no es el que sale de la regla (${expected.fire.origin})`);
  const times = fireTimes({ adj: buildGraph(map).adj, origin: fire.fire.origin, crime: caseData.rv, clueRooms: caseData.clues.map(clueRoom) });
  if (JSON.stringify(times.ign) !== JSON.stringify(fire.fire.ign)) errors.push('ign no coincide con la fórmula desde el foco');
  if (JSON.stringify(times.burnAt) !== JSON.stringify(fire.fire.burnAt)) errors.push('burnAt no coincide con la fórmula desde el foco');
  if (fire.fire.title !== fireTitle(map)) errors.push(`título inesperado: ${fire.fire.title}`);
  if (!fire.fire.intro.includes(map.rooms[fire.fire.origin].name)) errors.push('la presentación no nombra el foco');
  for (const g of fireFailures(fire)) errors.push(`no cumple la garantía: ${GUARANTEE_TEXT[g]}`);
  return errors;
}
