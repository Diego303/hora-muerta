# Hora Muerta

Juego web de deducción lógica sobre planos. Sigues a un puñado de sospechosos hora a hora por el plano de una casa, un tren, un museo, un hotel, un barco o un teatro, hasta descubrir quién estuvo a solas con la víctima a la hora de la muerte y con qué objeto. Semiprocedural, con cientos de casos ya revisados por un solver lógico (nunca hace falta adivinar), jugable en móvil y en ordenador en sesiones de 5 a 20 minutos.

Sin librerías de UI, sin analítica ni cookies, sin peticiones de red salvo Google Fonts y los propios archivos del juego. Funciona sin conexión una vez cargado (PWA).

## Requisitos

- [Node.js](https://nodejs.org/) 20 o superior.
- [pnpm](https://pnpm.io/) 9 (el proyecto usa el lockfile de pnpm; con `corepack enable` ya queda resuelta la versión).

## Arrancar en local

```bash
pnpm install      # instala las dependencias
pnpm dev          # arranca el servidor de desarrollo (Astro) con recarga en caliente
```

Por defecto queda escuchando en `http://localhost:4321/hora-muerta/` (el proyecto se sirve bajo la ruta base `/hora-muerta/`, igual que en GitHub Pages).

## Comandos disponibles

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo con recarga en caliente. |
| `pnpm build` | Build de producción (estático) en `dist/`. |
| `pnpm preview` | Sirve el build de `dist/` tal como quedaría en producción. |
| `pnpm typecheck` | `astro check` + `tsc --noEmit` sobre app, scripts, pruebas y el Web Worker. |
| `pnpm lint` | ESLint sobre todo el proyecto. |
| `pnpm test` | Pruebas unitarias/integración con Vitest (motor, juego, banco). |
| `pnpm test:e2e` | Pruebas end-to-end con Playwright (necesita `pnpm exec playwright install` la primera vez). |
| `pnpm bank:build` | Genera el banco de casos (`public/cases/*.json`) a partir de `scripts/bank.config.ts`. |
| `pnpm bank:group <modo> <cantidad>` | Genera un solo grupo (p. ej. `comisario 5`) en paralelo, sin tocar el resto del banco. `--simulacro` no escribe nada; `BANK_JOBS=n` fija los núcleos. |
| `pnpm bank:validate` | Verifica que el banco generado pasa el solver exacto y el humano. |
| `pnpm bank:report` | Imprime un resumen del banco (recuentos por nivel, arquetipos, etc.). |

Antes de dar algo por terminado conviene pasar `pnpm typecheck && pnpm lint && pnpm test` (y `pnpm build` si el cambio toca algo que se sirve en producción).

### Generar o regenerar el banco de casos

El juego lee los casos ya generados desde `public/cases/*.json` (no genera nada en el navegador salvo en el modo infinito). Para regenerarlos:

```bash
pnpm bank:build      # genera novato/inspector/comisario/diario según scripts/bank.config.ts (en serie, tarda)
pnpm bank:group comisario 5   # regenera solo un grupo, repartido entre los núcleos
pnpm bank:validate    # comprueba unicidad y coherencia de lo generado
pnpm bank:report      # resumen legible del contenido del banco
```

Comisario e Inspector pueden tardar bastante más que Novato en generarse (el generador descarta y reintenta hasta dar con un caso que pase el solver humano); ver `docs/DECISIONES.md` para tiempos medidos.

Para revisar un caso suelto sin tocar el banco:

```bash
pnpm exec tsx scripts/print-case.ts [semilla] [0|1|2]
```

## Estructura del proyecto

```
src/
  engine/   Motor puro (sin DOM): mapas, pistas, generador, solver exacto y solver humano.
             Se usa igual en el navegador, en el Web Worker del modo infinito y en Node (scripts, pruebas).
  game/     Estado y persistencia: store del tablero, banco de casos, progresión, localStorage.
  ui/       Renderizado y eventos DOM: portada, tablero, plano, tutorial, ajustes, perfil...
  workers/  Web Worker del modo infinito (genera casos sin bloquear el hilo principal).
  styles/   CSS (sin preprocesador ni framework).
  pages/    Punto de entrada de Astro.
scripts/    Utilidades de consola: generación y validación del banco, impresión de casos sueltos.
tests/      Pruebas Vitest (engine/game/bank) y Playwright (tests/e2e).
public/cases/  Banco de casos ya generado, servido tal cual (JSON estático).
docs/       Diseño técnico, plan de trabajo y decisiones (ver abajo).
```

## Documentación del proyecto

- `docs/DISENO_TECNICO.md` — fuente de verdad del diseño; si el código y el documento discrepan, manda el documento.
- `docs/PLAN.md` — plan de trabajo y estado de los hitos.
- `docs/DECISIONES.md` — decisiones tomadas ante ambigüedades del diseño, con el motivo de cada una.
- `docs/referencia/` — prototipos de referencia (motor, plano, estilos y textos de v1).
- `CLAUDE.md` — reglas intocables del proyecto (una puerta por hora, el culpable a solas con la víctima, un objeto por sospechoso, lógica pura sin adivinar, etc.).

## Despliegue

El sitio se despliega en GitHub Pages al hacer push a `main` (`.github/workflows/astro.yaml`), con `pnpm build` bajo la ruta base `/hora-muerta/` configurada en `astro.config.mjs`. No hace falta ningún paso manual aparte de fusionar a `main`.
