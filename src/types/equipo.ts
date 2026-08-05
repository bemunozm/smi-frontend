import { z } from 'zod';

/**
 * Contrato del dominio Flota (`GET/POST/PATCH/DELETE /api/equipos`).
 * Fuente única de los estados operativos: el mismo vocabulario que el enum
 * `EstadoEquipo` del backend (documento de requerimientos §5.1).
 */
export const ESTADOS_EQUIPO = [
  'DISPONIBLE',
  'EN_RUTA',
  'EN_MANTENCION',
  'DE_BAJA',
] as const;
export type EstadoEquipo = (typeof ESTADOS_EQUIPO)[number];

export const EquipoSchema = z.object({
  id: z.string(),
  codigo: z.string(),
  tipo: z.string(),
  marca: z.string(),
  modelo: z.string(),
  anio: z.number().int().nullable(),
  estado: z.enum(ESTADOS_EQUIPO),
  horometroActual: z.number(),
  kilometrajeActual: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Equipo = z.infer<typeof EquipoSchema>;

/** Movimiento de inventario imputado a la unidad, tal como llega en la ficha. */
const MovimientoDeEquipoSchema = z.object({
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
 * `GET /api/equipos/:id` — la ficha agrega el conteo de registros de los otros
 * dominios y los últimos consumos de inventario de la unidad.
 */
export const EquipoDetalleSchema = EquipoSchema.extend({
  _count: z.object({
    combustibles: z.number().int(),
    horometros: z.number().int(),
    trabajosExtra: z.number().int(),
    hallazgos: z.number().int(),
    movimientos: z.number().int(),
  }),
  movimientos: z.array(MovimientoDeEquipoSchema),
});
export type EquipoDetalle = z.infer<typeof EquipoDetalleSchema>;

/** `GET /api/equipos/resumen` — alimenta el KPI de flota del dashboard. */
export const ResumenFlotaSchema = z.object({
  total: z.number().int().nonnegative(),
  disponibles: z.number().int().nonnegative(),
  porEstado: z.record(z.enum(ESTADOS_EQUIPO), z.number().int().nonnegative()),
});
export type ResumenFlota = z.infer<typeof ResumenFlotaSchema>;

// --- Envolturas `{ data, message }` ---------------------------------------

export const EquipoListResponseSchema = z.object({
  data: z.array(EquipoSchema),
  message: z.string(),
});

export const EquipoResponseSchema = z.object({
  data: EquipoSchema,
  message: z.string(),
});

export const EquipoDetalleResponseSchema = z.object({
  data: EquipoDetalleSchema,
  message: z.string(),
});

export const ResumenFlotaResponseSchema = z.object({
  data: ResumenFlotaSchema,
  message: z.string(),
});

export const DeleteEquipoResponseSchema = z.object({
  data: z.object({ id: z.string() }).nullable(),
  message: z.string(),
});

// --- Formularios (RHF + zodResolver) --------------------------------------

/**
 * El año se maneja como STRING en el formulario y se convierte a número al
 * enviar (ver `toEquipoPayload`). Un input numérico vacío entrega `''`, que
 * `z.coerce.number()` convierte en `0` — es decir, un año inválido que pasa la
 * validación silenciosamente. Con string + regex, "vacío" y "mal escrito" son
 * dos casos distintos y explícitos.
 */
const anioField = z
  .string()
  .regex(/^\d{4}$/, 'Ingresa un año de 4 dígitos')
  .refine((value) => Number(value) >= 1950 && Number(value) <= 2100, {
    message: 'El año debe estar entre 1950 y 2100',
  })
  .or(z.literal(''));

export const EquipoFormSchema = z.object({
  codigo: z
    .string()
    .min(1, 'El código es obligatorio')
    .max(20, 'Máximo 20 caracteres'),
  tipo: z.string().min(1, 'El tipo es obligatorio').max(60),
  marca: z.string().min(1, 'La marca es obligatoria').max(60),
  modelo: z.string().min(1, 'El modelo es obligatorio').max(60),
  anio: anioField,
  estado: z.enum(ESTADOS_EQUIPO),
});
export type EquipoFormValues = z.infer<typeof EquipoFormSchema>;

/** Body de `POST /api/equipos`. */
export interface CreateEquipoInput {
  codigo: string;
  tipo: string;
  marca: string;
  modelo: string;
  anio?: number;
  estado: EstadoEquipo;
}

/** Body de `PATCH /api/equipos/:id` — el código no es editable en el backend. */
export type UpdateEquipoInput = Omit<CreateEquipoInput, 'codigo'>;

/** Convierte los valores del formulario al body que espera la API. */
export function toEquipoPayload(values: EquipoFormValues): CreateEquipoInput {
  return {
    codigo: values.codigo.trim().toUpperCase(),
    tipo: values.tipo.trim(),
    marca: values.marca.trim(),
    modelo: values.modelo.trim(),
    // `undefined` y no `null`: el DTO del backend lo marca `@IsOptional()`, y
    // con `forbidNonWhitelisted` un `null` explícito fallaría la validación.
    ...(values.anio ? { anio: Number(values.anio) } : {}),
    estado: values.estado,
  };
}
