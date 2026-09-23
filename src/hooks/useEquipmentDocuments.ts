import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { EquipmentDocumentAPI } from '../api/EquipmentDocumentAPI';
import type { CreateEquipmentDocumentInput, UpdateEquipmentDocumentInput } from '../types/equipment-document';

const EQUIPMENT_DOCUMENTS_KEY = ['equipment-documents'] as const;
/** Prefijo del árbol de `useEquipment` (`hooks/useEquipment.ts#EQUIPMENT_KEY`)
 * — se reinvalida acá (no se importa esa constante privada) para refrescar el
 * badge `documentsAlert` del listado/ficha cuando cambian los documentos. */
const EQUIPMENT_KEY = ['equipment'] as const;

/** Documentos de UN equipo (`GET /api/equipment/:equipmentId/documents`) —
 * ordenados `createdAt desc` por el backend. */
export function useEquipmentDocuments(equipmentId: string) {
  return useQuery({
    queryKey: [...EQUIPMENT_DOCUMENTS_KEY, equipmentId],
    queryFn: () => EquipmentDocumentAPI.list(equipmentId),
    enabled: !!equipmentId,
  });
}

/**
 * Invalida la lista de documentos de ESTE equipo Y el árbol `['equipment']`
 * completo: el `documentsAlert` que ve el listado/ficha se deriva de los
 * documentos, así que cualquier crear/editar/borrar tiene que refrescar
 * ambas queries para que el badge no quede desactualizado.
 */
function useInvalidarEquipmentDocuments(equipmentId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [...EQUIPMENT_DOCUMENTS_KEY, equipmentId] });
    void queryClient.invalidateQueries({ queryKey: EQUIPMENT_KEY });
  };
}

export function useCreateEquipmentDocument(equipmentId: string) {
  const invalidar = useInvalidarEquipmentDocuments(equipmentId);

  return useMutation({
    mutationFn: (input: CreateEquipmentDocumentInput) => EquipmentDocumentAPI.create(equipmentId, input),
    onSuccess: () => {
      invalidar();
      toast.success('Documento creado');
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo crear el documento.');
    },
  });
}

export function useUpdateEquipmentDocument(equipmentId: string) {
  const invalidar = useInvalidarEquipmentDocuments(equipmentId);

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEquipmentDocumentInput }) =>
      EquipmentDocumentAPI.update(id, input),
    onSuccess: () => {
      invalidar();
      toast.success('Documento actualizado');
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo actualizar el documento.');
    },
  });
}

export function useDeleteEquipmentDocument(equipmentId: string) {
  const invalidar = useInvalidarEquipmentDocuments(equipmentId);

  return useMutation({
    mutationFn: (id: string) => EquipmentDocumentAPI.remove(id),
    onSuccess: () => {
      invalidar();
      toast.success('Documento eliminado');
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo eliminar el documento.');
    },
  });
}
