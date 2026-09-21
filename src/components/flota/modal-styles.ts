/**
 * Clases responsive compartidas por los modales de registro de Flota
 * (`RegistrarEntradaModal`, `RegistrarSalidaModal`,
 * `RegistrarCargaCombustibleModal`): en PC quedan
 * como un modal centrado de ancho acotado; en tablet/celular ocupan todo el
 * viewport (sin bordes redondeados) para operarse cómodo con una mano en
 * terreno — el patrón "hoja a pantalla completa" pedido para esta feature.
 *
 * Se fuerza `max-h-full` en la base porque el estilo por defecto de
 * `Modal.Dialog` (`@heroui/styles`) ya trae su propio `max-height`; sin este
 * override explícito, ese valor de base gana sobre el `h-full` en mobile.
 */
export const RESPONSIVE_SHEET_DIALOG_CLASS =
  'flex h-full max-h-full w-full max-w-full flex-col rounded-none sm:h-auto sm:max-h-[85vh] sm:w-auto sm:max-w-lg sm:rounded-2xl';

/**
 * Variante ancha del sheet responsive — mismo comportamiento mobile (hoja a
 * pantalla completa), pero en PC/tablet queda un modal de ancho generoso en
 * vez del `max-w-lg` (512px) de arriba. La usa el modal de crear/editar
 * equipo (`CreateEquipoModal`/`EditEquipoModal`): con 10 campos agrupados en
 * secciones + banner de foto, `CamposEquipo` reflowa a 3 columnas en PC
 * (`xl:grid-cols-3`) — `max-w-2xl` (672px) dejaba esas 3 columnas apretadas,
 * así que se sube a `max-w-3xl` (768px) para que respiren (v3 del rediseño,
 * feedback de Benjamin: la v2 de 2 columnas se veía angosta y desordenada).
 * `overflow-hidden` es necesario acá (no en la base) porque el banner de foto
 * sangra por fuera del padding del diálogo (`-mx-6 -mt-6`, ver
 * `EquipoPhotoBanner`) y necesita quedar recortado por el radio del diálogo
 * en vez de sobresalir en las esquinas.
 */
export const RESPONSIVE_SHEET_DIALOG_WIDE_CLASS =
  'flex h-full max-h-full w-full max-w-full flex-col overflow-hidden rounded-none sm:h-auto sm:max-h-[90vh] sm:w-auto sm:max-w-3xl sm:rounded-2xl';
