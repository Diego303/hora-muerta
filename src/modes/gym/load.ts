// Carga del banco de ejercicios en el navegador: public/drills.json (generado por
// scripts/build-drills.ts) más los 23 del prototipo. Aparte de drills.ts porque usa
// import.meta.env, que no existe en los scripts de Node.
import { bankDrillFromDef, DRILLS, type BankDrill } from './drills';
import type { DrillBankFile } from './types';

let bank: Promise<BankDrill[]> | null = null;

/** El banco completo: los del prototipo primero y después los generados. Si
 * public/drills.json no se puede cargar, solo los del prototipo. */
export function loadDrillBank(): Promise<BankDrill[]> {
  bank ??= fetch(`${import.meta.env.BASE_URL}drills.json`)
    .then((res) => (res.ok ? (res.json() as Promise<DrillBankFile>) : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((file) => [...DRILLS, ...file.drills.map(bankDrillFromDef)])
    .catch(() => {
      bank = null;
      return DRILLS;
    });
  return bank;
}
