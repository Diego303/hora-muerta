// Proceso hijo de la generación en paralelo del grupo incendio: genera UN hueco y
// escribe su resultado (SlotOutcome) como JSON en la salida estándar.
// Uso interno: <script> <grupo> <hueco> <fichero con las firmas ya publicadas>
import { readFileSync } from 'node:fs';
import { generateFireSlot } from './fire-bank';

const [groupArg, slotArg, signaturesFile] = process.argv.slice(2);
const known = new Set<string>(JSON.parse(readFileSync(signaturesFile, 'utf8')) as string[]);
const outcome = generateFireSlot(Number(groupArg), Number(slotArg), known);
process.stdout.write(JSON.stringify(outcome));
