import type { AxiosRequestConfig } from 'axios';

import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  ShiftCardListResponseSchema,
  ShiftCardWrapperSchema,
  type CloseShiftCardInput,
  type OpenShiftCardInput,
  type ShiftCardResponse,
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

export const ShiftCardAPI = {
  openCard,
  closeCard,
  listMine,
};
