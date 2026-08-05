import { z } from 'zod';

export const CRITICIDADES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;

export const hallazgoFormSchema = z.object({
  equipoId: z.string().min(1, 'Seleccioná un equipo'),
  descripcion: z.string().min(3, 'Describí el hallazgo'),
  criticidad: z.enum(CRITICIDADES),
  fotoUrl: z.string().optional(),
});

export type HallazgoForm = z.infer<typeof hallazgoFormSchema>;

export interface Hallazgo {
  id: string;
  equipoId: string;
  descripcion: string;
  criticidad: string;
  estado: string;
  fotoUrl: string | null;
  fecha: string;
  equipo?: { codigo: string };
}
