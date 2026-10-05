import { z } from 'zod';

import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import type { JsonObject } from '../types/json';

export type WriteMethod = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface WriteRequest {
  method: WriteMethod;
  url: string;
  body?: JsonObject;
  headers?: Record<string, string>;
  timeout?: number;
  /** Mensaje cuando el servidor no trae uno propio. */
  failMessage: string;
}

const EnvelopeSchema = z.looseObject({ data: z.unknown() });

/**
 * Único punto por el que el replay manda una escritura genérica (`httpWrite`).
 * El método y la URL los arma el REGISTRO tipado (`offline/endpoints.ts`), nunca
 * la operación guardada. Devuelve el `data` de la envoltura `{ data, message }`
 * sin validarlo — cada endpoint del registro sabe qué forma esperar.
 */
export async function sendWrite(request: WriteRequest): Promise<unknown> {
  try {
    const response = await axiosInstance.request({
      method: request.method,
      url: request.url,
      data: request.body,
      headers: request.headers,
      timeout: request.timeout,
    });
    const envelope = EnvelopeSchema.safeParse(response.data);
    return envelope.success ? envelope.data.data : undefined;
  } catch (error: unknown) {
    throw toDomainError(error, request.failMessage);
  }
}
