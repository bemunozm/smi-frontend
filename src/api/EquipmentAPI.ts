import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  EquipmentDetailResponseSchema,
  EquipmentListResponseSchema,
  ResumenFleetResponseSchema,
  type Equipment,
  type EquipmentClass,
  type EquipmentDetail,
  type EquipmentStatus,
  type ControlUnit,
  type ResumenFleet,
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

export const EquipmentAPI = {
  list,
  resumen,
  getById,
};
