import { z } from 'zod';
import { leerNumero, nonNegNumber, NUMERO_INVALIDO } from '../lib/forms';

export const ACTIVIDADES = [
  { value: 'REGULACION_CARGA', label: 'Regulación y carga' },
  { value: 'LIMPIEZA_CANCHA', label: 'Limpieza de cancha' },
  { value: 'SOLTAR_MATERIAL', label: 'Soltar material' },
  { value: 'LIMPIEZA_SILOS', label: 'Limpieza de silos' },
  // «Pretil», no «petril». Solo cambia la etiqueta:
  // el valor guardado en la base sigue siendo `HACER_PETRIL`.
  { value: 'HACER_PETRIL', label: 'Hacer pretil' },
  { value: 'ARREGLO_CANCHA', label: 'Arreglo cancha' },
  { value: 'LIMPIEZA_PECAS', label: 'Limpieza de pecas' },
  { value: 'BARRIDO_CANCHA', label: 'Barrido de cancha' },
  { value: 'LIMPIEZA_ROMANA', label: 'Limpieza de romana' },
  { value: 'LIMPIEZA_RUTA', label: 'Limpieza de ruta' },
  // Válvula de escape para la tarea que no estaba en la lista. El texto va en
  // `otraActividad`; el servidor lo exige cuando se elige esta opción.
  { value: 'OTRO', label: 'Otro' },
] as const;

export const actividadLabel: Record<string, string> = Object.fromEntries(
  ACTIVIDADES.map((a) => [a.value, a.label]),
);

/**
 * Dónde se hizo CADA actividad (pedido del cliente, espejo de la columna
 * «Planta» de su planilla): Transporte, una planta concreta —solo para
 * limpieza de silos— o Variado. Lo declara el supervisor por fila.
 */
export const DESTINOS = [
  { value: 'TRANSPORTE', label: 'Transporte' },
  { value: 'PLANTA', label: 'Planta' },
  { value: 'VARIADO', label: 'Variado' },
] as const;

export const destinoLabel: Record<string, string> = Object.fromEntries(
  DESTINOS.map((d) => [d.value, d.label]),
);

const actividadValues = ACTIVIDADES.map((a) => a.value) as [string, ...string[]];

/**
 * Una fila del desglose del report: qué se hizo, dónde y cuántas horas
 * máquina tomó. Las horas son el DESGLOSE del trabajo: el total a cobrar
 * sigue saliendo de los horómetros (con el mínimo de 1 h), y si las filas no
 * suman lo mismo la vista avisa sin bloquear (decisión del cliente, 05-11).
 */
const actividadDetalleSchema = z.object({
  actividad: z.enum(actividadValues, { message: 'Elegí la actividad' }),
  lugar: z.enum(['TRANSPORTE', 'PLANTA', 'VARIADO'], { message: 'Indicá dónde se hizo' }),
  /** En cuál planta (catálogo del reporte diario) cuando `lugar` es PLANTA.
   * `null` es la forma canónica de «no aplica» (la misma que guarda el
   * servidor): así el payload normalizado sigue siendo de esta forma. */
  planta: z.string().nullable().optional(),
  // Texto o número: punto o coma sueltos son el decimal (`lib/forms.ts#leerNumero`).
  horas: z.preprocess(
    leerNumero,
    z
      .number({ error: (iss) => (iss.input === undefined ? 'Indicá las horas' : NUMERO_INVALIDO) })
      .positive('Las horas deben ser mayores a 0')
      .max(24, 'Máximo 24 h por actividad'),
  ),
});

export type ActividadDetalle = z.infer<typeof actividadDetalleSchema>;

/** Una fila del desglose como la guarda y devuelve el servidor. */
export interface DetalleActividadRegistro {
  actividad: string;
  lugar: string;
  planta: string | null;
  horas: number;
}

const camposTrabajoExtra = z
  .object({
    equipoId: z.string().min(1, 'Seleccioná un equipo'),
    // `id` del catálogo de Operadores (ver `types/operator.ts`) — ya no texto
    // libre. El servidor guarda `operador` (el nombre) como snapshot a partir
    // de este id; el cliente nunca manda ese campo.
    operatorId: z.string().min(1, 'Elegí el operador'),
    faena: z.string().min(1, 'Indicá la faena'),
    turno: z.enum(['DIURNO', 'NOCTURNO']),
    horometroInicial: nonNegNumber('Valor inválido'),
    horometroFinal: nonNegNumber('Valor inválido'),
    /** El desglose, UNA FILA POR ACTIVIDAD — el servidor deriva `actividades`
     * (el resumen) de acá. Las reglas cruzadas van en el `.superRefine`. */
    detalle: z
      .array(actividadDetalleSchema)
      .min(1, 'Agregá al menos una actividad')
      .max(12, 'Máximo 12 actividades por report'),
    otraActividad: z.string().optional(),
    descripcion: z.string().min(3, 'Describí la tarea'),
    observaciones: z.string().optional(),
    /** `YYYY-MM-DD` del trabajo — por defecto hoy; una fecha pasada es la
     * carga histórica. Solo viaja al backend cuando difiere de hoy (ver
     * `useRegistrarTrabajoExtra`): así los registros del día conservan la
     * hora real de captura. */
    fecha: z.string().optional(),
    /** N° del report en papel que respalda el trabajo — el Excel del admin lo lleva. */
    reportNumero: z.string().min(1, 'Indicá el N° del report'),
  });

/**
 * Reglas cruzadas COMPARTIDAS entre creación y edición (el servidor aplica
 * las mismas; acá solo se avisa antes de mandar):
 * - horómetro final ≥ inicial;
 * - «Otro» sin texto deja la actividad como «otro» a secas (incobrable);
 * - solo una limpieza de silos puede hacerse EN PLANTA, y una fila PLANTA
 *   siempre dice en cuál.
 */
const reglasTrabajoExtra = (
  d: Omit<z.infer<typeof camposTrabajoExtra>, 'reportNumero' | 'detalle'> & {
    reportNumero?: string;
    detalle?: ActividadDetalle[];
  },
  ctx: z.RefinementCtx,
) => {
  if (Number(d.horometroFinal) < Number(d.horometroInicial)) {
    ctx.addIssue({ code: 'custom', message: 'El horómetro final debe ser ≥ inicial', path: ['horometroFinal'] });
  }
  const detalle = d.detalle ?? [];
  if (detalle.some((f) => f.actividad === 'OTRO') && !d.otraActividad?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Describí cuál fue la otra actividad', path: ['otraActividad'] });
  }
  detalle.forEach((f, i) => {
    if (f.lugar !== 'PLANTA') return;
    if (f.actividad !== 'LIMPIEZA_SILOS') {
      ctx.addIssue({
        code: 'custom',
        message: 'Solo una limpieza de silos puede hacerse en planta: usá Transporte o Variado',
        path: ['detalle', i, 'lugar'],
      });
    } else if (!f.planta?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Indicá en qué planta se hizo', path: ['detalle', i, 'planta'] });
    }
  });
};

export const trabajoExtraFormSchema = camposTrabajoExtra.superRefine(reglasTrabajoExtra);

/**
 * Edición desde el panel: un trabajo LEGACY (anterior al folio/desglose) se
 * puede corregir sin inventarle esos datos — acá son opcionales y, si vienen
 * vacíos, el formulario los omite y el diff no los toca. Las reglas cruzadas
 * aplican igual cuando sí vienen.
 */
export const trabajoExtraEdicionSchema = camposTrabajoExtra
  .extend({
    reportNumero: z.string().min(1, 'Indicá el N° del report').optional(),
    detalle: camposTrabajoExtra.shape.detalle.optional(),
  })
  .superRefine(reglasTrabajoExtra);

export type TrabajoExtraForm = z.infer<typeof trabajoExtraFormSchema>;
/** La forma de la EDICIÓN: folio y desglose opcionales (trabajos legacy). */
export type TrabajoExtraEdicion = z.infer<typeof trabajoExtraEdicionSchema>;
export type TrabajoExtraFormInput = z.input<typeof trabajoExtraFormSchema>;

/** Body de `POST /api/trabajos-extra` y payload del outbox: el formulario
 * validado + `id` (clave de idempotencia, uuid v4 del cliente) + `capturedAt`
 * (hora del dispositivo). `fecha` solo viaja cuando difiere de hoy. La foto
 * del report NO viaja acá: en Terreno queda como blob junto a la operación y
 * el replay sube el archivo e inyecta `fotoKey` recién al mandar (el admin,
 * online, la sube antes del POST). */
export interface CreateTrabajoExtraInput extends TrabajoExtraForm {
  id: string;
  capturedAt: string;
  /** Fecha elegida en el panel (un trabajo olvidado): gana sobre `capturedAt`. */
  fecha?: string;
  /** Key `tmp/...` de la foto del report ya subida — la pone el replay o el
   * flujo online del admin, nunca el formulario. */
  fotoKey?: string;
}

export interface TrabajoExtraordinario {
  id: string;
  /** Correlativo del sistema (lo asigna la base; no es el folio `reportNumero`). Sin él todavía: un
   * registro que sigue en el equipo, sin señal. */
  numero?: number | null;
  equipoId: string;
  /** `id` del catálogo de Operadores — `null` en registros legacy (previos al
   * catálogo) o si el operador fue borrado (`onDelete: SetNull`). */
  operatorId: string | null;
  /** Snapshot del nombre al momento de crear el registro — es lo que se
   * muestra en historial y detalle, tal cual quedó guardado (no se
   * actualiza si el operador cambia de nombre después). */
  operador: string;
  faena: string;
  turno: string;
  horometroInicial: number;
  horometroFinal: number;
  totalHoras: number;
  /** Resumen derivado del desglose (o el dato original en registros legacy). */
  actividades: string[];
  otraActividad: string | null;
  descripcion: string;
  observaciones: string | null;
  /** N° del report en papel — null en registros previos al campo. */
  reportNumero?: string | null;
  /** El desglose por actividad — null/ausente en registros previos al campo. */
  detalleActividades?: DetalleActividadRegistro[] | null;
  /** Foto del report, como URL firmada (~1 h) — null en registros sin foto;
   * opcional para tolerar un backend que aún no manda el campo. */
  fotoUrl?: string | null;
  fecha: string;
  equipo?: { internalCode: string };
  /** Nombre de quien lo registró — null si la cuenta ya no existe; opcional
   * para tolerar un backend que aún no manda el campo. */
  registradoPor?: string | null;
}

/** Forma de un trabajo extraordinario en las respuestas del servidor. */
export const TrabajoExtraordinarioSchema = z.object({
  id: z.string(),
  /** Correlativo del sistema que asigna la base al crear (no es el folio `reportNumero`). `nullish`: un
   * registro guardado en el equipo (sin señal) todavía no lo tiene, y una
   * respuesta cacheada antes de la columna tampoco. */
  numero: z.number().nullish(),
  equipoId: z.string(),
  operatorId: z.string().nullable(),
  operador: z.string(),
  faena: z.string(),
  turno: z.string(),
  horometroInicial: z.number(),
  horometroFinal: z.number(),
  totalHoras: z.number(),
  actividades: z.array(z.string()),
  otraActividad: z.string().nullable(),
  descripcion: z.string(),
  observaciones: z.string().nullable(),
  reportNumero: z.string().nullable().optional(),
  detalleActividades: z
    .array(
      z.object({
        actividad: z.string(),
        lugar: z.string(),
        planta: z.string().nullable(),
        horas: z.number(),
      }),
    )
    .nullish(),
  fotoUrl: z.string().nullable().optional(),
  fecha: z.string(),
  equipo: z.object({ internalCode: z.string() }).optional(),
  registradoPor: z.string().nullable().optional(),
});

/** `PATCH /api/trabajos-extra/:id`: solo los campos que cambiaron. */
export type EditTrabajoExtraBody = Partial<TrabajoExtraForm>;
