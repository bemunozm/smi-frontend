import type { AxiosRequestConfig } from 'axios';

import { axiosInstance } from '../lib/axios';
import { env } from '../config/env';
import { toDomainError } from '../lib/api-error';
import {
  DeleteShiftReportResponseSchema,
  ShiftReportFileUrlResponseSchema,
  ShiftCardListResponseSchema,
  ShiftReportListResponseSchema,
  ShiftReportWrapperSchema,
  type SendExitReportInput,
  type ShiftCardResponse,
  type ShiftReportListItem,
  type ShiftReportResponse,
} from '../types/shift';

/**
 * Reporte de salida de turno (Módulo A). Idempotente por
 * `input.id` (UUID generado en el CLIENTE, mismo criterio que
 * `ShiftCardAPI#openCard`) — clave para el outbox offline (ver
 * `offline/outbox.ts#enqueueExitReport` / `offline/replay.ts`), que es el
 * ÚNICO llamador real: la vista nunca llama a esto directo (ver
 * `hooks/useShiftRegister.ts#enviarReporte`).
 *
 * `config` opcional, mismo patrón que `ShiftCardAPI` — el replay manda
 * timeout de 20 s + `X-Client-Time`.
 */
async function sendExitReport(
  input: SendExitReportInput,
  config?: AxiosRequestConfig,
): Promise<ShiftReportResponse> {
  try {
    const response = await axiosInstance.post('/api/shift-reports', input, config);
    return ShiftReportWrapperSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo enviar el reporte de salida.');
  }
}

/** Registro completo de reportes (`GET /api/shift-reports`, solo ADMIN) —
 * alimenta la vista «Reportes» del administrador. */
async function list(): Promise<ShiftReportListItem[]> {
  try {
    const response = await axiosInstance.get('/api/shift-reports');
    return ShiftReportListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo cargar los reportes de salida.');
  }
}

/** Las tarjetas del turno de un reporte (`GET /api/shift-reports/:id/cards`,
 * ADMIN y SECRETARIA) — «Ver registro» del Informe diario equipos. */
async function cards(id: string): Promise<ShiftCardResponse[]> {
  try {
    const response = await axiosInstance.get(`/api/shift-reports/${id}/cards`);
    return ShiftCardListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo cargar el registro del turno.');
  }
}

/** Borra un reporte de salida (`DELETE /api/shift-reports/:id`, solo ADMIN):
 * para envíos duplicados. Las tarjetas del turno no se tocan; el borrado queda
 * en el Registro de actividad. */
async function remove(id: string): Promise<void> {
  try {
    const response = await axiosInstance.delete(`/api/shift-reports/${encodeURIComponent(id)}`);
    DeleteShiftReportResponseSchema.parse(response.data);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo eliminar el reporte.');
  }
}

/**
 * URL de descarga (`GET /api/shift-reports/:id/file`, 302 a una URL
 * firmada) — un `<a target="_blank">` directo, no un `fetch` desde acá: el
 * backend exige la cookie de sesión (ADMIN o quien lo creó) y el navegador
 * ya la manda sola en la navegación.
 */
function fileUrl(id: string): string {
  return `${env.apiUrl}/api/shift-reports/${id}/file`;
}

/**
 * URL firmada del PDF en JSON (`GET /api/shift-reports/:id/file-url`). Se pide
 * ANTES de abrir la pestaña: si el reporte ya no existe (se borró por
 * duplicado) el 404 se muestra como aviso en la app, no como la página cruda
 * `{"data":null,"message":"Reporte no encontrado"}`.
 */
async function signedFileUrl(id: string): Promise<string> {
  try {
    const res = await axiosInstance.get(`/api/shift-reports/${encodeURIComponent(id)}/file-url`);
    return ShiftReportFileUrlResponseSchema.parse(res.data).data.url;
  } catch (error) {
    throw toDomainError(error, 'No se pudo abrir el PDF del reporte.');
  }
}

export const ShiftReportAPI = {
  sendExitReport,
  list,
  cards,
  remove,
  fileUrl,
  signedFileUrl,
};
