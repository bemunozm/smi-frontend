import axios from 'axios';
import { ZodError } from 'zod';

import { axiosInstance } from '../lib/axios';
import {
  ActividadListResponseSchema,
  ActividadResponseSchema,
  IntervencionListResponseSchema,
  IntervencionResponseSchema,
  OrdenTrabajoListResponseSchema,
  OrdenTrabajoResponseSchema,
  TareaResponseSchema,
  UmbralListResponseSchema,
  UmbralResponseSchema,
  type Actividad,
  type CreateActividadInput,
  type CreateIntervencionInput,
  type CreateOrdenInput,
  type CreateUmbralInput,
  type EstadoOT,
  type Intervencion,
  type OrdenTrabajo,
  type Tarea,
  type Umbral,
  type UpdateActividadInput,
  type UpdateOrdenInput,
} from '../types/mantenimiento';

/**
 * Extrae `message` del body `{ data, message }` que el backend devuelve
 * incluso en 4xx/5xx — mismo helper que `api/UserAPI.ts#extractBackendMessage`,
 * duplicado a propósito acá (cada módulo de dominio es responsable de su
 * propio `toDomainError`, ver comentario de `UserAPI.ts`).
 */
function extractBackendMessage(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('message' in data)) {
    return undefined;
  }
  const raw = (data as { message?: unknown }).message;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : undefined;
}

/**
 * `toDomainError` propio del módulo Mantenimiento — misma lógica que
 * `UserAPI.ts#toDomainError`: prioriza el mensaje del backend, luego un
 * fallback amigable, nunca el texto técnico de axios. `ZodError` señala un
 * desajuste de contrato con `types/mantenimiento.ts`, no un error de red.
 */
function toDomainError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0]?.message ?? 'formato inesperado';
    return new Error(`Respuesta de /mantenimiento inválida: ${firstIssue}`);
  }
  if (axios.isAxiosError(error)) {
    const backendMessage = extractBackendMessage(error.response?.data);
    return new Error(backendMessage ?? fallbackMessage);
  }
  if (error instanceof Error) {
    return new Error(error.message);
  }
  return new Error(fallbackMessage);
}

// ---------------------------------------------------------------------------
// Órdenes de trabajo
// ---------------------------------------------------------------------------

async function listOrdenes(estado?: EstadoOT): Promise<OrdenTrabajo[]> {
  try {
    const response = await axiosInstance.get('/api/mantenimiento/ordenes', {
      params: estado ? { estado } : undefined,
    });
    return OrdenTrabajoListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener la lista de órdenes de trabajo.');
  }
}

async function getOrdenById(id: string): Promise<OrdenTrabajo> {
  try {
    const response = await axiosInstance.get(`/api/mantenimiento/ordenes/${id}`);
    return OrdenTrabajoResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, `No se pudo obtener la orden de trabajo "${id}".`);
  }
}

async function createOrden(input: CreateOrdenInput): Promise<OrdenTrabajo> {
  try {
    const response = await axiosInstance.post('/api/mantenimiento/ordenes', input);
    return OrdenTrabajoResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo crear la orden de trabajo.');
  }
}

async function updateOrden(id: string, input: UpdateOrdenInput): Promise<OrdenTrabajo> {
  try {
    const response = await axiosInstance.patch(`/api/mantenimiento/ordenes/${id}`, input);
    return OrdenTrabajoResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, `No se pudo actualizar la orden de trabajo "${id}".`);
  }
}

/**
 * PATCH de una tarea puntual de la OT. El backend responde con la tarea
 * actualizada (`{ data: Tarea, message }`), no con la OT completa;
 * `useToggleTarea` invalida `['ordenes']`, que es la fuente de verdad real.
 */
async function toggleTarea(ordenId: string, tareaId: string, hecha: boolean): Promise<Tarea> {
  try {
    const response = await axiosInstance.patch(
      `/api/mantenimiento/ordenes/${ordenId}/tareas/${tareaId}`,
      { hecha },
    );
    return TareaResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo actualizar la tarea.');
  }
}

export const OrdenesAPI = {
  list: listOrdenes,
  getById: getOrdenById,
  create: createOrden,
  update: updateOrden,
  toggleTarea,
};

// ---------------------------------------------------------------------------
// Intervenciones (bitácora de una OT)
// ---------------------------------------------------------------------------

async function listIntervenciones(ordenId: string): Promise<Intervencion[]> {
  try {
    const response = await axiosInstance.get(`/api/mantenimiento/ordenes/${ordenId}/intervenciones`);
    return IntervencionListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener la bitácora de la orden de trabajo.');
  }
}

async function createIntervencion(ordenId: string, input: CreateIntervencionInput): Promise<Intervencion> {
  try {
    const response = await axiosInstance.post(
      `/api/mantenimiento/ordenes/${ordenId}/intervenciones`,
      input,
    );
    return IntervencionResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo registrar la intervención.');
  }
}

export const IntervencionesAPI = {
  list: listIntervenciones,
  create: createIntervencion,
};

// ---------------------------------------------------------------------------
// Umbrales preventivos
// ---------------------------------------------------------------------------

async function listUmbrales(): Promise<Umbral[]> {
  try {
    const response = await axiosInstance.get('/api/mantenimiento/umbrales');
    return UmbralListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener la lista de umbrales.');
  }
}

async function createUmbral(input: CreateUmbralInput): Promise<Umbral> {
  try {
    const response = await axiosInstance.post('/api/mantenimiento/umbrales', input);
    return UmbralResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo crear el umbral.');
  }
}

export const UmbralesAPI = {
  list: listUmbrales,
  create: createUmbral,
};

// ---------------------------------------------------------------------------
// Actividades
// ---------------------------------------------------------------------------

async function listActividades(): Promise<Actividad[]> {
  try {
    const response = await axiosInstance.get('/api/mantenimiento/actividades');
    return ActividadListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener la lista de actividades.');
  }
}

async function createActividad(input: CreateActividadInput): Promise<Actividad> {
  try {
    const response = await axiosInstance.post('/api/mantenimiento/actividades', input);
    return ActividadResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo crear la actividad.');
  }
}

async function updateActividad(id: string, input: UpdateActividadInput): Promise<Actividad> {
  try {
    const response = await axiosInstance.patch(`/api/mantenimiento/actividades/${id}`, input);
    return ActividadResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, `No se pudo actualizar la actividad "${id}".`);
  }
}

export const ActividadesAPI = {
  list: listActividades,
  create: createActividad,
  update: updateActividad,
};
