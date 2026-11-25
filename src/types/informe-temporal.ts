import { z } from 'zod';

import { SHIFT_TYPES, type CloseShiftCardInput, type ShiftType } from './shift';

/**
 * Informe del supervisor temporal: cierra de una vez todas sus tarjetas
 * abiertas y registra la jornada (sin `Shift` ni reporte de salida). Misma
 * forma que `InformeTemporalResponse` del backend
 * (`terreno/informes-temporales/informes-temporales.service.ts#shape`).
 */

/** Una persona del informe, en la actividad 1 o 2. `operatorId` solo si es
 * del catálogo de operadores; el personal de apoyo va solo con nombre. */
export type PersonalInforme = { actividad: 1 | 2; operatorId?: string | null; nombre: string };

/**
 * El cierre de UNA tarjeta dentro del informe: los campos de
 * `POST /shift-cards/:id/close` más `cardId`, SIN el turno de quien cierra
 * (`shiftDate`/`shiftType`): la tarjeta temporal nunca entra a un turno y el
 * backend responde 400 si llega. `closeClientId` lo genera el formulario UNA
 * vez y lo repite en cada reintento (idempotencia del cierre).
 */
export type CierreTemporalInput = Omit<CloseShiftCardInput, 'shiftDate' | 'shiftType' | 'fuelLiters'> & {
  cardId: string;
  /** Opcional en el backend solo para el liviano que ya registró cargas con
   * la tarjeta abierta; en el resto lo exige. */
  fuelLiters?: number;
};

/**
 * `POST /api/informes-temporales`. `id` (UUID) lo genera el formulario UNA vez
 * y lo repite en cada reintento: con él un reenvío devuelve el informe ya
 * creado en vez de cerrar todo de nuevo.
 */
export type CreateInformeTemporalInput = {
  id: string;
  /** `YYYY-MM-DD`. */
  fecha: string;
  turno: ShiftType;
  actividad1: string;
  actividad2?: string;
  personal: PersonalInforme[];
  observaciones?: string;
  supervisorResponsable1: string;
  supervisorResponsable2?: string;
  cierres: CierreTemporalInput[];
};

/** `PATCH /api/informes-temporales/:id`: solo los datos del informe (sin `id`
 * ni `cierres`; las lecturas de cada tarjeta se corrigen en la tarjeta).
 * `actividad2: ''` quita la actividad 2. */
export type UpdateInformeTemporalInput = Partial<Omit<CreateInformeTemporalInput, 'id' | 'cierres'>>;

export const PersonalInformeSchema = z.object({
  actividad: z.union([z.literal(1), z.literal(2)]),
  operatorId: z.string().nullable(),
  nombre: z.string(),
});

export const InformeTemporalTarjetaSchema = z.object({
  id: z.string(),
  /** `name` = tipo, marca y modelo: el equipo no tiene un nombre propio. */
  equipo: z.object({ id: z.string(), internalCode: z.string(), name: z.string() }),
  operador: z.string(),
  valorInicial: z.number(),
  valorFinal: z.number().nullable(),
  fuelLiters: z.number().nullable(),
  adBlueLiters: z.number().nullable(),
  /** URL firmada; `null` si la tarjeta se cerró sin foto. */
  pumpPhotoUrl: z.string().nullable(),
  /** ISO. */
  fecha: z.string(),
  fechaSalida: z.string().nullable(),
});

export const InformeTemporalSchema = z.object({
  id: z.string(),
  numero: z.number().int(),
  /** `YYYY-MM-DD`. */
  fecha: z.string(),
  turno: z.enum(SHIFT_TYPES),
  actividad1: z.string(),
  actividad2: z.string().nullable(),
  personal: z.array(PersonalInformeSchema),
  observaciones: z.string().nullable(),
  supervisorResponsable1: z.string(),
  supervisorResponsable2: z.string().nullable(),
  supervisorId: z.string(),
  supervisorNombre: z.string(),
  /** ISO: apertura de la primera tarjeta y momento del envío. */
  inicio: z.string(),
  fin: z.string(),
  /** URL firmada de la foto del report en papel (hoy solo la traen los «Report»
   * migrados); `null`/ausente si no tiene. */
  fotoUrl: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tarjetas: z.array(InformeTemporalTarjetaSchema),
});

export type InformeTemporal = z.infer<typeof InformeTemporalSchema>;
export type InformeTemporalTarjeta = z.infer<typeof InformeTemporalTarjetaSchema>;

export const InformeTemporalResponseSchema = z.object({ data: InformeTemporalSchema, message: z.string().optional() });
export const InformesTemporalesResponseSchema = z.object({
  data: z.array(InformeTemporalSchema),
  message: z.string().optional(),
});
