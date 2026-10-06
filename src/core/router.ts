// Router de vistas (docs/MODOS.md §1.1). Una sola función para cambiar de
// vista: para lo que hay en pantalla (leave), fija el modo visual, monta la
// nueva (enter), la pinta (render) y actualiza el hash. Las pantallas
// transitorias (ajustes, perfil, cargas...) se montan con replaceScreen: sustituyen
// el contenido sin cambiar de vista ni de hash. No toca el DOM: el modo y el
// hash llegan inyectados, así se prueba en Node.

export type ViewName = 'home' | 'game' | 'fire' | 'academy';
export type VisualMode = 'fuego' | null;
export type Leave = () => void;

export interface ViewDef<P> {
  /** Modo visual de la vista; si depende de los parámetros (una partida de incendio), una función. */
  mode: VisualMode | ((params: P) => VisualMode);
  /** Arranca lo que la vista necesita (temporizadores, escuchas, suscripciones). */
  enter(params: P): void;
  /** Pinta o repinta lo que muestra la vista. Lo llama el router al entrar y con render(). */
  render(params: P): void;
  /** Para todo lo que enter arrancó. Se llama como mucho una vez por cada enter. */
  leave(): void;
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
  /** Repinta la vista activa con sus mismos parámetros. No hace nada si hay una pantalla transitoria. */
  render(): void;
  /** Sustituye lo que hay en pantalla por una pantalla transitoria. */
  replaceScreen(mount: () => Leave): void;
  /** Vista activa, o null si lo que hay en pantalla es una pantalla transitoria. */
  readonly current: ViewName | null;
}

const noop: Leave = () => undefined;

export function createRouter<P extends Record<ViewName, unknown>>(views: ViewDefs<P>, env: RouterEnv): Router<P> {
  let currentName: ViewName | null = null;
  let repaint: Leave | null = null;
  let stopScreen: Leave = noop;
  let mode: VisualMode = null;
  // Cada navegación recibe un número. Si durante enter() o render() se navega
  // otra vez, la vista que se estaba montando ya no es la activa: se para.
  let generation = 0;

  function clearScreen(): void {
    const stop = stopScreen;
    stopScreen = noop;
    repaint = null;
    currentName = null;
    stop();
  }

  return {
    get current() {
      return currentName;
    },
    showView(name, ...args) {
      const def = views[name];
      const params = args[0] as P[typeof name];
      clearScreen();
      const next = typeof def.mode === 'function' ? def.mode(params) : def.mode;
      env.applyMode(next, mode);
      mode = next;
      const token = ++generation;
      def.enter(params);
      if (token !== generation) {
        def.leave();
        return;
      }
      currentName = name;
      repaint = () => def.render(params);
      stopScreen = () => def.leave();
      def.render(params);
      if (token !== generation) return;
      env.writeHash(def.hash(params));
    },
    render() {
      repaint?.();
    },
    replaceScreen(mount) {
      clearScreen();
      const token = ++generation;
      const stop = mount();
      if (token !== generation) {
        stop();
        return;
      }
      stopScreen = stop;
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
