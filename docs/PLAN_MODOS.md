# Plan de implementación: Modo Incendio y Modo Calentamiento

> Paso 0 del prompt. Propuesta **pendiente de confirmación**: no se ha escrito código de F0.
> Fuentes: `docs/MODOS.md` (especificación, fuente de verdad), `docs/referencia/hora-muerta-modos.html` (prototipo), `docs/DISENO_TECNICO.md`, `CLAUDE.md`.
> Base verificada: rama `develop`, último commit `cd3a631`, árbol limpio, 165 pruebas en verde (`pnpm test` sin e2e).

---

## 1. Resumen

- Se construyen dos modos nuevos en 8 fases (F0 a F7), con un commit por fase y sin push.
- **Ninguna fase está bloqueada técnicamente.**
  - **F6 (banco de ejercicios) puede hacerse ya:** el solver humano (M2) está cerrado y tiene todas las reglas que hacen falta (R1 a R6).
  - **F3 (incendio en el banco) puede hacerse ya para Novato e Inspector:** los bancos de esos niveles existen y el generador se puede ejecutar por grupo. M3 sigue abierto solo por Comisario y Expediente, que este modo no necesita.
  - **F0, F1, F2, F4 y F5** no dependen de nada pendiente.
- Hay **decisiones que tomar antes de F1 y F3** (sección 4). La más importante es la **D1**: la regla de justicia del incendio tal como está escrita no garantiza que el caso siga siendo resoluble cuando arden pistas.
- Lo que **no puedo verificar aquí**: los e2e de Playwright (en este sandbox no se ejecutan) y el aspecto real en móvil. Esa parte la pruebas tú con la lista de la sección 8.

---

## 2. Estado verificado del repositorio

| Área | Estado real | Implicación para el plan |
|---|---|---|
| Router | No existe. `main.ts` cambia de vista con funciones `show*` y un `cleanup`. `routeFromHash()` solo entiende `#caso=` y `#gen=` (main.ts:375). No hay `hashchange`. | F0 crea `core/router.ts` y migra `main.ts` **sin cambiar** el comportamiento de `#caso` ni de `#gen`. |
| Modos visuales | `styles/tokens.css` tiene tema claro y oscuro (`data-theme`, `prefers-color-scheme`). No hay `data-mode`. | F0/F2: tokens de fuego con `:root[data-mode='fuego']`. Tienen la misma especificidad (0,2,0) que los temas, así que hay que declararlos **al final** de `tokens.css`. |
| Miniplano | No hay `planlite`. El tablero usa `ui/plan.ts`; el tutorial y las capas de reconstrucción tienen SVG propios. | Se crea `ui/planlite.ts` para calentamiento y vista previa del incendio. El tablero y el tutorial no se tocan (decisión D6). |
| Portada | Hero con "Jugar el caso del día", "Elegir nivel" (ancla) y "Expediente". Cabecera con Tutorial, Cómo se juega, ☰ Perfil, ⚙ Ajustes y tema. Plano de casos en `#plano-casos`. | F0 reordena el menú según 1.4, conservando lo que ya funciona (decisión D5). |
| Tablero | `GameStore.mark(room)` comprueba `mode`; `ui/chalk.ts`; `undo`; pista del inspector (M6); `BoardOptions.onReady` (añadido en el tutorial). | F1 añade un predicado inyectado en el store (`isRoomLocked`), sin ramas de incendio dispersas por la UI. |
| Solver exacto | `checkUnique(ctx, culprit, weapon, clues)` → `unique \| alt \| limit`. No hay una primitiva "¿existe un escenario que cumpla P?". | F4 y F6 necesitan esa primitiva (decisión D10). |
| Solver humano | `solveHuman` con R1 a R6 completas; cada paso lleva `crit` y `prem`. | F6 puede hacerse ya. Todas las reglas que pide la tabla 3.8 existen. |
| Explicaciones | `engine/text.ts`: `stepExplanation`, `hintPush`, `keyDeductionText`. Las plantillas son el Apéndice C del diseño. | F6 reutiliza las plantillas y las adapta a "tú". |
| Banco | `BANK_GROUPS`: novato 170, inspector 190, comisario 120, diario 60. **Publicado:** novato 170, inspector 164, comisario 0, diario 55, expedientes 0. | F3 usa `generateGroup()` (exportada en esta sesión) para generar **solo** el grupo `incendio`. No se lanza `pnpm bank:build` completo, porque reescribe todo y tarda mucho. |
| Mapas | 6 escenarios con 50 salas en total. Los nombres coinciden con el prototipo ("Casa Valdemar", "Museo Aldana"), así que el título "{Lugar} en llamas" sale directo. El Archivo del museo es `arc`, igual que en el prototipo. | Las causas por sala (MODOS 2.5) son 50 textos (decisión D7). |
| Pruebas | 165 de Vitest (unos 20 min por el solver lento). Playwright configurado; no se ejecuta en este sandbox. | Los e2e se escriben, pero los ejecutas tú. |

---

## 3. Prototipo frente a especificación: lo que cambia al portar

1. **Los dos casos de incendio del prototipo no son reproducibles con nuestro motor.** Sus semillas (`INC-MAN7`, `INC-MUS6`) las genera el motor del prototipo, que es otro. Las pruebas de F1 usarán dos casos de nuestro generador con semilla fija (D3); el banco real llega en F3.
2. **Ejercicios sobre un mapa que no es de los 6 escenarios.** De los 23 ejercicios, 14 usan `tut` ("Casa de prácticas", 5 salas, no es un escenario del juego) y 5 usan `mansion`. Los ids de sala de `mansion` del prototipo coinciden con los de nuestro `MANSION` (bib, est, inv, sal, ves, com, bod, coc). Ver D2.
3. **La verificación del prototipo no escala.** Enumera todos los caminos de cada persona, combina las personas y prueba todas las permutaciones de objetos. Medido con nuestros mapas y T=3:

   | Mapa | Salas | Caminos por persona | Escenarios con N=4 (antes de objetos) | Con N=5 |
   |---|---|---|---|---|
   | mansion | 8 | 104 | 1,2·10⁸ | 1,2·10¹⁰ |
   | tren | 8 | 62 | 1,5·10⁷ | 9,2·10⁸ |
   | museo | 9 | 95 | 8,2·10⁷ | 7,7·10⁹ |
   | hotel | 8 | 68 | 2,1·10⁷ | 1,5·10⁹ |
   | barco | 9 | 95 | 8,2·10⁷ | 7,7·10⁹ |
   | teatro | 8 | 76 | 3,3·10⁷ | 2,5·10⁹ |

   Con 23 ejercicios sobre todo lo anterior, la fuerza bruta literal no es viable en el tiempo de una sesión, ni siquiera offline. Ver D10.
4. **La primitiva `carry` (poseer un objeto) no existe en nuestro tipo `Clue`.** Calentamiento la necesita como enunciado de `tri`. El evaluador la tratará como predicado sobre el escenario (`obj[c] === o`), no como pista de un caso.
5. **Un solo `<script>` con temporizadores globales.** F0 lo separa en módulos con `enter`/`leave`.
6. **El tutorial del prototipo no es el nuestro.** El nuestro usa Casa Valdemar real y ya funciona. No se toca (decisión D6).
7. **Inconsistencias de la especificación** (sección 4): D4 (cifra de remates), D8 (escena del crimen), D9 (desempates del foco).

---

## 4. Decisiones y ambigüedades

Cada una necesita tu confirmación. Donde hay recomendación, la aplico solo si la confirmas.

| ID | Tema | Problema | Recomendación |
|---|---|---|---|
| **D1** | **Solubilidad con pistas quemadas (crítica)** | MODOS 2.5 garantiza que "al menos la mitad de la cadena crítica arde después de 2:30". Pero no garantiza que el caso siga siendo resoluble cuando arden las pistas que el jugador todavía no ha usado. Un caso así exige adivinar, contra la regla 1. | Garantía fuerte y comprobable: el solver exacto debe dar **solución única** usando (a) las pistas que arden a partir de 2:30 y (b) **cualquier pareja** de pistas tempranas, que son las que se pueden salvar con foto. Se comprueban todas las parejas (como mucho 36 por caso). Si la tasa de rechazo resulta demasiado alta (se mide en F3), alternativa: "la cadena crítica no usa pistas que ardan antes de 2:30". |
| D2 | Mapa de los ejercicios `tut` | 14 de 23 ejercicios usan un mapa de 5 salas que no es de los 6 escenarios. | **A (recomendada):** "Casa de prácticas" como mapa solo de ejercicios, en `src/content/practice.ts`. Nunca entra en el banco. Por ser pequeño, se verifica por enumeración. **B:** reubicar los 14 ejercicios sobre Casa Valdemar y recalcular respuestas. Más trabajo y se pierde la pedagogía de las 5 salas. |
| D3 | Casos de incendio del prototipo | No son reproducibles con nuestro motor. | F1 usa 2 casos de nuestro generador con semilla fija, validados. El banco real llega en F3. |
| D4 | Cifra de remates | "360 ejercicios, 30 por técnica y nivel en las 4 técnicas (60 de ellos remates)". Con 4 técnicas × 3 niveles × 30 = 360, los remates serían 90, no 60. | Elegir: **90** (30 por nivel) o **60** (20 por nivel, y el total baja a 330). |
| D5 | Menú de la portada | La lista de 1.4 no incluye "Elegir nivel", "Expediente", ☰ Perfil ni ⚙ Ajustes, que ya funcionan. | Conservarlos como botones secundarios. Principales en el orden de 1.4: Caso del día, Plano de casos (ancla a `#plano-casos`), Calentamiento (con bombilla) y Modo Incendio (rojo, con llama). Cabecera: Tutorial, Calentar, Cómo se juega, ☰, ⚙ y tema. |
| D6 | `planlite` frente al tablero | 1.3 pide que el tutorial use `planlite`. Ya funciona y pediste no tocarlo. | `planlite` solo para calentamiento y la vista previa del incendio. Tutorial y tablero intactos. Se anota la desviación en `DECISIONES.md`. |
| D7 | Causas por sala del incendio | MODOS pide una lista por sala, pero solo da ejemplos. Son 50 salas. | Yo redacto las 50 causas en español de España, y tú las revisas antes de F3. |
| D8 | Escena del crimen | `max(240, ign)`: la sala del crimen arde a 240 s como mínimo, así que sus pistas arden a 285 s (15 s antes del final). | Lo interpreto como intencionado. Confirmar. |
| D9 | Desempates del foco | "La más alejada en puertas" puede empatar. MODOS dice "distancia intermedia" sin definirla. | Propongo definirla en F3, con la medición de la tasa de rechazo, sin fijarla ahora. |
| D10 | Método de verificación | La fuerza bruta literal no escala (sección 3.3). | Una primitiva nueva `exists(ctx, clues, predicado)` sobre la propagación del solver exacto, que ya se contrastó con fuerza bruta independiente en M1. Para instancias pequeñas (`tut`, hasta 2 personas) y una muestra aleatoria, una fuerza bruta independiente como segunda opinión. Va en `engine/`, sin DOM. |
| D11 | Tiza y salas en llamas | Los trazos no pertenecen a una sala; son libres sobre el canvas. "No empezar trazos en salas en llamas" exige un criterio. | Comprobar el punto inicial del trazo contra el rectángulo de la sala (`roomRect`) al pulsar. Los trazos ya hechos se ven siempre. |
| D12 | Estrellas del incendio | MODOS 2.8: 1 por resolver, +1 por medalla, máximo 3. `scoring.ts` no tiene esa regla. | Sumar directamente a `profile.stars` sin tocar `scoring.ts`. |
| D13 | Calentamiento: banco de ejercicios | "Los 23 del prototipo están verificados" no es cierto: sus respuestas las calcula el motor del prototipo y hay que volver a verificarlas. | F4 las reverifica con el método de D10 antes de darlas por buenas. |

**Desviaciones que anotaré en `DECISIONES.md` al implementarlas:** D2 (si eliges A), D6, D11 y D12.

---

### Estado de las decisiones (tras la confirmación del usuario)

- **D1: decidida por el usuario.** El caso puede volverse irresoluble cuando arden pistas; la presión del tiempo es la gracia. No se aplica la garantía fuerte. Se mantienen las garantías literales de MODOS 2.5. Ver la tensión con CLAUDE.md en `DECISIONES.md`.
- **D2: decidida, opción A.** "Casa de prácticas" es un mapa solo de ejercicios.
- **D4: decidida, 90 remates.**
- **D5 y D6: aplicadas en F0.**
- **D3, D7 a D13:** pendientes de su fase (F1 a F4). Las recomendaciones de la tabla siguen vigentes salvo que se indique lo contrario.

## 5. Encaje con el código

**Crear**

- `src/core/router.ts` (F0)
- `src/ui/planlite.ts` (F0)
- `src/modes/fire/`: `config.ts`, `timeline.ts`, `session.ts`, `ui/lobby.ts`, `ui/layer.ts`, `ui/clues.ts`, `ui/status.ts`, `ui/end.ts`, `theme/ignite.ts`, `theme/embers.ts` (F1 y F2)
- `src/modes/gym/`: `types.ts`, `bank.ts`, `compose.ts`, `adapt.ts`, `grade.ts`, `ui/intro.ts`, `ui/player.ts`, `ui/report.ts`, `ui/twoleft.ts` (F4 y F5)
- `src/content/practice.ts` (D2 A)
- `scripts/build-drills.ts`, `scripts/validate-drills.ts`, `public/drills.json` (F6)
- Pruebas: `tests/fire/timeline.test.ts`, `tests/fire/validate.test.ts`, `tests/gym/grade.test.ts`, `tests/gym/adapt.test.ts`, `tests/gym/drills.test.ts`, `tests/e2e/fire.spec.ts`, `tests/e2e/gym.spec.ts`

**Tocar (cambios pequeños y localizados)**

- `src/main.ts`: router. `#caso` y `#gen` se conservan tal cual.
- `src/ui/landing.ts`: menú (D5).
- `src/styles/tokens.css`: tokens de fuego, al final del fichero.
- `src/styles/game.css`, `landing.css`: estilos de los modos nuevos.
- `src/game/store.ts`: predicado `isRoomLocked` para marcas y undo.
- `src/ui/board.ts`: opción `fire` en `BoardOptions`; pista del inspector desactivada en fuego.
- `src/ui/chalk.ts`: bloqueo del inicio de trazo (D11).
- `src/game/storage.ts`: `hm2:fire` y `hm2:gym`.
- `scripts/bank.config.ts` y `scripts/build-bank.ts`: grupo `incendio` (20 Novato + 20 Inspector exprés, con un tope de 9 pistas, un parámetro nuevo del generador).

**No tocar:** `ui/tutorial.ts`, `game/tutorial.ts`, la renderización del plano del tablero y la lógica de `engine/human.ts`.

---

## 6. Fases y lista de tareas

Cada fase se cierra con `pnpm typecheck`, `pnpm lint`, `pnpm test` (y `pnpm test:e2e` desde F1, aunque aquí no se ejecute), las casillas de este documento actualizadas y un commit `Fn: ...`.

### F0 · Router, modos visuales, planlite y menú — ✅ hecha
- [x] `core/router.ts`: `showView(name, params)` con `home`, `game`, `fire` y `academy`; `enter`, `render` y `leave`, más `router.render()` para repintar la vista activa; hash `#incendio`, `#academia`, `#tutorial`. `#caso=` se lee (enlaces) pero no se escribe en partidas sueltas: desviación pendiente de tu confirmación (ver DECISIONES.md).
- [x] `main.ts` migrado al router sin cambiar `#caso` ni `#gen`.
- [x] `data-mode="fuego"` con tokens al final de `tokens.css`; contraste calculado (texto 13,9:1 o más, botón 6,1:1).
- [x] Destello de 0,7 s al entrar y fundido de 0,3 s al salir; con `prefers-reduced-motion`, ninguno.
- [x] `ui/planlite.ts` con la API de 1.3 (más `selected`) y pruebas del marcado.
- [x] Menú según 1.4 (D5); "Calentar" en la cabecera.
- [x] Prueba: al volver al menú no queda ningún temporizador, intervalo ni `requestAnimationFrame` activo. Unitaria en `tests/core/router.test.ts` (con control que demuestra que detecta una fuga) y de extremo a extremo en `tests/e2e/router.spec.ts`, que mide en la página misma (esta última no se ejecuta aquí). Se corrigieron dos fugas reales (carga asíncrona de la portada y scroll del coach).
- **Hecho cuando:** criterio 1.1 cumplido en pruebas (20 nuevas en verde). Falta tu comprobación en el móvil (360 px, portada, pantallas provisionales).

### F1 · Incendio, núcleo — ✅ hecha
- [x] `modes/fire/config.ts` con las constantes de la tabla 2.2.
- [x] `timeline.ts`: `roomState`, `clueBurnAt`, `clueState` y `fireTimes` puras, con tabla de estados para varios `t` en los 2 casos de prueba (D3).
- [x] Bloqueos en el store (`BoardLocks`): ni marcas ni trazos nuevos en salas en llamas; las marcas previas se ven; la goma funciona; deshacer descarta la entrada afectada y avisa (D11).
- [x] Reloj de 300 s hacia atrás (`session.ts`), con pausa al ocultar la pestaña y capa "En pausa" con botón Seguir.
- [x] Penalización de 30 s; derrumbe al llegar a 0 o en el momento si la penalización lo deja por debajo; "Volver a entrar".
- [x] Capa de fuego en el plano (carbón, bordes, llama, aviso naranja con cuenta atrás), redibujada solo al cambiar un estado.
- [x] Casos de prueba: los 2 edificios del prototipo generados con nuestro motor (`scripts/build-fire-fixtures.ts`, `public/cases/incendio.json`) y verificados.
- [x] Pruebas: 53 unitarias en `tests/fire/` y e2e `tests/e2e/fire.spec.ts` (derrumbe, penalización, pausa). El e2e no se puede ejecutar aquí: falta `libnspr4.so`.
- **Hecho cuando:** pruebas unitarias en verde (235 en total) y e2e escrito. Falta que lo ejecutes tú.

### F2 · Incendio completo — ✅ hecha
- [x] Fotos (2 por caso); pista salvada nunca arde; mecha con contador a 30 s o menos.
- [x] Quemado: 4 s "Ardiendo", después "Pista quemada" con ceniza y el texto fuera del DOM.
- [x] Línea de estado y barra del edificio.
- [x] Pista del inspector desactivada en modo fuego (F1).
- [x] Sala del incendio `#incendio`: cinco reglas, filtro por nivel, tarjetas con miniplano de calor (planlite) y mejor marca.
- [x] Cierre con medallas (Sin fotos, A tiempo, Sin errores); derrumbe con Volver a entrar, Ver la solución y Volver.
- [x] Diálogo de salida a mitad: "Si sales, el incendio se pierde. ¿Salir?".
- [x] Chispas en un único `<canvas>`, con 80 partículas como máximo; paradas con la pestaña oculta, al salir y con movimiento reducido.
- [x] Anunciador `role="status"` solo con cambios importantes; salas en llamas en su `aria-label`.
- [x] Contraste AA comprobado por prueba sobre la paleta real de `tokens.css`.
- [x] Récords en `hm2:fire` y estrellas según D12 (solo lo que mejora la mejor marca).
- [x] Casos límite de 2.9: penalización por debajo de cero (F1), foto sobre pista ardiendo, pista enfocada que se quema, reinicio al volver a entrar, capa de fuego también en el plano ampliado.
- **Hecho cuando:** 263 pruebas unitarias en verde; e2e y capturas escritos (`tests/e2e/fire-complete.spec.ts`). Falta que los ejecutes tú: `pnpm test:e2e`, y las capturas quedan en `test-results/`.

### F3 · Incendio en el banco — ✅ hecha
- [x] Grupo `incendio` en `bank.config.ts`: 20 Novato y 20 Inspector exprés (tope estricto de 9 pistas con la nueva opción `maxClues`).
- [x] Foco determinista según 2.5.2, con desempate por pistas en salas de distancia intermedia (D9) y después por índice.
- [x] `ign` y `burnAt` precalculados.
- [x] Una causa por cada una de las 50 salas y título "{Lugar} en llamas".
- [x] Garantías de 2.5 en `validate-bank` (la opcional de calibración no se aplica, ver DECISIONES.md).
- [x] Generación solo de este grupo (`scripts/build-fire-bank.ts`), en paralelo por huecos con el mismo resultado que en serie (16 min con 15 procesos), e informe en `reports/fire-report.md`.
- [x] `public/cases/incendio.json` (40 casos) y `manifest.json` actualizados.
- [x] Sala del incendio conectada al banco: orden por jugador, siguiente edificio sin resolver por nivel, resueltos aparte con su mejor marca, escenarios desbloqueados y filtro por nivel.
- **Hecho cuando:** criterios 2.10 (1 y 2) cumplidos: `pnpm bank:validate` pasa (429 casos) y `tests/fire/bank.test.ts` comprueba los 40.

### F4 · Calentamiento, núcleo — ✅ hecha
- [x] Entrada `#academia` con presentación, bloques (técnica del día y motivo), ficha y botón Empezar el calentamiento.
- [x] Reproductor de los 5 tipos (`reach`, `tri`, `pick`, `clue`, `contra`) con `planlite` (ahora con puertas, nombres, rasgos y hora en las fichas).
- [x] `grade.ts` con las 10 reglas de error de la tabla 3.5; una prueba por regla que provoca su mensaje.
- [x] Sesión de 3 bloques (5, 5 y 3) con pantallas intermedias y barra de puntos.
- [x] Informe final "N de 13", con aciertos por bloque y técnica, consejo, "Ir a jugar un caso" (plano desplegado), "Repetir" y "Volver a la Academia".
- [x] Los 23 ejercicios portados (D2) y reverificados por fuerza bruta (`pnpm drills:validate`, D10 y D13): las 23 respuestas cuadran.
- [x] e2e escrito para móvil (vertical y horizontal) y escritorio.
- **Hecho cuando:** criterios 3.13 (4 y 5): 414 pruebas unitarias en verde. Falta que ejecutes el e2e.

### F5 · Calentamiento adaptativo
- [x] `adapt.ts`: niveles (subir con 8 o más de 10; bajar con 4 o menos), técnica del día, diagnóstico la primera vez, repaso de fallados a las 3 sesiones, sin repetir hasta agotar el grupo.
- [x] Ficha de detective (barra, nivel y aciertos por técnica) y racha.
- [x] "¿Te quedan dos?" en la hoja de acusación, con el protocolo de 5 pasos y el botón Practicar remates (guarda el caso en curso).
- [x] Recomendación tras un caso fallado según el arquetipo (tabla 3.10.2).
- [x] Pruebas unitarias de `adapt.ts` con historiales sintéticos: subir, bajar, técnica del día y no repetir la del día anterior.
- **Hecho cuando:** criterio 3.13 (3).

### F6 · Banco de ejercicios generado
- [x] `scripts/build-drills.ts` a partir de `solveHuman`, según la tabla 3.8. Los `tri` "no se sabe" se verifican con el solver exacto.
- [x] Nivel automático; filtros de calidad (como mucho 4 pistas en "Lo que sabes", 6 en remates).
- [x] Explicaciones con `engine/text.ts` y el Apéndice C, en tono "tú".
- [x] `scripts/validate-drills.ts`: reverifica cada respuesta.
- [x] Unos 360 ejercicios validados (o los que resulten con D4).
- [x] Muestra de 10 ejercicios por técnica para que la revises.
- **Puede empezar ya:** M2 está cerrado. Es independiente de F1 a F5.

### F7 · Calidad
- [ ] e2e de ambos modos en 360×640, 390×844, 844×390 y 1280×800, en tema claro y oscuro (el incendio siempre con su paleta). Los ejecutas tú.
- [ ] Auditoría de accesibilidad: teclado, `role`, contraste y movimiento reducido.
- [ ] Rendimiento con la CPU limitada ×4 (prueba manual tuya).
- [ ] Revisión de todos los textos frente a MODOS.
- [ ] Lista final de lo que queda fuera.

---

## 7. Riesgos

| Riesgo | Origen | Mitigación |
|---|---|---|
| Un caso de incendio exige adivinar cuando arden pistas | MODOS 2.5 no lo garantiza (D1) | Garantía fuerte comprobable; medir la tasa de rechazo en F3 |
| La verificación de ejercicios no termina | Fuerza bruta literal (sección 3.3) | D10: propagación con el solver exacto y fuerza bruta solo en instancias pequeñas |
| Ejercicios confusos o con respuesta equivocada | Respuestas heredadas del prototipo (D13) | Reverificación de todo antes de servirlo; muestra de revisión en F6 |
| Generar el incendio tarda demasiado | Muchos rechazos por las garantías | Generar solo el grupo con `generateGroup()`; medir en F3 |
| Ansiedad en lugar de diversión | Presión de MODOS 2.1 | Solo Novato e Inspector exprés; medallas en positivo; el derrumbe no resta rango |
| Contraste insuficiente en la paleta de fuego | Texto oscuro sobre brasa | Cálculo de contraste en F2 y ajuste de tokens |
| Regresiones en la portada y el tablero | Router y menú nuevos | Cambios localizados (sección 5); `#caso` y `#gen` intactos; pruebas existentes en verde |
| Pistas que parpadean | Animaciones de llama y aviso | Nada parpadea más de 3 veces por segundo; `prefers-reduced-motion` |
| Playwright no corre en este sandbox | Entorno | Los e2e se escriben aquí; los ejecutas tú con `pnpm test:e2e` |
| Comisario y Expediente vacíos | M3 abierto | No bloquea F3; no se lanza `bank:build` completo |

---

## 8. Qué verifico yo aquí y qué verificas tú

**Yo, en el sandbox:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (pruebas unitarias), `pnpm build` con comprobación del bundle, `pnpm bank:validate` (y su equivalente para incendio y ejercicios), y el cálculo de contrastes.

**Tú, en tu entorno:**
- `pnpm test:e2e` (requiere `pnpm exec playwright install` la primera vez).
- La lista de MODOS 11 en un móvil real, y capturas a 390×844 y 1280×800.
- La rotación del móvil y la capa de fuego.

---

## 9. Orden y próximo paso

Orden propuesto: **F0 → F1 → F2 → F4 → F5** (ambos modos jugables con contenido fijo). **F6** puede ir en paralelo, porque no depende de los demás. **F3** espera a D1.

**Lo que necesito de ti para empezar F0:**
1. Confirmar el orden y el alcance de la sección 6.
2. Decidir D1, D2 y D4, y confirmar las recomendaciones de D3, D5 a D12.

Hasta entonces no escribo código.
