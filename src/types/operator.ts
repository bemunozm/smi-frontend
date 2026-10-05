import { z } from 'zod';

import { isValidRut, normalizeRut } from '../lib/rut';

/**
 * Contrato del dominio Operadores (`GET/POST/PATCH/DELETE /api/operators`,
 * ver plan "Supervisión en Terreno") — catálogo propio, ya no texto libre.
 * `rut` normalizado `12345678-K` (único en el backend); lectura para
 * cualquier sesión autenticada, escritura ADMIN/SUPERVISOR, borrado
 * ADMIN-only con guarda de uso (409 si está en uso, sugiere desactivar).
 */
export const OperatorSchema = z.object({
  id: z.string(),
  name: z.string(),
  rut: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Operator = z.infer<typeof OperatorSchema>;

// --- Envolturas `{ data, message }` ---------------------------------------

export const OperatorListResponseSchema = z.object({
  data: z.array(OperatorSchema),
  message: z.string(),
});

export const OperatorResponseSchema = z.object({
  data: OperatorSchema,
  message: z.string(),
});

export const DeleteOperatorResponseSchema = z.object({
  data: z.object({ id: z.string() }).nullable(),
  message: z.string(),
});

// --- Formulario (RHF + zodResolver) ---------------------------------------

/**
 * Un solo schema para crear y editar (mismo criterio que `BranchFormSchema`)
 * — `isActive` solo lo consume el modal de edición; el de creación ignora el
 * campo (el backend arranca todo operador nuevo activo). El RUT es
 * opcional: cadena vacía pasa, cualquier otra cosa se valida con
 * `isValidRut` (dígito verificador módulo 11, espejo del backend).
 */
export const OperatorFormSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(120, 'Máximo 120 caracteres'),
  rut: z
    .string()
    .max(12, 'Máximo 12 caracteres')
    .refine((value) => value.trim().length === 0 || isValidRut(value), 'RUT inválido'),
  isActive: z.boolean(),
});
export type OperatorFormValues = z.infer<typeof OperatorFormSchema>;

/** Body de `POST /api/operators`. */
export interface CreateOperatorInput {
  name: string;
  rut?: string;
}

/** Body de `PATCH /api/operators/:id` — parcial; el contrato no admite
 * "borrar" un RUT ya cargado (no hay `rut: null`), solo reemplazarlo. */
export interface UpdateOperatorInput {
  name?: string;
  rut?: string;
  isActive?: boolean;
}

export function toCreateOperatorPayload(values: OperatorFormValues): CreateOperatorInput {
  const rut = values.rut.trim();
  return {
    name: values.name.trim(),
    ...(rut ? { rut: normalizeRut(rut) ?? rut } : {}),
  };
}

export function toUpdateOperatorPayload(values: OperatorFormValues): UpdateOperatorInput {
  const rut = values.rut.trim();
  return {
    name: values.name.trim(),
    rut: rut ? (normalizeRut(rut) ?? rut) : undefined,
    isActive: values.isActive,
  };
}

/** Los campos editables de un operador tal como los guarda el servidor: la forma
 * de la base de una edición (sin RUT es `null`). */
export interface OperatorFields {
  name: string;
  rut: string | null;
  isActive: boolean;
}
