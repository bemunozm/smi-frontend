import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { EquipmentDocumentAPI } from '../api/EquipmentDocumentAPI';
import { EQUIPMENT_DOCUMENTS_KEY } from '../lib/query-keys';
import { buildQueuedEdit } from '../lib/queued-edit';
import { equipmentDocumentEntity } from '../offline/db';
import type {
  CreateEquipmentDocumentInput,
  EquipmentDocument,
  UpdateEquipmentDocumentInput,
} from '../types/equipment-document';
import { useQueuedCreate, useQueuedDelete, useQueuedMutation } from './useQueuedMutation';

/** Documentos de UN equipo (`GET /api/equipment/:equipmentId/documents`) —
 * ordenados `createdAt desc` por el backend. */
export function useEquipmentDocuments(equipmentId: string) {
  return useQuery({
    queryKey: [...EQUIPMENT_DOCUMENTS_KEY, equipmentId],
    queryFn: () => EquipmentDocumentAPI.list(equipmentId),
    enabled: !!equipmentId,
  });
}

export interface CreateEquipmentDocumentVars {
  input: CreateEquipmentDocumentInput;
  /** Adjunto: se guarda en el equipo y se sube al sincronizar. */
  file?: File | null;
}

/** El replay invalida la lista de documentos de la unidad y el árbol
 * `['equipment']` (el `documentsAlert` del listado/ficha se deriva de los
 * documentos), ver `offline/endpoints/flota.ts`. */
export function useCreateEquipmentDocument(equipmentId: string) {
  return useQueuedCreate<'equipmentDocument.create', CreateEquipmentDocumentVars>({
    endpoint: 'equipmentDocument.create',
    build: ({ input, file }, id) => ({
      params: { equipmentId },
      body: { ...input, id },
      ...(file ? { files: [{ field: 'fileKey', file }] } : {}),
    }),
    onSent: () => {
      toast.success('Documento creado');
    },
    errorFallback: 'No se pudo crear el documento.',
  });
}

export interface UpdateEquipmentDocumentVars {
  /** El documento tal como lo muestra la pantalla: la base de la edición. */
  documento: EquipmentDocument;
  input: Omit<UpdateEquipmentDocumentInput, 'fileKey' | 'fileName'>;
  /** `undefined` = sin cambio de archivo, `null` = quitarlo, `File` = uno nuevo. */
  file?: File | null;
}

const CAMPOS_DE_DOCUMENTO = ['type', 'title', 'expiryDate', 'notes'] as const;

type CamposDeDocumento = Pick<UpdateEquipmentDocumentInput, 'type' | 'title' | 'expiryDate' | 'notes' | 'fileName'>;

function camposDeDocumento(documento: EquipmentDocument): CamposDeDocumento {
  return {
    type: documento.type,
    title: documento.title,
    // El formulario trabaja con `YYYY-MM-DD`.
    expiryDate: documento.expiryDate ? documento.expiryDate.slice(0, 10) : null,
    notes: documento.notes,
    fileName: documento.fileName,
  };
}

export function useUpdateEquipmentDocument() {
  return useQueuedMutation<'equipmentDocument.update', UpdateEquipmentDocumentVars>({
    endpoint: 'equipmentDocument.update',
    build: async ({ documento, input, file }) => {
      const edicion = await buildQueuedEdit<CamposDeDocumento>({
        entity: equipmentDocumentEntity(documento.id),
        ops: ['equipmentDocument.update'],
        base: camposDeDocumento(documento),
        next: { ...input, fileName: file ? file.name : null },
        fields: file === undefined ? CAMPOS_DE_DOCUMENTO : [...CAMPOS_DE_DOCUMENTO, 'fileName'],
      });
      if (!edicion.hayCambios && file === undefined) return null;
      return {
        params: { id: documento.id },
        body: { ...edicion.cambios, ...(file === null ? { fileKey: null } : {}) },
        expected: edicion.esperado,
        ...(file ? { files: [{ field: 'fileKey', file }] } : {}),
      };
    },
    onSent: () => {
      toast.success('Documento actualizado');
    },
    errorFallback: 'No se pudo actualizar el documento.',
  });
}

export function useDeleteEquipmentDocument() {
  return useQueuedDelete({
    endpoint: 'equipmentDocument.delete',
    sentMessage: 'Documento eliminado',
    errorFallback: 'No se pudo eliminar el documento.',
  });
}
