// Perfil (§17.2, pantalla 7): rango, estadísticas y archivo de arquetipos (§16).
import { formatElapsed } from '../engine/text';
import type { Archetype } from '../engine/types';
import { getDailyResultDates, todayKey } from '../game/modes';
import { ARCHETYPE_LABELS, ARCHETYPE_ORDER, computeDailyStreak, medianTime, rankProgress } from '../game/progression';
import type { ArchetypeExample, LevelKey, Profile } from '../game/storage';

export interface ProfileOptions {
  onBack: () => void;
  /** Enlace para rejugar el caso de ejemplo de un arquetipo (§16.2); `null` si ya no se puede construir. */
  linkFor: (example: ArchetypeExample) => string | null;
}

const LEVEL_NAMES: Record<LevelKey, string> = { n: 'Novato', i: 'Inspector', c: 'Comisario' };
const LEVEL_ORDER: LevelKey[] = ['n', 'i', 'c'];

function statsRow(profile: Profile): string {
  return LEVEL_ORDER.map((level) => {
    const median = medianTime(profile.times[level]);
    return `
      <tr>
        <th>${LEVEL_NAMES[level]}</th>
        <td>${profile.solved[level]}</td>
        <td>${profile.perfect[level]}</td>
        <td>${profile.solved[level] ? Math.round((profile.firstTry[level] / profile.solved[level]) * 100) + '%' : '—'}</td>
        <td>${median === null ? '—' : formatElapsed(median)}</td>
      </tr>
    `;
  }).join('');
}

function archetypeRow(profile: Profile, archetype: Archetype, options: ProfileOptions): string {
  const count = profile.arch[archetype];
  const example = profile.archExample[archetype];
  const link = count > 0 && example ? options.linkFor(example) : null;
  return `
    <li class="arch-row${count === 0 ? ' dim' : ''}">
      <span class="arch-name">${ARCHETYPE_LABELS[archetype]}</span>
      <span class="arch-count">${count}</span>
      ${link ? `<a class="link" href="${link}">Rejugar el ejemplo</a>` : ''}
    </li>
  `;
}

export function renderProfile(root: HTMLElement, profile: Profile, options: ProfileOptions): () => void {
  const { rank, next, starsToNext } = rankProgress(profile.stars);
  const streak = computeDailyStreak(getDailyResultDates(), todayKey());
  const progressPct = next ? Math.round(((profile.stars - rank.stars) / (next.stars - rank.stars)) * 100) : 100;

  root.innerHTML = `
    <div class="gbar">
      <button class="icon-btn" id="back" aria-label="Volver a la portada">←</button>
      <div class="ttl"><b>Perfil</b></div>
    </div>
    <div class="wrap profile-view">
      <section class="sec">
        <h2>${rank.name}</h2>
        <p class="intro">${profile.stars} estrellas${next ? ` · faltan ${starsToNext} para ${next.name}` : ' · rango máximo'}</p>
        <div class="rank-bar"><i style="width:${progressPct}%"></i></div>
      </section>

      <section class="sec">
        <h2>Estadísticas</h2>
        <div class="gridwrap">
          <table class="stats-table">
            <thead><tr><th></th><th>Resueltos</th><th>Perfectos</th><th>A la primera</th><th>Tiempo mediano</th></tr></thead>
            <tbody>${statsRow(profile)}</tbody>
          </table>
        </div>
        <p class="intro">Racha diaria: ${streak.current}${streak.best > streak.current ? ` (mejor racha: ${streak.best})` : ''}.
          ${profile.legacySolvedV1 > 0 ? ` Además, ${profile.legacySolvedV1} casos resueltos en la versión anterior.` : ''}</p>
      </section>

      <section class="sec">
        <h2>Archivo de arquetipos</h2>
        <p class="intro">Cada caso se etiqueta con el patrón de deducción que lo resuelve.</p>
        <ul class="arch-list">${ARCHETYPE_ORDER.map((a) => archetypeRow(profile, a, options)).join('')}</ul>
      </section>
    </div>
  `;

  root.querySelector('#back')?.addEventListener('click', () => options.onBack());

  return () => {
    /* nada que limpiar: la pantalla se sustituye entera al navegar */
  };
}
