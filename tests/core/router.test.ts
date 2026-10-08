import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRouter, parseRoute } from '../../src/core/router';
import type { RouterEnv, ViewDef, VisualMode } from '../../src/core/router';
import { installFrameLedger } from '../support/frameLedger';

interface Params {
  home: undefined;
  game: { tag: string };
  fire: undefined;
  academy: undefined;
}

type Defs = { [K in keyof Params]: ViewDef<Params[K]> };

function setup(log: string[] = []) {
  const modes: [VisualMode, VisualMode][] = [];
  const hashes: (string | null)[] = [];
  const env: RouterEnv = {
    applyMode: (next, previous) => {
      modes.push([next, previous]);
    },
    writeHash: (hash) => {
      hashes.push(hash);
    },
  };
  const view = <P>(name: string, mode: VisualMode, hash: string | null): ViewDef<P> => ({
    mode,
    enter: () => log.push(`enter ${name}`),
    render: () => log.push(`render ${name}`),
    leave: () => log.push(`leave ${name}`),
    hash: () => hash,
  });
  const defs: Defs = {
    home: view('home', null, null),
    game: {
      mode: null,
      enter: (p) => log.push(`enter game ${p.tag}`),
      render: (p) => log.push(`render game ${p.tag}`),
      leave: () => log.push('leave game'),
      hash: (p) => (p.tag === 'tutorial' ? 'tutorial' : null),
    },
    fire: view('fire', 'fuego', 'incendio'),
    academy: view('academy', null, 'academia'),
  };
  const router = createRouter<Params>(defs, env);
  return { router, modes, hashes };
}

describe('router de vistas', () => {
  it('para lo anterior antes de montar la nueva, y la pinta al entrar', () => {
    const log: string[] = [];
    const { router } = setup(log);
    router.showView('home');
    router.showView('academy');
    expect(log).toEqual(['enter home', 'render home', 'leave home', 'enter academy', 'render academy']);
    expect(router.current).toBe('academy');
  });

  it('render() repinta la vista activa con los mismos parámetros, sin pararla', () => {
    const log: string[] = [];
    const { router } = setup(log);
    router.showView('game', { tag: 'caso' });
    log.length = 0;
    router.render();
    expect(log).toEqual(['render game caso']);
    expect(router.current).toBe('game');
  });

  it('render() no hace nada sin vista activa', () => {
    const log: string[] = [];
    const { router } = setup(log);
    router.render();
    expect(log).toEqual([]);
  });

  it('fija el modo visual con el modo anterior y el nuevo', () => {
    const { router, modes } = setup();
    router.showView('home');
    router.showView('fire');
    router.showView('home');
    expect(modes).toEqual([
      [null, null],
      ['fuego', null],
      [null, 'fuego'],
    ]);
  });

  it('actualiza el hash con lo que dice cada vista, y lo borra al volver al menú', () => {
    const { router, hashes } = setup();
    router.showView('home');
    router.showView('fire');
    router.showView('academy');
    router.showView('game', { tag: 'tutorial' });
    router.showView('home');
    expect(hashes).toEqual([null, 'incendio', 'academia', 'tutorial', null]);
  });

  it('una pantalla transitoria sustituye el contenido sin cambiar modo ni hash, y no tiene vista activa', () => {
    const log: string[] = [];
    const { router, modes, hashes } = setup(log);
    router.showView('fire');
    router.replaceScreen(() => {
      log.push('mount screen');
      return () => log.push('leave screen');
    });
    expect(modes).toEqual([['fuego', null]]);
    expect(hashes).toEqual(['incendio']);
    expect(router.current).toBeNull();
    router.render();
    router.showView('home');
    expect(log).toEqual(['enter fire', 'render fire', 'leave fire', 'mount screen', 'leave screen', 'enter home', 'render home']);
  });

  it('si se navega otra vez durante enter, la vista que se estaba montando se para y no deja huérfanos', () => {
    const log: string[] = [];
    const hashes: (string | null)[] = [];
    let router: ReturnType<typeof createRouter<Params>> | null = null;
    const env: RouterEnv = { applyMode: () => undefined, writeHash: (h) => hashes.push(h) };
    const plain = (name: string): ViewDef<undefined> => ({
      mode: null,
      enter: () => log.push(`enter ${name}`),
      render: () => log.push(`render ${name}`),
      leave: () => log.push(`leave ${name}`),
      hash: () => null,
    });
    router = createRouter<Params>(
      {
        home: plain('home'),
        game: {
          mode: null,
          enter: () => {
            log.push('enter game (redirige)');
            router?.showView('home');
          },
          render: () => log.push('render game'),
          leave: () => log.push('leave game'),
          hash: () => null,
        },
        fire: plain('fire'),
        academy: plain('academy'),
      },
      env,
    );
    router.showView('game', { tag: 'x' });
    expect(router.current).toBe('home');
    expect(log).toEqual(['enter game (redirige)', 'enter home', 'render home', 'leave game']);
    expect(hashes).toEqual([null]);
  });

  it('si se navega otra vez durante render, la vista anterior se para una sola vez', () => {
    const log: string[] = [];
    let router: ReturnType<typeof createRouter<Params>> | null = null;
    const env: RouterEnv = { applyMode: () => undefined, writeHash: () => undefined };
    router = createRouter<Params>(
      {
        home: {
          mode: null,
          enter: () => log.push('enter home'),
          render: () => log.push('render home'),
          leave: () => log.push('leave home'),
          hash: () => null,
        },
        game: {
          mode: null,
          enter: () => log.push('enter game'),
          render: () => {
            log.push('render game');
            router?.showView('academy');
          },
          leave: () => log.push('leave game'),
          hash: () => null,
        },
        fire: { mode: 'fuego', enter: () => undefined, render: () => undefined, leave: () => undefined, hash: () => 'incendio' },
        academy: {
          mode: null,
          enter: () => log.push('enter academy'),
          render: () => log.push('render academy'),
          leave: () => log.push('leave academy'),
          hash: () => null,
        },
      },
      env,
    );
    router.showView('game', { tag: 'x' });
    router.showView('home');
    expect(log).toEqual(['enter game', 'render game', 'leave game', 'enter academy', 'render academy', 'leave academy', 'enter home', 'render home']);
  });
});

describe('volver al menú no deja temporizadores, intervalos ni fotogramas activos', () => {
  let frames: ReturnType<typeof installFrameLedger> | null = null;

  afterEach(() => {
    frames?.restore();
    frames = null;
    vi.useRealTimers();
  });

  // Cada vista arranca lo suyo en enter (un temporizador, un intervalo o un
  // fotograma) y lo para en leave. La portada tiene un intervalo propio (el
  // demo), que es lo único que debe quedar tras volver a ella.
  function timedRouter(leakFire: boolean, leakGame: boolean) {
    frames = installFrameLedger();
    const timed = <P>(mode: VisualMode, leak: boolean, start: () => () => void): ViewDef<P> => {
      let stop: (() => void) | null = null;
      return {
        mode,
        hash: () => null,
        enter: () => {
          stop = start();
        },
        render: () => undefined,
        leave: () => {
          if (!leak) stop?.();
          stop = null;
        },
      };
    };
    const router = createRouter<Params>(
      {
        home: timed(null, false, () => {
          const id = setInterval(() => undefined, 1000);
          return () => clearInterval(id);
        }),
        game: timed<{ tag: string }>(null, leakGame, () => {
          const timeout = setTimeout(() => undefined, 500);
          const frame = globalThis.requestAnimationFrame(() => undefined);
          return () => {
            clearTimeout(timeout);
            globalThis.cancelAnimationFrame(frame);
          };
        }),
        fire: timed('fuego', leakFire, () => {
          const frame = globalThis.requestAnimationFrame(() => undefined);
          return () => globalThis.cancelAnimationFrame(frame);
        }),
        academy: timed(null, false, () => {
          const id = setInterval(() => undefined, 200);
          return () => clearInterval(id);
        }),
      },
      { applyMode: () => undefined, writeHash: () => undefined },
    );
    return router;
  }

  it('tras recorrer todas las vistas, vuelve exactamente a lo que deja la portada sola', () => {
    vi.useFakeTimers();
    const router = timedRouter(false, false);
    router.showView('home');
    const baseline = { timers: vi.getTimerCount(), frames: frames?.count() ?? -1 };
    expect(baseline).toEqual({ timers: 1, frames: 0 });

    router.showView('fire');
    router.showView('game', { tag: 'x' });
    router.showView('academy');
    router.showView('fire');
    router.showView('home');

    expect({ timers: vi.getTimerCount(), frames: frames?.count() }).toEqual(baseline);
  });

  it('una pantalla transitoria que arranca un intervalo y un fotograma también los deja parados al volver al menú', () => {
    vi.useFakeTimers();
    frames = installFrameLedger();
    const router = createRouter<Params>(
      {
        home: { mode: null, hash: () => null, enter: () => undefined, render: () => undefined, leave: () => undefined },
        game: { mode: null, hash: () => null, enter: () => undefined, render: () => undefined, leave: () => undefined },
        fire: { mode: 'fuego', hash: () => null, enter: () => undefined, render: () => undefined, leave: () => undefined },
        academy: { mode: null, hash: () => null, enter: () => undefined, render: () => undefined, leave: () => undefined },
      },
      { applyMode: () => undefined, writeHash: () => undefined },
    );
    router.showView('home');
    router.replaceScreen(() => {
      const id = setInterval(() => undefined, 1000);
      const frame = globalThis.requestAnimationFrame(() => undefined);
      return () => {
        clearInterval(id);
        globalThis.cancelAnimationFrame(frame);
      };
    });
    expect(vi.getTimerCount()).toBe(1);
    expect(frames.count()).toBe(1);

    router.showView('home');
    expect(vi.getTimerCount()).toBe(0);
    expect(frames.count()).toBe(0);
  });

  it('la prueba detecta una vista que no para lo que arranca (control del propio test)', () => {
    vi.useFakeTimers();
    const router = timedRouter(true, false);
    router.showView('home');
    const baseline = vi.getTimerCount() + (frames?.count() ?? 0);
    router.showView('fire');
    router.showView('home');
    expect(vi.getTimerCount() + (frames?.count() ?? 0)).toBeGreaterThan(baseline);
  });
});

describe('parseRoute', () => {
  it('reconoce las vistas por hash', () => {
    expect(parseRoute('#incendio')).toEqual({ kind: 'fire' });
    expect(parseRoute('#academia')).toEqual({ kind: 'academy' });
    expect(parseRoute('#tutorial')).toEqual({ kind: 'tutorial' });
  });

  it('mantiene los enlaces de caso y de caso generado de siempre', () => {
    expect(parseRoute('#caso=N-012')).toEqual({ kind: 'caso', id: 'N-012' });
    expect(parseRoute('#gen=abc&n=2&m=tren')).toEqual({ kind: 'gen', seed: 'abc', diff: 2, map: 'tren' });
    expect(parseRoute('#gen=abc')).toEqual({ kind: 'gen', seed: 'abc', diff: 0, map: null });
  });

  it('cualquier otra cosa, incluidas las anclas de la portada, es el menú', () => {
    expect(parseRoute('')).toEqual({ kind: 'home' });
    expect(parseRoute('#niveles')).toEqual({ kind: 'home' });
    expect(parseRoute('#caso=')).toEqual({ kind: 'home' });
  });
});
