import { z } from 'zod';

import { BranchSchema } from './branch';

/**
 * Contrato del dominio Flota (`GET/POST/PATCH/DELETE /api/equipment`).
 * Fuente única de los vocabularios: los mismos enums del backend
 * (`EquipmentClass`, `ControlUnit`, `EquipmentStatus` — reemplazan al
 * `EstadoEquipo` en español del modelo anterior).
 */
export const EQUIPMENT_CLASS = ['LIGHT', 'HEAVY'] as const;
export type EquipmentClass = (typeof EQUIPMENT_CLASS)[number];

export const CONTROL_UNIT = ['KM', 'HOURS'] as const;
export type ControlUnit = (typeof CONTROL_UNIT)[number];

export const EQUIPMENT_STATUS = ['OPERATIONAL', 'IN_WORKSHOP', 'OUT_OF_SERVICE'] as const;
export type EquipmentStatus = (typeof EQUIPMENT_STATUS)[number];

export const EquipmentSchema = z.object({
  id: z.string(),
  internalCode: z.string(),
  licensePlate: z.string().nullable(),
  equipmentClass: z.enum(EQUIPMENT_CLASS),
  type: z.string(),
  brand: z.string(),
  model: z.string(),
  year: z.number().int().nullable(),
  controlUnit: z.enum(CONTROL_UNIT),
  currentHourmeter: z.number().nullable(),
  currentMileage: z.number().nullable(),
  status: z.enum(EQUIPMENT_STATUS),
  homeBranchId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Equipment = z.infer<typeof EquipmentSchema>;

/** Movimiento de inventario imputado a la unidad, tal como llega en la ficha.
 * Insumo sigue en español a propósito — dominio de Inventario (Joaquín). */
const InventoryMovementSchema = z.object({
  id: z.string(),
  tipo: z.enum(['ENTRADA', 'SALIDA']),
  origen: z.string(),
  cantidad: z.number(),
  saldoResultante: z.number(),
  observacion: z.string().nullable(),
  fecha: z.string().datetime(),
  insumo: z.object({
    codigo: z.string(),
    nombre: z.string(),
    unidad: z.string(),
  }),
});

/**
 * `GET /api/equipment/:id` — la ficha agrega la sucursal base, el conteo de
 * registros de los otros dominios y los últimos consumos de inventario de la
 * unidad. Las claves de `_count`/`movimientos` son las relaciones Prisma tal
 * cual las expone el backend (español, dominios de Terreno/Inventario).
 */
export const EquipmentDetailSchema = EquipmentSchema.extend({
  homeBranch: BranchSchema.nullable(),
  _count: z.object({
    combustibles: z.number().int(),
    horometros: z.number().int(),
    trabajosExtra: z.number().int(),
    hallazgos: z.number().int(),
    movimientos: z.number().int(),
  }),
  movimientos: z.array(InventoryMovementSchema),
});
export type EquipmentDetail = z.infer<typeof EquipmentDetailSchema>;

/** `GET /api/equipment/resumen` — alimenta el KPI de flota del dashboard. */
export const ResumenFleetSchema = z.object({
  total: z.number().int().nonnegative(),
  disponibles: z.number().int().nonnegative(),
  porEstado: z.record(z.enum(EQUIPMENT_STATUS), z.number().int().nonnegative()),
});
export type ResumenFleet = z.infer<typeof ResumenFleetSchema>;

// --- Envolturas `{ data, message }` ---------------------------------------

export const EquipmentListResponseSchema = z.object({
  data: z.array(EquipmentSchema),
  message: z.string(),
});

export const EquipmentResponseSchema = z.object({
  data: EquipmentSchema,
  message: z.string(),
});

export const EquipmentDetailResponseSchema = z.object({
  data: EquipmentDetailSchema,
  message: z.string(),
});

export const ResumenFleetResponseSchema = z.object({
  data: ResumenFleetSchema,
  message: z.string(),
});

export const DeleteEquipmentResponseSchema = z.object({
  data: z.object({ id: z.string() }).nullable(),
  message: z.string(),
});

// --- Formularios (RHF + zodResolver) --------------------------------------

/**
 * El año se maneja como STRING en el formulario y se convierte a número al
 * enviar (ver `toEquipmentPayload`). Un input numérico vacío entrega `''`, que
 * `z.coerce.number()` convierte en `0` — es decir, un año inválido que pasa la
 * validación silenciosamente. Con string + regex, "vacío" y "mal escrito" son
 * dos casos distintos y explícitos.
 */
const yearField = z
  .string()
  .regex(/^\d{4}$/, 'Ingresa un año de 4 dígitos')
  .refine((value) => Number(value) >= 1950 && Number(value) <= 2100, {
    message: 'El año debe estar entre 1950 y 2100',
  })
  .or(z.literal(''));

export const EquipmentFormSchema = z.object({
  internalCode: z
    .string()
    .min(1, 'El código es obligatorio')
    .max(20, 'Máximo 20 caracteres'),
  licensePlate: z.string().max(20, 'Máximo 20 caracteres').or(z.literal('')),
  equipmentClass: z.enum(EQUIPMENT_CLASS),
  type: z.string().min(1, 'El tipo es obligatorio').max(60),
  brand: z.string().min(1, 'La marca es obligatoria').max(60),
  model: z.string().min(1, 'El modelo es obligatorio').max(60),
  year: yearField,
  controlUnit: z.enum(CONTROL_UNIT),
  status: z.enum(EQUIPMENT_STATUS),
  /** `''` = sin sucursal asignada. */
  homeBranchId: z.string(),
});
export type EquipmentFormValues = z.infer<typeof EquipmentFormSchema>;

/** Body de `POST /api/equipment`. */
export interface CreateEquipmentInput {
  internalCode: string;
  licensePlate?: string;
  equipmentClass: EquipmentClass;
  type: string;
  brand: string;
  model: string;
  year?: number;
  controlUnit: ControlUnit;
  status: EquipmentStatus;
  homeBranchId?: string;
}

/** Body de `PATCH /api/equipment/:id` — el código interno no es editable en
 * el backend (es la clave de negocio que usan Terreno/Mantenimiento/Inventario).
 * A diferencia de `CreateEquipmentInput`, estos tres campos aceptan `null`
 * explícito (ver `toUpdateEquipmentPayload`): en UPDATE es la única forma de
 * limpiar un valor ya guardado, y el backend los marca `@IsOptional()` sin
 * `forbidNonWhitelisted` bloquear un `null`. */
export type UpdateEquipmentInput = Omit<
  CreateEquipmentInput,
  'internalCode' | 'licensePlate' | 'year' | 'homeBranchId'
> & {
  licensePlate?: string | null;
  year?: number | null;
  homeBranchId?: string | null;
};

/** Convierte los valores del formulario al body de CREAR (`POST`). Omite la
 * clave cuando el campo viene vacío — con `forbidNonWhitelisted` activo, un
 * `null`/`''` explícito en un campo `@IsOptional()` haría fallar la validación. */
export function toEquipmentPayload(values: EquipmentFormValues): CreateEquipmentInput {
  return {
    internalCode: values.internalCode.trim().toUpperCase(),
    ...(values.licensePlate.trim() ? { licensePlate: values.licensePlate.trim().toUpperCase() } : {}),
    equipmentClass: values.equipmentClass,
    type: values.type.trim(),
    brand: values.brand.trim(),
    model: values.model.trim(),
    ...(values.year ? { year: Number(values.year) } : {}),
    controlUnit: values.controlUnit,
    status: values.status,
    ...(values.homeBranchId ? { homeBranchId: values.homeBranchId } : {}),
  };
}

/**
 * Convierte los valores del formulario al body de EDITAR (`PATCH`). A
 * diferencia de `toEquipmentPayload`, un campo vacío manda `null` explícito
 * en vez de omitir la clave — es el único contrato que le permite al usuario
 * limpiar la patente, el año o la sucursal base ya guardados (contrato
 * acordado con backend: los tres son `@IsOptional()` y aceptan `null`).
 */
export function toUpdateEquipmentPayload(values: EquipmentFormValues): UpdateEquipmentInput {
  return {
    licensePlate: values.licensePlate.trim() ? values.licensePlate.trim().toUpperCase() : null,
    equipmentClass: values.equipmentClass,
    type: values.type.trim(),
    brand: values.brand.trim(),
    model: values.model.trim(),
    year: values.year ? Number(values.year) : null,
    controlUnit: values.controlUnit,
    status: values.status,
    homeBranchId: values.homeBranchId ? values.homeBranchId : null,
  };
}
