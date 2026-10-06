// Genera public/cases/incendio.json con los casos de incendio de prueba (F1). Usa
// los mismos mapas, niveles, focos, títulos y textos que los dos casos del
// prototipo (docs/referencia/hora-muerta-modos.html, FIRE_CASES), pero el
// puzle lo produce nuestro generador: las semillas del prototipo no se pueden
// reproducir con él. Si una semilla no da un caso válido, se prueba la siguiente
// (sufijo -2, -3...) y el resultado queda escrito en el fichero.
// Uso: pnpm exec tsx scripts/build-fire-fixtures.ts
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { MAPS } from '../src/engine/content/maps';
import { buildCaseCandidate, draftToCaseDef } from '../src/engine/generate';
import { buildGraph } from '../src/engine/graph';
import type { DiffIndex } from '../src/engine/clues';
import type { CaseMode, MapId } from '../src/engine/types';
import { clueRoom, fireTimes } from '../src/modes/fire/timeline';
import type { FireCase } from '../src/modes/fire/types';
import { BANK_VERSION } from './bank.config';

const OUT = path.join(process.cwd(), 'public', 'cases', 'incendio.json');
const MAX_CLUES_BY_DIFF: Record<DiffIndex, number> = { 0: 9, 1: 9, 2: 9 };

interface FixtureSpec {
  id: string;
  seed: string;
  diff: DiffIndex;
  mode: CaseMode;
  map: MapId;
  origin: string;
  level: 'Novato' | 'Inspector exprés';
  title: string;
  intro: string;
}

const SPECS: FixtureSpec[] = [
  {
    id: 'INC-01',
    seed: 'INC-MAN7',
    diff: 0,
    mode: 'novato',
    map: 'mansion',
    origin: 'coc',
    level: 'Novato',
    title: 'Casa Valdemar en llamas',
    intro: 'Alguien prendió fuego a la Cocina para borrar sus huellas. Los bomberos te dan cinco minutos dentro antes de que ceda el tejado.',
  },
  {
    id: 'INC-02',
    seed: 'INC-MUS6',
    diff: 1,
    mode: 'inspector',
    map: 'museo',
    origin: 'arc',
    level: 'Inspector exprés',
    title: 'Museo Aldana en llamas',
    intro: 'Un cortocircuito en el Archivo ha incendiado el museo en plena gala. Cinco minutos para dar con el culpable entre el humo.',
  },
];

function build(spec: FixtureSpec): FireCase {
  const map = MAPS.find((m) => m.id === spec.map);
  if (!map) throw new Error(`Mapa desconocido: ${spec.map}`);
  const origin = map.rooms.findIndex((r) => r.id === spec.origin);
  if (origin < 0) throw new Error(`Sala de foco desconocida en ${spec.map}: ${spec.origin}`);

  for (let attempt = 1; attempt <= 40; attempt++) {
    const seed = attempt === 1 ? spec.seed : `${spec.seed}-${attempt}`;
    const draft = buildCaseCandidate(seed, spec.diff, spec.map);
    if (!draft) continue;
    if (draft.clues.length > MAX_CLUES_BY_DIFF[spec.diff]) continue;
    const caseData = draftToCaseDef(draft, spec.id, spec.mode);
    const graph = buildGraph(map);
    const clueRooms = caseData.clues.map(clueRoom);
    const times = fireTimes({ adj: graph.adj, origin, crime: caseData.rv, clueRooms });
    console.log(`[build-fire-fixtures] ${spec.id}: semilla "${seed}", ${caseData.clues.length} pistas, foco ${spec.origin}, escena ${map.rooms[caseData.rv].id}.`);
    return {
      caseData,
      fire: { origin, ign: times.ign, burnAt: times.burnAt, level: spec.level, title: spec.title, intro: spec.intro },
    };
  }
  throw new Error(`No se encontró un caso válido para ${spec.id} tras 40 semillas.`);
}

const cases = SPECS.map(build);
writeFileSync(OUT, JSON.stringify({ version: BANK_VERSION, cases }));
console.log(`[build-fire-fixtures] ${cases.length} casos escritos en public/cases/incendio.json.`);
