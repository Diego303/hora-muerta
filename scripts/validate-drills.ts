// Reverifica por fuerza bruta cada ejercicio del calentamiento (docs/MODOS.md 3.8): los
// 23 del prototipo y los de public/drills.json. La respuesta guardada tiene que ser
// exactamente la que dejan las pistas; en los remates (clue y contra), exactamente una
// pista decisiva. En los generados se comprueba además el nivel y los límites: hasta 4
// personas, 3 horas y 9 salas, y "Lo que sabes" con 4 pistas como mucho (6 en remates).
// Uso: pnpm drills:validate. Sale con código 1 si algo no cuadra.
import { existsSync, readFileSync } from 'node:fs';
import { drillLevel } from '../src/modes/gym/adapt';
import { bankDrillFromDef, DRILLS } from '../src/modes/gym/drills';
import { unpackDef } from '../src/modes/gym/normalize';
import type { DrillBankFile } from '../src/modes/gym/types';
import { computeAnswer, drillErrors } from '../src/modes/gym/verify';

const errors: string[] = [];
console.time('[validate-drills] tiempo');

for (const { drill, answer } of DRILLS) for (const e of drillErrors(answer, computeAnswer(drill))) errors.push(`${drill.id}: ${e}`);

const path = 'public/drills.json';
let generated = 0;
if (existsSync(path)) {
  const file = JSON.parse(readFileSync(path, 'utf8')) as DrillBankFile;
  const ids = new Set(DRILLS.map((d) => d.drill.id));
  for (const packed of file.drills) {
    const def = unpackDef(packed);
    generated++;
    const fail = (msg: string): void => {
      errors.push(`${def.id}: ${msg}`);
    };
    if (ids.has(def.id)) fail('id repetido');
    ids.add(def.id);
    const { drill } = bankDrillFromDef(def);
    for (const e of drillErrors(def.answer, computeAnswer(drill))) fail(e);
    if (def.level !== drillLevel(drill)) fail(`nivel guardado ${def.level}, calculado ${drillLevel(drill)}`);
    if (drill.N > 4 || drill.T > 3 || drill.plan.rooms.length > 9) fail(`demasiado grande para la fuerza bruta (${drill.N} personas, ${drill.T} horas, ${drill.plan.rooms.length} salas)`);
    const maxGiven = def.tech === 'remate' ? 6 : 4;
    if (def.given.length + def.facts.length > maxGiven) fail(`"Lo que sabes" con ${def.given.length + def.facts.length} pistas (máximo ${maxGiven})`);
    if (!def.explain.trim()) fail('sin explicación');
    if (/<|\{[a-z]:[^}]*$/.test(def.explain)) fail('explicación con marcas sin compactar');
  }
} else {
  console.warn(`[validate-drills] no existe ${path}: solo se validan los del prototipo (pnpm drills:build lo genera).`);
}

console.timeEnd('[validate-drills] tiempo');
const total = DRILLS.length + generated;
if (errors.length) {
  for (const e of errors) console.error(`  - ${e}`);
  console.error(`[validate-drills] ${errors.length} errores en ${total} ejercicios.`);
  process.exitCode = 1;
} else {
  console.log(`[validate-drills] ${total} ejercicios verificados por fuerza bruta (${DRILLS.length} del prototipo y ${generated} generados): todo correcto.`);
}
