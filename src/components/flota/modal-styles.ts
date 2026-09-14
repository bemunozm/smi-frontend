/**
 * Clases responsive compartidas por los modales de registro de Flota
 * (`RegistrarLecturaModal`, `RegistrarCargaCombustibleModal`): en PC quedan
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
