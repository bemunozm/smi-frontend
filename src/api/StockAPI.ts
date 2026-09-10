import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  DesgloseInsumoResponseSchema,
  SetStockMinimoResponseSchema,
  StockListResponseSchema,
  type DesgloseInsumo,
  type SetStockMinimoInput,
  type StockList,
  type TipoInsumo,
} from '../types/stock';

export interface StockFiltros {
  sucursalId?: string;
  q?: string;
  tipo?: TipoInsumo;
  bajoStock?: boolean;
  soloEnBodega?: boolean;
}

function limpiarParams(filtros: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(filtros).filter(
      ([, value]) => value !== undefined && value !== '' && value !== false,
    ),
  );
}

/** Catálogo con el saldo de UNA bodega — la consulta de PROD-11. */
async function listStock(filtros: StockFiltros = {}): Promise<StockList> {
  try {
    const response = await axiosInstance.get('/api/inventario/stock', {
      params: limpiarParams(filtros),
    });
    return StockListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener el stock de la sucursal.');
  }
}

/** En qué bodegas está repartido un insumo. */
async function desglose(insumoId: string): Promise<DesgloseInsumo> {
  try {
    const response = await axiosInstance.get(
      `/api/inventario/insumos/${insumoId}/stock`,
    );
    return DesgloseInsumoResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(
      error,
      'No se pudo obtener el desglose por sucursal del insumo.',
    );
  }
}

async function setStockMinimo(input: SetStockMinimoInput): Promise<void> {
  try {
    const response = await axiosInstance.put(
      '/api/inventario/stock/minimo',
      input,
    );
    SetStockMinimoResponseSchema.parse(response.data);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo actualizar el stock mínimo.');
  }
}

export const StockAPI = { listStock, desglose, setStockMinimo };
