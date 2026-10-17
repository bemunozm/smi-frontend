import { z } from 'zod';

export const SECCIONES = ['INTERNOS', 'MINA_CALETA', 'MINERAS'] as const;

export const SECCION_LABEL: Record<string, string> = {
  INTERNOS: 'Camiones internos',
  MINA_CALETA: 'Camiones Mina Caleta',
  MINERAS: 'Camiones mineras',
};

export const TRASPASO_TIPOS = ['INTERNOS', 'EXTERNOS', 'MINA_PUERTO'] as const;

export const TRASPASO_LABEL: Record<string, string> = {
  INTERNOS: 'Equipos internos',
  EXTERNOS: 'Equipos externos',
  MINA_PUERTO: 'Equipos Mina-Puerto',
};

export const PlantaSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  orden: z.number().int(),
  activa: z.boolean(),
});
export type Planta = z.infer<typeof PlantaSchema>;

export const EmpresaExternaSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  activa: z.boolean(),
});
export type EmpresaExterna = z.infer<typeof EmpresaExternaSchema>;

export const ReporteDiarioSchema = z.object({
  id: z.string(),
  fecha: z.string(),
  turno: z.enum(['DIURNO', 'NOCTURNO']),
  supervisorId: z.string(),
  supervisorNombre: z.string(),
  observaciones: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  produccion: z.array(
    z.object({
      seccion: z.enum(SECCIONES),
      camiones: z.number().int(),
      vueltasPorCamion: z.number().int(),
    }).passthrough(),
  ),
  tolvas: z.array(
    z.object({ tolva: z.number().int(), cargas: z.number().int() }).passthrough(),
  ),
  plantas: z.array(
    z.object({
      plantaId: z.string(),
      producto: z.string(),
      planta: z.object({ nombre: z.string() }),
    }).passthrough(),
  ),
  traspasos: z.array(
    z.object({
      tipo: z.enum(TRASPASO_TIPOS),
      cantidad: z.number().int(),
    }).passthrough(),
  ),
  empresas: z.array(
    z.object({
      empresaId: z.string(),
      empresa: z.object({ nombre: z.string() }),
    }).passthrough(),
  ),
  personal: z.array(
    z.object({ rol: z.string(), nombre: z.string(), orden: z.number().int() }).passthrough(),
  ),
});
export type ReporteDiario = z.infer<typeof ReporteDiarioSchema>;

/** Lo que el formulario envía al crear (el `id` lo agrega la cola offline). */
export interface CreateReporteDiarioInput {
  fecha: string; // YYYY-MM-DD
  turno: 'DIURNO' | 'NOCTURNO';
  produccion: { seccion: string; camiones: number; vueltasPorCamion: number }[];
  tolvas: { tolva: number; cargas: number }[];
  plantas: { plantaId: string; producto: string }[];
  traspasos: { tipo: string; cantidad: number }[];
  empresaIds: string[];
  personal: { rol: string; nombre: string }[];
  observaciones?: string;
}

/** Corrección post-envío: los mismos bloques, todos opcionales. */
export type EditReporteDiarioBody = Partial<CreateReporteDiarioInput> & {
  fecha?: never;
  turno?: never;
};
