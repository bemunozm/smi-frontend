// Estilo de tabla «pizarra» (la de Mantenciones), compartido por las tablas que
// lo usan: cabecera en bloques con degradado azul y columnas alternadas en gris.

// Columnas alternadas (gris desde la primera) por índice lógico de columna, no por `nth-child`, para no depender de
// cuántas celdas trae cada fila. Las celdas de HeroUI traen fondo propio con más especificidad, por eso el gris va
// con `!` y solo si la fila no está en hover; el hover verde (tinte del token success) va sobre todas las celdas de
// la fila y le gana al gris. El relieve (luz arriba, sombra fina abajo y a la derecha) separa cada celda sin rayar.
export const CEBRA_COLUMNAS =
  '[&_td]:border-b-0! [&_td]:shadow-pizarra-celda [&:not(:hover)_td[data-gris]]:bg-default/70! hover:[&_td]:bg-success/15!';

/** Columnas pares (0, 2, 4…) en gris. */
export const fondoColumna = (indice: number) => (indice % 2 === 0 ? { 'data-gris': '' } : {});

// Cabecera tipo tabla de precios: cada columna es un bloque propio (degradado de azul oscuro a azul claro,
// texto blanco en negrita, esquinas de arriba redondeadas y relieve). El borde blanco a los lados hace de separación
// entre bloques; `z-1` deja la sombra por encima de la primera fila del cuerpo. El `::after` es la rayita separadora
// de HeroUI, que acá sobra.
const BLOQUE_CABECERA =
  'z-1 border-x-2 border-surface rounded-t-lg! rounded-b-none! py-3! text-xs font-bold! text-white! shadow-pizarra-cabecera after:hidden';

/** Los nueve pasos del degradado (tokens de `index.css`), escritos enteros para que Tailwind los encuentre. */
const COLOR_CABECERA = [
  'bg-pizarra-1!',
  'bg-pizarra-2!',
  'bg-pizarra-3!',
  'bg-pizarra-4!',
  'bg-pizarra-5!',
  'bg-pizarra-6!',
  'bg-pizarra-7!',
  'bg-pizarra-8!',
  'bg-pizarra-9!',
] as const;

/** Clases del bloque de cabecera en el paso `paso` (0 a 8) del degradado. */
export const cabecera = (paso: number) => `${BLOQUE_CABECERA} ${COLOR_CABECERA[paso]}`;

/**
 * Cabecera de la columna `indice` de una tabla de `total` columnas: reparte los
 * pasos para que cualquier tabla recorra el degradado completo.
 */
export const cabeceraDe = (indice: number, total: number) =>
  cabecera(total <= 1 ? 0 : Math.round((indice * (COLOR_CABECERA.length - 1)) / (total - 1)));
