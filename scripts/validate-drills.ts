// Reverifica por fuerza bruta cada ejercicio del calentamiento (docs/MODOS.md 3.8):
// la respuesta guardada tiene que ser exactamente la que dejan las pistas, y en los
// remates (clue y contra) tiene que haber exactamente una pista decisiva.
// Uso: pnpm drills:validate. Sale con código 1 si algo no cuadra.
import { DRILLS } from '../src/modes/gym/drills';
import { computeAnswer, drillErrors } from '../src/modes/gym/verify';

let failed = 0;
console.time('[validate-drills] tiempo');
for (const { drill, answer } of DRILLS) {
  const errors = drillErrors(answer, computeAnswer(drill));
  if (errors.length) {
    failed += 1;
    for (const e of errors) console.error(`  - ${drill.id}: ${e}`);
  }
}
console.timeEnd('[validate-drills] tiempo');
if (failed) {
  console.error(`[validate-drills] ${failed} de ${DRILLS.length} ejercicios no cuadran.`);
  process.exitCode = 1;
} else {
  console.log(`[validate-drills] ${DRILLS.length} ejercicios verificados por fuerza bruta: todo correcto.`);
}
