import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  DeleteEquipmentDocumentResponseSchema,
  EquipmentDocumentListResponseSchema,
  EquipmentDocumentResponseSchema,
  type CreateEquipmentDocumentInput,
  type EquipmentDocument,
  type UpdateEquipmentDocumentInput,
} from '../types/equipment-document';

async function list(equipmentId: string): Promise<EquipmentDocument[]> {
  try {
    const response = await axiosInstance.get(`/api/equipment/${equipmentId}/documents`);
    return EquipmentDocumentListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudieron obtener los documentos del equipo.');
  }
}

async function create(equipmentId: string, input: CreateEquipmentDocumentInput): Promise<EquipmentDocument> {
  try {
    const response = await axiosInstance.post(`/api/equipment/${equipmentId}/documents`, input);
    return EquipmentDocumentResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo crear el documento.');
  }
}

/** Endpoint sin prefijo `:equipmentId` — el documento ya trae su propio `id`
 * único, mismo criterio que `/api/equipment/:id/status`. */
async function update(id: string, input: UpdateEquipmentDocumentInput): Promise<EquipmentDocument> {
  try {
    const response = await axiosInstance.patch(`/api/equipment/documents/${id}`, input);
    return EquipmentDocumentResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo actualizar el documento.');
  }
}

async function remove(id: string): Promise<void> {
  try {
    const response = await axiosInstance.delete(`/api/equipment/documents/${id}`);
    DeleteEquipmentDocumentResponseSchema.parse(response.data);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo eliminar el documento.');
  }
}

export const EquipmentDocumentAPI = {
  list,
  create,
  update,
  remove,
};
