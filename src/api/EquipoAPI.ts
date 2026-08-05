import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  DeleteEquipoResponseSchema,
  EquipoDetalleResponseSchema,
  EquipoListResponseSchema,
  EquipoResponseSchema,
  ResumenFlotaResponseSchema,
  type CreateEquipoInput,
  type Equipo,
  type EquipoDetalle,
  type EstadoEquipo,
  type ResumenFlota,
  type UpdateEquipoInput,
} from '../types/equipo';

export interface EquipoFiltros {
  estado?: EstadoEquipo;
  tipo?: string;
  q?: string;
}

async function list(filtros: EquipoFiltros = {}): Promise<Equipo[]> {
  try {
    // El backend corre con `forbidNonWhitelisted`: un filtro `undefined` que
    // axios serializara como `?q=` haría fallar la request, así que solo se
    // mandan las claves con valor.
    const params = Object.fromEntries(
      Object.entries(filtros).filter(([, value]) => value !== undefined && value !== ''),
    );
    const response = await axiosInstance.get('/api/equipos', { params });
    return EquipoListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener la lista de equipos.');
  }
}

async function resumen(): Promise<ResumenFlota> {
  try {
    const response = await axiosInstance.get('/api/equipos/resumen');
    return ResumenFlotaResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener el resumen de la flota.');
  }
}

async function getById(id: string): Promise<EquipoDetalle> {
  try {
    const response = await axiosInstance.get(`/api/equipos/${id}`);
    return EquipoDetalleResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener la ficha del equipo.');
  }
}

async function create(input: CreateEquipoInput): Promise<Equipo> {
  try {
    const response = await axiosInstance.post('/api/equipos', input);
    return EquipoResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo crear el equipo.');
  }
}

async function update(id: string, input: UpdateEquipoInput): Promise<Equipo> {
  try {
    const response = await axiosInstance.patch(`/api/equipos/${id}`, input);
    return EquipoResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo actualizar el equipo.');
  }
}

/** Endpoint aparte del PATCH general: lo puede usar también el SUPERVISOR. */
async function updateEstado(id: string, estado: EstadoEquipo): Promise<Equipo> {
  try {
    const response = await axiosInstance.patch(`/api/equipos/${id}/estado`, { estado });
    return EquipoResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo actualizar el estado del equipo.');
  }
}

async function remove(id: string): Promise<void> {
  try {
    const response = await axiosInstance.delete(`/api/equipos/${id}`);
    DeleteEquipoResponseSchema.parse(response.data);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo eliminar el equipo.');
  }
}

export const EquipoAPI = {
  list,
  resumen,
  getById,
  create,
  update,
  updateEstado,
  remove,
};
