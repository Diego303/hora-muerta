// Sustituye requestAnimationFrame y cancelAnimationFrame (que Node no tiene) por
// una versión que solo lleva la cuenta de los fotogramas pendientes. Así una
// prueba puede comprobar que ninguna vista deja uno activo al salir.
export interface FrameLedger {
  count(): number;
  restore(): void;
}

interface FrameGlobals {
  requestAnimationFrame?: (cb: (time: number) => void) => number;
  cancelAnimationFrame?: (id: number) => void;
}

export function installFrameLedger(): FrameLedger {
  const globals = globalThis as FrameGlobals;
  const previousRequest = globals.requestAnimationFrame;
  const previousCancel = globals.cancelAnimationFrame;
  const pending = new Map<number, (time: number) => void>();
  let seq = 0;

  globals.requestAnimationFrame = (cb) => {
    const id = ++seq;
    pending.set(id, cb);
    return id;
  };
  globals.cancelAnimationFrame = (id) => {
    pending.delete(id);
  };

  return {
    count: () => pending.size,
    restore() {
      if (previousRequest) globals.requestAnimationFrame = previousRequest;
      else delete globals.requestAnimationFrame;
      if (previousCancel) globals.cancelAnimationFrame = previousCancel;
      else delete globals.cancelAnimationFrame;
      pending.clear();
    },
  };
}
