import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  AjusteResponseSchema,
  DeleteInsumoResponseSchema,
  InsumoListResponseSchema,
  InsumoResponseSchema,
  KardexResponseSchema,
  MovimientoResponseSchema,
  ResumenInventarioResponseSchema,
  type CreateInsumoInput,
  type CreateMovimientoInput,
  type Insumo,
  type Kardex,
  type Movimiento,
  type ResumenInventario,
  type UpdateInsumoInput,
} from '../types/inventario';

export interface InsumoFiltros {
  q?: string;
  bajoStock?: boolean;
}

function limpiarParams(filtros: object): Record<string, unknown> {
  // El backend corre con `forbidNonWhitelisted`; mandar claves vacías o
  // `undefined` haría fallar la validación del query DTO.
  return Object.fromEntries(
    Object.entries(filtros).filter(
      ([, value]) => value !== undefined && value !== '' && value !== false,
    ),
  );
}

async function listInsumos(filtros: InsumoFiltros = {}): Promise<Insumo[]> {
  try {
    const response = await axiosInstance.get('/api/inventario/insumos', {
      params: limpiarParams(filtros),
    });
    return InsumoListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener la lista de insumos.');
  }
}

async function resumen(): Promise<ResumenInventario> {
  try {
    const response = await axiosInstance.get('/api/inventario/insumos/resumen');
    return ResumenInventarioResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener el resumen de inventario.');
  }
}

async function kardex(insumoId: string): Promise<Kardex> {
  try {
    const response = await axiosInstance.get(
      `/api/inventario/insumos/${insumoId}/kardex`,
    );
    return KardexResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener el kardex del insumo.');
  }
}

async function createInsumo(input: CreateInsumoInput): Promise<Insumo> {
  try {
    const response = await axiosInstance.post('/api/inventario/insumos', input);
    return InsumoResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo crear el insumo.');
  }
}

async function updateInsumo(id: string, input: UpdateInsumoInput): Promise<Insumo> {
  try {
    const response = await axiosInstance.patch(`/api/inventario/insumos/${id}`, input);
    return InsumoResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo actualizar el insumo.');
  }
}

async function removeInsumo(id: string): Promise<void> {
  try {
    const response = await axiosInstance.delete(`/api/inventario/insumos/${id}`);
    DeleteInsumoResponseSchema.parse(response.data);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo eliminar el insumo.');
  }
}

interface AjusteResultado {
  insumo: Insumo;
  movimiento: Movimiento | null;
  message: string;
}

/** Conteo físico: el backend calcula la diferencia y registra el movimiento. */
async function ajustarStock(
  id: string,
  input: { stockContado: number; observacion?: string },
): Promise<AjusteResultado> {
  try {
    const response = await axiosInstance.post(
      `/api/inventario/insumos/${id}/ajuste`,
      input,
    );
    const parsed = AjusteResponseSchema.parse(response.data);
    // El `message` viaja hasta el hook porque distingue dos resultados válidos:
    // "stock ajustado" y "el conteo coincidía, no se movió nada".
    return { ...parsed.data, message: parsed.message };
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo ajustar el stock.');
  }
}

async function createMovimiento(input: CreateMovimientoInput): Promise<Movimiento> {
  try {
    const response = await axiosInstance.post('/api/inventario/movimientos', input);
    return MovimientoResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo registrar el movimiento.');
  }
}

export const InventarioAPI = {
  listInsumos,
  resumen,
  kardex,
  createInsumo,
  updateInsumo,
  removeInsumo,
  ajustarStock,
  createMovimiento,
};
