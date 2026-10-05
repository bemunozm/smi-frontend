import { z } from 'zod';

export const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;

export const hallazgoFormSchema = z.object({
  equipoId: z.string().min(1, 'Seleccioná un equipo'),
  descripcion: z.string().min(3, 'Describí el hallazgo'),
  prioridad: z.enum(PRIORIDADES),
  /**
   * La foto nueva sube a storage privado y viaja como `fotoKey`; `fotoUrl`
   * queda para los hallazgos ya cargados por `/api/uploads`. El servidor
   * rechaza las dos juntas, así que el formulario manda una sola.
   */
  fotoUrl: z.string().optional(),
  fotoKey: z.string().optional(),
});

export type HallazgoForm = z.infer<typeof hallazgoFormSchema>;

/**
 * Lo que se guarda en el outbox al registrar un hallazgo: `id` es la clave de
 * idempotencia (uuid v4 del cliente) y `capturedAt` la hora del dispositivo.
 * La foto no viaja acá — se sube aparte y su key se agrega al mandar el POST
 * (ver `CreateHallazgoBody`).
 */
export interface CreateHallazgoInput {
  id: string;
  equipoId: string;
  descripcion: string;
  prioridad: HallazgoForm['prioridad'];
  capturedAt: string;
}

/** Body real de `POST /api/hallazgos`. */
export interface CreateHallazgoBody extends CreateHallazgoInput {
  fotoKey?: string;
}

export interface Hallazgo {
  id: string;
  equipoId: string;
  descripcion: string;
  prioridad: string;
  estado: string;
  fotoUrl: string | null;
  fecha: string;
  equipo?: { internalCode: string };
}

/** Forma de un hallazgo en las respuestas del servidor. */
export const HallazgoSchema = z.object({
  id: z.string(),
  equipoId: z.string(),
  descripcion: z.string(),
  prioridad: z.string(),
  estado: z.string(),
  fotoUrl: z.string().nullable(),
  fecha: z.string(),
  equipo: z.object({ internalCode: z.string() }).optional(),
});

/** `PATCH /api/hallazgos/:id`: solo los campos que cambiaron (la foto no se edita). */
export type EditHallazgoBody = {
  equipoId?: string;
  descripcion?: string;
  prioridad?: string;
  estado?: string;
};
