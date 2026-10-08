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


## Modos Incendio y Calentamiento
- Especificación y plan: docs/MODOS.md. Si el código y el documento discrepan, manda el documento.
- Prototipo de referencia de ambos modos: docs/referencia/hora-muerta-modos.html (funciones fire* y gym*, GYM_ITEMS, gym_core).
- El incendio es predecible: todo su estado se calcula a partir de t y de ign/burnAt precalculados. Nada de estado acumulado.
- El incendio nunca puede exigir adivinar: respeta las garantías de justicia de MODOS.md 2.5.
- El calentamiento no tiene reloj ni castigo. Cada ejercicio lleva su respuesta precalculada y verificada por fuerza bruta.
- timeline.ts, compose.ts, adapt.ts y grade.ts son funciones puras sin DOM y con pruebas.
- Textos en español de España, tal como aparecen en MODOS.md.