// Router de vistas (docs/MODOS.md §1.1). Una sola función para cambiar de
// vista: para la anterior (leave), fija el modo visual, arranca la nueva
// (enter) y actualiza el hash. Las pantallas transitorias (ajustes, perfil,
// cargas...) se montan con replaceScreen: no cambian ni la vista ni el hash.
// No toca el DOM: el modo y el hash llegan inyectados, así se prueba en Node.

export type ViewName = 'home' | 'game' | 'fire' | 'academy';
export type VisualMode = 'fuego' | null;
export type Leave = () => void;

export interface ViewDef<P> {
  mode: VisualMode;
  /** Pinta la vista y arranca lo que necesite. Devuelve cómo pararla. */
  enter(params: P): Leave;
  /** Fragmento de URL (sin #) que representa esta vista, o null si no tiene. */
  hash(params: P): string | null;
}

export type ViewDefs<P extends Record<ViewName, unknown>> = { [N in ViewName]: ViewDef<P[N]> };

export interface RouterEnv {
  applyMode(mode: VisualMode, previous: VisualMode): void;
  writeHash(hash: string | null): void;
}

type ShowArgs<P extends Record<ViewName, unknown>, N extends ViewName> = P[N] extends undefined ? [params?: undefined] : [params: P[N]];

export interface Router<P extends Record<ViewName, unknown>> {
  showView<N extends ViewName>(name: N, ...args: ShowArgs<P, N>): void;
  replaceScreen(mount: () => Leave): void;
  readonly current: ViewName | null;
}

const noop: Leave = () => undefined;

export function createRouter<P extends Record<ViewName, unknown>>(views: ViewDefs<P>, env: RouterEnv): Router<P> {
  let current: ViewName | null = null;
  let mode: VisualMode = null;
  let leave: Leave = noop;
  // Cada navegación recibe un número. Si durante enter() se navega otra vez,
  // la vista que acaba de montarse ya no es la activa: se para en vez de dejarla huérfana.
  let generation = 0;

  function stopCurrent(): void {
    const stop = leave;
    leave = noop;
    stop();
  }

  return {
    get current() {
      return current;
    },
    showView(name, ...args) {
      const def = views[name];
      const params = args[0] as P[typeof name];
      stopCurrent();
      env.applyMode(def.mode, mode);
      mode = def.mode;
      current = name;
      const token = ++generation;
      const stop = def.enter(params);
      if (token !== generation) {
        stop();
        return;
      }
      leave = stop;
      env.writeHash(def.hash(params));
    },
    replaceScreen(mount) {
      stopCurrent();
      const token = ++generation;
      const stop = mount();
      if (token !== generation) {
        stop();
        return;
      }
      leave = stop;
    },
  };
}

export type Route =
  | { kind: 'home' }
  | { kind: 'fire' }
  | { kind: 'academy' }
  | { kind: 'tutorial' }
  | { kind: 'caso'; id: string }
  | { kind: 'gen'; seed: string; diff: 0 | 1 | 2; map: string | null };

/** Interpreta el hash de la página (§1.1 "al cargar, interpreta el hash"). */
export function parseRoute(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (raw === 'incendio') return { kind: 'fire' };
  if (raw === 'academia') return { kind: 'academy' };
  if (raw === 'tutorial') return { kind: 'tutorial' };
  const params = new URLSearchParams(raw);
  const caso = params.get('caso');
  if (caso) return { kind: 'caso', id: caso };
  const gen = params.get('gen');
  if (gen) {
    const n = Number(params.get('n'));
    return { kind: 'gen', seed: gen, diff: n === 1 || n === 2 ? n : 0, map: params.get('m') };
  }
  return { kind: 'home' };
}
