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