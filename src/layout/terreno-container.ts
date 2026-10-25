/**
 * Ancho del contenido. Lo comparten el header, el `main` y la barra inferior
 * para que el título, el formulario y las pestañas queden en la misma columna.
 *
 * En teléfono y tablet ocupa la pantalla, hasta 672 px (768 desde `md`). No hay un tope de
 * teléfono (448 px) debajo de `sm`: la tablet de faena mide ~600 px CSS en
 * vertical y quedaba encajonada como un celular. Desde
 * `lg` se ensancha para las dos columnas —formulario e historial— que arman las
 * vistas: el formulario conserva su ancho y el sobrante se lo lleva la tabla.
 *
 * El techo igual existe: sin él, en un monitor de 1920 el formulario quedaría
 * de punta a punta, que es tan malo como la columna angosta pero al revés.
 */
export const CONTAINER =
  'mx-auto w-full max-w-2xl px-4 md:max-w-3xl lg:max-w-6xl xl:max-w-[1440px] 2xl:max-w-[1680px]';
