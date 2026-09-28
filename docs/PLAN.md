# Hora Muerta v2 — plan de trabajo

> Estado del proyecto y hoja de ruta por hitos. Se actualiza al cerrar cada hito (casillas, fecha, notas). Fuente de verdad del diseño: `docs/DISENO_TECNICO.md`. Decisiones ante ambigüedades: `docs/DECISIONES.md` (se crea en M0).

## 0. Resultado del Paso 0

Repositorio explorado: proyecto Astro 5.17 recién creado a partir de la plantilla oficial (`src/pages/index.astro` + `Welcome.astro` de ejemplo), sin motor de juego, sin pruebas, sin lint. `astro.config.mjs` ya fija `site: "https://Diego303.github.io"` y `base: "/hora-muerta/"` (GitHub Pages, project page). Hay un workflow `.github/workflows/astro.yaml` que despliega a Pages con `withastro/action@v2` forzando `package-manager: pnpm@9`; se deja sin tocar. Entorno de este sandbox: Node.js no está instalado y, por petición del usuario, no se instala ni se ejecuta nada aquí (ver "Modo de trabajo" más abajo); el usuario instala, arranca y prueba en otro entorno con Node y pnpm.

No hay framework de UI (React/Vue/etc.) instalado ni previsto: Astro se usa solo como generador de sitio estático y servidor de desarrollo.

---

## 1. Decisión de integración y motivo

**Opción (b) del prompt maestro: ruta de solo cliente dentro de Astro.**

- `src/pages/index.astro` es la única página del sitio y monta el juego completo (portada + mesa de trabajo) en un contenedor `<div id="app">` vacío. No se reescribe el juego con componentes de Astro/React: toda la lógica de pantallas vive en `src/ui/*.ts` (vanilla TS + DOM), igual que v1 pero organizada según la sección 19.2 del diseño.
- Motivo: el diseño exige `src/engine` sin DOM (usable en navegador, Web Worker y Node) y una pizarra con render SVG/canvas hecho a mano; un framework de componentes no aporta nada aquí y complicaría el Web Worker y los scripts de banco (que deben poder `import` el motor tal cual). Mantener una sola ruta estática evita duplicar la navegación tipo SPA que ya tiene v1 (portada/juego por `hidden` + hash) en el sistema de rutas de Astro.
- `Layout.astro` se conserva como layout base (`<head>`: charset, viewport con `viewport-fit=cover`, preconnect a Google Fonts, `manifest.webmanifest` desde M9, `data-theme`) y pasa a álojar los símbolos SVG de iconos compartidos.
- Se eliminan en M0 los sobrantes de la plantilla: `src/components/Welcome.astro`, `src/assets/astro.svg`, `src/assets/background.svg`.
- El banco de casos (`public/cases/*.json`, generado offline por `bank:build`) vive en `public/` de Astro y se sirve tal cual; todo acceso a rutas absolutas de `public/` (banco, manifest PWA, iconos, favicons) usa `import.meta.env.BASE_URL` para funcionar bajo `/hora-muerta/` tanto en `astro dev` como en producción.
- El Web Worker del modo infinito se crea con `new Worker(new URL('../workers/generator.worker.ts', import.meta.url), { type: 'module' })`, patrón nativo de Vite/Astro, sin plugin adicional.
- Los scripts del banco (`scripts/*.ts`) son independientes del build de Astro: se ejecutan con `tsx` en Node y usan `worker_threads` para paralelizar; importan `src/engine/*` directamente porque no depende del DOM.

**Decisión de gestor de paquetes: pnpm** (confirmado por el usuario). El workflow `.github/workflows/astro.yaml` ya fuerza `pnpm@9` y se deja tal cual, sin tocarlo. "Scripts npm" en el encargo se cumple como el campo `scripts` de `package.json`, ejecutable con `pnpm run <script>`. Ver `docs/DECISIONES.md`.

**Modo de trabajo de este entorno (actualizado):** M0-M3 se escribieron sin poder ejecutar nada, por petición inicial del usuario. Más tarde el usuario pidió instalar Node y pnpm en este mismo entorno (siguiendo las guías oficiales: nvm + Node 24 LTS, pnpm vía npm ya que `get.pnpm.io` no era alcanzable) para probar el proyecto aquí. La primera ejecución real de `pnpm test` encontró y permitió corregir 2 bugs reales en el solver humano (ver `docs/DECISIONES.md`); tras corregirlos y, más tarde, implementar R6_HYPOTHESIS, `pnpm typecheck`, `pnpm lint` y `pnpm test` pasan limpios (10 archivos, 76 pruebas, ~20 min por el coste real de generar casos Inspector/Comisario).

---

## 2. Estructura de carpetas final

```
src/
  engine/                    # sin DOM: navegador, Web Worker y Node
    rng.ts                   # mulberry32, fnv1a, shuffle, pick
    content/maps.ts          # 6 MapDef (Apéndice A)
    content/cast.ts          # reparto, colores, víctimas, objetos, motivos (Apéndice A/§4)
    graph.ts                 # adj, adjM, feat, dist
    paths.ts                 # enumeración de recorridos por T
    truth.ts                 # generación de la noche y sesgos (§7.2)
    clues.ts                 # holds(), reserva, prohibiciones, topes, orden (§6)
    exact.ts                 # solver exacto (§8, portado de v1)
    human.ts                 # solver humano: niveles, pasos, cadena crítica, puntuación (§9)
    archetypes.ts             # deducción clave y etiquetas (§10)
    generate.ts               # generarCaso() (§7.1)
    text.ts                   # textos de pistas y pasos (Apéndices B y C)
    types.ts                  # tipos de la sección 5
  game/
    store.ts                  # estado + acciones + suscripción + deshacer
    storage.ts                 # hm2:* con try/catch y migración desde hm:
    bank.ts                     # manifest, carga bajo demanda, orden personal, jugados (§12.5)
    modes.ts                     # suelto, diario, expediente, infinito (§13)
    hints.ts                      # pista del inspector (§15)
    scoring.ts                     # estrellas, errores, cierre (§14)
    progression.ts                  # rango, desbloqueos, archivo (§16)
  ui/
    landing.ts  demo.ts  selector.ts  board.ts  plan.ts  chalk.ts
    sheet.ts  clues.ts  objects.ts  casetab.ts  accuse.ts  closure.ts
    reconstruct.ts  settings.ts  profile.ts  help.ts  toast.ts  a11y.ts
  styles/
    tokens.css  base.css  landing.css  game.css  sheet.css
  workers/
    generator.worker.ts
  main.ts                       # arranque, router simple por hash/estado
  pages/
    index.astro                  # <div id="app">, <div id="layer">, <script>import '../main.ts'</script>
  layouts/
    Layout.astro                  # head, fuentes, símbolos SVG compartidos, tema
scripts/
  build-bank.ts    validate-bank.ts    bank-report.ts    bank.config.ts
public/
  cases/                              # generado: manifest.json, novato.json, inspector.json, comisario.json, diario.json, expedientes.json
  manifest.webmanifest                # M9
  icons/                              # M9
  favicon.svg  favicon.ico            # ya existen
tests/
  engine/*.test.ts
  bank/*.test.ts
  e2e/*.spec.ts
reports/
  bank-report.md                      # generado por bank:report, versionado
docs/
  DISENO_TECNICO.md
  PLAN.md
  DECISIONES.md                       # nuevo, se crea en M0
  referencia/hora-muerta-v1.html
astro.config.mjs
eslint.config.js
tsconfig.json                          # app (Astro/Vite), extiende astro/tsconfigs/strict
tsconfig.node.json                     # scripts/ y tests/, resolución NodeNext
vitest.config.ts
playwright.config.ts
package.json
```

Se eliminan: `src/components/Welcome.astro`, `src/assets/astro.svg`, `src/assets/background.svg`.

---

## 3. Dependencias exactas

Sin dependencias de producción nuevas (el juego es TS + DOM vanilla; Astro solo sirve el HTML/CSS/JS estático). Todo lo demás es `devDependencies`:

| Paquete | Uso |
|---|---|
| `astro` | ya presente (^5.17.1); generador del sitio estático |
| `typescript` | compilador, modo strict |
| `vitest` | pruebas unitarias del motor y del banco |
| `@playwright/test` | humo e2e y capturas en 3 tamaños / 2 temas |
| `tsx` | ejecutar `scripts/*.ts` (Node + ESM + `worker_threads`) sin paso de build |
| `eslint` | lint (config plana, ESLint 9) |
| `typescript-eslint` | reglas TS estrictas, incluida `no-explicit-any` |
| `eslint-plugin-astro` + `astro-eslint-parser` | lint de `src/pages/*.astro` y `src/layouts/*.astro` |

PWA (M9): decisión pendiente entre Service Worker escrito a mano (sin dependencia nueva, más control sobre el cacheo de `public/cases/*.json`) o `@vite-pwa/astro`. Por defecto **a mano**, coherente con "sin dependencia adicional salvo necesidad clara"; se revisa al llegar a M9 y se anota en `DECISIONES.md` si cambia.

---

## 4. Scripts npm

```json
{
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "typecheck": "astro check && tsc --noEmit -p tsconfig.node.json",
  "lint": "eslint .",
  "test": "vitest run",
  "test:e2e": "playwright test",
  "bank:build": "tsx scripts/build-bank.ts",
  "bank:validate": "tsx scripts/validate-bank.ts",
  "bank:report": "tsx scripts/bank-report.ts"
}
```

---

## 5. Hitos M0–M9

Un hito por sesión. Al cerrar cada uno: `pnpm typecheck && pnpm lint && pnpm test` (y `pnpm test:e2e` desde M4), marcar casillas abajo, commit con mensaje `M<n>: <resumen>` (sin push).

### M0 — Proyecto ✅ verificado
**Tareas:** `package.json` con los scripts de la sección 4 (pnpm); `tsconfig.json` (app) + `tsconfig.node.json` (scripts) + `tsconfig.test.json` (tests); ESLint plano con TS estricto (sin plugin de Astro: `astro check` cubre los `.astro`); Vitest y Playwright configurados; arregladas las rutas absolutas de favicons para respetar `base` vía `import.meta.env.BASE_URL`; tokens de color (claro/oscuro), tipografías (Google Fonts) y utilidades base portados a `src/styles/`; `src/engine/types.ts` (modelo de datos completo, §5), `src/engine/content/cast.ts` (reparto, víctimas, objetos, motivos completos, §4.2–4.3) y `src/engine/content/maps.ts` (solo Casa Valdemar; los otros 5 mapas se añaden en M1 con su validación geométrica); portada de v1 portada a `src/ui/landing.ts` + `src/ui/demo.ts` + `src/ui/plan.ts` (render SVG del plano), con un caso de ejemplo escrito a mano para animar el plano (el generador real llega en M1); plantilla por defecto de Astro eliminada; `docs/DECISIONES.md` creado.
**Hecho cuando (a verificar por el usuario, ver §6 "Nada se ejecuta en este entorno"):** `pnpm install && pnpm build` sin errores; `pnpm dev` sirve la portada y se ve igual que v1 en 360 px y en escritorio; `pnpm typecheck` y `pnpm lint` pasan; `pnpm test` pasa (una prueba real de `game/storage.ts`); commit `M0: proyecto y portada`.

### M1 — Motor base ✅ verificado (pnpm typecheck/lint/test pasan)
**Hecho:** `src/engine/rng.ts` (mulberry32 + fnv1a); los 6 `MapDef` del Apéndice A en `content/maps.ts` (mansión, tren, museo, hotel, barco, teatro; reparto/víctimas/objetos/motivos ya estaban de M0); `graph.ts`, `paths.ts`; `truth.ts` (noche: crimen, culpable hacia atrás/delante, resto por paseo aleatorio, objetos); `clues.ts` con los 16 tipos (`holds`, reserva, prohibiciones §6.2, pesos/topes/lectura mínima de movimiento §6.3, categoría y orden §6.4); `text.ts` con las plantillas exactas del Apéndice B; `exact.ts` (`compile`/`exists`/`checkUnique`, con `moved`/`still` como restricciones unarias); `generate.ts` con los pasos 1-8 y 11 de la tubería del §7.1 (selección guiada por contraejemplos, minimización, topes/longitud, cortesía en Novato) — devuelve un `CaseCandidate`, no el `CaseDef` final: el solver humano y la puntuación (pasos 9-10) llegan en M2/M3. Script de consola `scripts/print-case.ts` (`tsx scripts/print-case.ts <semilla> <0|1|2>`).
**Pruebas:** `tests/engine/holds.test.ts` (16 tipos), `tests/engine/maps.test.ts` (geometría de los 6 mapas: solapes, paredes compartidas salvo la pasarela del tren, conexión), `tests/engine/clues.test.ts` (prohibiciones §6.2), `tests/engine/exact.test.ts` (solver exacto vs. fuerza bruta independiente en 30 casos Novato), `tests/engine/determinism.test.ts` (misma semilla → mismo caso byte a byte).
**Hecho cuando (a verificar por el usuario):** las pruebas anteriores pasan con `pnpm test`; decisiones de interpretación (prohibición `notat`/`never` más amplia que v1, numerales hasta "cinco", aproximación de "la que más descarta") anotadas en `docs/DECISIONES.md`.

### M2 — Solver humano ✅ verificado (2 bugs reales encontrados y corregidos en la primera ejecución, ver DECISIONES.md)
**Hecho:** `src/engine/human.ts`: estado por máscaras de bits (`poss`, `carry`, `cand`), reglas de niveles 1-5 completas (§9.2: R1_AT/NOTAT/FEAT/NEVER/STAYED/NCARRY/EMPTY, R2_CANT_BE_THERE/ONLY_ONE/TAKEN, R3_REACH_FWD/BWD/STILL/MOVED, R4_TOGETHER/ADJ/APART/COUNT_FULL/COUNT_NEED/OBJ_WHERE/OBJ_WITH/VISITED, R5_OBJ_SINGLE/SUS_SINGLE/WEAPON) y **nivel 6 (R6_HYPOTHESIS)**: para cada candidato que queda y, si ninguno basta, para cada celda `poss[c][t]` de 2 salas, supone la hipótesis, propaga solo con niveles 1-5 (profundidad 1, sin anidar) hasta 12 pasos o contradicción, y deshace con `snapshot()`/`restore()` si no lleva a nada. Bucle de "regla más sencilla que avance" (§9.3), `Step` con premisas acumuladas por celda y cadena crítica por dependencias hacia atrás (§9.4), puntuación (§9.5), deducción clave y los 7/7 arquetipos (§10, incluido `callejon`). Ver `docs/DECISIONES.md` para el detalle de la implementación y la comprobación real (0/20 → 3/20 en una muestra de semillas Comisario).
**Pruebas:** `tests/engine/human.test.ts` — el ejemplo del Apéndice D completo (verdad construida a mano, verificada contra sus 5 pistas), solidez y coherencia con el solver exacto sobre ese ejemplo, y solidez/coherencia en 160 casos generados (120 Novato + 25 Inspector + 15 Comisario, no 300: Inspector/Comisario son más lentos y con menos aciertos por semilla, medido en `docs/DECISIONES.md`; los que el solver da por atascados se saltan, no fallan la prueba). Las 76 pruebas del proyecto pasan (`pnpm test`, ~20 min por el coste real de generar Inspector/Comisario, ahora con R6_HYPOTHESIS activa).
**Hecho cuando:** solidez en 300 casos generados (toda conclusión de todo paso es verdadera en `truth`); coherencia con el solver exacto; el ejemplo del Apéndice D reproduce exactamente la cadena de 11 pasos descrita; textos del Apéndice C para cada regla usada.

### M3 — Generador y banco ⚠️ (código listo; el banco en sí NO se ha generado — necesita ejecutarse en tu máquina)
**Hecho:** `generate.ts` completa la tubería del §7.1 (ya traía selección guiada, minimización, topes y lectura desde M1; ahora integra el solver humano, nivel/puntuación/banda y firma, ver M2/M3 en `docs/DECISIONES.md`); `scripts/bank.config.ts` con la composición de §12.1 (170/190/120/60 + 20 expedientes×3 = 600, y el mínimo de 200); `scripts/build-bank.ts` (genera y escribe `public/cases/*.json` + `manifest.json`; **en serie, no con `worker_threads`** — ver decisión en DECISIONES.md); `scripts/validate-bank.ts` (formato, unicidad, nivel/banda, firma única — error duro; cuotas de mapa — aviso); `scripts/bank-report.ts` (histogramas de puntuación/pistas/tipos/arquetipos/mapas/hora, `reports/bank-report.md`).
**Simplificado a propósito (ver DECISIONES.md):** sin `worker_threads`; solo se controla activamente la cuota de mapa (arquetipo/hora se reportan, no se fuerzan); sin motivos de rechazo ni tiempo por intento en el informe.
**Pendiente de ti, porque necesita ejecución real:** `pnpm bank:build` (genera el banco; puede tardar varios minutos), `pnpm bank:validate` (debe salir sin error), `pnpm bank:report` (revisa `reports/bank-report.md`: si algún nivel se solapa demasiado con el vecino, dímelo y ajusto pesos/bandas). Hasta que no hagas esto, M3 no está realmente verificado.
**Hecho cuando:** `bank:validate` pasa sin errores sobre el banco generado; cuotas de variedad cumplidas (mapas, arquetipos, hora del crimen, tercios de puntuación); informe en `reports/bank-report.md`; cada archivo de `public/cases/` ≤ 150 KB comprimido.

### M4 — Mesa de trabajo ✅ código y pruebas unitarias verificados; e2e escrito, pendiente de ejecutar
**Hecho:** layout responsive de 17.3 (móvil vertical, móvil horizontal/tableta, escritorio) en `src/styles/game.css`; `ui/plan.ts` (render SVG portado de `buildPlan`, con estela y ayuda de movimiento de 17.4); `ui/chalk.ts` (canvas de tiza, 17.5); `ui/board.ts` orquesta pestañas de hora, barra de herramientas, hoja inferior de dos estados, ampliar plano, deshacer común; portada conectada de verdad (`src/game/bank.ts` sirve un caso real del banco al pulsar "Empezar").
**Hecho cuando:** `pnpm typecheck/lint/test` pasan con el código de M4. La prueba e2e (`tests/e2e/board.spec.ts`, 390×844/844×390/1280×800: sin scroll horizontal, objetivos táctiles ≥44px) está escrita pero no se ha podido ejecutar en este entorno: Chromium headless necesita librerías del sistema (`libnspr4` y otras) que piden `sudo` y esta herramienta no tiene una terminal interactiva para la contraseña. Pendiente de que el usuario ejecute `sudo npx playwright install-deps chromium` (o el usuario lo pruebe en su propio entorno).

### M5 — Bucle completo ✅ código y pruebas unitarias verificados; e2e escrito, pendiente de ejecutar (mismo motivo que M4)
**Hecho:** `ui/clues.ts` (tachar, enfocar con salto de hora y resaltado de salas, agrupado por categoría), `ui/objects.ts` (tabla con autocompletar por fila y columna, ajustable desde Ajustes), `ui/casetab.ts` (informe + descartar), `ui/accuse.ts` (hoja de acusación con culpable/arma), `game/scoring.ts` (estrellas, límite de 2 errores, cierre), `ui/closure.ts` (frase de cierre, "la clave" por arquetipo, cadena de deducción desplegable con la explicación de cada paso), `ui/reconstruct.ts` (animación de fichas con `prefers-reduced-motion`), siguiente caso instantáneo desde el banco (`main.ts`). `engine/text.ts` gana `closingText()`, `keyDeductionText()` y `stepExplanation()` (Apéndice C, las 17 reglas incluida R6_HYPOTHESIS), con algunas simplificaciones documentadas en `docs/DECISIONES.md` (no hay estado en vivo del solver al renderizar, así que un par de plantillas se parafrasean en vez de citar listas de salas que no se pueden reconstruir con certeza). El arquetipo `paso` sigue sin detectarse (nunca se implementó; ver DECISIONES.md).
**Hecho cuando:** bucle jugable de principio a fin sobre un caso del banco (marcar → acusar → cierre → siguiente caso), verificado con 26 pruebas unitarias nuevas (`game/scoring.test.ts`, ampliación de `game/store.test.ts`, `engine/text.test.ts` contra el ejemplo del Apéndice D) y `pnpm test` completo en verde. Prueba e2e `tests/e2e/close.spec.ts` escrita (resuelve un caso Novato leyendo el culpable/arma del JSON del banco, sin adivinar, y comprueba 3 estrellas; y un segundo caso con 2 acusaciones erróneas que archiva sin estrellas), pendiente de ejecutar por el mismo motivo de Playwright que M4.

### M6 — Pista del inspector ✅ código y pruebas unitarias verificados; e2e escrito, pendiente de ejecutar (mismo motivo que M4/M5)
**Hecho:** `game/hints.ts` (sin DOM): revisión de marcas contradictorias (plano, tabla de objetos y descarte del culpable de verdad) antes que nada, y si no hay ninguna, el primer paso no reflejado de la cadena crítica — un paso intermedio (que reduce posibilidades sin fijar una sola sala/objeto) cuenta como reflejado si todos los pasos que dependen de él ya lo están. `game/store.ts` gana `requestHint()`/`explainHint()`: la primera pista de un aviso nuevo cuesta 1 estrella, repetir la misma pista sin haber cambiado nada no cobra otra vez, "Explícamelo" es gratis (interpretación razonada, ver DECISIONES.md). `engine/text.ts` gana `stepFocus()` (qué salas/hora/sospechosos resaltar, a partir solo de las conclusiones del paso) y `hintPush()` (el empujón, Apéndice C). Integrado en `ui/board.ts`: botón Pista, panel de aviso con "Explícamelo", resaltado en el plano y salto a la hora implicada.
**Corrección importante encontrada al construir esto:** `generate.ts` filtraba `solved.steps` a los pasos críticos sin reindexar `Step.prem` (seguían apuntando a posiciones de la lista completa sin filtrar): un fallo real, no solo de M6, que habría corrompido cualquier lectura de `prem` sobre `CaseDef.solve.steps` en cuanto se hubiera descartado algún paso no crítico. Corregido con `reindexCriticalSteps()`; cubierto con una prueba de rango en `human.test.ts`. Ver DECISIONES.md para el detalle y para el hallazgo relacionado (premisas de R6 infladas a 60+ pasos, ya reducidas).
**Hecho cuando:** pruebas unitarias del mapeo conclusión → marca reflejada, incluidos pasos intermedios no marcables (`tests/game/hints.test.ts`, 11 pruebas) y del coste de estrellas (`requestHint`/`explainHint` en `store.test.ts`); `pnpm typecheck/lint/test` en verde. E2e (`tests/e2e/hint.spec.ts`: pedir pista resta 1 estrella, repetirla no cobra, Explícamelo gratis) escrito, pendiente de ejecutar por las dependencias de Playwright.

### M7 — Modos ✅ código y pruebas unitarias verificados; banco de series de Expediente aún generándose (ver nota); e2e escrito, pendiente de ejecutar
**Hecho:** `game/bank.ts` gana orden personal por semilla (`getOrderSeed`), lista de jugados por versión de banco (`getPlayed`/`markPlayed`/`resetPlayed`) y `nextUnplayed()` (siguiente caso no jugado, en el orden personal, filtrado por mapa si se eligió uno; `null` si el grupo está agotado). `ui/exhausted.ts`: pantalla de agotamiento con "Modo infinito" y "Volver a empezar" (de verdad, olvida solo ese grupo). `game/session.ts` + `GameStore.hydrate()`: caso en curso (`hm2:game`) con guardado automático a los 300 ms y al ocultar la pestaña; "Seguir el caso" en la portada, también para un expediente en curso. `game/modes.ts`: caso del día por índice de fecha (§13, época 2026-01-01 en UTC) con su resultado aparte en `hm2:daily` (no cuenta para "sin repetir"). Enlaces `#caso=<id>` (banco) y `#gen=<semilla>&n=&m=` (modo infinito, reproducible); `main.ts` enruta por `location.hash` al arrancar. `ui/closure.ts` gana "Copiar enlace a este caso" (oculto para expediente, que no tiene un formato de enlace propio). Cronómetro (§14.2) conectado de verdad. **Expediente** (`game/expediente.ts`): serie de 3 noches con presupuesto de errores compartido (`SeriesProgress`, `hm2:series`) y estrellas acumuladas (máximo 9); cada noche usa `GameStore` con `maxErrors = Infinity` y `ui/board.ts#handleExpedienteOutcome()` lleva la cuenta compartida aparte, cerrando la noche con el nuevo `store.forceArchive()` si se agota. `main.ts` gana `startExpediente()`/`resumeExpediente()`/`showExpedienteNight()`/`advanceExpediente()`; "sin repetir" para series usa una clave namespaced `expediente:<version>`. `ui/landing.ts` gana el botón "Expediente". **Modo infinito** (`workers/generator.worker.ts` + `game/infinite.ts`): genera en un Web Worker con presupuesto de 8 s, pregenerando el siguiente caso mientras se juega el actual; `tsconfig.worker.json` (`lib: WebWorker`) separado del `tsconfig.json` de la app para que `self` tipe como `DedicatedWorkerGlobalScope`, no `Window`.
**Nota sobre datos:** `public/cases/expedientes.json` sigue con `series: []` a fecha de esta entrada — `pnpm bank:build` sigue en marcha en segundo plano generando Comisario (el más caro, con R6_HYPOTHESIS) antes de llegar a las series de Expediente. El código de expediente ya maneja ese caso con gracia (aviso "Todavía no hay expedientes disponibles.") y está probado con datos de prueba; falta reejecutarlo contra el banco real cuando `bank:build` termine.
**Hecho cuando:** `pnpm typecheck` y `pnpm lint` en verde sobre todo lo nuevo. `pnpm test`: todos los ficheros de prueba nuevos o tocados pasan en verde (`game/bank.test.ts`, `game/modes.test.ts`, `game/session.test.ts`, `game/expediente.test.ts` nuevo con 8 pruebas, `game/scoring.test.ts`/`game/store.test.ts` con las pruebas nuevas de `maxErrors`/`forceArchive`, `game/hints.test.ts`); confirmado con una ejecución completa de la suite hasta ese punto. La suite completa no se dejó terminar esta vez: además del "300 casos" de `tests/engine/human.test.ts` (lento por R6_HYPOTHESIS en Comisario, igual que `bank:build`), esta pasada reveló que otras dos pruebas ya existentes son mucho más lentas de lo esperado con el banco actual (`tests/engine/exact.test.ts`, ~134 s; `tests/engine/determinism.test.ts`, ~257 s), ninguna tocada por este trabajo; se paró para no bloquear el commit, sin haber visto ningún fallo real en lo recorrido. E2e de `session.spec.ts` (retomar tras recargar, abrir por enlace) escrito, pendiente de ejecutar por las dependencias de Playwright; no se ha escrito e2e específico de expediente/infinito por la misma razón, más la falta de datos reales de expediente todavía.

### M8 — Progresión
**Tareas:** `game/progression.ts` (rango por estrellas, desbloqueo de escenarios, archivo de arquetipos, estadísticas), `ui/settings.ts`, `ui/profile.ts`, `game/storage.ts` con claves `hm2:*` y migración desde `hm:stats`/`hm:daily` de v1.
**Hecho cuando:** pruebas de migración desde v1 y de comportamiento con `localStorage` bloqueado (modo privado).

### M9 — Calidad
**Tareas:** PWA (manifest + iconos + Service Worker que cachea app y banco, con scope `/hora-muerta/`), presupuestos de rendimiento de 19.4, auditoría de accesibilidad (17.9: roles, `aria-label` dinámico, teclado, foco visible, `prefers-reduced-motion`), pruebas e2e y capturas en los tres tamaños en tema claro y oscuro.
**Hecho cuando:** criterios de aceptación de la sección 20 completos; juego usable sin conexión tras la primera carga.

---

## 6. Riesgos

- ~~Nada se ejecuta en este entorno~~ **Resuelto:** Node 24 y pnpm ya están instalados en este entorno (a petición del usuario) y `pnpm typecheck && pnpm lint && pnpm test` se ejecutan y pasan aquí mismo. M0-M3 se escribieron sin esa posibilidad y la primera ejecución encontró 2 bugs reales (ver `docs/DECISIONES.md`), ya corregidos.
- **Solver humano (M2) es la pieza de mayor riesgo lógico.** Si la prueba de solidez en 300 casos falla, el trabajo se detiene ahí hasta corregirlo (regla explícita del encargo): puede alargar M2 más de una sesión.
- **Coste computacional del banco (M3).** Comisario es el más caro (~1 s por intento más rechazos); se paraleliza con `worker_threads`, pero generar 600 casos con calidad puede tardar varios minutos y requerir varias iteraciones de calibración de bandas (11).
- **Geometría de los 3 mapas nuevos** (hotel, barco, teatro): deben pasar la validación geométrica de M1 (sin solapes, grafo conexo, puertas sobre pared compartida). Se transcriben literalmente del Apéndice A y se validan con test antes de usarlos en generación.
- **Base path de GitHub Pages (`/hora-muerta/`).** Cualquier ruta absoluta a `public/` (favicons, manifest, banco, Service Worker) debe pasar por `import.meta.env.BASE_URL`; ya se detectó que `Layout.astro` actual usa `/favicon.svg` a pelo y se corrige en M0.
- **Transcripción de contenido** (Apéndices A, B, C, reparto, víctimas, objetos, motivos): cualquier error rompe la regla de "no inventar contenido"; se cubre con pruebas de instantánea de texto por tipo de pista y por plantilla de paso (sección 20).
- **Playwright:** primer uso en el entorno del usuario requiere `pnpm exec playwright install` (descarga binarios de navegador) antes de `pnpm test:e2e`.
- **Alcance total muy grande** (10 hitos, banco de 600 casos, solver de dos niveles, UI responsive completa, PWA): se ejecuta estrictamente un hito por sesión, con verificación y commit antes de continuar, como pide el encargo.

---

## 7. Lista de tareas

- [x] **M0** ✅ verificado (`pnpm typecheck && pnpm lint && pnpm test` pasan en Node 24 / pnpm) Proyecto: scripts pnpm, TS strict con 3 tsconfig, ESLint, Vitest, Playwright, tokens/tipografías, portada de v1 con demo animada sobre Casa Valdemar, base path corregido, `DECISIONES.md` creado.
- [x] **M1** ✅ verificado (30 casos Novato, solver exacto vs. fuerza bruta independiente, geometría de los 6 mapas, holds() de los 16 tipos: todo pasa) Motor: rng, 6 mapas, grafo, recorridos, verdad, 16 pistas, prohibiciones, topes, textos Apéndice B, solver exacto, generador (pasos 1-8/11) + pruebas.
- [x] **M2** ✅ verificado, con 2 bugs reales encontrados y corregidos en la primera ejecución (ver docs/DECISIONES.md): Novato no generaba ningún caso, y el ejemplo del Apéndice D se atascaba. Niveles 1-6 completos (R6_HYPOTHESIS implementada y verificada: 0/20 → 3/20 en una muestra de semillas Comisario). Solver humano: cadena crítica, puntuación, 7/7 arquetipos (incluido `callejon`) + pruebas de solidez/coherencia + ejemplo Apéndice D, todo pasando.
- [ ] **M3** (scripts verificados; Novato/Inspector/Diario ya generados y validados con `pnpm bank:validate`/`bank:report`; con R6_HYPOTHESIS ya implementada, `pnpm bank:build` completo — incluidos Comisario 120 y Expediente 20 — se relanzó y sigue en marcha en segundo plano al cerrar esta sesión, ver DECISIONES.md) Generador completo + `bank.config.ts` + los 3 scripts + banco de 600 casos validado.
- [x] **M4** ✅ código y pruebas unitarias verificados (`pnpm typecheck/lint/test`); e2e escrito (`tests/e2e/board.spec.ts`) pendiente de ejecutar (Chromium headless necesita librerías del sistema, pide sudo). Mesa de trabajo responsive (móvil vertical/horizontal/escritorio), plano SVG con estela y ayuda de movimiento, tiza, hoja inferior, portada conectada al banco real.
- [x] **M5** ✅ código y pruebas unitarias verificados (`pnpm typecheck/lint/test`, 26 pruebas nuevas); e2e escrito (`tests/e2e/close.spec.ts`, resuelve un caso con la solución del JSON) pendiente de ejecutar por el mismo motivo que M4. Pistas interactivas, tabla de objetos, pestaña Caso, acusación, estrellas, cierre, reconstrucción, siguiente caso.
- [x] **M6** ✅ código y pruebas unitarias verificados (`pnpm typecheck/lint/test`, 11 pruebas nuevas de game/hints.ts); e2e escrito, pendiente de ejecutar. Pista del inspector en dos fases con resaltados y coste de estrellas. De paso, corregido un fallo real en `generate.ts` (prem sin reindexar tras filtrar a pasos críticos).
- [x] **M7** ✅ código y pruebas verificados (`pnpm typecheck/lint/test`): servir sin repetir, caso en curso, enlaces `#caso=`/`#gen=`, caso del día, expediente (presupuesto y estrellas compartidos), modo infinito en Web Worker. Banco de series de Expediente aún generándose en segundo plano (ver DECISIONES.md); e2e pendiente de ejecutar por las dependencias de Playwright.
- [ ] **M8** Rango, desbloqueos, archivo de arquetipos, estadísticas, ajustes, persistencia `hm2:` y migración desde v1.
- [ ] **M9** PWA sin conexión, rendimiento, accesibilidad, e2e con capturas en 3 tamaños × 2 temas.

---

## 8. Cómo probarlo en el móvil

`pnpm dev -- --host` y abrir la URL `http://<IP-local>:4321/hora-muerta/` desde el teléfono en la misma red.
