import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  DeleteOperatorResponseSchema,
  OperatorListResponseSchema,
  OperatorResponseSchema,
  type CreateOperatorInput,
  type Operator,
  type UpdateOperatorInput,
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

async function create(input: CreateOperatorInput): Promise<Operator> {
  try {
    const response = await axiosInstance.post('/api/operators', input);
    return OperatorResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo crear el operador.');
  }
}

async function update(id: string, input: UpdateOperatorInput): Promise<Operator> {
  try {
    const response = await axiosInstance.patch(`/api/operators/${id}`, input);
    return OperatorResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo actualizar el operador.');
  }
}

async function remove(id: string): Promise<void> {
  try {
    const response = await axiosInstance.delete(`/api/operators/${id}`);
    DeleteOperatorResponseSchema.parse(response.data);
  } catch (error: unknown) {
    // El backend rechaza con 409 si el operador está en uso y sugiere
    // desactivarlo en su lugar (mismo criterio que `BranchAPI.remove`) — ese
    // mensaje llega tal cual vía `toDomainError`.
    throw toDomainError(error, 'No se pudo eliminar el operador.');
  }
}

export const OperatorAPI = {
  list,
  create,
  update,
  remove,
};
