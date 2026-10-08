// Proceso hijo de build-group.ts: genera UN intento de un hueco de un grupo y escribe el
// candidato (o null) como JSON en la salida estándar.
// Uso interno: <script> <modo> <hueco> <intento>
import { findGroup, slotCandidate } from './bank-group';

const [mode, slot, retry] = process.argv.slice(2);
process.stdout.write(JSON.stringify(slotCandidate(findGroup(mode), Number(slot), Number(retry))));
