# Hora Muerta v2: implementación con Claude Code

Esta guía tiene dos partes: cómo preparar tu repositorio y los prompts listos para copiar. El **prompt maestro** (sección 3) arranca el proyecto y hace que Claude Code planifique antes de tocar código. Los **prompts de fase** (sección 4) lo guían hito a hito, y los **prompts de ajuste** (sección 5) sirven para afinar después.

---

## 1. Preparar el repositorio (5 minutos)

1. Crea la carpeta `docs/` en la raíz de tu web y copia dentro:
   - `hora-muerta-diseno-tecnico.md` renombrado como **`docs/DISENO_TECNICO.md`**.
   - `hora-muerta.html` (el prototipo) como **`docs/referencia/hora-muerta-v1.html`**.
2. Crea en la raíz un archivo **`CLAUDE.md`** (Claude Code lo lee como memoria del proyecto en cada sesión) con este contenido:

```markdown
# Hora Muerta: memoria del proyecto

- Fuente de verdad del diseño: docs/DISENO_TECNICO.md. Si el código y el documento discrepan, manda el documento.
- Prototipo de referencia (motor, plano, estilos, textos): docs/referencia/hora-muerta-v1.html.
- Plan de trabajo y estado de los hitos: docs/PLAN.md. Decisiones tomadas ante ambigüedades: docs/DECISIONES.md.
- Reglas del juego intocables: una puerta por hora; el culpable estaba a solas con la víctima a la hora de la muerte; un objeto distinto por sospechoso y el arma es el del culpable.
- Lógica pura: ningún caso servido puede requerir adivinar. Todo caso pasa por el solver exacto y el solver humano.
- src/engine no depende del DOM (se usa en navegador, Web Worker y Node).
- Interfaz en español de España, textos de los apéndices B y C del diseño, mayúscula solo al inicio de frase.
- Móvil primero: cómodo a 360 px de ancho, sin scroll horizontal del body, objetivos táctiles de 44 px, safe areas, 100dvh.
- Pizarra: solo Marcar, Tiza y Ver, más la estela y la ayuda de movimiento. No añadir herramientas.
- Sin peticiones de red salvo Google Fonts y archivos propios. Sin analítica ni cookies. localStorage siempre con try/catch.
- Antes de cerrar un hito: npm run typecheck, npm run lint, npm test (y test:e2e cuando exista).
```

3. Abre Claude Code en la raíz del repositorio y pega el prompt maestro. Si tu versión tiene un modo de planificación, actívalo para este primer mensaje.

**Consejo de trabajo:** un hito por sesión. Al terminar cada uno, pruébalo en el móvil (con `npm run dev -- --host` puedes abrirlo desde el teléfono en tu red local), revisa el resumen y haz commit antes de pasar al siguiente.

---

## 2. Qué vas a obtener

- El juego completo según el diseño: 6 escenarios, 3 niveles, **banco de 600 casos** validados (configurable entre 200 y 600), caso del día, expediente de 3 casos, modo infinito, pista del inspector, estrellas, rango y archivo de arquetipos.
- Interfaz **móvil primero** con mesa de trabajo (plano fijo arriba, hoja inferior con pestañas y barra de acciones), horizontal y escritorio adaptados.
- PWA jugable sin conexión.
- Scripts para regenerar, validar y analizar el banco de casos, y pruebas automáticas del motor y de la interfaz.

---

## 3. Prompt maestro (copiar y pegar completo)

````text
Actúa como ingeniero sénior de videojuegos web y front-end, con experiencia en solvers de restricciones, generación procedural con control de calidad, TypeScript estricto, diseño móvil primero y accesibilidad. Vas a implementar "Hora Muerta v2", un juego de deducción lógica sobre planos, dentro de este repositorio.

## Fuentes (léelas completas antes de hacer nada)
1. docs/DISENO_TECNICO.md: fuente de verdad. Contiene reglas, contenido, modelo de datos, catálogo de pistas, generación, solver exacto, solver humano por niveles, arquetipos, dificultad, banco de casos, modos, puntuación, ayudas, progresión, interfaz responsive, persistencia, arquitectura, pruebas y fases.
2. docs/referencia/hora-muerta-v1.html: prototipo funcional. Del script "Engine" porta la lógica (makeCase, cluePool, holds, compile, exists, checkUnique, hasMatching, textos). Del resto porta la identidad visual (tokens CSS, tipografías, render del plano en buildPlan, puertas, iconos, fichas, tiza en canvas, animación de la portada). No copies su estructura monolítica: reorganiza según la sección 19 del diseño.
3. CLAUDE.md: reglas del proyecto.

## Objetivo
Implementar la versión 2 completa descrita en el diseño, integrada en esta web, jugable en móvil y en ordenador, con un banco de 600 casos validados y sin repeticiones para el jugador hasta agotarlo.

## Reglas innegociables
1. Las tres reglas del juego (sección 3 del diseño) no cambian. Ningún caso servido puede requerir adivinar: todos pasan por el solver exacto (unicidad) y por el solver humano (resoluble razonando dentro del nivel permitido).
2. src/engine no usa DOM ni APIs del navegador; debe funcionar igual en navegador, Web Worker y Node.
3. Determinismo: la misma semilla produce el mismo caso; la misma versión de banco produce el mismo banco.
4. Interfaz en español de España con los textos exactos de los apéndices B y C. Mayúscula solo al inicio de frase. Verbos activos. Errores que dicen qué pasó y qué hacer.
5. Móvil primero (sección 17.3): perfecto a 360 × 640 y 390 × 844; sin scroll horizontal del body; objetivos táctiles ≥ 44 px; env(safe-area-inset-*); 100dvh con alternativa 100vh.
6. Pizarra sencilla: Marcar, Tiza y Ver, más la estela y la ayuda de movimiento opcional. No añadas herramientas ni gestos complejos.
7. Sin peticiones de red salvo Google Fonts y archivos propios. Sin analítica ni cookies. localStorage con prefijo hm2: y siempre con try/catch.
8. Accesibilidad AA, foco visible, teclado (sección 17.9) y prefers-reduced-motion.
9. TypeScript strict. Funciones pequeñas y puras en el motor. Nada de any sin justificar.
10. Si el diseño es ambiguo o detectas un error, no lo cambies en silencio: anota el problema, tu decisión y el motivo en docs/DECISIONES.md y continúa.

## Paso 0: explorar y planificar (no escribas código de la aplicación todavía)
1. Explora el repositorio: framework, gestor de paquetes, build, despliegue, rutas y estilos existentes.
2. Decide la integración:
   a) Repositorio vacío o web estática: Vite + TypeScript sin framework, servido en la raíz o en /hora-muerta (configura base en Vite).
   b) Web con framework (Astro, Next, Nuxt, SvelteKit…): una ruta de solo cliente que monta la app de juego en un contenedor. No reescribas el juego en el framework; los archivos del banco van en la carpeta pública del framework.
3. Escribe docs/PLAN.md con: decisión de integración y motivo, estructura de carpetas final (adaptando la sección 19.2), dependencias exactas, scripts npm, los hitos M0 a M9 con tareas y cómo se verifica cada uno, riesgos y una lista de tareas con casillas que irás marcando.
4. Muéstrame un resumen del plan y ESPERA mi confirmación antes de empezar M0.

## Scripts npm que deben existir al final
dev, build, preview, typecheck, lint, test, test:e2e, bank:build, bank:validate, bank:report.

## Hitos y criterios de terminado (detalle en la sección 21 del diseño)
- M0 Proyecto: Vite + TS strict (o ruta en el framework), ESLint, Vitest, Playwright, tokens CSS y tipografías de v1, portada de v1 funcionando. Hecho cuando: build sin errores y la portada se ve igual que en v1 en móvil y escritorio.
- M1 Motor base: rng, 6 mapas del apéndice A, grafo, recorridos, verdad, pistas (16 tipos con moved y still), prohibiciones, topes, textos del apéndice B, solver exacto portado. Hecho cuando: pruebas de holds() por tipo, solver exacto igual a fuerza bruta en 30 casos Novato, determinismo por semilla, validación geométrica de los 6 mapas.
- M2 Solver humano: estado por máscaras, reglas de niveles 1 a 6 (sección 9.2), bucle de la regla más sencilla, pasos con premisas, cadena crítica, puntuación, deducción clave y arquetipos (sección 10). Hecho cuando: solidez comprobada en 300 casos (toda conclusión es cierta en la verdad), coherencia con el solver exacto y textos del apéndice C para cada regla. Incluye el ejemplo del apéndice D como prueba.
- M3 Generador y banco: tubería de la sección 7 (selección guiada por contraejemplos con temperatura, minimización, topes, lectura máxima, pista de cortesía en Novato, filtros de nivel y banda), scripts build-bank (en paralelo con worker_threads), validate-bank y bank-report, bank.config.ts con la composición de la sección 12.1 (600 por defecto, mínimo 200). Genera el banco y confirma el JSON. Hecho cuando: validate-bank pasa, cuotas cumplidas, informe en reports/bank-report.md y archivos por grupo ≤ 150 KB comprimidos.
- M4 Mesa de trabajo: layout responsive de la sección 17.3 (vertical, horizontal y escritorio), plano SVG (17.4) con marcas, estela y ayuda de movimiento, tiza en canvas (17.5), pestañas de hora, barra de herramientas, hoja inferior de dos estados, ampliar plano, deshacer común. Hecho cuando: se juega un caso del banco en 390 × 844 sin scroll horizontal y con todos los controles alcanzables con el pulgar.
- M5 Bucle completo: lista de pistas (tachar y enfocar), tabla de objetos con autocompletar, pestaña Caso con descartar, hoja de acusación, estrellas y límite de 2 errores (sección 14), cierre con frase, deducción clave, cadena desplegable, reconstrucción y siguiente caso instantáneo.
- M6 Pista del inspector: revisión de marcas contradictorias y siguiente paso de la cadena crítica en dos fases (sección 15), con resaltados en el plano y coste de estrellas.
- M7 Modos: servir sin repetir con orden personal, caso en curso, enlaces #caso=, caso del día, expediente con errores compartidos, modo infinito en Web Worker con pregeneración (secciones 12.5 y 13).
- M8 Progresión: rango y desbloqueos de escenarios, archivo de arquetipos, estadísticas, ajustes, persistencia hm2: y migración desde v1 (secciones 16 y 18).
- M9 Calidad: PWA sin conexión, presupuestos de rendimiento (19.4), auditoría de accesibilidad, pruebas e2e y capturas en 390 × 844, 844 × 390 y 1280 × 800 en tema claro y oscuro, pulido.

## Forma de trabajar
- Un hito cada vez. Al terminar: ejecuta typecheck, lint y test (y test:e2e desde M4), actualiza las casillas de docs/PLAN.md y dame un resumen breve: qué has hecho, cómo lo pruebo a mano, qué decisiones has anotado y qué queda pendiente. Si hay git, haz un commit por hito con mensaje "M3: banco de casos validado" o similar. No hagas push sin preguntarme.
- Al portar el motor de v1: primero porta fielmente y cúbrelo con pruebas; después amplía (nuevas pistas, topes, solver humano).
- Si una prueba de solidez del solver humano falla, detente y corrígelo antes de seguir: es la garantía de "nunca adivinar".
- No inventes contenido fuera del diseño (reglas, pistas, textos). Si falta algo, propónlo en DECISIONES.md.
- Prioriza la experiencia en móvil en cada decisión de interfaz.

Empieza por el Paso 0.
````

---

## 4. Prompts de fase

Úsalos después de aprobar el plan, uno por sesión. Cada uno recuerda el objetivo y cómo verificarlo.

**M0 · Proyecto**
```text
Plan aprobado. Implementa M0 según docs/PLAN.md. Porta los tokens CSS, tipografías y la portada de v1 (héroe con plano animado, tres reglas, niveles) al nuevo proyecto. Verifica build y lint, y dime cómo abrirlo en el móvil desde mi red local.
```

**M1 · Motor base**
```text
Implementa M1: motor en src/engine según las secciones 4 a 8 y los apéndices A y B del diseño. Porta el motor de v1 fielmente, añade los mapas hotel, barco y teatro, y las pistas moved y still. Pruebas obligatorias: holds() por tipo, solver exacto contra fuerza bruta en 30 casos Novato, determinismo y validación geométrica de los 6 mapas. Añade un script de consola que imprima un caso generado con sus pistas en texto.
```

**M2 · Solver humano**
```text
Implementa M2: solver humano de la sección 9 y arquetipos de la sección 10. Cada Step con nivel, regla, pistas usadas, conclusiones y premisas; cadena crítica por dependencias; puntuación; deducción clave. Pruebas: solidez en 300 casos, coherencia con el solver exacto y el ejemplo del apéndice D. Imprime en consola la cadena crítica de un caso con los textos del apéndice C para que la revise.
```

**M3 · Generador y banco**
```text
Implementa M3: generador v2 (sección 7), topes y lectura máxima (6.3), filtros de dificultad (11) y los scripts bank:build, bank:validate y bank:report (12). Genera el banco de 600 casos con la composición por defecto y enséñame el informe: distribución de puntuaciones por nivel, número de pistas, tipos, arquetipos, mapas y motivos de rechazo. Si las bandas de puntuación se solapan más de un 15% entre niveles vecinos, propón bandas nuevas antes de fijarlas.
```

**M4 · Mesa de trabajo**
```text
Implementa M4: mesa de trabajo responsive (17.3), plano SVG con marcas, estela y ayuda de movimiento (17.4), tiza (17.5), horas, herramientas, hoja inferior de dos estados y ampliar plano. Carga un caso real del banco. Haz capturas con Playwright en 390 × 844, 844 × 390 y 1280 × 800, revísalas tú mismo buscando solapes, textos cortados y scroll horizontal, corrige y enséñame las capturas finales.
```

**M5 · Bucle completo**
```text
Implementa M5: pistas interactivas (17.6), tabla de objetos (17.7), pestaña Caso con descartar (17.8), acusación, estrellas y límite de errores (14), cierre con frase, deducción clave, cadena desplegable, reconstrucción animada y botón "Siguiente caso" instantáneo. Añade una prueba e2e que juegue un caso de principio a fin usando la solución del JSON.
```

**M6 · Pista del inspector**
```text
Implementa M6: pista del inspector de la sección 15 (revisión de marcas contradictorias, siguiente paso de la cadena crítica, empujón y explicación, resaltados, coste de estrella). Pruebas unitarias del mapeo entre conclusiones y marcas, incluidos los pasos intermedios que no se pueden marcar.
```

**M7 · Modos**
```text
Implementa M7: servir casos sin repetir con semilla personal (12.5), caso en curso, enlaces #caso= y #gen=, caso del día, expediente con errores compartidos y modo infinito en Web Worker con pregeneración del siguiente caso (13). Prueba el agotamiento de un grupo con un banco de prueba pequeño.
```

**M8 · Progresión**
```text
Implementa M8: rango y desbloqueo de escenarios, archivo de arquetipos, estadísticas y perfil, ajustes, persistencia hm2: con migración desde las claves hm: de v1 (secciones 16 y 18). Añade pruebas de la migración y de la lectura con localStorage bloqueado.
```

**M9 · Calidad**
```text
Implementa M9: PWA sin conexión (manifest, iconos y service worker que guarde la app y el banco), presupuestos de rendimiento (19.4), auditoría de accesibilidad (17.9) y e2e con capturas en los tres tamaños y en tema claro y oscuro. Dame una lista final de lo que queda fuera de v2.
```

---

## 5. Prompts de ajuste

**Calibrar la dificultad**
```text
Ejecuta bank:report y analiza si cada nivel se siente distinto: puntuación, pistas, nivel máximo y lectura. Propón cambios concretos en pesos, topes o bandas (secciones 6.3 y 11) para que los percentiles 10 y 90 de niveles vecinos no se solapen más de un 15% y Comisario se mantenga entre 10 y 14 pistas. Aplica los cambios, regenera el banco y enséñame el antes y el después.
```

**Revisar un caso que parece injusto**
```text
El caso {ID} me parece injusto o imposible. Cárgalo, verifica con el solver exacto y con el humano, imprime su cadena crítica con los textos del apéndice C y explícame paso a paso cómo se resuelve. Si encuentras un error en el motor, corrígelo, añade una prueba que lo cubra y revalida el banco.
```

**Añadir un escenario nuevo**
```text
Quiero un escenario nuevo: {descripción}. Diséñalo siguiendo el apéndice A (rejilla 12 × 9, salas de al menos 3 × 2, dos rasgos, una personalidad lógica clara), valida su geometría con la prueba de mapas, añade sus iconos, integra su desbloqueo y genera 30 casos de prueba. Dime qué tipo de deducción provoca y enséñame una captura del plano en móvil.
```

**Revisión de la experiencia móvil**
```text
Revisa la experiencia en móvil como lo haría un diseñador de producto: haz capturas en 360 × 640, 390 × 844 y 844 × 390 del flujo completo (portada, caso, tiza, pista, acusación, cierre). Busca objetivos táctiles pequeños, textos cortados, saltos de diseño al abrir la hoja inferior y cualquier cosa que obligue a usar dos manos. Corrige y enséñame el antes y el después.
```

**Cambiar el tamaño del banco**
```text
Cambia la composición del banco a {número} casos en bank.config.ts manteniendo las proporciones de la sección 12.1 y las cuotas de variedad. Regenera, valida y dime el tamaño final de cada archivo.
```

---

## 6. Lista de comprobación para ti (en el móvil)

- [ ] La portada carga rápido y el plano animado se ve nítido.
- [ ] Un caso Novato se resuelve en 3 a 5 minutos sin pedir ayuda y tiene un momento de "clic".
- [ ] Todo se alcanza con el pulgar: horas, modos, reparto, Pista y Acusar.
- [ ] Al tocar una pista, el plano salta a su hora y resalta las salas.
- [ ] La estela deja ver dónde marcaste a cada persona una hora antes y una después.
- [ ] La tiza dibuja fino y cada hora guarda sus trazos.
- [ ] La pista del inspector ayuda sin destripar.
- [ ] El cierre enseña la deducción clave y "Siguiente caso" entra al instante.
- [ ] Cerrar la web a medias y volver ofrece "Seguir el caso".
- [ ] Sin conexión, tras la primera visita, se puede jugar.
- [ ] Nunca se repite un caso hasta agotar el nivel.
