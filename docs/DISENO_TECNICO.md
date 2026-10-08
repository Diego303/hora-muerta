# Hora Muerta: documento de diseño técnico (v2)

> Juego web de deducción lógica sobre planos. Semiprocedural, con cientos de casos revisados, jugable en móvil y en ordenador en sesiones de 5 a 20 minutos.
>
> Este documento es la **fuente de verdad** para implementar la versión 2. Parte del prototipo jugable (`hora-muerta.html`, en adelante **v1**) e incorpora todas las mejoras acordadas. Si algo del prototipo contradice este documento, manda este documento.

---

## Índice

1. Visión y pilares
2. Qué se conserva de v1 y qué cambia
3. Reglas del juego (canónicas)
4. Contenido: escenarios, reparto, objetos, textos
5. Modelo de datos
6. Catálogo de pistas
7. Generación de un caso
8. Solver exacto (unicidad)
9. Solver humano (cómo razona una persona)
10. Deducción clave y arquetipos
11. Dificultad
12. Banco de casos (200 a 540)
13. Modos de juego
14. Puntuación, acusación y cierre
15. Pista del inspector (sistema de ayudas)
16. Progresión
17. Interfaz y diseño responsive
18. Persistencia
19. Arquitectura del código
20. Pruebas y validación
21. Hoja de ruta por fases
22. Futuro (fuera de v2)
23. Apéndices (datos de mapas, textos, plantillas, ejemplo de traza)

---

## 1. Visión y pilares

**Una frase:** cada noche hay un muerto, un plano y un solo culpable; sigues a los sospechosos hora a hora y lo deduces sin adivinar nunca.

**Pilares (en orden de prioridad; en caso de conflicto gana el de arriba):**

1. **Lógica pura.** Cada caso tiene una única respuesta y se puede alcanzar razonando. Nunca hace falta probar suerte. El azar solo se usa para crear variedad entre casos, jamás durante la resolución.
2. **Pocas reglas, mucha profundidad.** Tres reglas base que no cambian. La variedad sale de los escenarios (la forma del mapa), de la noche generada y de la combinación de pistas, no de mecánicas nuevas.
3. **Semiprocedural con curación.** Escenarios y tipos de pista hechos a mano. Noches y pistas generadas por máquina, pero filtradas por un solver que razona como una persona, para que cada caso tenga un "clic" real. Los casos se generan antes (offline), se revisan en bloque y se sirven desde un banco.
4. **La sensación de "uno más".** Cada caso cierra con una recompensa clara (reconstrucción de la noche y deducción clave) y el siguiente está a un toque, sin esperas.
5. **Móvil primero.** Toda la experiencia debe ser cómoda con una mano en un teléfono vertical de 360 px de ancho. El ordenador es una mejora, no el diseño base.
6. **Pizarra sencilla.** Marcar, Tiza y Ver. No se añaden herramientas complejas; solo mejoras que reducen esfuerzo mecánico (la estela de horas contiguas).

**Duración objetivo:** Novato de 3 a 5 min, Inspector de 6 a 10 min, Comisario de 10 a 18 min.

---

## 2. Qué se conserva de v1 y qué cambia

| Área | v1 (prototipo) | v2 (este documento) |
|---|---|---|
| Reglas base | 3 reglas | **Igual**, sin cambios |
| Escenarios | Mansión, tren, museo | **6 escenarios**: se añaden hotel, barco y teatro, cada uno con "personalidad lógica" |
| Origen de los casos | Generados en el navegador al momento | **Banco curado de 540 casos** generado offline y servido como JSON. El generador en el navegador queda como "modo infinito" |
| Verificación | Solver exacto (unicidad) | Solver exacto **más solver humano** por niveles |
| Dificultad | Por número de pistas y pesos de tipo | Por **profundidad del razonamiento** (nivel máximo y puntuación de la cadena) con topes de pistas |
| Pistas | 14 tipos; 36% de posiciones directas en Novato; Comisario hasta 22 pistas | 16 tipos (se añaden **cruzó una puerta** y **no se movió entre dos horas**), topes por tipo, Comisario de 10 a 14 pistas |
| Acusación | Errores ilimitados, cronómetro visible | **Estrellas** (3), máximo 2 errores, cronómetro oculto por defecto |
| Ayuda | Ninguna | **Pista del inspector** en dos fases (empujón y explicación) |
| Cierre | Frase final y reconstrucción | Reconstrucción, **deducción clave**, cadena de deducción desplegable, motivo |
| Pizarra | Marcar / Tiza / Ver, tiza por hora | **Igual** más **estela** de las horas contigua anterior y siguiente, y ayuda de movimiento opcional en Novato |
| Siguiente caso | Se genera al pulsar (hasta 3 s de espera) | **Instantáneo** (banco) o pregenerado en segundo plano (modo infinito) |
| Modos | Caso suelto, caso del día | Caso suelto, caso del día, modo infinito |
| Progresión | Contador de resueltos y racha diaria | **Rango de detective**, desbloqueo de escenarios, archivo de arquetipos, rachas |
| Interfaz móvil | Columna única con scroll largo | **Mesa de trabajo**: plano fijo arriba, hoja inferior con pestañas, barra de acciones fija |

Se conservan intactos: la identidad visual (tokens de color, tipografías, estilo de plano), la portada con el plano animado, el tema claro/oscuro, el enlace compartible a cada caso y el texto compartible del resultado.

---

## 3. Reglas del juego (canónicas)

Estas reglas se muestran en la ayuda y en la portada tal cual. El solver y el generador las implementan exactamente.

1. **Una puerta por hora.** Entre una hora y la siguiente, cada sospechoso se queda en su sala o cruza **una sola puerta** a una sala contigua.
2. **A solas con la víctima.** A la hora de la muerte, el culpable era **el único sospechoso** en la sala de la víctima.
3. **Un objeto cada uno.** Cada sospechoso llevó **un único objeto** toda la noche, distinto al de los demás. El arma es el objeto del culpable.

**Aclaraciones formales (glosario de la ayuda):**

- **Sospechoso:** cualquiera del reparto. La víctima no es sospechosa, no cuenta en los recuentos y no se movió de la sala del crimen.
- **Contigua:** dos salas unidas por una puerta dibujada. Compartir pared sin puerta no cuenta.
- **"Estaban en la misma sala":** coincidían en la misma sala a esa hora exacta.
- **"No coincidieron en ningún momento":** en ninguna de las horas del caso estuvieron en la misma sala.
- **"Exactamente N personas en X":** cuenta solo sospechosos.
- **Horas:** el caso transcurre en 3 o 4 horas en punto (21:00, 22:00, 23:00 y, en Comisario, 00:00). Solo existen esas horas; no hay estados intermedios.
- **Respuesta:** culpable y arma. La sala y la hora del crimen se dan siempre en el informe inicial.
- **Todas las pistas son verdad.** Juntas admiten una única respuesta.

---

## 4. Contenido

### 4.1 Escenarios

Todos los mapas usan una rejilla de **12 × 9** unidades. Cada sala es un rectángulo alineado a la rejilla, con un mínimo de 3 de ancho y 2 de alto (para que quepan etiqueta y fichas). Las puertas unen salas que comparten pared (en el tren, dos vagones pueden unirse a través de un hueco de 1 unidad: la pasarela entre vagones).

Cada escenario tiene dos **rasgos** (propiedades de sala usadas en pistas como "estaba en una sala con chimenea") y una **personalidad lógica**: el tipo de razonamiento que su forma provoca. Esa personalidad es lo que hace que seis mapas se sientan como seis juegos.

| Id | Nombre | Salas | Puertas | Diámetro | Personalidad lógica | Rasgos | Disponible |
|---|---|---|---|---|---|---|---|
| `mansion` | Casa Valdemar | 8 | 10 | 4 | **El centro**: casi todo pasa por el Vestíbulo | chimenea, ventana | Desde el inicio |
| `tren` | Expreso Boreal | 8 | 7 | 7 | **La distancia**: un pasillo lineal, cada vagón cuenta | literas, ventanilla abierta | Desde el inicio |
| `museo` | Museo Aldana | 9 | 10 | 4 | **Dos caminos**: un anillo con atajo por el Patio | vitrinas, claraboya | Desde el inicio |
| `hotel` | Hotel Miramar | 8 | 7 | 5 | **El paso obligado**: la escalera es el único enlace entre plantas | balcón, chimenea | Rango Detective |
| `barco` | Transatlántico Aurora | 9 | 10 | 4 | **Dos escaleras**: dos anillos unidos por proa y popa | a la intemperie, ojos de buey | Rango Inspector |
| `teatro` | Teatro Lírico | 8 | 8 | 5 | **Callejones**: salas sin salida (Almacén, Palco) | vista al escenario, espejos | Rango Inspector jefe |

Los datos exactos (coordenadas, puertas, artículos, rasgos) están en el **Apéndice A**. La geometría de los seis mapas está validada: sin solapes, cada puerta sobre una pared compartida (salvo la pasarela del tren) y todos los grafos conexos.

### 4.2 Reparto

Se conserva el reparto de v1 (18 personajes con nombre e inicial únicos, lo que permite fichas con una letra). Corrección respecto a v1: "el ama de llaves", no "la ama de llaves".

Adela (el ama de llaves), Bruno (el sobrino), Celia (la pianista), Darío (el chófer), Elena (la doctora), Fausto (el notario), Greta (la fotógrafa), Hugo (el jardinero), Irene (la heredera), Julián (el coronel), Lola (la periodista), Mateo (el cocinero), Nuria (la restauradora), Octavio (el marchante), Paula (la secretaria), Rómulo (el mayordomo), Sara (la botánica), Tomás (el socio).

**Regla de inicial única:** dentro de un caso, no puede haber dos sospechosos con la misma inicial (ya se cumple, porque las 18 iniciales son distintas).

**Colores de ficha** (en orden de asignación, tras ordenar el reparto alfabéticamente): `#1f9e8c`, `#d99a1c`, `#8b5cd6`, `#d6457a`, `#4f9f2f`, `#3d7ddc`. El color nunca es la única señal: la ficha siempre lleva la inicial.

### 4.3 Víctimas, objetos y motivos

**Víctimas (12):** Don Aurelio Valdemar, La condesa Brígida, El doctor Anselmo Ferrer, Madame Solange, El profesor Ibarra, Doña Leonor Quintana, El señor Casimiro Roel, La baronesa Amparo Leal, El capitán Ulises Mora, Doña Fermina Castro, El maestro Gaspar Vidal, Lady Margaret Hale.

**Objetos (10):** el candelabro, la cuerda, el abrecartas, el frasco de veneno, la llave inglesa, el bastón, las tijeras de podar, el pisapapeles, el atizador, la estatuilla. Cada uno con artículo, nombre en texto y etiqueta corta para la tabla (Candelabro, Cuerda, Abrecartas, Veneno, Llave inglesa, Bastón, Tijeras, Pisapapeles, Atizador, Estatuilla).

**Motivos (12, solo para la frase de cierre, no se deducen):** una herencia que no iba a llegar, una deuda de juego, un chantaje que duraba años, celos, un testamento recién cambiado, un secreto de familia, una sociedad a punto de romperse, una carta que nunca debió leerse, una promesa rota, un cuadro falsificado, una venganza antigua, una estafa descubierta.

### 4.4 Combinatoria

Por caso: 6 escenarios × C(18,5) = 8.568 repartos × P(10,5) = 30.240 asignaciones de objetos × cientos de noches válidas × múltiples conjuntos de pistas. El espacio es prácticamente infinito; el banco selecciona los 540 mejores según calidad y variedad (sección 12).

---

## 5. Modelo de datos

Tipos en TypeScript. Los índices son enteros pequeños para que el JSON del banco sea compacto.

```ts
type RoomId = string;

interface FeatureDef { id: string; icon: 'fire'|'window'|'bed'|'case'|'sky'|'balcony'|'wave'|'porthole'|'stage'|'mirror'; txt: string; neg: string; label: string; }
interface RoomDef { id: RoomId; name: string; art: string; x: number; y: number; w: number; h: number; f: string[]; }
interface MapDef {
  id: 'mansion'|'tren'|'museo'|'hotel'|'barco'|'teatro';
  name: string; place: string; intro: string; unit: 'sala'|'vagón';
  w: 12; h: 9; features: [FeatureDef, FeatureDef]; rooms: RoomDef[]; edges: [RoomId, RoomId][];
  unlock: 'start'|'detective'|'inspector'|'inspector_jefe';
}

// Grafo precalculado a partir de MapDef
interface Graph { adj: number[][]; adjM: boolean[][]; feat: boolean[][]; dist: number[][]; }

type Hour = number;       // 0 = 21:00, 1 = 22:00, 2 = 23:00, 3 = 00:00
type Room = number;       // índice en MapDef.rooms
type Sus = number;        // índice en el reparto del caso (0..N-1)
type Obj = number;        // índice en los objetos del caso (0..N-1)

interface Truth { rooms: Room[][]; obj: Obj[]; }   // rooms[s][t], obj[s]

type Clue =
  | { k: 'at'; c: Sus; t: Hour; r: Room }
  | { k: 'notat'; c: Sus; t: Hour; r: Room }
  | { k: 'feat'; c: Sus; t: Hour; f: 0|1; neg: boolean }
  | { k: 'never'; c: Sus; r: Room }
  | { k: 'visited'; c: Sus; r: Room }
  | { k: 'stayed'; c: Sus }
  | { k: 'moved'; c: Sus; t: Hour }          // NUEVA: entre t y t+1 cruzó una puerta
  | { k: 'still'; c: Sus; t: Hour }          // NUEVA: entre t y t+1 no se movió
  | { k: 'together'; a: Sus; b: Sus; t: Hour }
  | { k: 'apart'; a: Sus; b: Sus }
  | { k: 'adj'; a: Sus; b: Sus; t: Hour }
  | { k: 'count'; r: Room; t: Hour; n: number }
  | { k: 'cat'; o: Obj; t: Hour; r: Room }
  | { k: 'cfeat'; o: Obj; t: Hour; f: 0|1; neg: boolean }
  | { k: 'ncarry'; c: Sus; o: Obj }
  | { k: 'cwith'; o: Obj; c: Sus; t: Hour };

type Archetype = 'coartada'|'paso'|'pareja'|'recuento'|'objeto'|'vacia'|'callejon';

interface Step {                 // un paso del solver humano
  lv: 1|2|3|4|5|6;
  rule: string;                  // id de regla, ver sección 9 y Apéndice C
  cl: number[];                  // índices de pistas usadas (en CaseDef.clues)
  concl: Conclusion[];           // lo que se deduce
  prem: number[];                // índices de pasos previos de los que depende
  crit: boolean;                 // pertenece a la cadena crítica
}
type Conclusion =
  | { k: 'notRoom'; c: Sus; t: Hour; r: Room }
  | { k: 'isRoom'; c: Sus; t: Hour; r: Room }
  | { k: 'notCarry'; c: Sus; o: Obj }
  | { k: 'carry'; c: Sus; o: Obj }
  | { k: 'notCulprit'; c: Sus }
  | { k: 'culprit'; c: Sus };

interface CaseDef {
  v: 2;                          // versión del formato
  id: string;                    // "N-017", "I-142", "C-033", "D-012", "E-07-2"
  mode: 'novato'|'inspector'|'comisario'|'diario';
  diff: 0|1|2;
  map: MapDef['id'];
  cast: number[];                // índices en el reparto global (longitud N)
  objects: number[];             // índices en la lista global de objetos (longitud N)
  victim: number; motive: number;
  N: number; T: number;
  rv: Room; td: Hour;            // sala y hora del crimen
  culprit: Sus; weapon: Obj;
  truth: Truth;
  clues: Clue[];                 // en orden de presentación
  solve: {
    steps: Step[];               // solo los pasos de la cadena crítica (crit = true)
    key: number;                 // índice del paso "deducción clave"
    arch: Archetype[];           // arquetipos presentes (el primero es el de la deducción clave)
    maxLv: number; score: number;
  };
  sig: string;                   // firma estructural para deduplicar
}

interface BankFile { version: string; mode: CaseDef['mode']; cases: CaseDef[]; }
```

---

## 6. Catálogo de pistas

### 6.1 Tipos

"Fuerza" orienta al generador (cuánto reduce el espacio de soluciones una pista típica). La categoría decide el grupo en la lista de pistas.

| Tipo | Significado formal | Texto (ejemplo) | Categoría | Fuerza |
|---|---|---|---|---|
| `at` | rooms[c][t] = r | A las 22:00, Bruno estaba en la Cocina. | Personas | 1,00 |
| `notat` | rooms[c][t] ≠ r | A las 22:00, Bruno no estaba en la Cocina. | Personas | 0,15 |
| `feat` | rasgo f de rooms[c][t] es verdadero (o falso si `neg`) | A las 21:00, Irene estaba en una sala con chimenea. | Personas | 0,50 |
| `never` | r ∉ rooms[c] | Hugo no pisó el Salón en toda la noche. | Movimiento | 0,35 |
| `visited` | r ∈ rooms[c] | Celia estuvo en la Bodega al menos una vez. | Movimiento | 0,45 |
| `stayed` | rooms[c] constante | Darío no se movió de su sala en toda la noche. | Movimiento | 0,80 |
| `moved` **(nueva)** | rooms[c][t] ≠ rooms[c][t+1] | Entre las 21:00 y las 22:00, Lola cruzó una puerta. | Movimiento | 0,40 |
| `still` **(nueva)** | rooms[c][t] = rooms[c][t+1] | Entre las 22:00 y las 23:00, Lola no se movió. | Movimiento | 0,55 |
| `together` | rooms[a][t] = rooms[b][t] | A las 23:00, Irene y Octavio estaban en la misma sala. | Encuentros | 0,90 |
| `apart` | ∀t rooms[a][t] ≠ rooms[b][t] | Sara y Fausto no coincidieron en ningún momento. | Encuentros | 0,60 |
| `adj` | rooms[a][t] y rooms[b][t] contiguas | A las 22:00, Greta estaba en una sala contigua a la de Mateo. | Encuentros | 0,80 |
| `count` | #{s : rooms[s][t] = r} = n | A las 23:00 había exactamente dos personas en el Comedor. / A las 21:00 no había nadie en el Patio. | Salas | 0,85 |
| `cat` | rooms[portador(o)][t] = r | A las 21:00, quien llevaba el candelabro estaba en el Invernadero. | Objetos | 0,95 |
| `cfeat` | rasgo f de rooms[portador(o)][t] | A las 23:00, quien llevaba el bastón estaba en una sala con chimenea. | Objetos | 0,50 |
| `ncarry` | obj[c] ≠ o | Paula no llevaba la cuerda. | Objetos | 0,20 |
| `cwith` | portador(o) ≠ c y rooms[portador(o)][t] = rooms[c][t] | A las 22:00, quien llevaba el atizador estaba con Julián. | Objetos | 0,90 |

Todos los textos exactos (con artículos, singular y plural, "sala" o "vagón") están en el **Apéndice B**.

### 6.2 Pistas prohibidas (regalarían la respuesta)

- `at` que sitúe al culpable en la sala del crimen a la hora del crimen.
- `cat` o `cfeat` del arma a la hora del crimen.
- `count` de la sala del crimen a la hora del crimen (repite la regla 2).
- `visited` del culpable en la sala del crimen.
- `stayed` del culpable.
- En Inspector y Comisario, `notat` y `never` referidos a la sala del crimen (acortan demasiado).

### 6.3 Topes y pesos por nivel

Los pesos multiplican la probabilidad de que el generador escoja un tipo. Los topes son máximos duros por caso. **El objetivo es que el movimiento sea protagonista:** las posiciones directas bajan y las pistas de movimiento suben.

| Tipo | Peso Novato | Peso Inspector | Peso Comisario | Tope N / I / C |
|---|---|---|---|---|
| `at` | 2,0 | 0,8 | 0,4 | 2 / 1 / 1 |
| `notat` | 1,0 | 0,3 | 0,2 | 2 / 1 / 1 |
| `feat` | 1,5 | 1,5 | 1,6 | 3 / 3 / 3 |
| `never` | 2,0 | 1,6 | 1,4 | 3 / 3 / 3 |
| `visited` | 1,5 | 1,8 | 1,8 | 2 / 3 / 3 |
| `stayed` | 1,0 | 1,0 | 0,8 | 1 / 1 / 1 |
| `moved` | 1,5 | 2,0 | 2,0 | 2 / 3 / 3 |
| `still` | 1,5 | 2,0 | 2,0 | 2 / 3 / 3 |
| `together` | 2,0 | 2,0 | 1,5 | 2 / 3 / 3 |
| `apart` | 1,0 | 1,5 | 1,6 | 1 / 2 / 2 |
| `adj` | 0 | 1,8 | 2,2 | 0 / 2 / 3 |
| `count` | 1,5 | 1,8 | 1,8 | 2 / 3 / 3 |
| `cat` | 2,0 | 1,4 | 1,0 | 3 / 3 / 3 |
| `cfeat` | 1,0 | 1,4 | 1,8 | 1 / 2 / 3 |
| `ncarry` | 2,0 | 1,0 | 0,6 | 2 / 2 / 1 |
| `cwith` | 0 | 1,2 | 1,6 | 0 / 2 / 3 |

Además:

- **Máximo 3 pistas del mismo tipo** por caso (ya reflejado en la tabla).
- **Longitud máxima de lectura:** suma de caracteres del texto plano de todas las pistas. Novato ≤ 600, Inspector ≤ 900, Comisario ≤ 1.250. Pensado para que en móvil se lea sin fatiga.
- **Mínimo de movimiento:** al menos 1 pista de categoría Movimiento en Novato y 2 en Inspector y Comisario.

### 6.4 Orden de presentación

Las pistas se agrupan por categoría (Personas, Movimiento, Encuentros, Salas, Objetos) y dentro de cada grupo por hora ascendente. Cada pista lleva un número visible y estable (se usa en las ayudas y en la cadena de deducción).

---

## 7. Generación de un caso

El mismo código genera casos offline (script del banco) y en el navegador (modo infinito, dentro de un Web Worker). Es determinista: la misma semilla produce el mismo caso.

### 7.1 Tubería

```
generarCaso(semilla, modo, mapaOpcional) -> CaseDef | null
  rng = mulberry32(fnv1a(semilla))
  repetir hasta 40 intentos:
    1. Elegir mapa (por cuota o el indicado), N y T según la dificultad.
    2. Elegir reparto (N nombres), objetos (N), víctima y motivo.
    3. Generar la noche (7.2).
    4. Construir la reserva de pistas verdaderas (6.1), aplicando prohibiciones (6.2) y pesos (6.3).
    5. Seleccionar pistas guiadas por contraejemplos (7.3).
    6. Minimizar: quitar cada pista si la unicidad se mantiene.
    7. Aplicar topes y longitud de lectura; si se incumplen, descartar el intento.
    8. Novato: añadir 1 pista de cortesía (tipo at, ncarry o together) que no sea necesaria.
    9. Resolver con el solver humano (sección 9). Rechazar si se atasca, si supera el nivel
       máximo de la dificultad o si no cumple los requisitos (sección 11).
   10. Calcular puntuación, deducción clave y arquetipos (sección 10). Rechazar si la
       puntuación cae fuera de la banda de la dificultad.
   11. Ordenar pistas (6.4), calcular firma (12.4) y devolver.
  devolver null
```

### 7.2 La noche

- **Crimen:** sala `rv` al azar; hora `td` entre la segunda y la última hora.
- **Culpable:** se construye el recorrido hacia atrás desde `rv` en `td` y hacia delante desde `rv`, con paseos aleatorios.
- **Resto:** paseos aleatorios desde salas al azar, rechazando los que estén en `rv` a la hora `td`.
- **Paseo aleatorio:** en cada hora, se queda con probabilidad 0,38; si no, cruza una puerta al azar.
- **Objetos:** permutación aleatoria.

**Sesgos opcionales para arquetipos** (se activan cuando el banco necesita rellenar una cuota concreta):

- `coartada`: al menos un inocente a distancia ≥ 2 de `rv` una hora antes o después de `td`.
- `pareja`: dos inocentes juntos a la hora `td` en una sala contigua a `rv`.
- `paso`: en mapas con cuello de botella (hotel, tren), el culpable cruza el cuello de botella antes de `td`.
- `vacia`: una sala contigua a `rv` vacía a la hora `td - 1`.

Los sesgos solo aumentan la probabilidad; el arquetipo real lo confirma el solver humano.

### 7.3 Selección guiada por contraejemplos

```
pistas = []
repetir hasta 70 veces:
  r = solverExacto.comprobarUnicidad(pistas)
  si r = única: salir
  candidatas = reserva - pistas - tipos que ya alcanzaron su tope
  si r = alternativa (una solución distinta a la verdad):
      candidatas = las que son falsas en esa alternativa (la descartan)
  elegir entre candidatas con probabilidad ∝ peso(tipo) × fuerza(tipo)²
      y con temperatura: 70% ponderado, 30% la que más candidatos de respuesta descarte
  añadir a pistas
```

La mezcla con la opción que más descarta produce conjuntos más cortos, que es lo que se busca en Comisario (10 a 14 pistas).

### 7.4 Firma estructural

`sig = hash(mapa | rv | td | recorridos de todos los sospechosos ordenados | recorrido del culpable)`. Dos casos con la misma firma son la misma noche con otros nombres; el banco nunca contiene dos iguales.

---

## 8. Solver exacto (unicidad)

Se porta el solver de v1 (`exists` y `checkUnique`) a TypeScript sin cambios de lógica, añadiendo los tipos `moved` y `still` como restricciones unarias.

- **Pregunta que responde:** ¿existe una asignación completa (recorrido de cada sospechoso y objetos) que cumpla todas las pistas y las reglas, con un culpable o un arma distintos de los verdaderos?
- **Método:** para cada candidato alternativo (culpable c ≠ verdadero, o culpable verdadero con arma o ≠ verdadera), búsqueda con dominios de recorridos, propagación hasta punto fijo (restricciones binarias con soporte por sala, recuentos con cotas, emparejamiento bipartito de objetos) y ramificación por el dominio más pequeño.
- **Resultado:** `unique`, `alt` (con la solución alternativa, para guiar la selección) o `limit` (se excedió el presupuesto de nodos; se trata como "no probado" y el caso no se acepta).
- **Presupuesto:** 15.000 nodos por candidato en la selección; 4.000 en la minimización; 60.000 en la verificación final.

El solver exacto garantiza la unicidad. No dice nada de si una persona puede llegar a la respuesta; eso lo hace el solver humano.

---

## 9. Solver humano (cómo razona una persona)

Es la pieza central de v2. Resuelve el caso usando solo razonamientos que una persona hace con el plano y la tabla, siempre eligiendo **la regla más sencilla que avance**, igual que los clasificadores de sudokus. Sirve para cuatro cosas:

1. Garantizar que el caso se resuelve razonando (si el solver humano se atasca, el caso se rechaza).
2. Medir la dificultad real (nivel máximo y puntuación de la cadena).
3. Detectar la deducción clave y los arquetipos.
4. Alimentar la pista del inspector y la cadena de deducción del cierre.

### 9.1 Estado

- `poss[c][t]`: máscara de bits de salas posibles para el sospechoso c a la hora t (máximo 9 salas).
- `carry[c]`: máscara de objetos posibles para c.
- `cand`: máscara de sospechosos que aún pueden ser culpables.
- `reason`: para cada eliminación, el índice del paso que la produjo (para construir dependencias).

Estado inicial: todo posible. Contradicción: algún `poss[c][t]` vacío, algún `carry[c]` vacío, un objeto sin portador posible, `cand` vacío o un recuento imposible.

### 9.2 Niveles y reglas

| Nivel | Nombre | Reglas (id) | Qué hace la persona |
|---|---|---|---|
| **1** | Lectura directa | `R1_AT`, `R1_NOTAT`, `R1_FEAT`, `R1_NEVER`, `R1_STAYED`, `R1_NCARRY`, `R1_EMPTY` | Aplica una pista que afecta a una sola persona o sala (incluye "no había nadie en X") |
| **2** | Regla del crimen | `R2_CANT_BE_THERE`, `R2_ONLY_ONE`, `R2_TAKEN` | Si alguien no pudo estar en la sala del crimen a la hora del crimen, no es culpable. Si solo uno pudo, es el culpable. Si ya se sabe quién estaba, los demás no estaban |
| **3** | Alcance | `R3_REACH_FWD`, `R3_REACH_BWD`, `R3_STILL`, `R3_MOVED` | "Una puerta por hora": las salas posibles a una hora limitan las de la hora anterior y siguiente |
| **4** | Cruce | `R4_TOGETHER`, `R4_ADJ`, `R4_APART`, `R4_COUNT_FULL`, `R4_COUNT_NEED`, `R4_OBJ_WHERE`, `R4_OBJ_WITH`, `R4_VISITED` | Combina dos fuentes: una pista entre personas con lo que ya se sabe de una de ellas; un recuento saturado; el lugar de un objeto contra el lugar de sus posibles portadores |
| **5** | Agotamiento | `R5_OBJ_SINGLE`, `R5_SUS_SINGLE`, `R5_WEAPON` | Un objeto que solo puede llevar una persona; una persona que solo puede llevar un objeto; el arma sale del objeto del culpable |
| **6** | Hipótesis corta | `R6_HYPOTHESIS` | Suponer "fue X" (o "X estaba en R a la hora t"), propagar con niveles 1 a 5 y llegar a contradicción en pocos pasos |

**Detalle de reglas no triviales:**

- `R3_REACH_FWD`: `poss[c][t+1] &= cierre(poss[c][t])`, donde `cierre(M)` es M más todas las salas contiguas a alguna sala de M. `R3_REACH_BWD` es lo mismo hacia atrás.
- `R3_STILL`: `poss[c][t] &= poss[c][t+1]` y viceversa. `R3_MOVED`: si `poss[c][t]` es una sola sala r, se quita r de `poss[c][t+1]` (y viceversa).
- `R4_TOGETHER`: `poss[a][t] &= poss[b][t]` y viceversa.
- `R4_ADJ`: `poss[a][t] &= vecinas(poss[b][t])` (vecinas estrictas, sin la propia sala) y viceversa.
- `R4_APART`: si b está fijado en r a la hora t, se quita r de `poss[a][t]` (y viceversa).
- `R4_COUNT_FULL`: si los sospechosos que seguro están en r a la hora t ya son n, se quita r a los demás. `R4_COUNT_NEED`: si los que pueden estar son exactamente n, todos ellos están.
- `R4_OBJ_WHERE`: para una pista `cat`/`cfeat` sobre o, se quita o de `carry[c]` a todo c que no pueda cumplir la condición; si o solo tiene un portador posible, la condición se aplica a su `poss`.
- `R4_OBJ_WITH`: para `cwith(o, d, t)`: se quita o de `carry[d]`; se quita o a quien no pueda coincidir con d a la hora t; si solo queda un portador, se le aplica `poss &= poss[d][t]`.
- `R4_VISITED`: si solo una hora admite r para c, se fija c en r a esa hora.
- `R6_HYPOTHESIS`: se prueba cada candidato a culpable que quede, y después cada celda `poss[c][t]` con exactamente 2 salas. Se propaga con niveles 1 a 5 hasta un máximo de 12 pasos. Si aparece contradicción, se elimina la suposición. **Profundidad 1** (no se anidan hipótesis).

### 9.3 Bucle

```
mientras no (cand tiene un solo bit Y carry[culpable] tiene un solo bit):
  para nivel en 1..6:
    buscar la primera regla de ese nivel que produzca alguna eliminación nueva
    si la encuentra: aplicarla, registrar Step, volver a empezar desde el nivel 1
  si ningún nivel avanza: ATASCADO -> rechazar el caso
```

El orden dentro de cada nivel es fijo (por id de regla y luego por índice de pista) para que el resultado sea determinista.

### 9.4 Cadena crítica

Cada `Step` registra sus premisas: los pasos que produjeron las eliminaciones que la regla consultó. Al terminar, se recorre hacia atrás desde los pasos que fijaron el culpable y el arma; todos los pasos alcanzados se marcan `crit = true`. **Solo la cadena crítica se guarda en el banco** (los pasos que no llevan a la respuesta no se enseñan ni se usan en ayudas).

Aproximación aceptable: si una regla consulta una celda, las premisas son todos los pasos que eliminaron algo en esa celda. Sobreestimar premisas no afecta a la corrección, solo alarga un poco la cadena.

### 9.5 Puntuación

`score = Σ peso(nivel) de los pasos críticos`, con pesos: nivel 1 = 1, nivel 2 = 2, nivel 3 = 4, nivel 4 = 6, nivel 5 = 8, nivel 6 = 20.

`maxLv` = nivel más alto entre los pasos críticos.

### 9.6 Corrección

Propiedades obligatorias (con pruebas automáticas, sección 20):

- **Solidez:** toda conclusión de todo paso es verdadera en `truth`.
- **Coherencia con el exacto:** si el solver humano resuelve el caso, el solver exacto devuelve `unique`. (Se deriva lógicamente de la solidez, pero se comprueba igualmente.)

---

## 10. Deducción clave y arquetipos

### 10.1 Deducción clave

Es el paso crítico que descarta a un candidato a culpable (o fija al culpable o el arma) con el **nivel más alto**. En caso de empate, el que más candidatos elimina, y si persiste, el último en la cadena. Se guarda en `solve.key` y se destaca en el cierre ("La clave: Bruno no podía llegar a tiempo al Mirador").

### 10.2 Arquetipos

Cada caso se etiqueta con los arquetipos detectados en su cadena crítica. El primero de `solve.arch` es el de la deducción clave.

| Id | Nombre en pantalla | Detección |
|---|---|---|
| `coartada` | La coartada imposible | Un paso `R3_REACH_*` elimina `rv` de `poss[c][td]` y después un `R2_CANT_BE_THERE` descarta a c |
| `paso` | El paso obligado | Como `coartada`, pero la eliminación de alcance depende de una sala bloqueada por `never` o `count = 0` (el único camino estaba cerrado) |
| `pareja` | La pareja inseparable | Un `R4_TOGETHER` a la hora `td` implica que dos personas estarían juntas en `rv`, lo que contradice la regla 2 y descarta a ambas |
| `recuento` | El recuento | Un `R4_COUNT_FULL` o `R4_COUNT_NEED` está en la cadena que descarta a un candidato |
| `objeto` | La cadena del objeto | La deducción clave usa `R4_OBJ_WHERE`, `R4_OBJ_WITH` o `R5_OBJ_SINGLE` para ligar un objeto a su portador |
| `vacia` | La sala vacía | Un `count = 0` corta rutas en la cadena crítica |
| `callejon` | El callejón sin salida | La cadena usa `R6_HYPOTHESIS` (solo Comisario) |

Los arquetipos se usan para: la frase de la deducción clave, el archivo de arquetipos del perfil (sección 16) y las cuotas de variedad del banco (sección 12).

---

## 11. Dificultad

| Parámetro | Novato | Inspector | Comisario |
|---|---|---|---|
| Sospechosos (N) | 4 | 5 | 5 |
| Horas (T) | 3 | 3 | 4 |
| Pistas | 5 a 7 (+1 de cortesía) | 7 a 10 | 10 a 14 |
| Nivel máximo permitido | 4 (como mucho 1 paso de nivel 4) | 5 | 6 |
| Requisito mínimo | Al menos un paso de nivel 3 en la cadena crítica | Al menos un paso de nivel 4 en la cadena crítica | Al menos un paso de nivel 5 o 6; como mucho 2 de nivel 6 |
| Banda de puntuación inicial | 8 a 25 | 22 a 60 | 55 a 140 |
| Lectura máxima (caracteres) | 600 | 900 | 1.250 |
| Tiempo orientativo | 3 a 5 min | 6 a 10 min | 10 a 18 min |
| Ayuda de movimiento | Activada por defecto | Desactivada (opcional) | Desactivada (opcional) |

**Calibración:** las bandas son un punto de partida. El script de informe del banco (12.3) muestra la distribución de puntuaciones; las bandas se ajustan para que los percentiles 10 y 90 de dificultades vecinas no se solapen más de un 15%. Tras jugar, se afinan con la duración real registrada en local (estadística personal, sin enviar datos).

---

## 12. Banco de casos (200 a 540)

### 12.1 Composición por defecto (540 casos)

| Grupo | Casos | Uso |
|---|---|---|
| Novato | 170 | Caso suelto |
| Inspector | 190 | Caso suelto |
| Comisario | 120 | Caso suelto |
| Diario | 60 | Caso del día (nivel Inspector) |
| **Total** | **540** | |

La composición es configurable en `scripts/bank.config.ts`. El mínimo razonable es 200 (70 / 70 / 40 / 20).

**Publicado ahora:** Novato 170, Inspector 164, Comisario 5 y Diario 55. Comisario se genera aparte, en paralelo, con `pnpm bank:group comisario <n>`, y con su tope de 14 pistas estricto.

**Cuotas de variedad dentro de cada grupo:**

- Escenarios: reparto uniforme entre los 6 mapas (±2 casos).
- Arquetipo de la deducción clave: ningún arquetipo por encima del 30%; cada arquetipo disponible para la dificultad al menos el 8% (`callejon` solo en Comisario).
- Hora del crimen: ninguna hora por encima del 45%.
- Puntuación: repartida en tercios de la banda (fácil, media, difícil dentro del nivel), para que dentro de un mismo nivel haya ritmo.

### 12.2 Script de construcción

`scripts/build-bank.ts` (Node, TypeScript con `tsx`, en paralelo con `worker_threads`):

```
para cada grupo y cada hueco de cuota:
  semilla = `${bankVersion}|${grupo}|${índice}|${intento}`
  caso = generarCaso(semilla, modo, mapaDeLaCuota, sesgoDelArquetipo)
  si caso cumple cuota y firma no repetida: aceptar
escribir public/cases/{novato,inspector,comisario,diario}.json
escribir public/cases/manifest.json  { version, counts, hash por archivo }
```

- Determinista: con la misma `bankVersion` se obtiene el mismo banco.
- Tiempo esperado: pocos minutos en un portátil (Comisario es lo más costoso, aproximadamente 1 s por intento más rechazos).

### 12.3 Validación e informe

- `scripts/validate-bank.ts`: para cada caso comprueba que la verdad cumple todas las pistas, que el solver exacto da `unique`, que el solver humano resuelve dentro del nivel permitido, los topes, la lectura máxima, la firma única y el formato. Falla con código distinto de 0 si algo no cuadra (se ejecuta en CI).
- `scripts/bank-report.ts`: histogramas de puntuación, número de pistas, tipos, arquetipos, mapas, horas del crimen, motivos de rechazo y tiempo de generación. Salida en consola y en `reports/bank-report.md`.

### 12.4 Tamaño y carga

- Aproximadamente 2 a 3 KB por caso con la cadena crítica; unos 1,5 MB en total sin comprimir, en torno a 250 KB con gzip.
- Cada grupo es un archivo aparte y se carga **bajo demanda** (al elegir nivel). El service worker los guarda en caché para jugar sin conexión.

### 12.5 Servir casos sin repetir

- En el primer uso se genera una semilla personal y se guarda. Para cada grupo, el orden de servicio es una permutación de los ids con esa semilla (cada persona ve un orden distinto).
- Se guarda la lista de ids jugados (resueltos o archivados) por versión de banco. Al pedir un caso nuevo se sirve el siguiente no jugado del orden, filtrando por escenarios desbloqueados y, si la persona eligió escenario, por ese mapa.
- **Al agotarse un grupo:** pantalla "Has resuelto todos los casos de este nivel" con dos opciones: *Modo infinito* (generador en el navegador) o *Volver a empezar* (reinicia la lista de ese grupo).
- **Caso en curso:** si hay uno sin terminar, la portada ofrece "Seguir el caso". Abrir la web no descarta el caso en curso.
- **Enlaces:** `#caso=I-142` abre ese caso concreto del banco. En modo infinito: `#gen=<semilla>&n=<nivel>&m=<mapa>`.

### 12.6 Versionado

`manifest.json` lleva `version` (por ejemplo `2026.10-a`). Los ids jugados se guardan por versión. Si una versión nueva del banco cambia los casos, el historial anterior se conserva para estadísticas y la lista de jugados empieza de cero para el banco nuevo.

---

## 13. Modos de juego

| Modo | Origen | Regla particular |
|---|---|---|
| **Caso suelto** | Banco del nivel elegido | El siguiente se sirve al instante |
| **Caso del día** | `diario.json`, índice = días desde 2026-01-01 módulo el número de casos | Igual para todo el mundo ese día. Cuenta para la racha diaria. Resultado compartible |
| **Modo infinito** | Generador en un Web Worker | Mismo generador y mismos filtros, con presupuesto de 8 s por caso. El siguiente se pregenera mientras juegas |

---

## 14. Puntuación, acusación y cierre

### 14.1 Estrellas

- Cada caso empieza con **3 estrellas**.
- Cada acusación errónea resta 1. Cada pista del inspector solicitada resta 1 (la segunda fase de la misma pista es gratis).
- Mínimo 0 estrellas en un caso resuelto (resolver con 0 estrellas cuenta como resuelto).
- Con **2 acusaciones erróneas**, el caso se cierra como "archivado sin resolver": se muestra la solución y la cadena de deducción, sin estrellas.

### 14.2 Cronómetro

Oculto por defecto (la lógica pura no debe tener prisa). Se registra el tiempo igualmente para las estadísticas personales y se puede mostrar desde Ajustes.

### 14.3 Acusación

Hoja inferior con dos selectores (culpable y arma) y el botón **Acusar**. Los sospechosos descartados por la persona aparecen atenuados, pero se pueden elegir. Tras un error: "No encaja con los hechos. Te queda 1 acusación." La hoja no revela qué parte falló.

### 14.4 Cierre del caso

Hoja a pantalla casi completa, en este orden:

1. **Resultado:** "Caso resuelto" y estrellas (o "Caso archivado sin resolver").
2. **Frase de cierre:** "{Culpable}, {rol}, estuvo a solas con {víctima} en {sala} a las {hora}. Llevaba {arma}. Motivo: {motivo}."
3. **La clave:** texto de la deducción clave (Apéndice C) con su arquetipo ("La coartada imposible").
4. **Cadena de deducción** (desplegable, cerrada por defecto): lista numerada de los pasos críticos con su explicación y los números de pista.
5. **Botón principal: "Siguiente caso"** (mismo nivel).
6. Acciones secundarias: "Ver la noche en el plano" (reconstrucción), "Copiar resultado", "Copiar enlace a este caso", "Volver a la portada".

**Reconstrucción:** el plano muestra las fichas reales moviéndose hora a hora (transición de 600 ms entre salas, 1,4 s por hora), con la sala del crimen resaltada a la hora `td`. Con `prefers-reduced-motion`, pasos sin transición.

**Texto compartible:** "Hora Muerta, caso del día 27 sep. Resuelto ★★☆ sin errores, 1 pista." más el enlace.

---

## 15. Pista del inspector

Botón **Pista** en la barra de acciones. Nunca revela la solución; revela **el siguiente paso lógico** de la cadena crítica que la persona aún no tenga reflejado.

### 15.1 Algoritmo

1. **Revisión de marcas.** Se comparan las marcas de la persona con la verdad: ✓ de sala donde el sospechoso no estaba, ✗ donde sí estaba, ✓ o ✗ erróneos en la tabla de objetos, o un sospechoso descartado que es el culpable. Si hay alguna, la pista es: "Una de tus marcas de las 22:00 no encaja con las pistas." (fase 2: se resalta la marca concreta). Esto evita que alguien se pierda por un error antiguo.
2. **Siguiente paso.** Se recorre la cadena crítica en orden y se elige el primer paso cuyas conclusiones no estén reflejadas en las marcas:
   - `notRoom(c, t, r)`: reflejada si hay ✗ de c en r a la hora t, o ✓ de c en otra sala a la hora t.
   - `isRoom(c, t, r)`: reflejada si hay ✓ de c en r a la hora t.
   - `notCarry` / `carry`: reflejadas en la tabla de objetos.
   - `notCulprit(c)`: reflejada si c está descartado en el reparto.
   - Los pasos cuyas conclusiones sean intermedias y difíciles de marcar (por ejemplo, reducir de 3 a 2 salas posibles) cuentan como reflejados si todos los pasos que dependen de ellos lo están.
3. **Fase 1, el empujón** (cuesta 1 estrella): "Fíjate en la pista 4 y en dónde podía estar Irene a las 22:00." Se resaltan en el plano las salas y la hora implicadas, y en la lista las pistas del paso.
4. **Fase 2, la explicación** (gratis, botón "Explícamelo"): texto completo del paso según su plantilla (Apéndice C).

Si todos los pasos están reflejados: "Ya tienes todo lo necesario. Revisa quién pudo estar a solas con la víctima."

---

## 16. Progresión

### 16.1 Rango de detective

Se sube por estrellas acumuladas:

| Rango | Estrellas | Desbloquea |
|---|---|---|
| Agente | 0 | Mansión, tren, museo; los tres niveles |
| Cabo | 10 | Tema de color alternativo del plano (tinta sepia) |
| Detective | 30 | **Hotel Miramar** |
| Inspector | 75 | **Transatlántico Aurora** |
| Inspector jefe | 150 | **Teatro Lírico** |
| Comisario | 300 | Insignia en el resultado compartible |

Los niveles de dificultad están disponibles desde el principio. Los escenarios bloqueados aparecen en la portada con su silueta y el rango necesario.

### 16.2 Archivo de arquetipos

En el perfil, una colección de los 7 arquetipos: cuántos casos has resuelto de cada uno y un caso de ejemplo para rejugar. Mensaje tras el cierre cuando se descubre uno nuevo: "Nuevo en tu archivo: El paso obligado".

### 16.3 Rachas y estadísticas

- Racha diaria (casos del día consecutivos) y mejor racha.
- Por nivel: resueltos, perfectos (3 estrellas), tasa de acierto a la primera, tiempo mediano.

Todo en local; no se envían datos.

---

## 17. Interfaz y diseño responsive

### 17.1 Identidad visual (se conserva de v1)

- **Concepto:** plano de arquitecto nocturno. Papel azulado en claro, cianotipo en oscuro. Un único acento rojo para el crimen y los errores.
- **Tipografías:** *Big Shoulders Display* (600, 800) para títulos, etiquetas de sala y horas; *Atkinson Hyperlegible* (400, 700, cursiva 400) para texto, por legibilidad en pantallas pequeñas. Carga desde Google Fonts con alternativas del sistema.
- **Tokens (claro):** `--paper #e4eaed`, `--panel #f2f5f6`, `--room #f9fbfc`, `--ink #15222c`, `--ink-2 #4c5d69`, `--grid #c7d4db`, `--wall #1d3446`, `--pencil #b3261e`, `--on-pencil #fff`, `--blue #2a64c8`, `--amber #b87d0c`, `--focus #2a64c8`.
- **Tokens (oscuro):** `--paper #0d2a45`, `--panel #10324f`, `--room #133a5c`, `--ink #e8f2f8`, `--ink-2 #a7c1d4`, `--grid #1c4a70`, `--wall #d6e8f4`, `--pencil #ff8a78`, `--on-pencil #2a0d09`, `--blue #8cc4ff`, `--amber #f2c14e`, `--focus #8cc4ff`.
- **Tema:** sigue al sistema; el botón ◐ lo fija (`data-theme` en `<html>`).
- **Movimiento:** solo el plano animado de la portada, la reconstrucción y las respuestas a acciones del usuario. Se respeta `prefers-reduced-motion`.
- **Voz de los textos:** español de España, frases en minúscula inicial salvo la primera letra, verbos activos, sin relleno. Los errores dicen qué pasó y qué hacer. Mismo nombre para cada acción en todo el flujo (el botón "Acusar" produce "Acusación correcta").

### 17.2 Pantallas

1. **Portada:** cabecera (marca, "Cómo se juega", ◐, perfil); héroe con título y plano animado; botones "Seguir el caso" (si hay uno en curso), "Caso nuevo" y "Caso del día"; barra de rango; "Tres reglas, nada más"; niveles con botón de empezar; escenarios (bloqueados con silueta); pie.
2. **Selector de caso nuevo:** hoja inferior con los tres niveles y el escenario ("Cualquiera" por defecto).
3. **Mesa de trabajo** (el juego).
4. **Hoja de acusación.**
5. **Cierre del caso** y reconstrucción.
6. **Ayuda** (reglas y glosario) y **Ajustes** (tema, cronómetro, estela, ayuda de movimiento, autocompletar tabla).
7. **Perfil:** rango, estadísticas, archivo de arquetipos.

### 17.3 Mesa de trabajo: distribución por tamaño

**Móvil vertical (ancho < 700 px), el diseño base:**

```
┌─────────────────────────────────┐
│ ←  Casa Valdemar · I-142  ★★★ ⋯ │  barra superior, 48 px, fija
│ † Madame Solange · Bodega · 22:00│  informe en una línea (toca para ampliar)
├─────────────────────────────────┤
│                                 │
│          PLANO (SVG)            │  alto = min(ancho × 9/12, 46dvh)
│                                 │
├─────────────────────────────────┤
│ [21:00] [22:00 †] [23:00]       │  pestañas de hora, 44 px
│ [✓][✎][👁] ↶ ⤢ │(A)(B)(C)(D)(E)│  modos + deshacer + ampliar │ reparto (scroll horizontal)
├─────────────────────────────────┤
│ Pistas · Objetos · Caso      ═══│  hoja inferior con pestañas
│ 1 ☐ A las 21:00, Rómulo estaba… │  (ocupa el resto; scroll propio)
│ 2 ☐ …                           │
├─────────────────────────────────┤
│   [ Pista ]        [ Acusar ]   │  barra de acciones fija, con safe-area
└─────────────────────────────────┘
```

- La **hoja inferior** tiene dos estados: *media* (por defecto, ocupa el espacio bajo la barra de herramientas) y *desplegada* (sube hasta cubrir el 85% de la pantalla). Se cambia con el asa, deslizando o tocando la pestaña activa. Al tocar el texto de una pista, la hoja vuelve a *media* para que se vea el plano.
- En modo Tiza, el reparto de la barra se sustituye por los colores de tiza (3), la goma y "Borrar tiza de esta hora".
- **Ampliar plano (⤢):** abre el plano a pantalla completa con las pestañas de hora y la barra de herramientas, para marcar con precisión. Se cierra con ✕ o con el gesto atrás.
- Objetivos táctiles de al menos 44 × 44 px. Las salas completas son zonas táctiles.

**Móvil horizontal y tabletas (ancho ≥ 700 px y alto < 560 px, o ancho entre 700 y 1099 px):**

```
┌──────────────────────┬───────────────────────┐
│ ← Casa Valdemar  ★★★ │  Pistas · Objetos · Caso│
├──────────────────────┤  (scroll propio)       │
│     PLANO (SVG)      │                        │
│                      │                        │
│ [21][22 †][23]       │                        │
│ [✓][✎][👁] ↶ (A)(B)… │   [ Pista ] [ Acusar ] │
└──────────────────────┴───────────────────────┘
```

**Escritorio (ancho ≥ 1100 px):** columna izquierda (58%) fija con informe, plano, horas, herramientas y leyenda; columna derecha (42%) con Pistas y Objetos visibles a la vez (sin pestañas), el reparto con botón de descartar y los botones Pista y Acusar fijos al pie de la columna. Ancho máximo 1280 px.

**Altura:** usar `100dvh` con alternativa `100vh`. Respetar `env(safe-area-inset-*)` en la barra superior, la barra de acciones y la hoja.

### 17.4 El plano (render SVG)

Se conserva el render de v1: unidad de rejilla 40 px, margen 8, retranqueo de pared 4.

- **Salas:** rectángulo con relleno `--room` y trazo `--wall` de 2,5 px.
- **Puertas:** hueco en la pared (rectángulo de 22 px de color `--room`) con dos jambas. En el tren, la puerta atraviesa el hueco entre vagones (pasarela).
- **Etiqueta:** esquina superior izquierda, *Big Shoulders* 600. Si no cabe, se reduce el cuerpo hasta un mínimo de 11 px (usar `textLength` solo como último recurso).
- **Rasgos:** iconos de 15 px en la esquina inferior izquierda (definidos como `<symbol>` y reutilizados con `<use>`). Leyenda bajo el plano.
- **Víctima:** marca circular con cruz, en rojo, en la esquina inferior derecha de la sala del crimen. A la hora `td`, contorno discontinuo rojo en toda la sala.
- **Fichas de marca:** círculos de 21 px con la inicial. ✓ = relleno del color del sospechoso; ✗ = contorno con una barra diagonal. Se colocan en una rejilla dentro de la sala, bajo la etiqueta.
- **Estela (nuevo):** en Marcar y Ver, las ✓ de la hora anterior se dibujan como anillo **discontinuo** sin relleno y las de la hora siguiente como anillo **punteado**, ambas al 45% de opacidad y más pequeñas (16 px), tras las marcas de la hora actual. Leyenda: "◌ hora anterior, ⋯ hora siguiente". Se puede desactivar en Ajustes.
- **Ayuda de movimiento (Novato, opcional en el resto):** con un sospechoso seleccionado que tenga ✓ en la hora anterior o siguiente, las salas a las que **no** pudo llegar se cubren con un rayado suave. Solo usa las marcas de la persona, nunca la verdad.
- **Resaltados:** al enfocar una pista o una ayuda, las salas implicadas reciben un contorno ámbar interior y las fichas del sospechoso, un halo breve.

### 17.5 Pizarra (sin cambios salvo la estela)

- **Marcar:** eliges un sospechoso en el reparto (queda seleccionado) y tocas salas. Primer toque ✓ (estaba aquí a esta hora), segundo ✗ (no estaba), tercero borra. Pulsación larga en una sala abre un selector rápido con todos los sospechosos para esa sala.
- **Tiza:** trazo libre sobre el plano en un `<canvas>` superpuesto (escalado por `devicePixelRatio`), con 3 colores (tinta, ámbar, rojo), goma (toca un trazo para borrarlo) y "Borrar tiza de esta hora". Los trazos pertenecen a la hora en que se dibujan; opción "en todas las horas" al mantener pulsado el color.
- **Ver:** plano limpio sin interacción (marcas visibles, tiza visible). Un interruptor permite ocultar la tiza.
- **Deshacer:** una pila común para marcas, tabla de objetos, descartes y trazos.

### 17.6 Lista de pistas

- Cada pista: número, casilla de tachar a la izquierda y texto con nombres coloreados, salas en negrita y horas destacadas.
- **Tocar la casilla:** tacha o destacha.
- **Tocar el texto:** enfoca la pista: cambia el plano a la hora de la pista (si la tiene), resalta salas y sospechosos implicados y, en móvil, devuelve la hoja a estado *media*.
- Agrupadas por categoría con subtítulo discreto.

### 17.7 Tabla de objetos

Filas = objetos, columnas = sospechosos (inicial con color). Toque: ✓, ✗, vacío. Con "Autocompletar tabla" activado (por defecto), al poner ✓ se rellenan con ✗ la fila y la columna (es mecánica, no deducción). Desplazamiento horizontal propio si no cabe.

### 17.8 Pestaña Caso

Informe completo (introducción del escenario, víctima, sala y hora), reparto con rol y botón **Descartar** por sospechoso (tacha su nombre, atenúa su chip y cuenta para las ayudas), y las reglas en versión corta.

### 17.9 Accesibilidad

- Contraste AA en ambos temas. Color nunca como única señal (inicial en fichas, texto en estados).
- Salas con `role="button"` y `aria-label` dinámico: "Cocina, 22:00. Bruno aquí. Clara no."
- Teclado: flechas para moverse entre salas, 1 a 6 para elegir sospechoso, espacio para cambiar la marca, `[` y `]` para cambiar de hora, `z` para deshacer.
- Foco visible (`--focus`, 3 px). Anuncios con `role="status"` para errores de acusación y avisos.
- `prefers-reduced-motion` desactiva transiciones de fichas y la animación de la portada (se muestra la hora del crimen fija).

---

## 18. Persistencia

`localStorage` con prefijo `hm2:`, todo envuelto en `try/catch` y con valores por defecto si falla (modo privado).

| Clave | Contenido |
|---|---|
| `hm2:settings` | `{ theme, showTimer, trail, moveHelp, autoGrid }` |
| `hm2:profile` | `{ stars, rank, solved: {n,i,c}, perfect: {n,i,c}, firstTry: {n,i,c}, times: {n:[],i:[],c:[]}, arch: {coartada: n, …} }` |
| `hm2:order` | `{ seed }` (semilla personal de orden) |
| `hm2:played` | `{ [bankVersion]: string[] }` |
| `hm2:game` | Caso en curso: `{ caseId | gen, mode, marks, grid, discarded, struck, strokes, stars, errors, hints, hintLog, elapsed, startedAt }` |
| `hm2:daily` | `{ [YYYY-MM-DD]: { stars, errors, hints, time } }` |

- Guardado automático con 300 ms de retardo tras cada acción y al ocultar la pestaña (`visibilitychange`).
- **Migración desde v1:** si existe `hm:stats`, se importan `solved` y el mapa `daily` a `hm2:profile` y `hm2:daily`. El caso en curso de v1 no se migra.

---

## 19. Arquitectura del código

### 19.1 Tecnología

- **Vite + TypeScript estricto**, DOM sin framework (el prototipo ya es vanilla y el juego no lo necesita). Si la web existente usa un framework, el juego se integra como una isla o ruta de cliente que monta la app en un contenedor, sin reescribirla en ese framework.
- **CSS** propio con variables (sin librería de componentes).
- **Web Worker** para el generador en modo infinito.
- **PWA**: `manifest.webmanifest` e iconos, service worker que guarda en caché la aplicación y los archivos del banco.
- **Node + `tsx`** para los scripts del banco; `worker_threads` para paralelizar.
- **Vitest** para pruebas unitarias; **Playwright** para humo e2e y capturas en tres tamaños.

### 19.2 Estructura

```
src/
  engine/                  # sin DOM: usable en navegador, worker y Node
    rng.ts                 # mulberry32, fnv1a, shuffle, pick
    content/maps.ts        # 6 MapDef (Apéndice A)
    content/cast.ts        # reparto, colores, víctimas, objetos, motivos
    graph.ts               # adj, adjM, feat, dist
    paths.ts               # enumeración de recorridos por T
    truth.ts               # generación de la noche y sesgos
    clues.ts               # holds(), reserva, prohibiciones, topes, orden
    exact.ts               # solver exacto (portado de v1)
    human.ts               # solver humano: niveles, pasos, cadena crítica, puntuación
    archetypes.ts          # deducción clave y etiquetas
    generate.ts            # generarCaso()
    text.ts                # textos de pistas, pasos, cierre y compartir
    types.ts
  game/
    store.ts               # estado + acciones + suscripción + deshacer
    storage.ts             # hm2:* con try/catch y migración
    bank.ts                # manifest, carga bajo demanda, orden personal, jugados
    modes.ts               # suelto, diario, infinito
    hints.ts               # pista del inspector
    scoring.ts             # estrellas, errores, cierre
    progression.ts         # rango, desbloqueos, archivo
  ui/
    landing.ts  demo.ts  selector.ts  board.ts  plan.ts  chalk.ts
    sheet.ts  clues.ts  objects.ts  casetab.ts  accuse.ts  closure.ts
    reconstruct.ts  settings.ts  profile.ts  help.ts  toast.ts  a11y.ts
  styles/ tokens.css base.css landing.css game.css sheet.css
  workers/generator.worker.ts
  main.ts
scripts/ build-bank.ts validate-bank.ts bank-report.ts bank.config.ts
public/cases/ manifest.json novato.json inspector.json comisario.json diario.json
public/ manifest.webmanifest icons/
tests/ engine/*.test.ts bank/*.test.ts e2e/*.spec.ts
docs/ DISENO_TECNICO.md referencia/hora-muerta-v1.html
```

### 19.3 Flujo de estado

Un único `store` con estado serializable (`GameState`) y acciones puras (`mark`, `cycleGrid`, `discard`, `strike`, `addStroke`, `undo`, `setHour`, `setMode`, `accuse`, `requestHint`…). La UI se suscribe y vuelve a pintar solo lo afectado (plano, lista, tabla, barra). Cada acción que cambia datos del jugador guarda en `hm2:game` con retardo.

### 19.4 Rendimiento

- Primera pintura en menos de 1,5 s en 4G; el banco de un nivel pesa como mucho 150 KB comprimido.
- Interacciones de marcado por debajo de 16 ms (repintar solo la capa de marcas del SVG).
- El `<canvas>` de tiza se redimensiona con `ResizeObserver` y guarda trazos en coordenadas del `viewBox`, no en píxeles.
- Ninguna generación en el hilo principal.

---

## 20. Pruebas y validación

**Motor:**

- `holds()` de cada tipo de pista contra casos construidos a mano.
- Solver exacto frente a fuerza bruta en 30 casos Novato (todas las asignaciones posibles): el conjunto de respuestas debe coincidir exactamente.
- Solver humano, **solidez**: en 300 casos generados, toda conclusión de todo paso es verdadera en la verdad.
- Solver humano, **coherencia**: si resuelve, el exacto da `unique`.
- Determinismo: la misma semilla produce el mismo caso byte a byte.
- Textos: instantáneas de un caso de cada tipo de pista y de cada plantilla de paso.

**Banco:** `validate-bank.ts` en CI (sección 12.3) y comprobación de cuotas.

**Interfaz (Playwright):**

- Humo en 390 × 844 (móvil vertical), 844 × 390 (móvil horizontal) y 1280 × 800 (escritorio): portada, empezar un Novato, marcar, cambiar hora, usar tiza, pedir pista, acusar mal y bien, cierre, siguiente caso.
- Capturas de referencia en tema claro y oscuro.
- Sin desbordamiento horizontal del `body` en ningún tamaño.

**Criterios de aceptación de v2:** banco de 540 casos validado; los tres niveles cumplen sus bandas; la estela y la pista del inspector funcionan; el juego completo es cómodo en 360 px de ancho; jugable sin conexión tras la primera carga.

---

## 21. Hoja de ruta por fases

| Fase | Contenido | Resultado visible |
|---|---|---|
| M0 | Proyecto, herramientas, CI, portar identidad visual | La portada de v1 funcionando en el nuevo proyecto |
| M1 | Motor portado a TS, 6 mapas, pistas nuevas, solver exacto y pruebas | Casos generados por consola |
| M2 | Solver humano, cadena crítica, puntuación, arquetipos y pruebas | Informe de dificultad por caso |
| M3 | Generador v2, scripts del banco, 540 casos validados | Archivos JSON del banco e informe |
| M4 | Mesa de trabajo responsive: plano, marcas, estela, tiza, horas, hoja inferior | Jugar un caso del banco en móvil |
| M5 | Pistas interactivas, tabla, pestaña Caso, acusación, estrellas, cierre y reconstrucción | Bucle completo de un caso |
| M6 | Pista del inspector y revisión de marcas | Ayudas en dos fases |
| M7 | Servir sin repetir, caso del día, modo infinito en worker, enlaces | Todos los modos |
| M8 | Rango, desbloqueos, archivo, estadísticas, ajustes, migración | Progresión |
| M9 | PWA, rendimiento, accesibilidad, e2e y pulido | Versión 2 lista |

---

## 22. Futuro (fuera de v2)

- **El testigo que miente:** un sospechoso da testimonios en primera persona; los inocentes dicen la verdad y el culpable miente. Es la única mecánica que añade una capa de pensamiento nueva. Requiere un nivel 4 bis en el solver humano ("si X miente, entonces…").
- **Editor de casos** para diseñar a mano y validar con los dos solvers.

---

## 23. Apéndices

### Apéndice A. Datos de los mapas

Rejilla de 12 × 9. `art` es el artículo que precede al nombre en los textos ("en **la** Biblioteca").

**A.1 Casa Valdemar (`mansion`)**

```json
{"id":"mansion","name":"Casa Valdemar","place":"la mansión","unit":"sala","unlock":"start",
 "intro":"Cena de aniversario en la mansión. La tormenta ha cortado el camino y nadie ha podido marcharse.",
 "features":[{"id":"chim","icon":"fire","txt":"con chimenea","neg":"sin chimenea","label":"Chimenea"},
             {"id":"vent","icon":"window","txt":"con ventana","neg":"sin ventana","label":"Ventana"}],
 "rooms":[{"id":"bib","name":"Biblioteca","art":"la","x":0,"y":0,"w":4,"h":3,"f":["chim"]},
          {"id":"est","name":"Estudio","art":"el","x":4,"y":0,"w":3,"h":3,"f":["vent"]},
          {"id":"inv","name":"Invernadero","art":"el","x":7,"y":0,"w":5,"h":4,"f":["vent"]},
          {"id":"sal","name":"Salón","art":"el","x":0,"y":3,"w":4,"h":4,"f":["chim","vent"]},
          {"id":"ves","name":"Vestíbulo","art":"el","x":4,"y":3,"w":3,"h":6,"f":[]},
          {"id":"com","name":"Comedor","art":"el","x":7,"y":4,"w":5,"h":3,"f":["chim"]},
          {"id":"bod","name":"Bodega","art":"la","x":0,"y":7,"w":4,"h":2,"f":[]},
          {"id":"coc","name":"Cocina","art":"la","x":7,"y":7,"w":5,"h":2,"f":["vent"]}],
 "edges":[["bib","est"],["bib","sal"],["est","ves"],["est","inv"],["inv","com"],["sal","ves"],
          ["ves","com"],["com","coc"],["ves","bod"],["sal","bod"]]}
```

**A.2 Expreso Boreal (`tren`)**

```json
{"id":"tren","name":"Expreso Boreal","place":"el tren","unit":"vagón","unlock":"start",
 "intro":"Tren nocturno sin paradas hasta el amanecer. Las puertas exteriores van cerradas con llave.",
 "features":[{"id":"lit","icon":"bed","txt":"con literas","neg":"sin literas","label":"Literas"},
             {"id":"vtn","icon":"window","txt":"con la ventanilla abierta","neg":"con las ventanillas cerradas","label":"Ventanilla abierta"}],
 "rooms":[{"id":"mir","name":"Mirador","art":"el","x":0,"y":0,"w":3,"h":4,"f":["vtn"]},
          {"id":"bar","name":"Vagón bar","art":"el","x":3,"y":0,"w":3,"h":4,"f":[]},
          {"id":"res","name":"Restaurante","art":"el","x":6,"y":0,"w":3,"h":4,"f":["vtn"]},
          {"id":"coc","name":"Cocina","art":"la","x":9,"y":0,"w":3,"h":4,"f":[]},
          {"id":"cma","name":"Coche A","art":"el","x":9,"y":5,"w":3,"h":4,"f":["lit"]},
          {"id":"cmb","name":"Coche B","art":"el","x":6,"y":5,"w":3,"h":4,"f":["lit","vtn"]},
          {"id":"equ","name":"Furgón","art":"el","x":3,"y":5,"w":3,"h":4,"f":[]},
          {"id":"cmc","name":"Coche C","art":"el","x":0,"y":5,"w":3,"h":4,"f":["lit"]}],
 "edges":[["mir","bar"],["bar","res"],["res","coc"],["coc","cma"],["cma","cmb"],["cmb","equ"],["equ","cmc"]]}
```

La puerta `coc`–`cma` cruza el hueco de 1 unidad (pasarela).

**A.3 Museo Aldana (`museo`)**

```json
{"id":"museo","name":"Museo Aldana","place":"el museo","unit":"sala","unlock":"start",
 "intro":"Gala privada a puerta cerrada. El museo se clausuró a las nueve y nadie salió.",
 "features":[{"id":"vit","icon":"case","txt":"con vitrinas","neg":"sin vitrinas","label":"Vitrinas"},
             {"id":"cla","icon":"sky","txt":"con claraboya","neg":"sin claraboya","label":"Claraboya"}],
 "rooms":[{"id":"egi","name":"Sala Egipcia","art":"la","x":0,"y":0,"w":4,"h":3,"f":["vit"]},
          {"id":"nor","name":"Galería Norte","art":"la","x":4,"y":0,"w":4,"h":3,"f":["cla"]},
          {"id":"map","name":"Sala de Mapas","art":"la","x":8,"y":0,"w":4,"h":3,"f":["vit"]},
          {"id":"pin","name":"Pinacoteca","art":"la","x":0,"y":3,"w":4,"h":3,"f":["cla"]},
          {"id":"pat","name":"Patio","art":"el","x":4,"y":3,"w":4,"h":3,"f":["cla"]},
          {"id":"esc","name":"Sala de Esculturas","art":"la","x":8,"y":3,"w":4,"h":3,"f":["vit","cla"]},
          {"id":"rec","name":"Recepción","art":"la","x":0,"y":6,"w":4,"h":3,"f":[]},
          {"id":"tie","name":"Tienda","art":"la","x":4,"y":6,"w":4,"h":3,"f":["vit"]},
          {"id":"arc","name":"Archivo","art":"el","x":8,"y":6,"w":4,"h":3,"f":[]}],
 "edges":[["egi","nor"],["nor","map"],["map","esc"],["esc","arc"],["arc","tie"],["tie","rec"],
          ["rec","pin"],["pin","egi"],["pat","nor"],["pat","tie"]]}
```

**A.4 Hotel Miramar (`hotel`), nuevo**

Planta alta arriba (tres habitaciones y el rellano), planta baja abajo; la escalera es el único enlace.

```json
{"id":"hotel","name":"Hotel Miramar","place":"el hotel","unit":"sala","unlock":"detective",
 "intro":"Noche de temporal en el hotel. El ascensor está averiado: entre plantas solo queda la escalera.",
 "features":[{"id":"bal","icon":"balcony","txt":"con balcón","neg":"sin balcón","label":"Balcón"},
             {"id":"chim","icon":"fire","txt":"con chimenea","neg":"sin chimenea","label":"Chimenea"}],
 "rooms":[{"id":"h101","name":"Habitación 101","art":"la","x":0,"y":0,"w":3,"h":3,"f":["bal"]},
          {"id":"h102","name":"Habitación 102","art":"la","x":3,"y":0,"w":3,"h":3,"f":["bal"]},
          {"id":"h103","name":"Habitación 103","art":"la","x":6,"y":0,"w":3,"h":3,"f":["chim"]},
          {"id":"rel","name":"Rellano","art":"el","x":0,"y":3,"w":9,"h":2,"f":[]},
          {"id":"esc","name":"Escalera","art":"la","x":9,"y":0,"w":3,"h":5,"f":[]},
          {"id":"rec","name":"Recepción","art":"la","x":8,"y":5,"w":4,"h":4,"f":["chim"]},
          {"id":"bar","name":"Bar","art":"el","x":4,"y":5,"w":4,"h":4,"f":[]},
          {"id":"te","name":"Salón de té","art":"el","x":0,"y":5,"w":4,"h":4,"f":["chim"]}],
 "edges":[["h101","rel"],["h102","rel"],["h103","rel"],["rel","esc"],["esc","rec"],["rec","bar"],["bar","te"]]}
```

**A.5 Transatlántico Aurora (`barco`), nuevo**

Cubierta superior arriba, cubierta inferior abajo, dos escaleras (Proa y Popa) en los laterales que forman dos anillos.

```json
{"id":"barco","name":"Transatlántico Aurora","place":"el barco","unit":"sala","unlock":"inspector",
 "intro":"Travesía nocturna del Aurora. Dos escaleras, a proa y a popa, unen las cubiertas.",
 "features":[{"id":"int","icon":"wave","txt":"a la intemperie","neg":"a cubierto","label":"Intemperie"},
             {"id":"oj","icon":"porthole","txt":"con ojos de buey","neg":"sin ojos de buey","label":"Ojos de buey"}],
 "rooms":[{"id":"pue","name":"Puente de mando","art":"el","x":0,"y":0,"w":4,"h":3,"f":["int"]},
          {"id":"pas","name":"Cubierta de paseo","art":"la","x":4,"y":0,"w":5,"h":3,"f":["int"]},
          {"id":"bib","name":"Biblioteca","art":"la","x":9,"y":0,"w":3,"h":3,"f":["oj"]},
          {"id":"epr","name":"Proa","art":"la","x":0,"y":3,"w":3,"h":3,"f":[]},
          {"id":"com","name":"Gran comedor","art":"el","x":3,"y":3,"w":6,"h":3,"f":["oj"]},
          {"id":"epo","name":"Popa","art":"la","x":9,"y":3,"w":3,"h":3,"f":[]},
          {"id":"cam","name":"Camarotes","art":"los","x":0,"y":6,"w":5,"h":3,"f":["oj"]},
          {"id":"maq","name":"Sala de máquinas","art":"la","x":5,"y":6,"w":4,"h":3,"f":[]},
          {"id":"bod","name":"Bodega","art":"la","x":9,"y":6,"w":3,"h":3,"f":[]}],
 "edges":[["pue","pas"],["pas","bib"],["pue","epr"],["bib","epo"],["epr","com"],["com","epo"],
          ["epr","cam"],["epo","bod"],["cam","maq"],["maq","bod"]]}
```

Nota de texto: con `unit: "sala"`, "Proa" y "Popa" se nombran como salas ("en la Proa"). La introducción explica que son las escaleras.

**A.6 Teatro Lírico (`teatro`), nuevo**

```json
{"id":"teatro","name":"Teatro Lírico","place":"el teatro","unit":"sala","unlock":"inspector_jefe",
 "intro":"Noche de estreno en el Teatro Lírico. Las puertas se cerraron al subir el telón.",
 "features":[{"id":"vis","icon":"stage","txt":"con vista al escenario","neg":"sin vista al escenario","label":"Vista al escenario"},
             {"id":"esp","icon":"mirror","txt":"con espejos","neg":"sin espejos","label":"Espejos"}],
 "rooms":[{"id":"tra","name":"Tramoya","art":"la","x":0,"y":0,"w":3,"h":4,"f":["vis"]},
          {"id":"esc","name":"Escenario","art":"el","x":3,"y":0,"w":6,"h":3,"f":[]},
          {"id":"alm","name":"Almacén","art":"el","x":9,"y":0,"w":3,"h":4,"f":[]},
          {"id":"pla","name":"Platea","art":"la","x":3,"y":3,"w":6,"h":3,"f":["vis"]},
          {"id":"cam","name":"Camerinos","art":"los","x":0,"y":4,"w":3,"h":5,"f":["esp"]},
          {"id":"foy","name":"Foyer","art":"el","x":3,"y":6,"w":6,"h":3,"f":["esp"]},
          {"id":"pal","name":"Palco","art":"el","x":9,"y":4,"w":3,"h":2,"f":["vis"]},
          {"id":"amb","name":"Ambigú","art":"el","x":9,"y":6,"w":3,"h":3,"f":["esp"]}],
 "edges":[["tra","esc"],["esc","alm"],["esc","pla"],["tra","cam"],["cam","foy"],["pla","foy"],["foy","amb"],["amb","pal"]]}
```

Iconos nuevos a dibujar como `<symbol>` de 15 × 15, trazo de 1,6 px en `--ink-2`: `balcony` (barandilla), `wave` (ola), `porthole` (círculo con aro), `stage` (telón), `mirror` (óvalo con reflejo).

### Apéndice B. Textos de pistas

`{S}` = nombre del sospechoso (coloreado). `{sala}` = artículo + nombre en negrita. `{h}` = hora. `{obj}` = artículo + objeto en cursiva. `{unidad}` = "sala" o "vagón"; `{contigua}` = "contigua" o "contiguo"; `{una_unidad}` = "una sala" o "un vagón".

| Tipo | Plantilla |
|---|---|
| `at` | A las {h}, {S} estaba en {sala}. |
| `notat` | A las {h}, {S} no estaba en {sala}. |
| `feat` | A las {h}, {S} estaba en {una_unidad} {rasgo.txt o rasgo.neg}. |
| `never` | {S} no pisó {sala} en toda la noche. |
| `visited` | {S} estuvo en {sala} al menos una vez. |
| `stayed` | {S} no se movió de su {unidad} en toda la noche. |
| `moved` | Entre las {h} y las {h+1}, {S} cruzó una puerta. |
| `still` | Entre las {h} y las {h+1}, {S} no se movió. |
| `together` | A las {h}, {S1} y {S2} estaban en la misma sala. (tren: "en el mismo vagón") |
| `apart` | {S1} y {S2} no coincidieron en ningún momento. |
| `adj` | A las {h}, {S1} estaba en {una_unidad} {contigua} a la de {S2}. (tren: "en un vagón contiguo al de {S2}") |
| `count` (n = 0) | A las {h} no había nadie en {sala}. |
| `count` (n = 1) | A las {h} había exactamente una persona en {sala}. |
| `count` (n ≥ 2) | A las {h} había exactamente {dos, tres, cuatro} personas en {sala}. |
| `cat` | A las {h}, quien llevaba {obj} estaba en {sala}. |
| `cfeat` | A las {h}, quien llevaba {obj} estaba en {una_unidad} {rasgo}. |
| `ncarry` | {S} no llevaba {obj}. |
| `cwith` | A las {h}, quien llevaba {obj} estaba con {S}. |

### Apéndice C. Plantillas de explicación de pasos

Se usan en la fase 2 de la pista del inspector y en la cadena de deducción. `(p. N)` = referencia a la pista N. El **empujón** (fase 1) es siempre: "Fíjate en {pistas} y en {sospechoso o sala} a las {hora}."

| Regla | Explicación |
|---|---|
| `R1_AT` | {S} estaba en {sala} a las {h} (p. N). |
| `R1_NOTAT` / `R1_NEVER` | Por la pista N, {S} no estaba en {sala} {a las h / en toda la noche}. |
| `R1_FEAT` | A las {h}, {S} estaba en {una_unidad} {rasgo} (p. N): solo puede ser {lista de salas}. |
| `R1_STAYED` | {S} no se movió en toda la noche (p. N): estuvo siempre en la misma sala. |
| `R1_NCARRY` | {S} no llevaba {obj} (p. N). |
| `R1_EMPTY` | A las {h} no había nadie en {sala} (p. N). |
| `R2_CANT_BE_THERE` | {S} no pudo estar en {sala del crimen} a las {td}, así que no es el culpable. |
| `R2_ONLY_ONE` | Solo {S} pudo estar a solas con la víctima en {sala} a las {td}: es el culpable. |
| `R2_TAKEN` | {S} estaba con la víctima a las {td}; nadie más podía estar en {sala}. |
| `R3_REACH_FWD` / `R3_REACH_BWD` | A las {h}, {S} estaba en {salas}. En una hora solo se cruza una puerta, así que a las {h±1} solo pudo estar en {salas}. |
| `R3_STILL` | {S} no se movió entre las {h} y las {h+1} (p. N): a ambas horas estuvo en {sala o salas}. |
| `R3_MOVED` | {S} cruzó una puerta entre las {h} y las {h+1} (p. N): no pudo seguir en {sala}. |
| `R4_TOGETHER` | {S1} y {S2} estaban juntos a las {h} (p. N); como {S2} solo pudo estar en {salas}, {S1} también. |
| `R4_ADJ` | {S1} estaba en una sala contigua a la de {S2} a las {h} (p. N): solo encaja {salas}. |
| `R4_APART` | {S1} y {S2} nunca coincidieron (p. N), y {S2} estaba en {sala} a las {h}: {S1} no. |
| `R4_COUNT_FULL` | A las {h} había exactamente {n} en {sala} (p. N) y ya son {nombres}: nadie más estaba allí. |
| `R4_COUNT_NEED` | A las {h} había exactamente {n} en {sala} (p. N) y solo {nombres} podían estar: estaban todos. |
| `R4_OBJ_WHERE` | Quien llevaba {obj} estaba en {sala o rasgo} a las {h} (p. N). {S} no pudo estar allí, así que no lo llevaba. |
| `R4_OBJ_WITH` | Quien llevaba {obj} estaba con {S2} a las {h} (p. N). {S} no pudo coincidir con {S2}: no lo llevaba. |
| `R4_VISITED` | {S} estuvo en {sala} alguna vez (p. N) y solo pudo ser a las {h}. |
| `R5_OBJ_SINGLE` | Solo {S} puede llevar {obj}: lo llevaba. |
| `R5_SUS_SINGLE` | A {S} solo le queda {obj}: lo llevaba. |
| `R5_WEAPON` | El culpable es {S} y llevaba {obj}: esa es el arma. |
| `R6_HYPOTHESIS` | Supón que fue {S}. Entonces {consecuencia 1} y {consecuencia 2}, pero {contradicción}. No pudo ser {S}. |

**Frases de la deducción clave por arquetipo** (encabezado en el cierre):

- `coartada`: "La clave: {S} no podía llegar a tiempo a {sala del crimen}."
- `paso`: "La clave: el único camino a {sala del crimen} pasaba por {sala}, y estaba vacía."
- `pareja`: "La clave: {S1} y {S2} iban juntos; ninguno pudo estar a solas con la víctima."
- `recuento`: "La clave: el recuento de {sala} a las {h} dejaba fuera a {S}."
- `objeto`: "La clave: {obj} solo podía estar en manos de {S}."
- `vacia`: "La clave: {sala} estaba vacía a las {h} y cortaba el paso."
- `callejon`: "La clave: suponer que fue {S} llevaba a una contradicción."

### Apéndice D. Ejemplo ilustrativo de traza

Caso Novato en la Casa Valdemar. Víctima en la Bodega, muerte a las 22:00. Sospechosos: Adela, Bruno, Celia y Darío. Objetos: la cuerda, el bastón, el candelabro y el pisapapeles.

Pistas del ejemplo:

1. A las 21:00, Bruno estaba en el Invernadero.
2. A las 22:00, Celia y Darío estaban en la misma sala.
3. A las 23:00, quien llevaba la cuerda estaba en el Estudio.
4. Adela no llevaba el candelabro.
5. A las 21:00, quien llevaba el pisapapeles estaba en la Cocina.

Cadena crítica:

1. `R1_AT` (p. 1): Bruno estaba en el Invernadero a las 21:00.
2. `R3_REACH_FWD`: a las 22:00, Bruno solo pudo estar en el Invernadero, el Estudio o el Comedor.
3. `R2_CANT_BE_THERE`: Bruno no pudo estar en la Bodega a las 22:00; no es el culpable. Arquetipo `coartada`.
4. `R4_TOGETHER` con la regla 2 (p. 2): si Celia o Darío hubieran estado en la Bodega a las 22:00, habrían estado los dos, y el culpable estaba solo. Ninguno de los dos es el culpable. Arquetipo `pareja`.
5. `R2_ONLY_ONE`: solo queda Adela; estaba a solas con la víctima en la Bodega a las 22:00.
6. `R3_REACH_FWD`: a las 23:00, Adela solo pudo estar en la Bodega, el Vestíbulo o el Salón.
7. `R4_OBJ_WHERE` (p. 3): quien llevaba la cuerda estaba en el Estudio a las 23:00; Adela no pudo estar allí, así que no la llevaba.
8. `R3_REACH_BWD`: a las 21:00, Adela solo pudo estar en la Bodega, el Vestíbulo o el Salón.
9. `R4_OBJ_WHERE` (p. 5): quien llevaba el pisapapeles estaba en la Cocina a las 21:00; Adela no pudo estar allí, así que no lo llevaba.
10. `R5_SUS_SINGLE` (p. 4): a Adela solo le queda el bastón.
11. `R5_WEAPON`: el arma es el bastón.

Deducción clave: el paso 4 (nivel 4, el más alto entre los que descartan candidatos). Frase del cierre: "La clave: Celia y Darío iban juntos; ninguno pudo estar a solas con la víctima."

Nivel máximo 4 con un solo paso de ese nivel: encaja en Novato.
