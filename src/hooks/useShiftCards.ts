import { useQuery } from '@tanstack/react-query';

import { ShiftCardAPI } from '../api/ShiftCardAPI';
import { DomainError, OPERATOR_INACTIVE_MESSAGE } from '../lib/api-error';

export const SHIFT_CARDS_MINE_KEY = ['shift-cards', 'mine'] as const;

/**
 * Tarjetas propias del Módulo A — SIN filtros en la key: es la misma URL
 * estable (`GET /api/shift-cards/mine`) que expone el backend, cacheada
 * offline (Workbox `smi-api`, ver `vite.config.ts`) para el arranque en
 * frío sin señal (RFC "Supervisión en Terreno" §Diseño → Offline).
 */
export function useShiftCardsMine() {
  return useQuery({
    queryKey: SHIFT_CARDS_MINE_KEY,
    queryFn: ShiftCardAPI.listMine,
  });
}

const CODE_MESSAGES: Partial<Record<string, string>> = {
  OPERATOR_INACTIVE: OPERATOR_INACTIVE_MESSAGE,
  ID_CONFLICT: 'Ya existe una tarjeta con ese identificador. Reintentá la acción.',
  INVALID_CAPTURE_TIME: 'La hora del registro no es válida — revisá la hora del equipo.',
  ALREADY_CLOSED: 'Esa tarjeta ya estaba cerrada.',
  NOT_OWNER: 'No podés cerrar una tarjeta de otro supervisor.',
  HOURMETER_BELOW_INITIAL: 'El horómetro final no puede ser menor que el inicial.',
  TMP_KEY_EXPIRED: 'La foto expiró antes de guardarse — volvé a tomarla y reintentá.',
  // Fase 5 (revisión offline) — códigos nuevos del backend/del propio replay.
  INVALID_SHIFT_DATE: 'La fecha del turno no es válida — revisá la fecha y la hora del equipo.',
  REPORT_RATE_LIMITED: 'Se mandaron demasiados reportes seguidos — esperá unos minutos y reintentá.',
  PHOTO_MISSING: 'Falta la foto guardada para este cierre — descartalo y volvé a cerrar la tarjeta.',
  INVALID_RESPONSE: 'Respuesta inesperada del servidor — reintentá más tarde o avisá si sigue pasando.',
  // `nextPendingOp` (`offline/replay.ts`) ya evita mandar un cierre mientras
  // su apertura sigue en `needs_attention` — este código cubre cualquier
  // otro camino que igual llegue a un cierre sin apertura en el servidor
  // (ej. la apertura se descartó por otro medio, o una carrera puntual).
  CARD_NOT_FOUND: 'La tarjeta no existe en el servidor (su apertura no llegó). Revisá la apertura pendiente o descartá este cierre.',
};

/**
 * Mensaje amigable para un error de `ShiftCardAPI`/`ShiftReportAPI`.
 * `EQUIPMENT_BUSY` y `EQUIPMENT_NOT_OPERATIONAL` NO están en
 * `CODE_MESSAGES` a propósito: el backend ya arma un mensaje específico y
 * útil para esos dos —con quién y desde cuándo, en el caso de
 * `EQUIPMENT_BUSY` (ver `shifts.service.ts#openCard`)—, así que se muestra
 * `error.message` tal cual en vez de taparlo con un texto genérico.
 *
 * También la usa `offline/replay.ts` para el `lastError.message` que
 * persiste en el outbox (`needs_attention`) — mismo texto que vería el
 * supervisor si la acción hubiera fallado en línea, ver ese archivo.
 */
export function mensajeErrorTarjeta(error: unknown): string {
  if (error instanceof DomainError && error.code) {
    const mensaje = CODE_MESSAGES[error.code];
    if (mensaje) return mensaje;
  }
  return error instanceof Error ? error.message : 'No se pudo completar la operación.';
}
