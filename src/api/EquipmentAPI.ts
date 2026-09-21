import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  DeleteEquipmentResponseSchema,
  EquipmentDetailResponseSchema,
  EquipmentListResponseSchema,
  EquipmentResponseSchema,
  ResumenFleetResponseSchema,
  type AssignEquipmentInput,
  type CreateEquipmentInput,
  type Equipment,
  type EquipmentClass,
  type EquipmentDetail,
  type EquipmentStatus,
  type ControlUnit,
  type ResumenFleet,
  type UpdateEquipmentInput,
} from '../types/equipment';

export interface EquipmentFiltros {
  status?: EquipmentStatus;
  equipmentClass?: EquipmentClass;
  controlUnit?: ControlUnit;
  homeBranchId?: string;
  type?: string;
  q?: string;
}

async function list(filtros: EquipmentFiltros = {}): Promise<Equipment[]> {
  try {
    // El backend corre con `forbidNonWhitelisted`: un filtro `undefined` que
    // axios serializara como `?q=` haría fallar la request, así que solo se
    // mandan las claves con valor.
    const params = Object.fromEntries(
      Object.entries(filtros).filter(([, value]) => value !== undefined && value !== ''),
    );
    const response = await axiosInstance.get('/api/equipment', { params });
    return EquipmentListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener la lista de equipos.');
  }
}

async function resumen(): Promise<ResumenFleet> {
  try {
    const response = await axiosInstance.get('/api/equipment/resumen');
    return ResumenFleetResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener el resumen de la flota.');
  }
}

async function getById(id: string): Promise<EquipmentDetail> {
  try {
    const response = await axiosInstance.get(`/api/equipment/${id}`);
    return EquipmentDetailResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener la ficha del equipo.');
  }
}

async function create(input: CreateEquipmentInput): Promise<Equipment> {
  try {
    const response = await axiosInstance.post('/api/equipment', input);
    return EquipmentResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo crear el equipo.');
  }
}

async function update(id: string, input: UpdateEquipmentInput): Promise<Equipment> {
  try {
    const response = await axiosInstance.patch(`/api/equipment/${id}`, input);
    return EquipmentResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo actualizar el equipo.');
  }
}

/** Endpoint aparte del PATCH general: lo puede usar también el SUPERVISOR. */
async function updateStatus(id: string, status: EquipmentStatus): Promise<Equipment> {
  try {
    const response = await axiosInstance.patch(`/api/equipment/${id}/status`, { status });
    return EquipmentResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo actualizar el estado del equipo.');
  }
}

async function remove(id: string): Promise<void> {
  try {
    const response = await axiosInstance.delete(`/api/equipment/${id}`);
    DeleteEquipmentResponseSchema.parse(response.data);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo eliminar el equipo.');
  }
}

/** Asigna/libera operador y supervisor — endpoint aparte del PATCH general
 * (ver `AssignEquipmentInput`). */
async function assign(id: string, input: AssignEquipmentInput): Promise<Equipment> {
  try {
    const response = await axiosInstance.patch(`/api/equipment/${id}/assignment`, input);
    return EquipmentResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo actualizar la asignación del equipo.');
  }
}

export const EquipmentAPI = {
  list,
  resumen,
  getById,
  create,
  update,
  updateStatus,
  remove,
  assign,
};
