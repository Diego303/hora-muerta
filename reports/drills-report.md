# Banco de ejercicios del calentamiento

Generado por `pnpm drills:build` (scripts/build-drills.ts). Versión `d1-62110d939f`.

- Casos analizados: 389 (novato, inspector, diario).
- Candidatos válidos (respuesta por fuerza bruta, el solver humano llega a lo mismo, filtros de calidad), sin duplicados: 4680.
- Elegidos: 360. Tamaño de public/drills.json: 245 KB sin comprimir.
- Tiempo: 430.4 s.

## Por técnica y nivel (elegidos, entre paréntesis los candidatos)

| Técnica | Nivel 1 | Nivel 2 | Nivel 3 | Total |
|---|---|---|---|---|
| alcance | 30 (de 795) | 30 (de 324) | 30 (de 178) | 90 |
| seguro | 30 (de 107) | 30 (de 686) | 30 (de 377) | 90 |
| tabla | 30 (de 326) | 30 (de 188) | 30 (de 415) | 90 |
| remate | 30 (de 698) | 30 (de 60) | 30 (de 526) | 90 |

## Variantes

- alcance: atrás 45, adelante 45
- seguro: F 32, NS 28, V 30
- tabla: quién 32, qué 32, NS 26
- remate: clue 69, contra 21

## Mapas

- tren: 41
- museo: 56
- teatro: 47
- barco: 66
- mansion: 63
- hotel: 64
- sin plano: 23

## Candidatos descartados, por motivo

- tri:sin-mundo: 13618
- pick:sin-mundo: 7095
- tri:ns-abierto: 2832
- tri:premisas: 2514
- pick:premisas: 2325
- reach:demasiadas-salas: 2307
- reach:premisas: 1864
- clue:mixta: 750
- clue:no-unico: 564
- contra:no-rompe: 417
- tri:humano: 368
- pick:muchas-pistas: 315
- pick:ns-abierto: 299
- contra:cadena: 293
- clue:respuesta: 120
- clue:cadena: 108
- pick:cadena: 86
- tri:muchas-pistas: 83
- contra:respuesta: 81
- pick:ns-humano: 53
- contra:humano: 35
- tri:ns-humano: 33
- clue:muchas-personas: 32
- pick:humano: 29
- tri:ns-cadena: 20
- presupuesto: 20
- contra:mundo: 17
- clue:humano: 14
- tri:cadena: 12
- clue:mundo: 6

## Muestra para revisar (10 al azar por técnica)

### alcance

**N-069-8-reach0** · alcance · reach · nivel 1 · museo · Sara  
Lo que sabes: A las 22:00, Sara estaba en la Recepción.  
Pregunta: ¿Dónde pudo estar Sara a las 21:00? Toca todas las salas posibles.  
Respuesta: Pinacoteca, Recepción, Tienda  
Explicación: A las 22:00, Sara estaba en la Recepción. En una hora solo se cruza una puerta, así que a las 21:00 solo pudo estar en la Pinacoteca, la Recepción o la Tienda. Esas son las salas que tienes que marcar.  
Origen: N-069 paso 8 (R3_REACH_FWD)

**I-004-8-reach** · alcance · reach · nivel 2 · barco · Mateo  
Lo que sabes: A las 21:00, Mateo estaba en una sala a la intemperie. / Mateo estuvo en los Camarotes al menos una vez.  
Pregunta: ¿Dónde pudo estar Mateo a las 22:00? Toca todas las salas posibles.  
Respuesta: Proa  
Explicación: A las 21:00, Mateo estaba en una sala a la intemperie: solo puede ser el Puente de mando o la Cubierta de paseo. Una hora después, a las 22:00, Mateo solo pudo estar en el Puente de mando, la Cubierta de paseo, la Biblioteca o la Proa. Una hora después, a las 23:00, Mateo solo pudo estar en el Puente de mando, la Cubierta de paseo, la Biblioteca, la Proa, el Gran comedor, la Popa o los Camarotes. Mateo estuvo en los Camarotes alguna vez y solo pudo ser a las 23:00. Una hora antes, a las 22:00, Mateo solo pudo estar en la Proa. Solo tienes que marcar la Proa.  
Origen: I-004 paso 8 (R3_REACH_BWD)

**I-111-5-reach0** · alcance · reach · nivel 1 · mansion · Rómulo  
Lo que sabes: A las 22:00, Rómulo estaba en la Bodega.  
Pregunta: ¿Dónde pudo estar Rómulo a las 21:00? Toca todas las salas posibles.  
Respuesta: Salón, Vestíbulo, Bodega  
Explicación: A las 22:00, Rómulo estaba en la Bodega. En una hora solo se cruza una puerta, así que a las 21:00 solo pudo estar en el Salón, el Vestíbulo o la Bodega. Esas son las salas que tienes que marcar.  
Origen: I-111 paso 5 (R3_REACH_FWD)

**N-103-3-reach0** · alcance · reach · nivel 2 · mansion · Adela  
Lo que sabes: A las 23:00, Adela estaba en el Salón.  
Pregunta: ¿Dónde pudo estar Adela a las 21:00? Toca todas las salas posibles.  
Respuesta: Biblioteca, Estudio, Salón, Vestíbulo, Comedor, Bodega  
Explicación: A las 23:00, Adela estaba en el Salón. En una hora solo se cruza una puerta, así que a las 22:00 solo pudo estar en la Biblioteca, el Salón, el Vestíbulo o la Bodega. Una hora antes, a las 21:00, Adela solo pudo estar en la Biblioteca, el Estudio, el Salón, el Vestíbulo, el Comedor o la Bodega. Esas son las salas que tienes que marcar.  
Origen: N-103 paso 3 (R3_REACH_BWD)

**N-056-4-reach2** · alcance · reach · nivel 2 · tren · Adela  
Lo que sabes: A las 21:00, Adela estaba en el Furgón.  
Pregunta: ¿Dónde pudo estar Adela a las 23:00? Toca todos los vagones posibles.  
Respuesta: Coche A, Coche B, Furgón, Coche C  
Explicación: A las 21:00, Adela estaba en el Furgón. En una hora solo se cruza una puerta, así que a las 22:00 solo pudo estar en el Coche B, el Furgón o el Coche C. Una hora después, a las 23:00, Adela solo pudo estar en el Coche A, el Coche B, el Furgón o el Coche C. Esos son los vagones que tienes que marcar.  
Origen: N-056 paso 4 (R3_REACH_FWD)

**D-017-1-reach** · alcance · reach · nivel 1 · teatro · Lola  
Lo que sabes: A las 23:00, Lola estaba en los Camerinos.  
Pregunta: ¿Dónde pudo estar Lola a las 22:00? Toca todas las salas posibles.  
Respuesta: Tramoya, Camerinos, Foyer  
Explicación: A las 23:00, Lola estaba en los Camerinos. En una hora solo se cruza una puerta, así que a las 22:00 solo pudo estar en la Tramoya, los Camerinos o el Foyer. Esas son las salas que tienes que marcar.  
Origen: D-017 paso 1 (R3_REACH_BWD)

**I-001-5-reach** · alcance · reach · nivel 1 · mansion · Rómulo  
Lo que sabes: A las 22:00, Rómulo estaba en el Vestíbulo.  
Pregunta: ¿Dónde pudo estar Rómulo a las 23:00? Toca todas las salas posibles.  
Respuesta: Estudio, Salón, Vestíbulo, Comedor, Bodega  
Explicación: A las 22:00, Rómulo estaba en el Vestíbulo. En una hora solo se cruza una puerta, así que a las 23:00 solo pudo estar en el Estudio, el Salón, el Vestíbulo, el Comedor o la Bodega. Esas son las salas que tienes que marcar.  
Origen: I-001 paso 5 (R3_REACH_FWD)

**N-166-7-reach** · alcance · reach · nivel 1 · hotel · Fausto  
Lo que sabes: A las 22:00, Fausto estaba en la Escalera.  
Pregunta: ¿Dónde pudo estar Fausto a las 23:00? Toca todas las salas posibles.  
Respuesta: Rellano, Escalera, Recepción  
Explicación: A las 22:00, Fausto estaba en la Escalera. En una hora solo se cruza una puerta, así que a las 23:00 solo pudo estar en el Rellano, la Escalera o la Recepción. Esas son las salas que tienes que marcar.  
Origen: N-166 paso 7 (R3_REACH_FWD)

**I-108-5-reach** · alcance · reach · nivel 3 · museo · Celia  
Lo que sabes: A las 21:00, Celia estaba en una sala sin claraboya. / A las 23:00, Celia estaba en una sala sin claraboya. / Celia estuvo en la Pinacoteca al menos una vez. / Celia no pisó la Sala Egipcia en toda la noche.  
Pregunta: ¿Dónde pudo estar Celia a las 23:00? Toca todas las salas posibles.  
Respuesta: Recepción  
Explicación: A las 21:00, Celia estaba en una sala sin claraboya: solo puede ser la Sala Egipcia, la Sala de Mapas, la Recepción, la Tienda o el Archivo. A las 23:00, Celia estaba en una sala sin claraboya: solo puede ser la Sala Egipcia, la Sala de Mapas, la Recepción, la Tienda o el Archivo. Celia no estaba en la Sala Egipcia en toda la noche. Celia estuvo en la Pinacoteca alguna vez y solo pudo ser a las 22:00. A las 22:00, Celia estaba en la Pinacoteca. En una hora solo se cruza una puerta, así que a las 23:00 solo pudo estar en la Recepción. Solo tienes que marcar la Recepción.  
Origen: I-108 paso 5 (R3_REACH_FWD)

**N-125-6-reach** · alcance · reach · nivel 1 · barco · Adela  
Lo que sabes: A las 23:00, Adela estaba en la Proa.  
Pregunta: ¿Dónde pudo estar Adela a las 22:00? Toca todas las salas posibles.  
Respuesta: Puente de mando, Proa, Gran comedor, Camarotes  
Explicación: A las 23:00, Adela estaba en la Proa. En una hora solo se cruza una puerta, así que a las 22:00 solo pudo estar en el Puente de mando, la Proa, el Gran comedor o los Camarotes. Esas son las salas que tienes que marcar.  
Origen: N-125 paso 6 (R3_REACH_BWD)

### seguro

**I-041-27-triNS** · seguro · tri · nivel 2 · teatro · Darío, Paula, Sara · objetos: frasco de veneno, bastón, estatuilla  
Lo que sabes: A las 22:00, quien llevaba el frasco de veneno estaba en una sala con vista al escenario. / A las 22:00, quien llevaba el bastón estaba con Darío.  
Afirmación: «Darío llevaba la estatuilla.» ¿Verdadero, falso o no se puede saber?  
Respuesta: No se puede saber  
Explicación: Quien llevaba el bastón estaba con Darío a las 22:00: no podía ser Darío mismo, así que no lo llevaba. Con lo que sabes, Darío pudo llevar el frasco de veneno o la estatuilla: es posible, pero no lo puedes demostrar.  
Origen: I-041 paso 27 (R4_OBJ_WHERE)

**I-118-15-triV** · seguro · tri · nivel 2 · hotel · Hugo, Julián · objetos: pisapapeles, abrecartas  
Lo que sabes: Julián no pisó la Recepción en toda la noche. / A las 21:00, quien llevaba el pisapapeles estaba en la Recepción.  
Afirmación: «A las 21:00, Hugo no estaba en la Habitación 102.» ¿Verdadero, falso o no se puede saber?  
Respuesta: Verdadero  
Explicación: Solo quien llevaba el pisapapeles pudo estar en la Recepción a las 21:00: por eso Hugo estuvo en la Recepción. Lo puedes demostrar: es verdadero.  
Origen: I-118 paso 15 (R4_OBJ_WHERE)

**I-076-21-triV** · seguro · tri · nivel 1 · barco · Adela, Fausto · objetos: abrecartas, estatuilla  
Lo que sabes: A las 23:00, quien llevaba la estatuilla estaba con Adela.  
Afirmación: «Adela no llevaba la estatuilla.» ¿Verdadero, falso o no se puede saber?  
Respuesta: Verdadero  
Explicación: Quien llevaba la estatuilla estaba con Adela a las 23:00: no podía ser Adela misma, así que no la llevaba. Lo puedes demostrar: es verdadero.  
Origen: I-076 paso 21 (R4_OBJ_WITH)

**I-060-7-triV** · seguro · tri · nivel 2 · hotel · Nuria  
Lo que sabes: A las 21:00, Nuria estaba en el Salón de té. / Entre las 21:00 y las 22:00, Nuria no se movió.  
Afirmación: «A las 22:00, Nuria no estaba en el Bar.» ¿Verdadero, falso o no se puede saber?  
Respuesta: Verdadero  
Explicación: A las 21:00, Nuria estaba en el Salón de té. En una hora solo se cruza una puerta, así que a las 22:00 solo pudo estar en el Bar o el Salón de té. Nuria no se movió entre las 21:00 y las 22:00: a ambas horas estuvo en el Salón de té. Lo puedes demostrar: es verdadero.  
Origen: I-060 paso 7 (R3_STILL)

**N-015-12-triV** · seguro · tri · nivel 2 · museo · Elena, Tomás · objetos: cuerda, candelabro  
Lo que sabes: A las 22:00, Elena estaba en la Galería Norte. / A las 21:00, quien llevaba el candelabro estaba en la Pinacoteca.  
Afirmación: «Elena no llevaba el candelabro.» ¿Verdadero, falso o no se puede saber?  
Respuesta: Verdadero  
Explicación: A las 22:00, Elena estaba en la Galería Norte. En una hora solo se cruza una puerta, así que a las 21:00 solo pudo estar en la Sala Egipcia, la Galería Norte, la Sala de Mapas o el Patio. Quien llevaba el candelabro estaba en la Pinacoteca a las 21:00. Elena no pudo estar allí, así que no lo llevaba. Lo puedes demostrar: es verdadero.  
Origen: N-015 paso 12 (R4_OBJ_WHERE)

**I-047-11-triF** · seguro · tri · nivel 1 · teatro · Hugo, Tomás · objetos: llave inglesa, cuerda  
Lo que sabes: A las 22:00, quien llevaba la cuerda estaba con Tomás.  
Afirmación: «Tomás llevaba la cuerda.» ¿Verdadero, falso o no se puede saber?  
Respuesta: Falso  
Explicación: Quien llevaba la cuerda estaba con Tomás a las 22:00: no podía ser Tomás mismo, así que no la llevaba. Puedes descartarlo: es falso.  
Origen: I-047 paso 11 (R4_OBJ_WITH)

**N-161-8-triNS** · seguro · tri · nivel 2 · barco · Darío  
Lo que sabes: A las 21:00, Darío estaba en una sala con ojos de buey. / Entre las 21:00 y las 22:00, Darío no se movió.  
Afirmación: «A las 22:00, Darío estaba en el Gran comedor.» ¿Verdadero, falso o no se puede saber?  
Respuesta: No se puede saber  
Explicación: A las 21:00, Darío estaba en una sala con ojos de buey: solo puede ser la Biblioteca, el Gran comedor o los Camarotes. Una hora después, a las 22:00, Darío solo pudo estar en la Cubierta de paseo, la Biblioteca, la Proa, el Gran comedor, la Popa, los Camarotes o la Sala de máquinas. Darío no se movió entre las 21:00 y las 22:00: a ambas horas ya no pudo estar en la Cubierta de paseo ni en la Proa ni en la Popa ni en la Sala de máquinas. Con lo que sabes, Darío pudo estar en la Biblioteca, el Gran comedor o los Camarotes: es posible, pero no lo puedes demostrar.  
Origen: N-161 paso 8 (R3_STILL)

**D-014-15-triF** · seguro · tri · nivel 2 · museo · Bruno, Celia · objetos: llave inglesa, abrecartas  
Lo que sabes: A las 22:00, Celia estaba en la Sala de Mapas. / A las 21:00, quien llevaba la llave inglesa estaba en la Recepción.  
Afirmación: «Celia llevaba la llave inglesa.» ¿Verdadero, falso o no se puede saber?  
Respuesta: Falso  
Explicación: A las 22:00, Celia estaba en la Sala de Mapas. En una hora solo se cruza una puerta, así que a las 21:00 solo pudo estar en la Galería Norte, la Sala de Mapas o la Sala de Esculturas. Quien llevaba la llave inglesa estaba en la Recepción a las 21:00. Celia no pudo estar allí, así que no la llevaba. Puedes descartarlo: es falso.  
Origen: D-014 paso 15 (R4_OBJ_WHERE)

**N-007-11-triNS** · seguro · tri · nivel 3 · mansion · Greta, Lola, Mateo, Sara · objetos: frasco de veneno, llave inglesa, pisapapeles, abrecartas  
Lo que sabes: A las 23:00, Greta estaba en el Vestíbulo. / A las 23:00, Mateo estaba en una sala con chimenea. / A las 23:00, Greta y Lola estaban en la misma sala. / A las 23:00, quien llevaba el frasco de veneno estaba en la Bodega.  
Afirmación: «Greta llevaba la llave inglesa.» ¿Verdadero, falso o no se puede saber?  
Respuesta: No se puede saber  
Explicación: A las 23:00, Mateo estaba en una sala con chimenea: solo puede ser la Biblioteca, el Salón o el Comedor. Greta y Lola estaban juntas a las 23:00; como Greta solo pudo estar en el Vestíbulo, Lola también. Quien llevaba el frasco de veneno estaba en la Bodega a las 23:00. Greta, Lola y Mateo no pudieron estar allí, así que no lo llevaban. Con lo que sabes, Greta pudo llevar la llave inglesa, el pisapapeles o el abrecartas: es posible, pero no lo puedes demostrar.  
Origen: N-007 paso 11 (R4_OBJ_WHERE)

**D-004-5-triF** · seguro · tri · nivel 2 · hotel · Elena  
Lo que sabes: A las 23:00, Elena estaba en la Recepción. / Entre las 21:00 y las 22:00, Elena no se movió.  
Afirmación: «A las 21:00, Elena estaba en el Rellano.» ¿Verdadero, falso o no se puede saber?  
Respuesta: Falso  
Explicación: A las 23:00, Elena estaba en la Recepción. En una hora solo se cruza una puerta, así que a las 22:00 solo pudo estar en la Escalera, la Recepción o el Bar. Una hora antes, a las 21:00, Elena solo pudo estar en el Rellano, la Escalera, la Recepción, el Bar o el Salón de té. Elena no se movió entre las 21:00 y las 22:00: a ambas horas ya no pudo estar en el Rellano ni en el Salón de té. Puedes descartarlo: es falso.  
Origen: D-004 paso 5 (R3_STILL)

### tabla

**D-030-2-pickwhat** · tabla · pick · nivel 1 · sin plano · Adela, Darío · objetos: abrecartas, atizador  
Lo que sabes: Darío no llevaba el abrecartas.  
Pregunta: ¿Qué llevaba Darío?  
Respuesta: atizador  
Explicación: Darío no llevaba el abrecartas. Solo Adela puede llevar el abrecartas: lo llevaba. Así que Darío llevaba el atizador.  
Origen: D-030 paso 2 (R1_NCARRY)

**N-063-12-pickNS** · tabla · pick · nivel 3 · museo · Adela, Celia, Lola · objetos: estatuilla, frasco de veneno, pisapapeles  
Lo que sabes: A las 21:00, Adela estaba en la Pinacoteca. / A las 21:00, quien llevaba el pisapapeles estaba en la Sala de Esculturas. / A las 22:00, quien llevaba el frasco de veneno estaba en la Sala de Mapas.  
Pregunta: ¿Quién llevaba el frasco de veneno?  
Respuesta: No se puede saber  
Explicación: A las 21:00, Adela estaba en la Pinacoteca. En una hora solo se cruza una puerta, así que a las 22:00 solo pudo estar en la Sala Egipcia, la Pinacoteca o la Recepción. Quien llevaba el pisapapeles estaba en la Sala de Esculturas a las 21:00. Adela no pudo estar allí, así que no lo llevaba. Quien llevaba el frasco de veneno estaba en la Sala de Mapas a las 22:00. Adela no pudo estar allí, así que no lo llevaba. Con lo que sabes, el frasco de veneno lo pudo llevar Celia o Lola: no lo puedes saber.  
Origen: N-063 paso 12 (R4_OBJ_WHERE)

**N-100-16-pickNS** · tabla · pick · nivel 3 · hotel · Elena, Julián, Octavio, Paula · objetos: frasco de veneno, candelabro, pisapapeles, cuerda  
Lo que sabes: A las 23:00, Julián estaba en el Rellano. / A las 23:00, Elena estaba en el Bar. / A las 22:00, quien llevaba el pisapapeles estaba en la Recepción. / A las 23:00, quien llevaba el frasco de veneno estaba en la Habitación 103.  
Pregunta: ¿Quién llevaba el frasco de veneno?  
Respuesta: No se puede saber  
Explicación: A las 23:00, Julián estaba en el Rellano. En una hora solo se cruza una puerta, así que a las 22:00 solo pudo estar en la Habitación 101, la Habitación 102, la Habitación 103, el Rellano o la Escalera. Quien llevaba el pisapapeles estaba en la Recepción a las 22:00. Julián no pudo estar allí, así que no lo llevaba. Quien llevaba el frasco de veneno estaba en la Habitación 103 a las 23:00. Elena y Julián no pudieron estar allí, así que no lo llevaban. Con lo que sabes, el frasco de veneno lo pudo llevar Octavio o Paula: no lo puedes saber.  
Origen: N-100 paso 16 (R4_OBJ_WHERE)

**N-097-12-pickwhat** · tabla · pick · nivel 2 · mansion · Celia, Irene · objetos: candelabro, frasco de veneno  
Lo que sabes: A las 21:00, Celia estaba en el Salón. / A las 21:00, quien llevaba el candelabro estaba en el Vestíbulo.  
Pregunta: ¿Qué llevaba Celia?  
Respuesta: frasco de veneno  
Explicación: Quien llevaba el candelabro estaba en el Vestíbulo a las 21:00. Celia no pudo estar allí, así que no lo llevaba. Solo Irene puede llevar el candelabro: lo llevaba. Así que Celia llevaba el frasco de veneno.  
Origen: N-097 paso 12 (R4_OBJ_WHERE)

**I-137-18-pickNS** · tabla · pick · nivel 2 · museo · Adela, Greta, Irene, Sara · objetos: cuerda, abrecartas, atizador, tijeras de podar  
Lo que sabes: Adela no llevaba el atizador. / A las 21:00, quien llevaba el abrecartas estaba en la Sala de Mapas.  
Pregunta: ¿Quién llevaba el atizador?  
Respuesta: No se puede saber  
Explicación: Adela no llevaba el atizador. Con lo que sabes, el atizador lo pudo llevar Greta, Irene o Sara: no lo puedes saber.  
Origen: I-137 paso 18 (R4_OBJ_WHERE)

**I-162-16-pickwhat** · tabla · pick · nivel 2 · tren · Irene, Nuria · objetos: pisapapeles, cuerda  
Lo que sabes: A las 23:00, Nuria estaba en un vagón con la ventanilla abierta. / A las 23:00, quien llevaba el pisapapeles estaba en el Vagón bar.  
Pregunta: ¿Qué llevaba Nuria?  
Respuesta: cuerda  
Explicación: A las 23:00, Nuria estaba en un vagón con la ventanilla abierta: solo puede ser el Mirador, el Restaurante o el Coche B. Quien llevaba el pisapapeles estaba en el Vagón bar a las 23:00. Nuria no pudo estar allí, así que no lo llevaba. Solo Irene puede llevar el pisapapeles: lo llevaba. Así que Nuria llevaba la cuerda.  
Origen: I-162 paso 16 (R4_OBJ_WHERE)

**N-043-16-pickwhat** · tabla · pick · nivel 3 · mansion · Adela, Bruno, Lola · objetos: abrecartas, estatuilla, candelabro  
Lo que sabes: A las 22:00, Adela estaba en el Invernadero. / A las 22:00, Adela y Bruno estaban en la misma sala. / A las 22:00, quien llevaba el candelabro estaba en el Salón.  
Pregunta: ¿Qué llevaba Lola?  
Respuesta: candelabro  
Explicación: Adela y Bruno estaban juntos a las 22:00; como Adela solo pudo estar en el Invernadero, Bruno también. Quien llevaba el candelabro estaba en el Salón a las 22:00. Adela y Bruno no pudieron estar allí, así que no lo llevaban. Solo Lola puede llevar el candelabro: lo llevaba. Así que Lola llevaba el candelabro.  
Origen: N-043 paso 16 (R4_OBJ_WHERE)

**N-142-9-pickNS** · tabla · pick · nivel 2 · hotel · Adela, Greta, Tomás · objetos: tijeras de podar, frasco de veneno, bastón  
Lo que sabes: A las 22:00, Greta estaba en la Habitación 102. / A las 21:00, quien llevaba el frasco de veneno estaba en una sala con chimenea.  
Pregunta: ¿Quién llevaba el frasco de veneno?  
Respuesta: No se puede saber  
Explicación: A las 22:00, Greta estaba en la Habitación 102. En una hora solo se cruza una puerta, así que a las 21:00 solo pudo estar en la Habitación 102 o el Rellano. Quien llevaba el frasco de veneno estaba en una sala con chimenea a las 21:00. Greta no pudo estar allí, así que no lo llevaba. Con lo que sabes, el frasco de veneno lo pudo llevar Adela o Tomás: no lo puedes saber.  
Origen: N-142 paso 9 (R4_OBJ_WHERE)

**I-084-22-pickNS** · tabla · pick · nivel 2 · mansion · Bruno, Greta, Julián, Sara · objetos: estatuilla, candelabro, cuerda, abrecartas  
Lo que sabes: A las 21:00, Bruno estaba en la Cocina. / A las 21:00, quien llevaba el abrecartas estaba en una sala con chimenea.  
Pregunta: ¿Qué llevaba Bruno?  
Respuesta: No se puede saber  
Explicación: Quien llevaba el abrecartas estaba en una sala con chimenea a las 21:00. Bruno no pudo estar allí, así que no lo llevaba. Con lo que sabes, Bruno pudo llevar la estatuilla, el candelabro o la cuerda: no lo puedes saber.  
Origen: I-084 paso 22 (R4_OBJ_WHERE)

**I-007-16-pickNS** · tabla · pick · nivel 3 · hotel · Elena, Lola, Mateo, Tomás · objetos: cuerda, estatuilla, abrecartas, frasco de veneno  
Lo que sabes: A las 22:00, Lola estaba en el Salón de té. / A las 21:00, Elena y Lola estaban en la misma sala. / A las 22:00, Lola y Tomás estaban en la misma sala. / A las 22:00, quien llevaba el frasco de veneno estaba en el Rellano.  
Pregunta: ¿Quién llevaba la cuerda?  
Respuesta: No se puede saber  
Explicación: Elena y Lola estaban juntas a las 21:00; como Lola solo pudo estar en el Bar o el Salón de té, Elena también. Una hora después, a las 22:00, Elena solo pudo estar en la Recepción, el Bar o el Salón de té. Lola y Tomás estaban juntos a las 22:00; como Lola solo pudo estar en el Salón de té, Tomás también. Quien llevaba el frasco de veneno estaba en el Rellano a las 22:00. Elena, Lola y Tomás no pudieron estar allí, así que no lo llevaban. Solo Mateo puede llevar el frasco de veneno: lo llevaba. Con lo que sabes, la cuerda la pudo llevar Elena, Lola o Tomás: no lo puedes saber.  
Origen: I-007 paso 16 (R4_OBJ_WHERE)

### remate

**I-146-7-contra** · remate · contra · nivel 3 · mansion · Adela, Fausto, Nuria  
> La víctima apareció en el Invernadero a las 23:00. Prueba una hipótesis: supón que fue Adela.  
Pregunta: Si Adela hubiera estado a solas con la víctima, ¿qué pista se rompe?  
Pistas: 1. A las 22:00, Adela estaba en una sala con ventana. / 2. A las 23:00, Adela estaba en una sala con ventana. / 3. A las 23:00, Adela y Fausto estaban en la misma sala.  
Respuesta: pista 3  
Explicación: Adela y Fausto estaban juntos a las 23:00; si alguno hubiera estado a solas con la víctima, el otro también, y solo hay un culpable. Ninguno de los dos lo es. Si supones que fue Adela, la pista 3 no se cumple: la hipótesis se rompe y no pudo ser Adela.  
Origen: I-146 paso 7 (R4_TOGETHER)

**D-045-10-contra** · remate · contra · nivel 3 · barco · Celia, Irene, Tomás  
> La víctima apareció en el Puente de mando a las 22:00. Prueba una hipótesis: supón que fue Irene.  
Pregunta: Si Irene hubiera estado a solas con la víctima, ¿qué pista se rompe?  
Pistas: 1. A las 22:00, Celia estaba en la Bodega. / 2. A las 21:00 no había nadie en el Puente de mando. / 3. A las 22:00, Celia y Irene estaban en la misma sala.  
Respuesta: pista 3  
Explicación: Celia y Irene estaban juntas a las 22:00. Si supones que fue Irene, la pista 3 no se cumple: la hipótesis se rompe y no pudo ser Irene.  
Origen: D-045 paso 10 (R4_TOGETHER)

**D-030-4-contra** · remate · contra · nivel 3 · mansion · Adela, Bruno  
> La víctima apareció en el Comedor a las 22:00. Prueba una hipótesis: supón que fue Bruno.  
Pregunta: Si Bruno hubiera estado a solas con la víctima, ¿qué pista se rompe?  
Pistas: 1. A las 22:00, Bruno estaba en la Biblioteca. / 2. Entre las 21:00 y las 22:00, Adela no se movió.  
Respuesta: pista 1  
Explicación: Bruno no pudo estar en el Comedor a las 22:00, así que no es el culpable. Si supones que fue Bruno, la pista 1 no se cumple: la hipótesis se rompe y no pudo ser Bruno.  
Origen: D-030 paso 4 (R2_CANT_BE_THERE)

**N-145-6-contra** · remate · contra · nivel 3 · mansion · Bruno, Tomás  
> La víctima apareció en el Invernadero a las 22:00. Prueba una hipótesis: supón que fue Bruno.  
Pregunta: Si Bruno hubiera estado a solas con la víctima, ¿qué pista se rompe?  
Pistas: 1. A las 21:00, Bruno estaba en el Vestíbulo. / 2. A las 21:00, Tomás estaba en una sala sin chimenea.  
Respuesta: pista 1  
Explicación: A las 21:00, Bruno estaba en el Vestíbulo. En una hora solo se cruza una puerta, así que a las 22:00 solo pudo estar en el Estudio, el Salón, el Vestíbulo, el Comedor o la Bodega. Bruno no pudo estar en el Invernadero a las 22:00, así que no es el culpable. Si supones que fue Bruno, la pista 1 no se cumple: la hipótesis se rompe y no pudo ser Bruno.  
Origen: N-145 paso 6 (R2_CANT_BE_THERE)

**N-167-10-clue0** · remate · clue · nivel 1 · barco · Elena, Hugo  
> La víctima apareció en el Puente de mando a las 23:00. Quedan Hugo y Elena.  
Pregunta: ¿Qué pista decide entre Hugo y Elena?  
Pistas: 1. Entre las 21:00 y las 22:00, Hugo no se movió. / 2. Elena y Hugo no coincidieron en ningún momento. / 3. A las 22:00, Elena estaba en la Bodega.  
Respuesta: pista 3 (Hugo)  
Explicación: A las 22:00, Elena estaba en la Bodega. En una hora solo se cruza una puerta, así que a las 23:00 solo pudo estar en la Popa, la Sala de máquinas o la Bodega. Elena no pudo estar en el Puente de mando a las 23:00, así que no es la culpable. La pista decisiva es la 3: descarta a Elena, así que el culpable es Hugo.  
Origen: N-167 paso 10 (R2_CANT_BE_THERE)

**I-090-17-clue0** · remate · clue · nivel 3 · tren · Adela, Lola  
> La víctima apareció en el Furgón a las 22:00. Quedan Adela y Lola.  
Lo que sabes: A las 23:00, Lola estaba en un vagón sin literas. / Lola estuvo en el Coche B al menos una vez.  
Pregunta: ¿Qué pista decide entre Adela y Lola?  
Pistas: 1. Adela no pisó el Coche A en toda la noche. / 2. A las 21:00, Lola estaba en el Furgón. / 3. A las 21:00, Adela estaba en un vagón con la ventanilla abierta.  
Respuesta: pista 2 (Adela)  
Explicación: A las 23:00, Lola estaba en un vagón sin literas: solo puede ser el Mirador, el Vagón bar, el Restaurante, la Cocina o el Furgón. A las 21:00, Lola estaba en el Furgón. En una hora solo se cruza una puerta, así que a las 22:00 solo pudo estar en el Coche B, el Furgón o el Coche C. Una hora después, a las 23:00, Lola solo pudo estar en el Furgón. Lola estuvo en el Coche B alguna vez y solo pudo ser a las 22:00. Lola no pudo estar en el Furgón a las 22:00, así que no es la culpable. La pista decisiva es la 2: descarta a Lola, así que la culpable es Adela.  
Origen: I-090 paso 17 (R2_CANT_BE_THERE)

**D-044-8-clue1** · remate · clue · nivel 1 · hotel · Julián, Mateo  
> La víctima apareció en el Bar a las 23:00. Quedan Julián y Mateo.  
Pregunta: ¿Qué pista decide entre Julián y Mateo?  
Pistas: 1. A las 22:00, Mateo estaba en una sala con balcón. / 2. Entre las 22:00 y las 23:00, Mateo cruzó una puerta. / 3. A las 21:00 no había nadie en la Habitación 101.  
Respuesta: pista 1 (Julián)  
Explicación: A las 22:00, Mateo estaba en una sala con balcón: solo puede ser la Habitación 101 o la Habitación 102. Una hora después, a las 23:00, Mateo solo pudo estar en la Habitación 101, la Habitación 102 o el Rellano. Mateo no pudo estar en el Bar a las 23:00, así que no es el culpable. La pista decisiva es la 1: descarta a Mateo, así que el culpable es Julián.  
Origen: D-044 paso 8 (R2_CANT_BE_THERE)

**N-020-4-clue1** · remate · clue · nivel 1 · tren · Bruno, Elena  
> La víctima apareció en el Coche A a las 22:00. Quedan Bruno y Elena.  
Pregunta: ¿Qué pista decide entre Bruno y Elena?  
Pistas: 1. Entre las 21:00 y las 22:00, Elena cruzó una puerta. / 2. A las 22:00, Elena estaba en un vagón sin literas. / 3. Bruno estuvo en el Coche B al menos una vez.  
Respuesta: pista 2 (Bruno)  
Explicación: A las 22:00, Elena estaba en un vagón sin literas: solo puede ser el Mirador, el Vagón bar, el Restaurante, la Cocina o el Furgón. Elena no pudo estar en el Coche A a las 22:00, así que no es la culpable. La pista decisiva es la 2: descarta a Elena, así que el culpable es Bruno.  
Origen: N-020 paso 4 (R2_CANT_BE_THERE)

**N-139-7-clue1** · remate · clue · nivel 1 · mansion · Elena, Greta  
> La víctima apareció en el Salón a las 22:00. Quedan Greta y Elena.  
Pregunta: ¿Qué pista decide entre Greta y Elena?  
Pistas: 1. A las 21:00, Elena estaba en el Estudio. / 2. A las 22:00 había exactamente una persona en el Invernadero.  
Respuesta: pista 1 (Greta)  
Explicación: A las 21:00, Elena estaba en el Estudio. En una hora solo se cruza una puerta, así que a las 22:00 solo pudo estar en la Biblioteca, el Estudio, el Invernadero o el Vestíbulo. Elena no pudo estar en el Salón a las 22:00, así que no es la culpable. La pista decisiva es la 1: descarta a Elena, así que la culpable es Greta.  
Origen: N-139 paso 7 (R2_CANT_BE_THERE)

**I-094-4-clue1** · remate · clue · nivel 1 · teatro · Paula, Tomás  
> La víctima apareció en el Almacén a las 23:00. Quedan Tomás y Paula.  
Pregunta: ¿Qué pista decide entre Tomás y Paula?  
Pistas: 1. A las 21:00 no había nadie en el Almacén. / 2. A las 23:00, Paula estaba en una sala con vista al escenario. / 3. A las 21:00, Paula estaba en la Platea.  
Respuesta: pista 2 (Tomás)  
Explicación: A las 23:00, Paula estaba en una sala con vista al escenario: solo puede ser la Tramoya, la Platea o el Palco. Paula no pudo estar en el Almacén a las 23:00, así que no es la culpable. La pista decisiva es la 2: descarta a Paula, así que el culpable es Tomás.  
Origen: I-094 paso 4 (R2_CANT_BE_THERE)
