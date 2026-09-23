import { z } from 'zod';

import { BranchSchema } from './branch';
import { MOVEMENT_DIRECTIONS, MOVEMENT_REASONS, UNITS_OF_MEASURE } from './inventory';

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

/**
 * Estado de vigencia de un documento (revisión técnica R1 / seguro R2),
 * derivado ON-READ por el backend (`equipment.service.ts#buildDocumentExpiryInfo`)
 * — nunca se persiste tal cual, se recalcula en cada lectura contra la fecha
 * actual. Mismo vocabulario que `DocumentStatus` del backend.
 */
export const DOCUMENT_STATUS = ['VIGENTE', 'POR_VENCER', 'VENCIDO', 'SIN_DATO'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUS)[number];

/** Operador/supervisor asignado HOY a la unidad — subset de `User` (id+name),
 * tal como lo devuelve `GET /api/equipment` (ver `operator`/`supervisor` más
 * abajo). Se declara acá en vez de importar `UserSchema` completo porque el
 * backend solo expone estas dos claves en este endpoint. */
const EquipmentAssigneeSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type EquipmentAssignee = z.infer<typeof EquipmentAssigneeSchema>;

/**
 * Turno de horómetro ABIERTO de la unidad (flujo ENTRADA/SALIDA de dos
 * pasos, Flota): el `RegistroHorometro` más reciente con `valorFinal ==
 * null`, o `null` si no hay uno en curso. Shape real de
 * `equipment.service.ts#OpenShiftSummary` (backend, rama
 * `feat/flota/equipment-usage-and-photo`) — le dice al front si debe ofrecer
 * "Registrar entrada" o "Registrar salida" (con el contexto de la entrada).
 */
const OpenShiftSchema = z.object({
  id: z.string(),
  valorInicial: z.number(),
  operador: z.string(),
  turno: z.string(),
  fecha: z.string().datetime(),
});
export type OpenShift = z.infer<typeof OpenShiftSchema>;

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
  /** Foto del equipo (`/uploads/...`, subida vía `uploadImage`) — `null` si
   * nunca se subió una. */
  photoUrl: z.string().nullable(),
  /** Operador/supervisor asignados HOY — asignación ACTUAL, no historial de
   * sesiones (ver `useAssignEquipment`). */
  operator: EquipmentAssigneeSchema.nullable(),
  supervisor: EquipmentAssigneeSchema.nullable(),
  /** Derivado por el backend: `!!currentOperatorId`. */
  inUse: z.boolean(),
  /** % del último `RegistroHorometro` del equipo — `null` sin registros. */
  currentFuelLevel: z.number().nullable(),
  /** Turno de horómetro abierto de esta unidad, o `null` si no tiene uno en
   * curso — ver `OpenShiftSchema`. */
  openShift: OpenShiftSchema.nullable(),
  /** Alerta discreta para el LISTADO/ficha, derivada on-read por el backend a
   * partir de los documentos de la unidad (dominio "Documentos de equipo",
   * ver `types/equipment-document.ts`): el tono más urgente entre todos sus
   * documentos, o `null` si ninguno está POR_VENCER/VENCIDO. Reemplaza al
   * viejo campo anidado `documents` (R1/R2 fijos) — el detalle completo (qué
   * documento, de qué tipo) vive en `GET /equipment/:id/documents`, no acá. */
  documentsAlert: z.enum(['VENCIDO', 'POR_VENCER']).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Equipment = z.infer<typeof EquipmentSchema>;

/**
 * Movimiento de inventario imputado a la unidad, tal como lo arma
 * `equipment.service.ts#findOne` (Prisma `stockMovements`, `take: 10`, orden
 * `occurredAt desc`). Es una PROYECCIÓN acotada del `StockMovement` completo
 * de Inventario — no el `StockMovementSchema` de `types/inventory.ts` tal
 * cual: ese modela `/api/inventory/movements` (que incluye `item.id` y las
 * relaciones `branch`/`sourceBranch`/`destinationBranch`/`equipment`
 * completas), mientras que acá el `include` del backend solo trae
 * `item: {sku, name, unit}` (sin `id`) y ninguna de esas relaciones — iban a
 * quedar `undefined`, no en el JSON. Los enums (`direction`/`reason`/`unit`)
 * SÍ se reusan de `types/inventory.ts`: es el mismo vocabulario, fuente única.
 *
 * Confirmado 2026-09-14 contra el código del backend
 * (`smi-backend/src/equipment/equipment.service.ts:143-166` y
 * `prisma/schema.prisma#StockMovement`) y con `GET /api/equipment/:id` en
 * vivo — no es un shape inventado.
 */
const EquipmentStockMovementSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  branchId: z.string(),
  direction: z.enum(MOVEMENT_DIRECTIONS),
  reason: z.enum(MOVEMENT_REASONS),
  /** Siempre > 0 — el signo lo determina `direction` (ver schema.prisma). */
  quantity: z.number(),
  resultingBalance: z.number(),
  reference: z.string().nullable(),
  documentNumber: z.string().nullable(),
  sourceBranchId: z.string().nullable(),
  destinationBranchId: z.string().nullable(),
  performedById: z.string().nullable(),
  equipmentId: z.string().nullable(),
  notes: z.string().nullable(),
  occurredAt: z.string().datetime(),
  item: z.object({
    sku: z.string(),
    name: z.string(),
    unit: z.enum(UNITS_OF_MEASURE),
  }),
});
export type EquipmentStockMovement = z.infer<typeof EquipmentStockMovementSchema>;

/**
 * `GET /api/equipment/:id` — la ficha agrega la sucursal base, el conteo de
 * registros de los otros dominios y los últimos movimientos de stock de la
 * unidad. `_count.stockMovements`/`stockMovements` son las claves reales que
 * expone el backend (relación Prisma `Equipment.stockMovements`, dominio de
 * Inventario — ya migrado a inglés, ver `types/inventory.ts`).
 */
export const EquipmentDetailSchema = EquipmentSchema.extend({
  homeBranch: BranchSchema.nullable(),
  _count: z.object({
    combustibles: z.number().int(),
    horometros: z.number().int(),
    trabajosExtra: z.number().int(),
    hallazgos: z.number().int(),
    stockMovements: z.number().int(),
  }),
  stockMovements: z.array(EquipmentStockMovementSchema),
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
  /** Sube al elegir el archivo (`uploadImage`, ver `EquipoPhotoField`) — el
   * form solo guarda la URL resultante, no el `File`. */
  photoUrl: z.string().nullable(),
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
  photoUrl?: string;
}

/** Body de `PATCH /api/equipment/:id` — el código interno no es editable en
 * el backend (es la clave de negocio que usan Terreno/Mantenimiento/Inventario).
 * A diferencia de `CreateEquipmentInput`, estos cuatro campos aceptan `null`
 * explícito (ver `toUpdateEquipmentPayload`): en UPDATE es la única forma de
 * limpiar un valor ya guardado, y el backend los marca `@IsOptional()` sin
 * `forbidNonWhitelisted` bloquear un `null`. */
export type UpdateEquipmentInput = Omit<
  CreateEquipmentInput,
  'internalCode' | 'licensePlate' | 'year' | 'homeBranchId' | 'photoUrl'
> & {
  licensePlate?: string | null;
  year?: number | null;
  homeBranchId?: string | null;
  photoUrl?: string | null;
};

/** Body de `PATCH /api/equipment/:id/assignment` — asigna/libera operador y/o
 * supervisor. `null` explícito libera esa asignación; omitir la clave la deja
 * igual (ver `useAssignEquipment`, que siempre manda ambas para evitar esa
 * ambigüedad — "sin cambios" y "liberar" quedan siempre explícitos). */
export interface AssignEquipmentInput {
  operatorId?: string | null;
  supervisorId?: string | null;
}

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
    ...(values.photoUrl ? { photoUrl: values.photoUrl } : {}),
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
    photoUrl: values.photoUrl,
  };
}
