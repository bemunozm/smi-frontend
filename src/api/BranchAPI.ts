import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  BranchListResponseSchema,
  BranchResponseSchema,
  DeleteBranchResponseSchema,
  type Branch,
  type CreateBranchInput,
  type UpdateBranchInput,
} from '../types/branch';

export interface BranchFiltros {
  isActive?: boolean;
  q?: string;
}

async function list(filtros: BranchFiltros = {}): Promise<Branch[]> {
  try {
    // Mismo criterio que `EquipmentAPI`: con `forbidNonWhitelisted` activo,
    // solo se mandan las claves con valor (`isActive: false` es un valor
    // válido, así que el filtro es `!== undefined`, no falsy).
    const params = Object.fromEntries(
      Object.entries(filtros).filter(([, value]) => value !== undefined && value !== ''),
    );
    const response = await axiosInstance.get('/api/branches', { params });
    return BranchListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener la lista de sucursales.');
  }
}

async function getById(id: string): Promise<Branch> {
  try {
    const response = await axiosInstance.get(`/api/branches/${id}`);
    return BranchResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener la sucursal.');
  }
}

async function create(input: CreateBranchInput): Promise<Branch> {
  try {
    const response = await axiosInstance.post('/api/branches', input);
    return BranchResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo crear la sucursal.');
  }
}

async function update(id: string, input: UpdateBranchInput): Promise<Branch> {
  try {
    const response = await axiosInstance.patch(`/api/branches/${id}`, input);
    return BranchResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo actualizar la sucursal.');
  }
}

async function remove(id: string): Promise<void> {
  try {
    const response = await axiosInstance.delete(`/api/branches/${id}`);
    DeleteBranchResponseSchema.parse(response.data);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo eliminar la sucursal.');
  }
}

export const BranchAPI = {
  list,
  getById,
  create,
  update,
  remove,
};
