import { describe, expect, it, vi } from 'vitest';
import { createRouter, parseRoute } from '../../src/core/router';
import type { Leave, RouterEnv, VisualMode } from '../../src/core/router';

interface Params {
  home: undefined;
  game: { tag: string };
  fire: undefined;
  academy: undefined;
}

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
  const view = (name: string, mode: VisualMode, hash: string | null) => ({
    mode,
    enter: (): Leave => {
      log.push(`enter ${name}`);
      return () => log.push(`leave ${name}`);
    },
    hash: () => hash,
  });
  const router = createRouter<Params>(
    {
      home: view('home', null, null),
      game: {
        mode: null,
        enter: (p) => {
          log.push(`enter game ${p.tag}`);
          return () => log.push(`leave game ${p.tag}`);
        },
        hash: (p) => (p.tag === 'tutorial' ? 'tutorial' : null),
      },
      fire: view('fire', 'fuego', 'incendio'),
      academy: view('academy', null, 'academia'),
    },
    env,
  );
  return { router, modes, hashes };
}

describe('router de vistas', () => {
  it('para la vista anterior antes de arrancar la nueva', () => {
    const log: string[] = [];
    const { router } = setup(log);
    router.showView('home');
    router.showView('academy');
    expect(log).toEqual(['enter home', 'leave home', 'enter academy']);
    expect(router.current).toBe('academy');
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

  it('una pantalla transitoria sustituye el contenido de la vista activa sin cambiar modo ni hash', () => {
    const log: string[] = [];
    const { router, modes, hashes } = setup(log);
    router.showView('fire');
    router.replaceScreen(() => {
      log.push('mount screen');
      return () => log.push('leave screen');
    });
    expect(modes).toEqual([['fuego', null]]);
    expect(hashes).toEqual(['incendio']);
    router.showView('home');
    expect(log).toEqual(['enter fire', 'leave fire', 'mount screen', 'leave screen', 'enter home']);
  });

  it('si se navega otra vez durante enter, la vista que se estaba montando se para y no deja huérfanos', () => {
    const log: string[] = [];
    const modes: [VisualMode, VisualMode][] = [];
    const hashes: (string | null)[] = [];
    let router: ReturnType<typeof createRouter<Params>> | null = null;
    const env: RouterEnv = {
      applyMode: (n, p) => modes.push([n, p]),
      writeHash: (h) => hashes.push(h),
    };
    router = createRouter<Params>(
      {
        home: { mode: null, hash: () => null, enter: () => (log.push('enter home'), () => log.push('leave home')) },
        game: {
          mode: null,
          hash: () => null,
          enter: () => {
            log.push('enter game (redirige)');
            router?.showView('home');
            return () => log.push('leave game');
          },
        },
        fire: { mode: 'fuego', hash: () => 'incendio', enter: () => (log.push('enter fire'), () => log.push('leave fire')) },
        academy: { mode: null, hash: () => 'academia', enter: () => () => undefined },
      },
      env,
    );
    router.showView('game', { tag: 'x' });
    expect(router.current).toBe('home');
    expect(log).toEqual(['enter game (redirige)', 'enter home', 'leave game']);
    expect(hashes).toEqual([null]);
  });

  it('una vista que arranca temporizadores los deja parados al volver al menú', () => {
    vi.useFakeTimers();
    try {
      const router = createRouter<Params>(
        {
          home: { mode: null, hash: () => null, enter: () => () => undefined },
          game: { mode: null, hash: () => null, enter: () => () => undefined },
          fire: {
            mode: 'fuego',
            hash: () => 'incendio',
            enter: () => {
              const id = setInterval(() => undefined, 200);
              const frame = setTimeout(() => undefined, 700);
              return () => {
                clearInterval(id);
                clearTimeout(frame);
              };
            },
          },
          academy: { mode: null, hash: () => null, enter: () => () => undefined },
        },
        { applyMode: () => undefined, writeHash: () => undefined },
      );
      router.showView('fire');
      expect(vi.getTimerCount()).toBe(2);
      router.showView('home');
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
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
