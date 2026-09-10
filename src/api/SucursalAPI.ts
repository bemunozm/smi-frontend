import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  DeleteSucursalResponseSchema,
  SucursalListResponseSchema,
  SucursalResponseSchema,
  type CreateSucursalInput,
  type Sucursal,
} from '../types/sucursal';

export interface SucursalFiltros {
  activa?: boolean;
}

function limpiarParams(filtros: object): Record<string, unknown> {
  // El backend corre con `forbidNonWhitelisted`; mandar claves vacías o
  // `undefined` haría fallar la validación del query DTO.
  return Object.fromEntries(
    Object.entries(filtros).filter(
      ([, value]) => value !== undefined && value !== '',
    ),
  );
}

async function listSucursales(
  filtros: SucursalFiltros = {},
): Promise<Sucursal[]> {
  try {
    const response = await axiosInstance.get('/api/sucursales', {
      params: limpiarParams(filtros),
    });
    return SucursalListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener la lista de sucursales.');
  }
}

async function createSucursal(input: CreateSucursalInput): Promise<Sucursal> {
  try {
    const response = await axiosInstance.post('/api/sucursales', input);
    return SucursalResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo crear la sucursal.');
  }
}

async function updateSucursal(
  id: string,
  input: Partial<{
    nombre: string;
    direccion: string;
    activa: boolean;
    esPrincipal: boolean;
  }>,
): Promise<Sucursal> {
  try {
    const response = await axiosInstance.patch(`/api/sucursales/${id}`, input);
    return SucursalResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo actualizar la sucursal.');
  }
}

async function removeSucursal(id: string): Promise<void> {
  try {
    const response = await axiosInstance.delete(`/api/sucursales/${id}`);
    DeleteSucursalResponseSchema.parse(response.data);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo eliminar la sucursal.');
  }
}

export const SucursalAPI = {
  listSucursales,
  createSucursal,
  updateSucursal,
  removeSucursal,
};
