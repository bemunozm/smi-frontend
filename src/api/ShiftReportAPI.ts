import type { AxiosRequestConfig } from 'axios';

import { axiosInstance } from '../lib/axios';
import { env } from '../config/env';
import { toDomainError } from '../lib/api-error';
import {
  ShiftReportWrapperSchema,
  type SendExitReportInput,
  type ShiftReportResponse,
} from '../types/shift';

/**
 * Reporte de salida de turno (Módulo A, backend Fase 3). Idempotente por
 * `input.id` (UUID generado en el CLIENTE, mismo criterio que
 * `ShiftCardAPI#openCard`) — clave para el outbox offline (Fase 5, ver
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

/**
 * URL de descarga (`GET /api/shift-reports/:id/file`, 302 a una URL
 * firmada) — un `<a target="_blank">` directo, no un `fetch` desde acá: el
 * backend exige la cookie de sesión (ADMIN o quien lo creó) y el navegador
 * ya la manda sola en la navegación.
 */
function fileUrl(id: string): string {
  return `${env.apiUrl}/api/shift-reports/${id}/file`;
}

export const ShiftReportAPI = {
  sendExitReport,
  fileUrl,
};
