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
