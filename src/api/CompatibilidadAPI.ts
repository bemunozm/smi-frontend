import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  CompatibilidadResponseSchema,
  DeleteCompatibilidadResponseSchema,
  EquiposCompatiblesResponseSchema,
  OrigenesReplicablesResponseSchema,
  ReplicacionResponseSchema,
  RepuestosDeEquipoResponseSchema,
  type CreateCompatibilidadInput,
  type EquipoCompatible,
  type OrigenReplicable,
  type RepuestosDeEquipo,
  type ResultadoReplicacion,
} from '../types/compatibilidad';

export interface RepuestosFiltros {
  sucursalId?: string;
  soloConStock?: boolean;
}

function limpiarParams(filtros: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(filtros).filter(
      ([, value]) => value !== undefined && value !== '' && value !== false,
    ),
  );
}

/** Repuestos compatibles con un equipo, cruzados con el stock de la bodega. */
async function repuestosDeEquipo(
  equipoId: string,
  filtros: RepuestosFiltros = {},
): Promise<RepuestosDeEquipo> {
  try {
    const response = await axiosInstance.get(
      `/api/equipos/${equipoId}/repuestos`,
      { params: limpiarParams(filtros) },
    );
    return RepuestosDeEquipoResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(
      error,
      'No se pudieron obtener los repuestos compatibles.',
    );
  }
}

/** Dirección inversa: en qué equipos se usa este repuesto. */
async function equiposDeInsumo(insumoId: string): Promise<EquipoCompatible[]> {
  try {
    const response = await axiosInstance.get(
      `/api/inventario/insumos/${insumoId}/equipos`,
    );
    return EquiposCompatiblesResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(
      error,
      'No se pudieron obtener los equipos compatibles.',
    );
  }
}

async function origenesReplicables(
  equipoId: string,
): Promise<OrigenReplicable[]> {
  try {
    const response = await axiosInstance.get(
      `/api/equipos/${equipoId}/repuestos/replicables`,
    );
    return OrigenesReplicablesResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(
      error,
      'No se pudieron buscar equipos del mismo modelo.',
    );
  }
}

async function replicar(
  equipoId: string,
  origenId: string,
): Promise<ResultadoReplicacion & { message: string }> {
  try {
    const response = await axiosInstance.post(
      `/api/equipos/${equipoId}/repuestos/replicar`,
      { origenId },
    );
    const parsed = ReplicacionResponseSchema.parse(response.data);
    // El `message` viaja hasta el hook porque distingue dos resultados válidos:
    // se copiaron todas, o parte ya estaba declarada.
    return { ...parsed.data, message: parsed.message };
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudieron copiar las compatibilidades.');
  }
}

async function createCompatibilidad(
  input: CreateCompatibilidadInput,
): Promise<{ id: string }> {
  try {
    const response = await axiosInstance.post('/api/compatibilidades', input);
    return CompatibilidadResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo declarar la compatibilidad.');
  }
}

async function updateNota(id: string, nota: string): Promise<{ id: string }> {
  try {
    const response = await axiosInstance.patch(`/api/compatibilidades/${id}`, {
      nota,
    });
    return CompatibilidadResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo actualizar la nota.');
  }
}

async function removeCompatibilidad(id: string): Promise<void> {
  try {
    const response = await axiosInstance.delete(`/api/compatibilidades/${id}`);
    DeleteCompatibilidadResponseSchema.parse(response.data);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo quitar la compatibilidad.');
  }
}

export const CompatibilidadAPI = {
  repuestosDeEquipo,
  equiposDeInsumo,
  origenesReplicables,
  replicar,
  createCompatibilidad,
  updateNota,
  removeCompatibilidad,
};
