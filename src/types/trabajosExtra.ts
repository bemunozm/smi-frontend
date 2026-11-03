import { z } from 'zod';
import { nonNegNumber } from '../lib/forms';

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
 * Dónde se hizo el trabajo (pedido del cliente, espejo de la columna «Planta»
 * de su planilla): Transporte, una planta concreta —solo para limpieza de
 * silos— o Variado cuando la salida mezcla destinos. Lo declara el supervisor.
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

export const trabajoExtraFormSchema = z
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
    // Varias: una misma salida suele mezclar tareas.
    actividades: z.array(z.enum(actividadValues)).min(1, 'Elegí al menos una actividad'),
    otraActividad: z.string().optional(),
    descripcion: z.string().min(3, 'Describí la tarea'),
    observaciones: z.string().optional(),
    /** N° del report en papel que respalda el trabajo — el Excel del admin lo lleva. */
    reportNumero: z.string().min(1, 'Indicá el N° del report'),
    /** Dónde se hizo — las reglas cruzadas van en los `.refine()` de abajo. */
    destino: z.enum(['TRANSPORTE', 'PLANTA', 'VARIADO'], { message: 'Indicá dónde se hizo' }),
    /** En cuál planta (catálogo del reporte diario) cuando `destino` es PLANTA. */
    planta: z.string().optional(),
  })
  .refine((d) => Number(d.horometroFinal) >= Number(d.horometroInicial), {
    message: 'El horómetro final debe ser ≥ inicial',
    path: ['horometroFinal'],
  })
  /**
   * «Otro» sin texto deja la actividad registrada como «otro» a secas, y el
   * trabajo no se podría justificar ni cobrar. El servidor aplica la misma
   * regla; acá solo se avisa antes de mandar.
   */
  .refine((d) => !d.actividades.includes('OTRO') || !!d.otraActividad?.trim(), {
    message: 'Describí cuál fue la otra actividad',
    path: ['otraActividad'],
  })
  /**
   * Regla del cliente: solo una limpieza de silos puede hacerse EN PLANTA —
   * el resto es Transporte o Variado. Y un destino PLANTA siempre dice cuál.
   * El servidor aplica las mismas reglas; acá solo se avisa antes de mandar.
   */
  .refine((d) => d.destino !== 'PLANTA' || d.actividades.includes('LIMPIEZA_SILOS'), {
    message: 'Solo una limpieza de silos puede hacerse en planta: usá Transporte o Variado',
    path: ['destino'],
  })
  .refine((d) => d.destino !== 'PLANTA' || !!d.planta?.trim(), {
    message: 'Indicá en qué planta se hizo',
    path: ['planta'],
  });

export type TrabajoExtraForm = z.infer<typeof trabajoExtraFormSchema>;
export type TrabajoExtraFormInput = z.input<typeof trabajoExtraFormSchema>;

/** Body de `POST /api/trabajos-extra` y payload del outbox: el formulario
 * validado + `id` (clave de idempotencia, uuid v4 del cliente) + `capturedAt`
 * (hora del dispositivo). La foto del report NO viaja acá: en Terreno queda
 * como blob junto a la operación y el replay sube el archivo e inyecta
 * `fotoKey` recién al mandar (el admin, online, la sube antes del POST). */
export interface CreateTrabajoExtraInput extends TrabajoExtraForm {
  id: string;
  capturedAt: string;
  /** Key `tmp/...` de la foto del report ya subida — la pone el replay o el
   * flujo online del admin, nunca el formulario. */
  fotoKey?: string;
}

export interface TrabajoExtraordinario {
  id: string;
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
  actividades: string[];
  otraActividad: string | null;
  descripcion: string;
  observaciones: string | null;
  /** N° del report en papel — null en registros previos al campo. */
  reportNumero?: string | null;
  /** TRANSPORTE | PLANTA | VARIADO — null en registros previos al campo. */
  destino?: string | null;
  /** Nombre de la planta cuando `destino` es PLANTA. */
  planta?: string | null;
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
  destino: z.string().nullable().optional(),
  planta: z.string().nullable().optional(),
  fotoUrl: z.string().nullable().optional(),
  fecha: z.string(),
  equipo: z.object({ internalCode: z.string() }).optional(),
  registradoPor: z.string().nullable().optional(),
});

/** `PATCH /api/trabajos-extra/:id`: solo los campos que cambiaron. */
export type EditTrabajoExtraBody = Partial<TrabajoExtraForm>;
