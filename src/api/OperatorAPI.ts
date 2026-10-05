import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  OperatorListResponseSchema,
  type Operator,
} from '../types/operator';

export interface OperatorFiltros {
  isActive?: boolean;
  q?: string;
}

async function list(filtros: OperatorFiltros = {}): Promise<Operator[]> {
  try {
    // Mismo criterio que `BranchAPI`/`EquipmentAPI`: con `forbidNonWhitelisted`
    // activo, solo se mandan las claves con valor (`isActive: false` es un
    // valor válido, así que el filtro es `!== undefined`, no falsy).
    const params = Object.fromEntries(
      Object.entries(filtros).filter(([, value]) => value !== undefined && value !== ''),
    );
    const response = await axiosInstance.get('/api/operators', { params });
    return OperatorListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener la lista de operadores.');
  }
}

export const OperatorAPI = {
  list,
};
