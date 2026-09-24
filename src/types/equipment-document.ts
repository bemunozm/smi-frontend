import { z } from 'zod';

import { DOCUMENT_STATUS } from './equipment';

/**
 * Contrato del dominio "Documentos de equipo"
 * (`GET/POST/PATCH/DELETE /api/equipment/:equipmentId/documents` y
 * `/api/equipment/documents/:id`) — reemplaza los 2 campos planos R1/R2
 * (`technicalInspectionExpiry`/`insuranceExpiry` en `EquipmentSchema`) por
 * una lista libre de documentos por equipo. `DOCUMENT_STATUS` se reusa de
 * `types/equipment.ts`: es el mismo vocabulario de vigencia (VIGENTE/POR_
 * VENCER/VENCIDO/SIN_DATO), derivado on-read por el backend a partir de
 * `expiryDate`, ya sea que venga de un documento individual (acá) o —
 * históricamente — del shape anidado que ya no existe.
 */
export const EQUIPMENT_DOCUMENT_TYPES = [
  'TECHNICAL_INSPECTION',
  'INSURANCE',
  'CIRCULATION_PERMIT',
  'CERTIFICATION',
  'OTHER',
] as const;
export type EquipmentDocumentType = (typeof EQUIPMENT_DOCUMENT_TYPES)[number];

/** Documento tal como lo devuelve el backend — shape PLANO (a diferencia del
 * viejo `EquipmentDocuments` anidado por tipo fijo): `status`/`daysToExpiry`
 * ya vienen derivados on-read a partir de `expiryDate`, mismo criterio que
 * usaba el shape anterior. */
export const EquipmentDocumentSchema = z.object({
  id: z.string(),
  equipmentId: z.string(),
  type: z.enum(EQUIPMENT_DOCUMENT_TYPES),
  title: z.string().nullable(),
  expiryDate: z.string().datetime().nullable(),
  fileUrl: z.string().nullable(),
  /** Nombre "humano" del archivo (el que subió el usuario, ej. "Póliza
   * Seguro.pdf") — el backend lo usa para el `Content-Disposition` al servir
   * el archivo, y el front lo muestra en vez de parsear la URL firmada (que
   * ahora lleva query de firma, no un nombre de archivo legible). */
  fileName: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: z.enum(DOCUMENT_STATUS),
  daysToExpiry: z.number().int().nullable(),
});
export type EquipmentDocument = z.infer<typeof EquipmentDocumentSchema>;

// --- Envolturas `{ data, message }` -----------------------------------------

export const EquipmentDocumentListResponseSchema = z.object({
  data: z.array(EquipmentDocumentSchema),
  message: z.string(),
});

export const EquipmentDocumentResponseSchema = z.object({
  data: EquipmentDocumentSchema,
  message: z.string(),
});

/** A diferencia de `DeleteEquipmentResponseSchema` (que admite `data: null`
 * cuando el backend rechaza el borrado por historial asociado), el borrado de
 * un documento no tiene ese caso de conflicto — el contrato siempre trae
 * `{ id }`. */
export const DeleteEquipmentDocumentResponseSchema = z.object({
  data: z.object({ id: z.string() }),
  message: z.string(),
});

// --- Bodies de API -----------------------------------------------------------

/** Body de `POST /api/equipment/:equipmentId/documents` — solo `type` es
 * obligatorio. `fileKey`/`fileName` viajan juntos (siempre los dos, o
 * ninguno) — ver `toCreateEquipmentDocumentPayload`. */
export interface CreateEquipmentDocumentInput {
  type: EquipmentDocumentType;
  title?: string;
  /** `YYYY-MM-DD`, opcional. */
  expiryDate?: string;
  fileKey?: string;
  fileName?: string;
  notes?: string;
}

/** Body de `PATCH /api/equipment/documents/:id` — todos los campos son
 * opcionales; `title`/`expiryDate`/`notes` aceptan `null` explícito para
 * limpiarlos (`type` es opcional pero NUNCA nullable).
 *
 * `fileKey`/`fileName` son TRI-STATE y viajan siempre juntos (ver
 * `toUpdateEquipmentDocumentPayload`): omitidos = sin cambio de archivo,
 * `null` = quitarlo, string = archivo nuevo — chequeado con `=== undefined`,
 * nunca con `in`. */
export interface UpdateEquipmentDocumentInput {
  type?: EquipmentDocumentType;
  title?: string | null;
  expiryDate?: string | null;
  fileKey?: string | null;
  fileName?: string | null;
  notes?: string | null;
}

// --- Formulario (RHF + zodResolver) ------------------------------------------

/** `<Input type="date">` entrega/espera `"YYYY-MM-DD"` (o `""` vacío) — mismo
 * criterio que `dateOnlyField` de `types/equipment.ts` (el vencimiento es
 * opcional, se puede guardar el documento sin fecha cargada). Se duplica acá
 * (en vez de importarlo) porque es un primitivo de 4 líneas y cada dominio de
 * formulario en este proyecto queda autocontenido en su propio `types/*.ts`. */
const dateOnlyField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
  .or(z.literal(''));

export const EquipmentDocumentFormSchema = z.object({
  type: z.enum(EQUIPMENT_DOCUMENT_TYPES),
  /** Opcional — el tipo de documento ya es un identificador válido por sí
   * solo. */
  title: z.string(),
  expiryDate: dateOnlyField,
  notes: z.string(),
});
export type EquipmentDocumentFormValues = z.infer<typeof EquipmentDocumentFormSchema>;

/** `key`/`name` del archivo recién subido (`uploadFile`, ver
 * `DocumentFileField` en `EquipmentDocumentModal`) — vive FUERA del form de
 * RHF (estado aparte en el modal, mismo criterio que `photoKey` en
 * `types/equipment.ts`), así que los builders de payload lo reciben aparte. */
export interface EquipmentDocumentFileChange {
  key: string;
  name: string;
}

/** Convierte los valores del formulario al body de CREAR (`POST`). Omite la
 * clave cuando el campo viene vacío — mismo criterio que
 * `toEquipmentPayload` (`types/equipment.ts`). `file` solo llega informado
 * cuando el usuario adjuntó un archivo nuevo. */
export function toCreateEquipmentDocumentPayload(
  values: EquipmentDocumentFormValues,
  file?: EquipmentDocumentFileChange,
): CreateEquipmentDocumentInput {
  return {
    type: values.type,
    ...(values.title.trim() ? { title: values.title.trim() } : {}),
    ...(values.expiryDate ? { expiryDate: values.expiryDate } : {}),
    ...(file ? { fileKey: file.key, fileName: file.name } : {}),
    ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
  };
}

/**
 * Convierte los valores del formulario al body de EDITAR (`PATCH`). A
 * diferencia de crear, un campo vacío manda `null` explícito — es la única
 * forma de limpiar un título/vencimiento/nota ya guardado (mismo criterio
 * que `toUpdateEquipmentPayload`).
 *
 * `fileChange` es tri-state: `undefined` (default) OMITE `fileKey`/`fileName`
 * — sin cambio de archivo —, `{key: null, name: null}` los manda para
 * quitarlo, `{key, name}` manda el archivo nuevo.
 */
export function toUpdateEquipmentDocumentPayload(
  values: EquipmentDocumentFormValues,
  fileChange?: { key: string | null; name: string | null },
): UpdateEquipmentDocumentInput {
  return {
    type: values.type,
    title: values.title.trim() ? values.title.trim() : null,
    expiryDate: values.expiryDate ? values.expiryDate : null,
    ...(fileChange ? { fileKey: fileChange.key, fileName: fileChange.name } : {}),
    notes: values.notes.trim() ? values.notes.trim() : null,
  };
}
