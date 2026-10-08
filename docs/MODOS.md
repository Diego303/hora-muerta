# Hora Muerta: plan de implementación del Modo Incendio y el Modo Calentamiento

> Parte del prototipo `hora-muerta-academia.html` (en adelante **el prototipo**) y encaja con la arquitectura v2 descrita en `DISENO_TECNICO.md` (motor sin DOM, banco de casos, solver humano).
>
> El documento tiene dos partes:
>
> - **Parte A, el plan:** qué debe hacer cada modo, cómo funciona por dentro, en qué orden construirlo y cuándo está terminado.
> - **Parte B, los prompts para Claude Code:** preparación del repositorio, prompt maestro, un prompt por fase y prompts de ajuste.

---

## Índice

**Parte A. Plan**

0. Punto de partida
1. Infraestructura compartida (F0)
2. Modo Incendio
3. Modo Calentamiento
4. Estructura del código
5. Fases
6. Riesgos

**Parte B. Prompts para Claude Code**

7. Preparar el repositorio
8. Prompt maestro
9. Prompts por fase
10. Prompts de ajuste
11. Lista de comprobación en el móvil

---

# Parte A. Plan

## 0. Punto de partida

### 0.1 Qué se aprovecha del prototipo

| Pieza del prototipo | Qué es | Destino |
|---|---|---|
| `FIRE_CASES`, `startFire`, `roomDist` | Casos de incendio, arranque y distancias por puertas | `modes/fire/` |
| `fireUpdate`, `fireLayer`, `fireClues`, `firePhoto` | Propagación, capa del plano, pistas que arden y fotos | `modes/fire/` |
| `collapse`, `fireSolved`, `fireMedals`, `fireRecord` | Derrumbe, cierre, medallas y récords | `modes/fire/` |
| `ignite`, `startEmbers`, tokens `:root[data-fire]` | Transición, chispas y paleta | `modes/fire/theme/` |
| `GYM_ITEMS` (23 ejercicios), `gymNorm`, `gymSolve`, `gymAnswer` | Ejercicios, normalización y verificación por fuerza bruta | `modes/gym/` y `scripts/` |
| `gymRender`, `gymDraw`, `gymCheck`, `gymEnd` | Reproductor, miniplano, corrección e informe | `modes/gym/ui/` |

### 0.2 Atajos del prototipo que hay que resolver

1. **Casos de incendio fijos:** dos semillas escritas a mano y el foco elegido a mano. Hay que generarlos y validarlos en el banco.
2. **Ejercicios a mano:** solo hay 23, con las respuestas precalculadas en un JSON. Hay que generarlos desde el solver humano.
3. **Código monolítico:** todo vive en un solo `<script>`. Hay que separarlo en módulos.
4. **Vistas sin router:** las vistas se cambian con `hidden` a mano. Hace falta un router de vistas único.
5. **Sin adaptación real:** el calentamiento solo elige la técnica por porcentaje total. Hacen falta niveles e historial reciente.
6. **El incendio no se protege al salir:** si sales a mitad, se pierde sin confirmación.

### 0.3 Principios que no se tocan

- Las tres reglas del juego son las mismas en todos los modos.
- **Lógica pura:** ningún modo puede exigir adivinar. El incendio quita información de forma predecible y evitable; el calentamiento enseña a no adivinar.
- Móvil primero: todo cómodo a 360 px de ancho.
- Determinismo: la misma semilla produce el mismo caso, el mismo incendio y el mismo ejercicio.
- Sin red salvo las fuentes; persistencia en `localStorage` con `try/catch`.

---

## 1. Infraestructura compartida (fase F0)

Ambos modos la necesitan, así que va primero.

### 1.1 Router de vistas

Una sola función `showView(name, params)` con cuatro vistas: `home`, `game`, `fire` (sala del incendio) y `academy`. Cada vista registra tres funciones: `enter()`, `leave()` y `render()`. El router:

- Oculta las otras vistas y llama a `leave()` de la anterior (parar animaciones, chispas o temporizadores).
- Ajusta el modo visual: `document.documentElement.dataset.mode = 'fuego' | ''`.
- Actualiza el hash: `#incendio`, `#academia`, `#caso=ID`, `#tutorial`.
- Al cargar la página, interpreta el hash y abre la vista correspondiente.

**Hecho cuando** las cuatro vistas se abren por botón y por enlace directo, y al volver al menú no queda ningún temporizador ni animación activos.

### 1.2 Sistema de modos visuales

- **Tokens por modo:** `:root[data-mode="fuego"]` con mayor especificidad que los temas claro y oscuro. El fuego fuerza su paleta sea cual sea el tema del sistema.
- **Transiciones:** entrar al incendio usa la franja de fuego (unos 0,7 s); salir hace un fundido corto. Con `prefers-reduced-motion`, ninguna de las dos.
- **El calentamiento usa el tema base**, sin cambio de estética: es un espacio de calma.

### 1.3 Miniplano reutilizable (`ui/planlite.ts`)

Hoy hay tres renderizadores parecidos: el del juego, el del tutorial y el del calentamiento. Se unifica uno ligero:

```ts
renderPlanLite(svg, map, {
  victimRoom?: Room,
  tokens?: { c: number; r: Room; label?: string; dashed?: boolean }[],
  selectable?: boolean, onToggle?: (r: Room) => void,
  marks?: { ok?: Room[]; miss?: Room[]; bad?: Room[]; no?: Room[] },
  path?: Room[],            // camino con puertas numeradas
  heat?: number[]           // opacidad por sala (vista previa de los casos de incendio)
})
```

Lo usan el calentamiento, la vista previa de los casos de incendio y las capas del tutorial.

### 1.4 Menú principal

En la portada, en este orden y con jerarquía visual clara:

| Botón | Estilo | Destino |
|---|---|---|
| Jugar el caso del día | Principal | Juego |
| Abrir el plano de casos | Secundario | Plano de la ciudad |
| Calentamiento | Secundario, con icono de bombilla | Academia |
| Modo Incendio | Rojo, con icono de llama | Sala del incendio |

En móvil, "Caso del día" ocupa una fila entera y los otros tres se reparten debajo. En la cabecera: Tutorial, Calentar, Cómo se juega y el botón de tema.

---

## 2. Modo Incendio

### 2.1 Qué es

Un caso normal con las mismas reglas y la misma interfaz, pero dentro de un edificio en llamas: **5 minutos**, salas que arden siguiendo las puertas, pistas que se carbonizan y dos fotos para salvar las que quieras. La presión obliga a razonar rápido, pero todo es predecible: nunca se pierde información sin aviso.

### 2.2 Reglas exactas

| Parámetro | Valor | Nota |
|---|---|---|
| Tiempo total | 300 s | El reloj cuenta hacia atrás |
| Fase de humo | 0 a 45 s | No arde nada; humo en el plano |
| Ignición del foco | 45 s | |
| Propagación | Una puerta cada 45 s | `ign[r] = 45 + 45 × distancia(foco, r)` |
| Aviso previo | 15 s antes de arder | Sala teñida de naranja con cuenta atrás |
| Escena del crimen | `max(240, ign calculada)` | Aguanta hasta que queda 1:00 |
| Pista con sala | Arde a `ign[sala] + 45` | La sala es la que nombra la pista |
| Pista sin sala | Arde a 240 s | Rasgos de sala, encuentros entre personas, `ncarry`… |
| Animación de quemado | 4 s | Después queda "Pista quemada" |
| Fotos | 2 por caso | Una pista fotografiada nunca arde |
| Acusación errónea | −30 s | Se suma al tiempo consumido |
| Fin | 0:00 | El edificio se derrumba; se puede acusar hasta el último segundo |

**Qué arde y qué no:**

- **Las salas en llamas** no admiten marcas nuevas, ni borrar marcas, ni empezar trazos de tiza. **Las marcas y trazos ya hechos se ven siempre** por encima del carbón. La goma sí funciona, porque son tus notas.
- **Las pistas** arden según la tabla. Las tachadas también arden.
- **No arden nunca:** la tabla de objetos, los descartes de sospechosos ni los trazos.
- **Deshacer:** si la acción que se desharía afecta a una sala en llamas, se descarta esa entrada y aparece un aviso.
- **La pista del inspector** está desactivada en este modo (es un modo de presión).

### 2.3 Línea de tiempo y estados

```ts
type RoomFire = 'cold' | 'heat' | 'burning';
type ClueFire = 'ok' | 'heat' | 'burning' | 'burnt' | 'saved';

roomState(r, t) = t >= ign[r] ? 'burning' : t >= ign[r] - 15 ? 'heat' : 'cold'
clueBurnAt(i)   = saved(i) ? Infinity : (sala(i) != null ? ign[sala(i)] + 45 : 240)
clueState(i, t) = saved ? 'saved' : t >= at + 4 ? 'burnt' : t >= at ? 'burning'
                : at - t <= 30 ? 'heat' : 'ok'
```

Todo se calcula a partir de `t` (segundos consumidos) y de los datos precalculados del caso. **No hay estado acumulado**, así que no hay errores de sincronía: el mismo `t` da siempre la misma imagen.

**Pausa:** el tiempo se detiene si la pestaña queda oculta. Al volver aparece una capa "En pausa" con el botón **Seguir**, para que no te pille por sorpresa.

### 2.4 Datos del caso

En el banco se añade el grupo `incendio`. Cada caso lleva, además de lo normal:

```ts
interface FireData {
  origin: Room;                 // foco
  ign: number[];                // segundo de ignición por sala
  burnAt: number[];             // segundo de quemado por pista
  level: 'Novato' | 'Inspector exprés';
  title: string;                // "Museo Aldana en llamas"
  intro: string;                // texto que nombra el foco
}
```

`ign` y `burnAt` se precalculan en el banco: el navegador no calcula nada y el validador puede comprobarlos.

### 2.5 Generación y garantías de justicia

En `scripts/build-bank.ts` se añade un grupo `incendio` con 40 casos por defecto: 20 Novato y 20 Inspector exprés (5 sospechosos, 3 horas, 9 pistas como máximo).

1. Generar el caso con la tubería normal y los filtros de su nivel.
2. **Elegir el foco:** la sala más alejada (en puertas) de la sala del crimen. En empate, la que tenga más pistas ancladas a salas de distancia intermedia, para que el quemado sea gradual. Después, por índice, para que sea determinista.
3. Calcular `ign` y `burnAt`.
4. **Validar** y rechazar el caso si falla algo:
   - El foco está a 2 puertas o más de la escena del crimen.
   - Cada pista es legible durante al menos 90 s (por construcción, mínimo 90 s).
   - **Ritmo:** como mucho el 40 % de las pistas arde antes de 2:30 consumidos.
   - **Cadena crítica:** al menos la mitad de las pistas que usa el solver humano arde después de 2:30.
   - Opcional para la calibración: ninguna pista crítica anclada al foco salvo que exista otra pista crítica equivalente.
   - La puntuación del solver humano está en el tercio bajo o medio de la banda del nivel.
5. Escribir `public/cases/incendio.json` y validarlo con `validate-bank`.

Para los textos, cada mapa tiene una lista de causas por sala ("un cortocircuito en el Archivo", "una vela olvidada en la Biblioteca"…). El título es "{Lugar} en llamas".

### 2.6 Interfaz

**Sala del incendio (`#incendio`):**

- Cabecera con "← Volver al menú".
- Título grande con degradado de fuego, una frase de presentación y las cinco reglas con iconos (las del prototipo).
- Tarjetas de edificio: miniplano con el calor por distancia y la llama en el foco, nivel, título, introducción, "Foco: X. N sospechosos, 3 horas, N pistas", tu mejor marca y el botón **Entrar en el edificio**.
- Filtro por nivel (Todos / Novato / Inspector exprés). Los casos se sirven sin repetir, como el banco normal.

**Dentro del caso** (la vista de juego normal más estas piezas):

| Pieza | Dónde | Comportamiento |
|---|---|---|
| Reloj | Cabecera | Cuenta atrás grande; el último minuto late a 1 Hz, nunca más rápido |
| Barra del edificio | Bajo la cabecera | Ancho proporcional al tiempo restante |
| Capa de fuego | Plano, entre salas y etiquetas | Carbón, brillo de bordes, llamas animadas; aviso naranja con cuenta atrás |
| Humo | Plano | Solo durante la fase de humo |
| Línea de estado | Bajo las pestañas de hora | "Arden: X. Después: Y, dentro de 0:20" |
| Mecha de la pista | Cada pista | Contador cuando le quedan 30 s o menos |
| Botón de foto | Cada pista | Cámara; al usarla, "A salvo" |
| Contador de fotos | Cabecera de las pistas | "2 fotos para salvar pistas" |
| Pista quemada | Lista | "Pista quemada" más una barra de ceniza; el texto se elimina del DOM |

**Rendimiento de la capa de fuego:** solo se vuelve a dibujar cuando cambia el estado de alguna sala. Las cuentas atrás se actualizan como texto, para que las llamas no reinicien su animación cada segundo.

**Cierre:**

- **Resuelto:** "Resuelto entre las llamas", veredicto, tiempo sobrante y tres medallas: **Sin fotos**, **A tiempo** (más de 2:00 restantes) y **Sin errores**. Botones: Ver la noche, Mejorar mi tiempo y Volver al Modo Incendio.
- **Derrumbe:** "El edificio se ha derrumbado". Botones: Volver a entrar (el fuego arde igual), Ver la solución y Volver.
- **Salir a mitad:** un diálogo pregunta "Si sales, el incendio se pierde. ¿Salir?".

### 2.7 Estética, accesibilidad y rendimiento

- **Paleta:** hollín `#160e0b`, panel `#22150f`, sala `#2a1a13`, paredes `#f0ad6e`, texto `#f7e8d4`, brasa `#ff5a1f`, llama `#ffb13b`. Hay que comprobar el contraste AA del texto y de los botones (texto oscuro sobre brasa).
- **Chispas:** un único `<canvas>` fijo, 80 partículas como máximo y una intensidad que sube con el tiempo. Se paran al salir, con la pestaña oculta y con movimiento reducido.
- **Fotosensibilidad:** nada parpadea más de 3 veces por segundo y no hay destellos a pantalla completa.
- **Lectores de pantalla:** un anunciador `role="status"` dice solo los cambios importantes ("La Cocina arde", "La pista 4 se ha quemado", "Queda 1 minuto"), nunca la cuenta atrás segundo a segundo. Las salas en llamas lo indican en su `aria-label`.
- **No depender del color:** lo quemado también se distingue por textura y por el texto "Pista quemada".

### 2.8 Persistencia

`hm2:fire = { [caseId]: { bestLeft, medals: string[], attempts, solvedAt } }`.

El caso en curso **no** se guarda (recargar la página equivale a abandonar). El incendio no cuenta en las estadísticas normales, pero sí suma estrellas de rango: 1 por resolver, más 1 por cada medalla, con un máximo de 3.

### 2.9 Casos límite que hay que probar

- El tiempo se acaba con la hoja de acusación abierta: se cierra y aparece el derrumbe.
- Una penalización deja el reloj por debajo de cero: derrumbe inmediato.
- Acertar justo en 0:00: se da por resuelto si la acusación llega antes de que se procese el derrumbe.
- Foto sobre una pista que ya está ardiendo: se rechaza con un aviso.
- Modo Ver con filtro: las pistas quemadas no se resaltan.
- La reconstrucción de la noche tras el final: las fichas se ven sobre el carbón.
- Volver a entrar en el caso: todo se reinicia (marcas, tiza, fotos, tabla).
- Rotar el móvil o redimensionar: la capa de fuego se recoloca.

### 2.10 Criterios de aceptación

1. Con `t` simulado, el estado de cada sala y cada pista coincide con la fórmula en todos los casos del banco (prueba unitaria).
2. `validate-bank` pasa las garantías de justicia de los 40 casos.
3. Un e2e resuelve un caso de incendio de principio a fin y otro provoca el derrumbe.
4. A 390 × 844 se ven a la vez el plano, las horas y la línea de estado sin desplazar la página.
5. Con la CPU limitada ×4 en las herramientas del navegador, el juego sigue fluido con las chispas activas.

---

## 3. Modo Calentamiento ("Prácticas en la Academia")

### 3.1 Qué es

Una sesión corta de entrenamiento, de 5 a 8 minutos y sin reloj, para afinar las técnicas de razonamiento antes de jugar. No es una partida: son ejercicios de 20 a 60 segundos sobre un trozo pequeño de plano, con corrección inmediata que **explica el error concreto**. Ataca directamente el problema de quedarse con dos candidatos y acusar al azar.

### 3.2 Técnicas

| Id | Nombre | Qué entrena | Versión |
|---|---|---|---|
| `alcance` | Contar puertas | Dónde pudo estar alguien hacia delante y hacia atrás, cruzando horas y rasgos | v1 |
| `seguro` | Seguro o solo posible | Distinguir lo demostrado de lo posible | v1 |
| `tabla` | La tabla de objetos | Exclusión mutua y agotamiento entre personas y objetos | v1 |
| `remate` | Remates con dos | Desempatar dos candidatos: pista decisiva e hipótesis | v1 |
| `recuento` | Recuentos | "Exactamente N" saturado y necesario | v2 |
| `hipotesis` | Prueba y descarta | Suponer un candidato y encontrar la contradicción | v2 (en v1 va dentro de `remate`) |

### 3.3 Tipos de ejercicio

| Tipo | Pregunta | Cómo responde el jugador | Cómo se corrige |
|---|---|---|---|
| `reach` | ¿Dónde pudo estar X a las H? | Toca salas en el plano y pulsa Comprobar | Conjunto exacto de salas |
| `tri` | ¿Verdadero, falso o no se puede saber? | Tres botones | V, F o NS |
| `pick` | ¿Quién llevaba O? / ¿Qué llevaba X? | Opciones más "No se puede saber" (con tabla opcional para anotar) | Opción única o NS |
| `clue` | ¿Qué pista decide entre A y B? | Elige una pista (las ya usadas aparecen tachadas y no se pueden elegir) | Índice decisivo |
| `contra` | Supón que fue X: ¿qué pista se rompe? | Elige una pista; la hipótesis se dibuja en el plano | Índice que rompe la hipótesis |
| `count` (v2) | ¿Quién más pudo estar en la sala? | Toca fichas de sospechosos | Conjunto exacto |

### 3.4 Estructura de la sesión

| Bloque | Ejercicios | Contenido | Nivel |
|---|---|---|---|
| 1. Activación | 5 | Mezcla de `alcance` y `seguro`, solo `reach` y `tri` | Tu nivel menos 1 (mínimo 1) |
| 2. Técnica del día | 5 | Una sola técnica | Tu nivel en esa técnica |
| 3. Remate | 3 | `clue` y `contra` | Tu nivel de `remate` |

- Antes de cada bloque, una pantalla breve con el nombre del bloque y una frase de método (en el remate: "relee las pistas pensando solo en esos dos, o prueba una hipótesis").
- Una barra de puntos arriba: verde si aciertas, rojo si fallas.
- Puedes salir en cualquier momento; lo respondido cuenta en tus estadísticas.

**Primera vez:** la sesión es de **diagnóstico**, con 2 ejercicios de cada técnica en la activación, y se explica así en la entrada.

### 3.5 Corrección y mensajes

Cada respuesta muestra **✓ Correcto** o **✗ No del todo**, una pista concreta sobre el error si lo hubo, la explicación completa y marcas en el plano: salas acertadas, las que faltaron con borde discontinuo, las sobrantes con ✗ y el camino con las puertas numeradas cuando aplica.

**Reglas de error** (se aplica la primera que encaje):

| Tipo | Error detectado | Mensaje |
|---|---|---|
| `reach` | Falta la sala de partida | "En una hora también puede quedarse donde estaba: X también vale." |
| `reach` | Elige una sala que toca la de partida sin puerta | "X y Y se tocan, pero no hay puerta entre ellas." |
| `reach` | Elige una sala a 2 puertas o más | "X está a dos puertas: no da tiempo en una hora." |
| `reach` | Elige una sala que no cumple un rasgo | "X no tiene ventana." |
| `reach` | Le falta parte de la intersección entre horas | "Tiene que encajar con las dos horas a la vez." |
| `tri`/`pick` | Responde V/F (o una opción) cuando era NS | "Es posible, pero no está demostrado. Responder eso sería una corazonada." |
| `tri`/`pick` | Responde NS cuando se podía saber | "Sí se puede saber: hay una deducción que lo cierra." |
| `tri` | Invierte V y F | "Es justo al revés." |
| `clue` | Elige una pista que no afecta a los dos | "Esa pista no cambia nada entre los dos que quedan." |
| `contra` | Elige una pista compatible con la hipótesis | "Con esa pista la hipótesis sigue en pie." |

El tono es siempre de entrenador: sin castigo, con la idea siguiente en la mano. Si ninguna regla encaja, se muestra solo la explicación.

### 3.6 Adaptación

Por técnica se guarda `level` (1 a 3), `hist` (los últimos 20 resultados como 0 y 1) y `ok`/`n` totales.

- **Subir de nivel:** 8 o más aciertos en los últimos 10 del nivel actual.
- **Bajar de nivel:** 4 o menos aciertos en los últimos 10.
- **Técnica del día:** primero las que no se han practicado; después, la de menor acierto en sus últimos 20. No se repite la del día anterior salvo que su acierto esté más de 15 puntos por debajo de la siguiente.
- **Sin repeticiones:** un ejercicio no vuelve hasta agotar su grupo (técnica y nivel). Los fallados vuelven antes, 3 sesiones después, como repaso espaciado sencillo.

**Niveles de dificultad de un ejercicio:**

| Nivel | Pistas | Horas o saltos | Ejemplo |
|---|---|---|---|
| 1 | 1 | Un salto | Alcance a una hora |
| 2 | 2 | Dos saltos o un cruce | Alcance de dos horas, intersección |
| 3 | 3 o más | Hipótesis o agotamiento en cadena | Contradicción, tabla en tres pasos |

### 3.7 Datos del ejercicio

```ts
interface DrillDef {
  id: string; tech: Tech; type: DrillType; level: 1 | 2 | 3;
  map: MapId | null; T: number;
  cast: string[]; objs?: string[];
  given: Clue[];                              // "Lo que sabes"
  facts?: Clue[];                             // hechos del enunciado (no se listan)
  clues?: (Clue & { used?: boolean })[];      // para clue/contra
  stmt?: Clue | { k: 'carry'; c: number; o: number };   // para tri
  ask?: { c?: number; t?: number; who?: number; what?: number };  // para reach/pick
  rv?: Room; td?: Hour;                       // regla del crimen (remates)
  hyp?: { culprit: number };                  // contra
  tokens?: Token[]; show?: { rooms?: Room[]; path?: Room[] };
  prompt?: string; context?: string; explain: string;
  answer: number[] | 'V' | 'F' | 'NS' | number | { decide: number[]; answer?: number };
}
```

La respuesta va **precalculada y verificada** en el banco; el navegador no resuelve nada.

### 3.8 Generación del banco de ejercicios

**Objetivo:** unos 360 ejercicios, 30 por técnica y nivel en las 4 técnicas de v1 (60 de ellos remates). Se guardan en `public/drills.json`, unos 200 KB sin comprimir y unos 40 KB comprimido.

**Fuente 1, semilla manual:** los 23 del prototipo, que ya están verificados. Sirven de referencia de calidad.

**Fuente 2, el solver humano** (requiere la fase M2 del diseño técnico). En cada caso del banco, cada paso de la cadena crítica se convierte en un ejercicio:

| Paso del solver | Ejercicio | Cómo |
|---|---|---|
| `R3_REACH_*` | `reach` | Se dan las premisas del paso y se pregunta por el conjunto de salas que deduce |
| `R1_FEAT` | `reach` con rasgo | Igual |
| `R4_TOGETHER`, `R4_OBJ_WHERE`, `R4_OBJ_WITH` | `tri` verdadero | La conclusión del paso como afirmación |
| (derivado) | `tri` falso | Se niega una conclusión |
| (derivado) | `tri` no se sabe | Una afirmación plausible sobre la misma persona u hora que el solver exacto confirma indeterminada con esas premisas |
| `R5_OBJ_SINGLE`, `R5_SUS_SINGLE` | `pick` | Las premisas de la tabla y la pregunta por el objeto o la persona |
| Paso que descarta al penúltimo candidato | `clue` | El caso en ese momento: pistas usadas tachadas, quedan dos y se pregunta por la pista decisiva |
| `R6_HYPOTHESIS` o pareja a la hora del crimen | `contra` | La hipótesis falsa y las pistas; se pregunta cuál se rompe |

**Verificación** (`scripts/validate-drills.ts`): cada ejercicio se resuelve por fuerza bruta (escenarios pequeños: hasta 4 sospechosos, 3 horas y 9 salas) y su respuesta tiene que coincidir. En `clue` y `contra`, exactamente una pista elegible debe ser la decisiva.

**Filtros de calidad:**

- "Lo que sabes" tiene como mucho 4 pistas (6 en remates).
- Ningún ejercicio se responde sin mirar el plano ni las pistas.
- Variedad de mapas y de personas.
- Las explicaciones se generan con las plantillas del Apéndice C del diseño, adaptadas a "tú".

**Nivel automático:** según el número de pistas y saltos necesarios (tabla 3.6).

### 3.9 Interfaz

**Entrada (`#academia`):** "Academia de Policía de Valdeniebla", título "Prácticas en la Academia", una frase de presentación, el botón **Empezar el calentamiento**, la lista de los tres bloques (con la técnica del día y el motivo) y la ficha de detective (cuatro técnicas con barra, nivel y aciertos). Opcionalmente, la racha de días.

**Reproductor de ejercicios:**

- **Móvil:** barra de progreso arriba; debajo, técnica, enunciado, miniplano a todo el ancho (como mucho 40 % del alto), "Lo que sabes", la zona de respuesta y la corrección.
- **Escritorio:** dos columnas, con el miniplano a la izquierda y las pistas y la respuesta a la derecha.
- El botón **Comprobar** solo se activa cuando hay una respuesta. Tras corregir, **Siguiente** recibe el foco.

**Informe final:** "N de 13", aciertos por bloque, cómo cambia cada técnica (por ejemplo, "Seguro o solo posible: nivel 1 → 2"), un consejo para la próxima partida según tu técnica más floja y tres botones: **Ir a jugar un caso** (abre el plano de la ciudad desplegado), **Repetir el calentamiento** y **Volver a la Academia**.

### 3.10 Integración con la partida normal

1. **"¿Te quedan dos?"** En la hoja de acusación, si has descartado a todos menos a dos (según tus descartes o tus marcas), aparece un enlace que despliega el protocolo de cinco comprobaciones:
   1. ¿Hay pistas sin tachar? Reléelas pensando solo en esos dos.
   2. Supón que es el primero: sigue su noche hora a hora. ¿Rompe alguna pista?
   3. Mira sus objetos posibles en la tabla: ¿alguno queda sin dueño?
   4. Revisa los recuentos y los rasgos de sala.
   5. Mira de dónde pudo venir cada uno una hora antes del crimen.

   Debajo, un botón **Practicar remates** abre una sesión corta solo de remates (5 ejercicios) y guarda el caso en curso.

2. **Recomendación tras un caso.** Si fallaste una acusación, el cierre sugiere una técnica según el arquetipo de la deducción clave:

   | Arquetipo | Técnica sugerida |
   |---|---|
   | Coartada imposible, paso obligado | Contar puertas |
   | Cadena del objeto | La tabla de objetos |
   | Pareja inseparable, recuento | Seguro o solo posible |
   | Callejón sin salida | Remates con dos |

3. **Calentar antes del caso del día.** Una invitación opcional en la portada: "Calienta 5 minutos antes del caso del día".

### 3.11 Accesibilidad

- En los ejercicios de tocar salas, cada sala es un botón con `aria-pressed` que se maneja con Tab, Enter y espacio.
- El resultado se anuncia con `aria-live`.
- Acierto y fallo llevan texto y símbolo (✓, ✗), no solo color.
- La corrección no depende de animaciones.

### 3.12 Persistencia

```ts
hm2:gym = {
  tech: { [id]: { level, hist: (0 | 1)[], ok, n } },
  served: { [`${tech}:${level}`]: string[] },
  review: { id: string; due: number }[],    // fallados para repaso
  streak: { last: 'YYYY-MM-DD', count, best },
  sessions: { date, score, n, tech }[]      // últimas 30
}
```

### 3.13 Criterios de aceptación

1. `validate-drills` pasa con todos los ejercicios, y cada `clue`/`contra` tiene exactamente una respuesta decisiva.
2. Una sesión completa dura entre 5 y 8 minutos con un jugador medio (13 ejercicios de 20 a 40 s).
3. La técnica del día y los niveles cambian según el historial (pruebas unitarias con historiales sintéticos).
4. Cada regla de error de la tabla 3.5 tiene una prueba que la provoca y comprueba el mensaje.
5. Un e2e completa la sesión en móvil y en escritorio, y "Ir a jugar un caso" abre el plano desplegado.

---

## 4. Estructura del código

```
src/
  core/router.ts              # showView, hash, modos visuales
  ui/planlite.ts              # miniplano compartido
  modes/fire/
    config.ts                 # constantes de la tabla 2.2
    timeline.ts               # roomState, clueBurnAt, clueState (puras)
    session.ts                # arranque, penalizaciones, derrumbe, cierre, récords
    ui/lobby.ts  ui/layer.ts  ui/clues.ts  ui/status.ts  ui/end.ts
    theme/ignite.ts  theme/embers.ts
  modes/gym/
    types.ts
    bank.ts                   # carga de drills.json y servicio sin repetir
    compose.ts                # composición de la sesión (tabla 3.4)
    adapt.ts                  # niveles, técnica del día, repaso
    grade.ts                  # corrección y reglas de error (tabla 3.5)
    ui/intro.ts  ui/player.ts  ui/report.ts  ui/twoleft.ts
scripts/
  build-bank.ts               # + grupo incendio
  build-drills.ts
  validate-drills.ts
tests/
  fire/timeline.test.ts  fire/validate.test.ts
  gym/grade.test.ts  gym/adapt.test.ts  gym/drills.test.ts
  e2e/fire.spec.ts  e2e/gym.spec.ts
```

`timeline.ts`, `compose.ts`, `adapt.ts` y `grade.ts` son **funciones puras sin DOM**: se prueban en Node y son la parte que más conviene blindar.

---

## 5. Fases

| Fase | Contenido | Depende de | Entregable | Hecho cuando |
|---|---|---|---|---|
| **F0** | Router, modos visuales, miniplano, menú | — | Navegación limpia entre las 4 vistas | Criterio de 1.1 cumplido |
| **F1** | Incendio, núcleo: línea de tiempo, capa de fuego, bloqueos, reloj, penalización, derrumbe; los 2 casos del prototipo | F0 | Incendio jugable | Pruebas de `timeline` y e2e de derrumbe |
| **F2** | Incendio completo: fotos, quemado de pistas, línea de estado, sala, cierre con medallas, chispas, accesibilidad, salir con confirmación | F1 | Modo como el prototipo, pulido | Criterios 2.10 (3, 4, 5) |
| **F3** | Incendio en el banco: grupo de generación, elección del foco, validación de justicia, 40 casos, servicio sin repetir | F2 y M3 del diseño | `incendio.json` validado | Criterios 2.10 (1, 2) |
| **F4** | Calentamiento, núcleo: entrada, reproductor con 5 tipos, corrección con reglas de error, sesión de 3 bloques, informe; los 23 ejercicios del prototipo | F0 | Sesión jugable | Criterios 3.13 (4, 5) |
| **F5** | Calentamiento adaptativo: niveles, técnica del día, diagnóstico, repaso, ficha, racha, "¿Te quedan dos?", recomendación tras un caso | F4 | Modo que aprende de ti | Criterio 3.13 (3) |
| **F6** | Banco de ejercicios generado: `build-drills` desde el solver humano, unos 360 ejercicios validados | F5 y M2 del diseño | `drills.json` | Criterios 3.13 (1, 2) |
| **F7** | Calidad: e2e en 3 tamaños y 2 temas, auditoría de accesibilidad, rendimiento, textos | Todas | Versión lista | Todos los criterios |

**Orden recomendado:** F0, F1, F2, F4, F5 (ambos modos jugables con contenido fijo), y después F3 y F6 cuando el banco y el solver humano de la v2 estén listos. Así puedes probar los dos modos pronto sin esperar al motor completo.

---

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| El incendio se siente injusto | Garantías de 2.5, aviso de 15 s, fase de humo, fotos, y "Volver a entrar" con el mismo fuego |
| Ansiedad en lugar de diversión | Solo casos Novato e Inspector exprés, medallas en positivo y sin penalizar el rango por derrumbe |
| Rendimiento en móviles modestos | Capa de fuego redibujada solo al cambiar el estado, chispas limitadas y en pausa con la pestaña oculta |
| Ejercicios generados confusos | Filtros de calidad, límite de pistas, plantillas de explicación revisadas y la semilla manual como referencia |
| El calentamiento se vuelve repetitivo | Repaso espaciado, niveles y un banco de unos 360 ejercicios |
| Mensajes de error equivocados | Una prueba por regla; si ninguna regla encaja, solo la explicación |

---

# Parte B. Prompts para Claude Code

## 7. Preparar el repositorio

1. Copia en `docs/`:
   - Este archivo como **`docs/MODOS.md`**.
   - El prototipo `hora-muerta-academia.html` como **`docs/referencia/hora-muerta-modos.html`**.
   - Si ya lo tienes, `DISENO_TECNICO.md` sigue en `docs/`.
2. Añade al final de tu **`CLAUDE.md`** estas líneas:

```markdown
## Modos Incendio y Calentamiento
- Especificación y plan: docs/MODOS.md. Si el código y el documento discrepan, manda el documento.
- Prototipo de referencia de ambos modos: docs/referencia/hora-muerta-modos.html (funciones fire* y gym*, GYM_ITEMS, gym_core).
- El incendio es predecible: todo su estado se calcula a partir de t y de ign/burnAt precalculados. Nada de estado acumulado.
- El incendio nunca puede exigir adivinar: respeta las garantías de justicia de MODOS.md 2.5.
- El calentamiento no tiene reloj ni castigo. Cada ejercicio lleva su respuesta precalculada y verificada por fuerza bruta.
- timeline.ts, compose.ts, adapt.ts y grade.ts son funciones puras sin DOM y con pruebas.
- Textos en español de España, tal como aparecen en MODOS.md.
```

3. Trabaja **una fase por sesión** y prueba cada una en el móvil antes de seguir.

---

## 8. Prompt maestro (copiar y pegar completo)

````text
Actúa como ingeniero sénior de videojuegos web, con experiencia en TypeScript estricto, diseño móvil primero, accesibilidad, animación eficiente y lógica de restricciones. Vas a implementar dos modos nuevos de "Hora Muerta": el Modo Incendio y el Modo Calentamiento ("Prácticas en la Academia").

## Fuentes (léelas completas antes de hacer nada)
1. docs/MODOS.md: especificación y plan de ambos modos. Es la fuente de verdad: reglas con números exactos, estados, datos, generación, interfaz, persistencia, casos límite, criterios de aceptación y fases F0 a F7.
2. docs/referencia/hora-muerta-modos.html: prototipo funcional de ambos modos. Porta la lógica de las funciones fire* (startFire, fireUpdate, fireLayer, fireClues, firePhoto, collapse, fireSolved, ignite, startEmbers) y gym* (GYM_ITEMS, gymNorm, gymSolve, gymAnswer, gymRender, gymDraw, gymCheck, gymEnd), y su estética. No copies su estructura monolítica: organiza según MODOS.md sección 4.
3. docs/DISENO_TECNICO.md (si existe): arquitectura general, banco de casos y solver humano en los que se apoyan las fases F3 y F6.
4. CLAUDE.md: reglas del proyecto.

## Reglas innegociables
1. Las tres reglas del juego no cambian en ningún modo. Ningún modo puede exigir adivinar.
2. Incendio: todo su estado sale de t (segundos consumidos) y de ign/burnAt precalculados, con las fórmulas de MODOS.md 2.3. Sin estado acumulado.
3. Calentamiento: sin reloj ni castigo. Cada ejercicio lleva su respuesta precalculada y verificada.
4. Funciones puras sin DOM en timeline.ts, compose.ts, adapt.ts y grade.ts, con pruebas unitarias.
5. Móvil primero: cómodo a 360 × 640 y 390 × 844, sin scroll horizontal del body, objetivos táctiles de 44 px.
6. Accesibilidad: AA de contraste también en la paleta de fuego, nada que parpadee más de 3 veces por segundo, prefers-reduced-motion, anuncios con role="status" solo en cambios importantes, nunca color como única señal.
7. Sin red salvo Google Fonts. localStorage con prefijo hm2: y siempre con try/catch.
8. Textos en español de España tal como aparecen en MODOS.md.
9. Si algo del documento es ambiguo o parece un error, anótalo en docs/DECISIONES.md con tu decisión y sigue.

## Paso 0: explorar y planificar (no escribas código todavía)
1. Explora el repositorio: estado actual del juego, router, estilos, motor, banco de casos y si existe ya el solver humano.
2. Escribe docs/PLAN_MODOS.md con: cómo encaja cada fase en el código existente, archivos que crearás o tocarás, dependencias, riesgos y una lista de tareas con casillas por fase (F0 a F7). Indica si F3 y F6 pueden hacerse ya o dependen de piezas de la v2 que aún no existen.
3. Muéstrame un resumen y ESPERA mi confirmación antes de empezar F0.

## Forma de trabajar
- Una fase cada vez. Al terminar: typecheck, lint, test (y test:e2e desde F1), casillas actualizadas en docs/PLAN_MODOS.md y un resumen breve con qué has hecho, cómo lo pruebo a mano en el móvil, decisiones anotadas y pendientes.
- Un commit por fase ("F2: Modo Incendio completo"). No hagas push sin preguntarme.
- Al portar del prototipo: primero porta fielmente y cubre con pruebas; después mejora.
- Si una prueba de las fórmulas del incendio o de la verificación de ejercicios falla, detente y corrígelo antes de seguir.

Empieza por el Paso 0.
````

---

## 9. Prompts por fase

Úsalos después de aprobar el plan, uno por sesión.

**F0 · Infraestructura compartida**
```text
Plan aprobado. Implementa F0 según MODOS.md sección 1: router de vistas único (home, game, fire, academy) con enter/leave/render y hash (#incendio, #academia, #caso=, #tutorial); modos visuales con :root[data-mode="fuego"]; miniplano compartido ui/planlite.ts con la API de 1.3; y el menú principal de 1.4 con su distribución en móvil. Prueba: al volver al menú desde cualquier vista no queda ningún temporizador, intervalo ni requestAnimationFrame activo (añade una prueba que lo compruebe).
```

**F1 · Incendio, núcleo**
```text
Implementa F1 según MODOS.md 2.2, 2.3 y 2.9: modes/fire/config.ts con las constantes de la tabla 2.2; modes/fire/timeline.ts con roomState, clueBurnAt y clueState puras; capa de fuego en el plano (carbón, bordes, llamas, aviso naranja con cuenta atrás) redibujada solo al cambiar estados; bloqueo de marcas y tiza en salas en llamas (marcas previas visibles, goma permitida, deshacer que descarta entradas de salas en llamas); reloj hacia atrás con pausa al ocultar la pestaña y capa "En pausa"; penalización de 30 s; derrumbe. Usa los 2 casos del prototipo. Pruebas: tabla de estados para varios t en los 2 casos y un e2e que provoque el derrumbe.
```

**F2 · Incendio completo**
```text
Implementa F2 según MODOS.md 2.2, 2.6, 2.7 y 2.8: fotos (2 por caso), mecha y quemado de pistas con el texto eliminado del DOM, línea de estado, barra del edificio, sala del incendio (#incendio) con tarjetas, miniplano de calor y mejor marca, cierre con medallas (Sin fotos, A tiempo, Sin errores), derrumbe con Volver a entrar y Ver la solución, confirmación al salir a mitad, transición de entrada, chispas en canvas con límites, anunciador role="status" y récords en hm2:fire. Comprueba el contraste AA de la paleta de fuego. Pruebas: e2e de un caso resuelto y capturas en 390 × 844 y 1280 × 800.
```

**F3 · Incendio en el banco**
```text
Implementa F3 según MODOS.md 2.4 y 2.5: grupo "incendio" en scripts/build-bank.ts (20 Novato y 20 Inspector exprés), elección determinista del foco, cálculo de ign y burnAt, textos de causa por sala y título "{Lugar} en llamas", y todas las garantías de justicia en validate-bank. Genera incendio.json, enséñame un informe con la distribución de focos, el porcentaje de pistas quemadas por minuto y los rechazos por cada garantía. Conecta la sala del incendio al banco con servicio sin repetir y filtro por nivel.
```


Continúo el proyecto Hora Muerta (Astro + TypeScript estricto, juego de deducción en planos). Antes de nada lee CLAUDE.md,
  docs/MODOS.md (especificación de los modos Incendio y Calentamiento, fuente de verdad), docs/PLAN_MODOS.md (plan por fases
  con casillas) y las secciones "Modos: F0", "F1", "F2" y "F3" del final de docs/DECISIONES.md.

  Forma de trabajar: una fase cada vez; al terminar, typecheck, lint, test (las suites lentas del solver solo si tocas
  src/engine), build y casillas actualizadas en PLAN_MODOS.md; un commit por fase ("F3: ..."), sin push. Playwright no arranca
  en este entorno (falta libnspr4.so): los e2e se escriben pero los ejecuto yo. No commitees CLAUDE.md, docs/MODOS.md ni
  docs/referencia/hora-muerta-modos.html; son míos.

  Estado:
  - Hechas y commiteadas: F0 (router, modo fuego, planlite, menú), F1 (núcleo del incendio) y F2 (incendio completo: fotos,
  quemado, sala, medallas, récords hm2:fire, chispas, contraste AA).
  - Decisiones mías: D1, el caso puede volverse irresoluble cuando arden pistas, es la gracia del modo; D2, "Casa de prácticas"
  es un mapa solo de ejercicios; D4, 90 remates.

  F3 (incendio en el banco) está a medias y SIN COMMIT. Todo el código está escrito y las 274 pruebas unitarias pasan:
  - src/modes/fire/fairness.ts: chooseOrigin y las garantías de MODOS 2.5.
  - src/modes/fire/texts.ts: causas de las 50 salas, título e introducción.
  - src/modes/fire/serve.ts: servicio sin repetir por jugador.
  - scripts/fire-bank.ts: generación, validación e informe.
  - scripts/build-fire-bank.ts: regenera solo el grupo incendio.
  - FIRE_GROUPS en scripts/bank.config.ts, y la opción maxClues en buildCaseCandidate (src/engine/generate.ts).
  - Validación en scripts/validate-bank.ts.
  - Sala conectada al banco (src/main.ts, src/modes/fire/ui/lobby.ts).
  - tests/fire/{fairness,serve,bank}.test.ts y los e2e ajustados.

  Lo que falta en F3:
  1. Generar el banco: `pnpm exec tsx scripts/build-fire-bank.ts` (en segundo plano). Novato tarda alrededor de un minuto;
  Inspector exprés, unos 2 minutos por hueco y algunos huecos se agotan, así que en total más o menos una hora. Hay 16 núcleos:
  si quieres, propónme paralelizarlo por huecos antes de lanzarlo, manteniendo el resultado determinista.
  2. Comprobar: `pnpm bank:validate`, `tests/fire/bank.test.ts` y las suites rápidas. Como se tocó src/engine/generate.ts
  (opción maxClues, que no cambia nada si no se pasa), pasa también tests/engine/determinism.test.ts.
  3. Enseñarme reports/fire-report.md: distribución de focos, porcentaje de pistas quemadas por minuto y rechazos por garantía.
  4. Actualizar PLAN_MODOS.md y hacer el commit "F3: incendio en el banco".

  Después vienen F4 y F5 (calentamiento) y F6 (banco de ejercicios), según PLAN_MODOS.md




**F4 · Calentamiento, núcleo**
```text
Implementa F4 según MODOS.md 3.3, 3.4, 3.5, 3.9 y 3.11: entrada #academia, reproductor con los tipos reach, tri, pick, clue y contra usando ui/planlite.ts, corrección con todas las reglas de error de la tabla 3.5 en modes/gym/grade.ts, sesión de 3 bloques con pantallas intermedias, informe final con "Ir a jugar un caso" que abre el plano desplegado. Porta los 23 ejercicios del prototipo con sus respuestas, y un script que las reverifique por fuerza bruta. Pruebas: una por cada regla de error y un e2e de sesión completa en móvil y escritorio.
```
--------------------------------------------


**F5 · Calentamiento adaptativo**
```text
Implementa F5 según MODOS.md 3.6, 3.10 y 3.12: niveles por técnica, técnica del día, sesión de diagnóstico la primera vez, repaso de fallados, servicio sin repetir por técnica y nivel, ficha de detective con nivel y barra, racha, el enlace "¿Te quedan dos?" en la hoja de acusación con el protocolo de 5 pasos y el botón Practicar remates (que guarda el caso en curso), y la recomendación de técnica tras un caso fallado según el arquetipo. Pruebas unitarias de adapt.ts con historiales sintéticos (subir, bajar, elegir técnica, no repetir el día anterior).
```

**F6 · Banco de ejercicios generado**
```text
Implementa F6 según MODOS.md 3.7 y 3.8: scripts/build-drills.ts que convierte los pasos de la cadena crítica del solver humano en ejercicios según la tabla de 3.8 (incluidos los tri "no se sabe" verificados con el solver exacto), nivel automático, filtros de calidad y explicaciones con las plantillas del Apéndice C del diseño; scripts/validate-drills.ts que reverifica cada respuesta por fuerza bruta. Objetivo unos 360 ejercicios. Enséñame 10 ejercicios al azar de cada técnica para revisarlos antes de dar la fase por cerrada.
```

**F7 · Calidad**
```text
Implementa F7: e2e de ambos modos en 360 × 640, 390 × 844, 844 × 390 y 1280 × 800, en tema claro y oscuro (el incendio siempre con su paleta); auditoría de accesibilidad (teclado, lectores de pantalla, contraste, movimiento reducido); rendimiento con CPU limitada; revisión de todos los textos frente a MODOS.md. Dame la lista final de lo que queda fuera.
```

---

## 10. Prompts de ajuste

**Calibrar la justicia del incendio**
```text
Ejecuta el informe del grupo incendio y dime, por nivel: cuántas pistas arden en cada minuto, cuántos casos rechaza cada garantía de MODOS.md 2.5 y qué porcentaje de la cadena crítica sobrevive a los 2:30. Si el incendio está demasiado duro o demasiado suave, propón ajustes de FIRE_STEP, CLUE_DELAY o de las garantías, aplícalos, regenera y enséñame el antes y el después.
```

**Revisar un ejercicio que parece mal**
```text
El ejercicio {ID} me parece incorrecto o confuso. Cárgalo, reverifica su respuesta por fuerza bruta, enséñame todas las soluciones posibles del escenario y explícame la deducción paso a paso. Si hay un error en el generador o en la explicación, corrígelo, añade una prueba y revalida todos los ejercicios.
```

**Añadir la técnica "Recuentos"**
```text
Añade la técnica recuento según MODOS.md 3.2 y el tipo de ejercicio count de 3.3: generación desde R4_COUNT_FULL y R4_COUNT_NEED, reglas de error propias ("ya están los N", "faltaba alguien que tenía que estar"), integración en la ficha y en la técnica del día, y pruebas. Genera 30 ejercicios por nivel y enséñame 5 de cada.
```

**Revisión de la experiencia en móvil**
```text
Recorre ambos modos como un diseñador de producto en 360 × 640 y 390 × 844: entrada, incendio completo hasta el derrumbe y hasta resolver, y una sesión de calentamiento. Busca objetivos táctiles pequeños, textos cortados, partes del plano tapadas, saltos de diseño y cualquier cosa que obligue a usar dos manos. Corrige y enséñame el antes y el después.
```

---

## 11. Lista de comprobación en el móvil

**Modo Incendio**

- [ ] El botón rojo de la portada abre la sala del incendio con la transición de fuego.
- [ ] Al entrar hay 45 segundos de humo y se ve qué sala prenderá primero.
- [ ] Antes de arder, cada sala avisa en naranja con su cuenta atrás.
- [ ] En una sala en llamas no se puede anotar, pero se ven mis marcas.
- [ ] Las pistas avisan antes de quemarse y las fotos las salvan.
- [ ] Una acusación errónea resta 30 segundos y se nota en el reloj.
- [ ] Al llegar a 0:00 el edificio se derrumba y puedo volver a entrar.
- [ ] Al volver al menú, la web recupera su estética normal.

**Modo Calentamiento**

- [ ] El botón Calentamiento abre la Academia con la técnica del día y mi ficha.
- [ ] Una sesión dura entre 5 y 8 minutos.
- [ ] Puedo tocar salas en el plano con el pulgar sin fallar.
- [ ] Cada fallo me dice qué no vi, no solo que está mal.
- [ ] El botón "No se puede saber" me frena antes de afirmar algo que no está demostrado.
- [ ] Los remates me enseñan a desempatar cuando quedan dos.
- [ ] Al terminar, "Ir a jugar un caso" me lleva al plano de la ciudad.
- [ ] En una partida normal, cuando me quedan dos, aparece "¿Te quedan dos?".
