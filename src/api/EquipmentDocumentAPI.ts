import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  EquipmentDocumentListResponseSchema,
  type EquipmentDocument,
} from '../types/equipment-document';

async function list(equipmentId: string): Promise<EquipmentDocument[]> {
  try {
    const response = await axiosInstance.get(`/api/equipment/${equipmentId}/documents`);
    return EquipmentDocumentListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudieron obtener los documentos del equipo.');
  }
}

export const EquipmentDocumentAPI = {
  list,
};
