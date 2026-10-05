/**
 * Ancho del contenido. Lo comparten el header, el `main` y la barra inferior
 * para que el título, el formulario y las pestañas queden en la misma columna.
 *
 * En teléfono son los mismos 448 px de siempre: es la pantalla donde se opera
 * en faena y no se toca. Desde `sm` el módulo deja de estar encajonado, y desde
 * `lg` se ensancha para las dos columnas —formulario e historial— que arman las
 * vistas: el formulario conserva su ancho y el sobrante se lo lleva la tabla.
 *
 * El techo igual existe: sin él, en un monitor de 1920 el formulario quedaría
 * de punta a punta, que es tan malo como la columna angosta pero al revés.
 */
export const CONTAINER =
  'mx-auto w-full max-w-md px-4 sm:max-w-2xl lg:max-w-6xl xl:max-w-[1440px] 2xl:max-w-[1680px]';
