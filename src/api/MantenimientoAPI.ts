import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  ActividadListResponseSchema,
  IntervencionListResponseSchema,
  OrdenTrabajoListResponseSchema,
  OrdenTrabajoResponseSchema,
  UmbralListResponseSchema,
  type Actividad,
  type EstadoOT,
  type Intervencion,
  type OrdenTrabajo,
  type Umbral,
} from '../types/mantenimiento';

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

export const OrdenesAPI = {
  list: listOrdenes,
  getById: getOrdenById,
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

export const IntervencionesAPI = {
  list: listIntervenciones,
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

export const UmbralesAPI = {
  list: listUmbrales,
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

export const ActividadesAPI = {
  list: listActividades,
};
