// Construye public/drills.json, el banco de ejercicios del calentamiento (docs/MODOS.md
// 3.8, fuente 2): convierte los pasos de la cadena crítica del solver humano de cada
// caso del banco en ejercicios (src/modes/gym/generate.ts), y elige 30 por técnica y
// nivel (360 en total, 90 de ellos remates: decisión D4) con variedad de mapas, de
// casos y de tipo de respuesta. Determinista: con el mismo banco de casos sale lo mismo.
// Escribe también reports/drills-report.md, con una muestra para revisar a mano.
// Uso: pnpm drills:build
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { rngFromSeed, shuffle } from '../src/engine/rng';
import { carryText, clueText, plainText } from '../src/engine/text';
import type { BankFile } from '../src/engine/types';
import { analyzeCase, drillsFromCase, REJECTS, type Candidate } from '../src/modes/gym/generate';
import { drillFromDef, packDef } from '../src/modes/gym/normalize';
import type { DrillBankFile, DrillDef, Tech } from '../src/modes/gym/types';

const SOURCES = ['novato', 'inspector', 'diario'] as const;
const PER_BUCKET = 30;
const TECHS: Tech[] = ['alcance', 'seguro', 'tabla', 'remate'];
const LEVELS = [1, 2, 3] as const;
/** Como mucho tantos ejercicios de un mismo caso en todo el banco. */
const PER_CASE = 3;

/** Variante dentro de una técnica, para repartir: sentido del alcance, V/F/NS, quién/qué/NS, clue/contra. */
function flavour(def: DrillDef): string {
  switch (def.tech) {
    case 'alcance':
      return def.given.some((g) => g.k === 'at' && def.ask && g.t > (def.ask.t ?? 0)) ? 'atrás' : 'adelante';
    case 'seguro':
      return def.answer.type === 'tri' ? def.answer.value : '?';
    case 'tabla':
      return def.answer.type === 'pick' && def.answer.value === 'NS' ? 'NS' : def.ask?.who !== null ? 'quién' : 'qué';
    case 'remate':
      return def.type;
  }
}

/** Dos ejercicios iguales salvo el id, el origen y la explicación cuentan como uno. */
function signature(def: DrillDef): string {
  return JSON.stringify({ ...def, id: '', src: '', explain: '', context: '', prompt: '' });
}

function select(candidates: Candidate[]): DrillDef[] {
  const rng = rngFromSeed('hora-muerta:drills:v1');
  const perCase = new Map<string, number>();
  const chosen: DrillDef[] = [];
  // Primero los grupos con menos candidatos, para que no se queden sin casos.
  const buckets = TECHS.flatMap((tech) => LEVELS.map((level) => ({ tech, level, pool: shuffle(rng, candidates.filter((c) => c.def.tech === tech && c.def.level === level)) })));
  buckets.sort((x, y) => x.pool.length - y.pool.length);
  for (const { pool } of buckets) {
    const flavours = [...new Set(pool.map((c) => flavour(c.def)))].sort();
    const maps = [...new Set(pool.map((c) => c.map))].sort();
    const taken: DrillDef[] = [];
    let turn = 0;
    let stalled = 0;
    while (taken.length < PER_BUCKET && stalled < flavours.length * maps.length) {
      const f = flavours[turn % flavours.length];
      const m = maps[Math.floor(turn / flavours.length) % maps.length];
      turn++;
      const i = pool.findIndex((c) => flavour(c.def) === f && c.map === m && (perCase.get(c.caseId) ?? 0) < PER_CASE);
      if (i < 0) {
        stalled++;
        continue;
      }
      stalled = 0;
      const [c] = pool.splice(i, 1);
      perCase.set(c.caseId, (perCase.get(c.caseId) ?? 0) + 1);
      taken.push(c.def);
    }
    // Si la variedad no da para 30, se completa con lo que quede.
    for (const c of pool) {
      if (taken.length >= PER_BUCKET) break;
      if ((perCase.get(c.caseId) ?? 0) >= PER_CASE) continue;
      perCase.set(c.caseId, (perCase.get(c.caseId) ?? 0) + 1);
      taken.push(c.def);
    }
    chosen.push(...taken);
  }
  const order = (d: DrillDef): number => TECHS.indexOf(d.tech) * 10 + d.level;
  return chosen.sort((x, y) => order(x) - order(y) || x.id.localeCompare(y.id));
}

/** Un ejercicio en texto plano, como lo vería quien juega (para revisarlo). */
export function drillAsText(def: DrillDef): string {
  const drill = drillFromDef(def);
  const ctx = drill.ctx;
  const t = (html: string): string => plainText(html);
  const lines: string[] = [];
  lines.push(`**${def.id}** · ${def.tech} · ${def.type} · nivel ${def.level} · ${def.map ?? 'sin plano'} · ${ctx.suspects.map((s) => s.name).join(', ')}${ctx.objects.length ? ` · objetos: ${ctx.objects.map((o) => o.name).join(', ')}` : ''}`);
  if (def.context) lines.push(`> ${def.context}`);
  if (def.given.length) lines.push(`Lo que sabes: ${def.given.map((c) => t(clueText(c, ctx))).join(' / ')}`);
  if (def.type === 'tri' && def.stmt) lines.push(`Afirmación: «${t(def.stmt.k === 'carry' ? carryText(def.stmt.c, def.stmt.o, ctx) : clueText(def.stmt, ctx))}» ¿Verdadero, falso o no se puede saber?`);
  if (def.type === 'pick' && def.ask) {
    if (def.ask.who !== null) lines.push(`Pregunta: ¿Quién llevaba ${ctx.objects[def.ask.who].article} ${ctx.objects[def.ask.who].name}?`);
    if (def.ask.what !== null) lines.push(`Pregunta: ¿Qué llevaba ${ctx.suspects[def.ask.what].name}?`);
  }
  if (def.prompt) lines.push(`Pregunta: ${def.prompt}`);
  if (def.clues.length) lines.push(`Pistas: ${def.clues.map((c, i) => `${i + 1}. ${t(clueText(c, ctx))}${def.used[i] ? ' (tachada)' : ''}`).join(' / ')}`);
  const a = def.answer;
  const answer =
    a.type === 'reach'
      ? a.rooms.map((r) => ctx.rooms[r].name).join(', ')
      : a.type === 'tri'
        ? { V: 'Verdadero', F: 'Falso', NS: 'No se puede saber' }[a.value]
        : a.type === 'pick'
          ? a.value === 'NS'
            ? 'No se puede saber'
            : def.ask?.who !== null
              ? ctx.suspects[a.value].name
              : ctx.objects[a.value].name
          : `pista ${a.decide[0] + 1}${a.answer !== null ? ` (${def.decide?.what !== null && def.decide?.what !== undefined ? ctx.objects[a.answer].name : ctx.suspects[a.answer].name})` : ''}`;
  lines.push(`Respuesta: ${answer}`);
  lines.push(`Explicación: ${t(drill.explain)}`);
  lines.push(`Origen: ${def.src}`);
  return lines.join('  \n');
}

function main(): void {
  const t0 = Date.now();
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  let cases = 0;
  for (const source of SOURCES) {
    const bank = JSON.parse(readFileSync(`public/cases/${source}.json`, 'utf8')) as BankFile;
    for (const caseData of bank.cases) {
      const analysis = analyzeCase(caseData);
      if (!analysis) continue;
      cases++;
      for (const c of drillsFromCase(analysis)) {
        const sig = signature(c.def);
        if (seen.has(sig)) continue;
        seen.add(sig);
        candidates.push(c);
      }
    }
    console.log(`[build-drills] ${source}: ${candidates.length} candidatos hasta ahora (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }

  const drills = select(candidates);
  const version = `d1-${createHash('sha256').update(JSON.stringify(drills)).digest('hex').slice(0, 10)}`;
  const file: DrillBankFile = { version, drills: drills.map(packDef) };
  writeFileSync('public/drills.json', `${JSON.stringify(file)}\n`);
  const bytes = Buffer.byteLength(JSON.stringify(file));

  // Informe.
  const count = (pred: (d: DrillDef) => boolean): number => drills.filter(pred).length;
  const candCount = (tech: Tech, level: number): number => candidates.filter((c) => c.def.tech === tech && c.def.level === level).length;
  const rows = TECHS.map((tech) => `| ${tech} | ${LEVELS.map((l) => `${count((d) => d.tech === tech && d.level === l)} (de ${candCount(tech, l)})`).join(' | ')} | ${count((d) => d.tech === tech)} |`);
  const flavours = TECHS.map((tech) => {
    const f = new Map<string, number>();
    for (const d of drills.filter((x) => x.tech === tech)) f.set(flavour(d), (f.get(flavour(d)) ?? 0) + 1);
    return `- ${tech}: ${[...f].map(([k, v]) => `${k} ${v}`).join(', ')}`;
  });
  const maps = new Map<string, number>();
  for (const d of drills) maps.set(d.map ?? 'sin plano', (maps.get(d.map ?? 'sin plano') ?? 0) + 1);
  const rng = rngFromSeed('hora-muerta:drills:muestra');
  const sample = TECHS.map((tech) => `### ${tech}\n\n${shuffle(rng, drills.filter((d) => d.tech === tech)).slice(0, 10).map(drillAsText).join('\n\n')}`);
  const report = `# Banco de ejercicios del calentamiento

Generado por \`pnpm drills:build\` (scripts/build-drills.ts). Versión \`${version}\`.

- Casos analizados: ${cases} (${SOURCES.join(', ')}).
- Candidatos válidos (respuesta por fuerza bruta, el solver humano llega a lo mismo, filtros de calidad), sin duplicados: ${candidates.length}.
- Elegidos: ${drills.length}. Tamaño de public/drills.json: ${(bytes / 1024).toFixed(0)} KB sin comprimir.
- Tiempo: ${((Date.now() - t0) / 1000).toFixed(1)} s.

## Por técnica y nivel (elegidos, entre paréntesis los candidatos)

| Técnica | Nivel 1 | Nivel 2 | Nivel 3 | Total |
|---|---|---|---|---|
${rows.join('\n')}

## Variantes

${flavours.join('\n')}

## Mapas

${[...maps].map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## Candidatos descartados, por motivo

${Object.entries(REJECTS)
  .sort((x, y) => y[1] - x[1])
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}

## Muestra para revisar (10 al azar por técnica)

${sample.join('\n\n')}
`;
  writeFileSync('reports/drills-report.md', report);
  console.log(`[build-drills] ${drills.length} ejercicios en public/drills.json (${(bytes / 1024).toFixed(0)} KB), versión ${version}.`);
  for (const r of rows) console.log(`[build-drills] ${r}`);
}

main();
