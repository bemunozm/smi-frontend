import type { AxiosRequestConfig } from 'axios';

import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import { EntradaCambiosListResponseSchema, type EntradaCambios } from '../types/cambios';
import {
  ShiftCardListResponseSchema,
  ShiftCardWrapperSchema,
  ShiftSummaryListResponseSchema,
  type AdminCloseShiftCardInput,
  type CloseShiftCardInput,
  type OpenShiftCardInput,
  type RegisterClosedShiftCardInput,
  type ShiftCardResponse,
  type ShiftSummary,
  type ShiftType,
} from '../types/shift';

/**
 * Abre una tarjeta de turno (Módulo A). Idempotente por `input.id` (UUID
 * generado en el CLIENTE, ver `lib/uuid.ts`): reintentar la MISMA request
 * devuelve la misma tarjeta en vez de fallar o duplicar — clave para el
 * flujo offline (`offline/replay.ts`). Los errores de negocio
 * (`EQUIPMENT_BUSY`, `EQUIPMENT_NOT_OPERATIONAL`, `OPERATOR_INACTIVE`,
 * `ID_CONFLICT`, `INVALID_CAPTURE_TIME`) llegan con `code` — ver
 * `lib/api-error.ts#DomainError` y `hooks/useShiftCards.ts`.
 *
 * `config` es opcional: el replay offline lo usa para mandar un timeout de
 * 20 s y el header `X-Client-Time` en cada reintento (ver
 * `offline/replay.ts`) sin duplicar esta función — la llamada en línea
 * (`hooks/useShiftRegister.ts`, vía el outbox) no lo necesita y lo omite.
 */
async function openCard(input: OpenShiftCardInput, config?: AxiosRequestConfig): Promise<ShiftCardResponse> {
  try {
    const response = await axiosInstance.post('/api/shift-cards', input, config);
    return ShiftCardWrapperSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo abrir la tarjeta de turno.');
  }
}

/**
 * Cierra una tarjeta abierta. Idempotente por `input.closeClientId` (UUID
 * DISTINTO del `id` de apertura). Errores de negocio: `ALREADY_CLOSED`,
 * `NOT_OWNER`, `HOURMETER_BELOW_INITIAL`, `TMP_KEY_EXPIRED`. Mismo `config`
 * opcional que `openCard` — ver ese comentario.
 */
async function closeCard(
  id: string,
  input: CloseShiftCardInput,
  config?: AxiosRequestConfig,
): Promise<ShiftCardResponse> {
  try {
    const response = await axiosInstance.post(`/api/shift-cards/${id}/close`, input, config);
    return ShiftCardWrapperSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo cerrar la tarjeta de turno.');
  }
}

/**
 * Corrige una tarjeta ya enviada (`PATCH /api/shift-cards/:id`) — versión
 * ONLINE directa para el panel admin (p. ej. corregir los litros de una carga
 * nacida del cierre, desde Cargas de combustible). El flujo de Terreno edita
 * por el outbox (`shiftCard.edit`), no por acá. `expected` viaja como
 * `X-Expected` (precondición por campo, mismo contrato que el outbox:
 * JSON `encodeURIComponent`-eado para tolerar texto no Latin-1) — sin él, el
 * backend aplica sin chequear pisadas.
 */
async function updateCard(
  id: string,
  body: Partial<
    Pick<
      ShiftCardResponse,
      'operatorId' | 'valorInicial' | 'valorFinal' | 'fuelLiters' | 'adBlue' | 'adBlueLiters' | 'observaciones'
    >
  >,
  expected?: Record<string, unknown>,
): Promise<ShiftCardResponse> {
  try {
    const response = await axiosInstance.patch(`/api/shift-cards/${encodeURIComponent(id)}`, body, {
      ...(expected ? { headers: { 'X-Expected': encodeURIComponent(JSON.stringify(expected)) } } : {}),
    });
    return ShiftCardWrapperSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo guardar el cambio de la tarjeta.');
  }
}

/**
 * Registra un turno PASADO como tarjeta que nace cerrada (backfill, ver
 * `offline/outbox.ts#enqueueClosedCard`). Idempotente por `input.id`.
 * Errores de negocio: `SHIFT_NOT_FINISHED` (el turno aún no termina),
 * `CHECKLIST_NOT_ACCEPTED`, `HOURMETER_BELOW_INITIAL`, `TMP_KEY_EXPIRED`,
 * `ID_CONFLICT`. Mismo `config` opcional que `openCard`.
 */
async function registerClosedCard(
  input: RegisterClosedShiftCardInput,
  config?: AxiosRequestConfig,
): Promise<ShiftCardResponse> {
  try {
    const response = await axiosInstance.post('/api/shift-cards/closed', input, config);
    return ShiftCardWrapperSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo registrar el turno pasado en el equipo.');
  }
}

/** Tarjetas propias: abiertas + cerradas en las últimas 48 h. Quién ve qué
 * (SUPERVISOR: las suyas; ADMIN: todas) lo decide el backend, no este
 * archivo — ver `hooks/useShiftRegister.ts#veTodo`, que solo cambia el
 * copy, no el filtrado. */
async function listMine(): Promise<ShiftCardResponse[]> {
  try {
    const response = await axiosInstance.get('/api/shift-cards/mine');
    return ShiftCardListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener las tarjetas del turno.');
  }
}

/** Quién cambió qué de una tarjeta, del cambio más reciente al más viejo. */
async function listChanges(id: string): Promise<EntradaCambios[]> {
  try {
    const response = await axiosInstance.get(`/api/shift-cards/${encodeURIComponent(id)}/changes`);
    return EntradaCambiosListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo cargar el historial de cambios.');
  }
}

/**
 * Turnos de una fecha y tipo (`GET /api/shifts?date&type` — la "lista viva"
 * compartida con el Módulo B). SUPERVISOR ve los suyos; ADMIN todos. Lo usa
 * el modo "registrar un turno pasado" para avisar qué tiene ya ese turno.
 */
async function listShiftsByDate(date: string, type: ShiftType): Promise<ShiftSummary[]> {
  try {
    const response = await axiosInstance.get('/api/shifts', { params: { date, type } });
    return ShiftSummaryListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo consultar el turno elegido.');
  }
}

/**
 * El administrador cierra un uso que quedó colgado (`POST
 * /api/shift-cards/:id/admin-close`): sin foto ni combustible, con la lectura
 * final y el motivo. El servidor también suelta la asignación del equipo.
 * Online directo — es una acción del panel, no de terreno.
 */
async function adminCloseCard(id: string, input: AdminCloseShiftCardInput): Promise<ShiftCardResponse> {
  try {
    const response = await axiosInstance.post(`/api/shift-cards/${id}/admin-close`, input);
    return ShiftCardWrapperSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo cerrar el uso del equipo.');
  }
}

export const ShiftCardAPI = {
  listChanges,
  openCard,
  closeCard,
  adminCloseCard,
  registerClosedCard,
  updateCard,
  listMine,
  listShiftsByDate,
};
