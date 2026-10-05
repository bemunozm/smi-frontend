import { DomainError, OPERATOR_INACTIVE_MESSAGE } from './api-error';
import type { ErrorCode } from '../types/error-codes';

/**
 * Mensaje amigable por `code` de negocio — única fuente para Tarjetas de
 * turno (`hooks/useShiftCards.ts`), asignación de equipos
 * (`hooks/useEquipment.ts`), Trabajos extra (`hooks/useTrabajosExtra.ts`) y
 * el outbox offline (`offline/replay.ts`, `lastError.message`): mismo texto
 * en todos lados para el mismo caso de negocio, en vez de redactarlo cuatro
 * veces.
 *
 * `EQUIPMENT_BUSY`, `EQUIPMENT_NOT_OPERATIONAL` y `OPERATOR_IN_USE` NO están
 * acá a propósito: el backend ya arma un mensaje específico y útil para esos
 * tres —con quién y desde cuándo, en el caso de `EQUIPMENT_BUSY` (ver
 * `shifts.service.ts#openCard`), o qué hacer en su lugar, en el de
 * `OPERATOR_IN_USE`—, así que se muestra `error.message` tal cual en vez de
 * taparlo con un texto genérico (ver `mensajeErrorOperacion` más abajo).
 */
export const ERROR_MESSAGES: Partial<Record<ErrorCode, string>> = {
  OPERATOR_INACTIVE: OPERATOR_INACTIVE_MESSAGE,
  ID_CONFLICT: 'Ya existe un registro con ese identificador. Descartá este registro en Sincronización y volvé a crearlo.',
  INVALID_CAPTURE_TIME: 'La hora del registro no es válida — revisá la hora del equipo.',
  // Cierre en cola desde Registro de turno cuya tarjeta ya cerró otra
  // persona (ej. el administrador, desde Flota) antes de que la
  // sincronización llegara: los litros y la foto que se registraron acá NO
  // se enviaron — el cierre queda rechazado, pero la carga de combustible
  // se puede registrar aparte (ver `RegistrarSalidaModal`, que avisa lo
  // mismo de antemano cuando la tarjeta tiene un turno de Terreno).
  ALREADY_CLOSED:
    'Otra persona (por ejemplo, el administrador desde Flota) ya cerró esta tarjeta. Los litros y la foto que registraste acá no se enviaron — podés registrar la carga de combustible por separado.',
  NOT_OWNER: 'No podés cerrar ni modificar una tarjeta de otro supervisor.',
  HOURMETER_BELOW_INITIAL: 'El horómetro final no puede ser menor que el inicial.',
  // Edición en cola (`PATCH`): otra persona cambió esos mismos datos entre que
  // se guardó la edición y que llegó al servidor.
  STALE_UPDATE:
    'Otra persona cambió estos datos mientras tanto. Elegí Sobrescribir para aplicar tu cambio igual, o Descartar para quedarte con lo que hay.',
  CARD_NOT_CLOSED:
    'La tarjeta todavía está abierta: el horómetro final, los litros y el AdBlue se editan una vez cerrada.',
  TMP_KEY_EXPIRED: 'La foto expiró antes de guardarse — volvé a tomarla y reintentá.',
  INVALID_SHIFT_DATE: 'La fecha del turno no es válida — revisá la fecha y la hora del equipo.',
  REPORT_RATE_LIMITED: 'Se mandaron demasiados reportes seguidos — esperá unos minutos y reintentá.',
  // Cliente: ver `offline/replay.ts#uploadOpPhoto`/`lib/api-error.ts#toDomainError`.
  PHOTO_MISSING: 'Falta la foto guardada de este registro — descartalo y volvé a registrarlo.',
  INVALID_RESPONSE: 'Respuesta inesperada del servidor — reintentá más tarde o avisá si sigue pasando.',
  STORAGE_FULL: 'No hay espacio en el equipo para guardar esto. Liberá espacio o sincronizá lo pendiente y reintentá.',
  FILE_TOO_LARGE: 'El archivo supera el máximo de 8 MB.',
  FILE_TYPE_NOT_ALLOWED: 'Formato no permitido. Solo se aceptan JPG, PNG, WebP o PDF.',
  INSUFFICIENT_STOCK:
    'No hay existencia suficiente en la bodega para esta salida. Revisá el saldo y registrá una cantidad menor.',
  ENDPOINT_NOT_QUEUEABLE: 'Esta operación no se puede guardar para enviar después.',
  // `nextPendingOp` (`offline/replay.ts`) ya evita mandar un cierre mientras
  // su apertura sigue en `needs_attention` — este código cubre cualquier
  // otro camino que igual llegue a un cierre sin apertura en el servidor
  // (ej. la apertura se descartó por otro medio, o una carrera puntual).
  CARD_NOT_FOUND:
    'La tarjeta no existe en el servidor (su apertura no llegó). Revisá la apertura pendiente o descartá este cierre.',
  // El turno de esta tarjeta ya se cerró por otra vía (ej. el ADMIN cerró la
  // salida desde Flota en vez de desde Registro de turno) — un cierre en
  // cola contra esa tarjeta ya no tiene nada que cerrar.
  SHIFT_CARD_CLOSE_ELSEWHERE:
    'Esta tarjeta se cerró por otra vía antes de sincronizar. Este cierre pendiente ya no se puede aplicar — descartalo y revisá la tarjeta.',
  NO_CARDS: 'No hay tarjetas para incluir en el reporte de salida — abrí o cerrá al menos un equipo antes de enviarlo.',
  SHIFT_NOT_FOUND:
    'El turno de este reporte no existe en el servidor — revisá la fecha y el tipo de turno, o descartá y reintentá.',
};

/**
 * Mensaje amigable para un error de dominio de Tarjetas de turno, asignación
 * de equipos o Trabajos extra. `fallback` cubre el caso ultra raro en que
 * `error` no sea ni un `DomainError` con `code` mapeado ni un `Error` común
 * (`toDomainError`, `lib/api-error.ts`, garantiza que todo lo que sale de un
 * `api/<X>API.ts` es un `Error` con `.message` ya resuelto — así que esta
 * rama casi nunca se ejercita en la práctica).
 */
export function mensajeErrorOperacion(error: unknown, fallback = 'No se pudo completar la operación.'): string {
  if (error instanceof DomainError && error.code) {
    const mensaje = ERROR_MESSAGES[error.code as ErrorCode];
    if (mensaje) return mensaje;
  }
  return error instanceof Error ? error.message : fallback;
}

/**
 * Mensajes para un error que sale en un FORMULARIO de oficina, mientras la
 * persona sigue mirándolo: la operación ya se descartó de la cola, así que las
 * instrucciones de la hoja de sincronización ("Sobrescribir", "Descartá este
 * registro en Sincronización") no existen para ella. Sin override cae en
 * `mensajeErrorOperacion`.
 */
const MENSAJES_DE_FORMULARIO: Partial<Record<ErrorCode, string>> = {
  STALE_UPDATE:
    'Otra persona cambió estos datos mientras tanto. Actualizá la pantalla, revisá los valores y volvé a guardar.',
  ID_CONFLICT: 'No se pudo guardar: ese registro ya existe. Intentá de nuevo.',
  // Cierre de turno desde Flota (`PATCH /horometro/:id/salida`).
  ALREADY_CLOSED: 'Este turno ya fue cerrado por otra persona. Actualizá la pantalla para ver su estado.',
  CARD_NOT_FOUND: 'El turno que intentás cerrar ya no existe. Actualizá la pantalla.',
  SHIFT_CARD_CLOSE_ELSEWHERE:
    'Esta tarjeta es de Registro de turno: la cierra el supervisor desde Terreno, no desde Flota.',
};

export function mensajeErrorFormulario(error: unknown, fallback = 'No se pudo completar la operación.'): string {
  if (error instanceof DomainError && error.code) {
    const mensaje = MENSAJES_DE_FORMULARIO[error.code as ErrorCode];
    if (mensaje) return mensaje;
  }
  return mensajeErrorOperacion(error, fallback);
}
