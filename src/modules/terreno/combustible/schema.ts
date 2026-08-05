import { z } from 'zod';

export const combustibleFormSchema = z.object({
  equipoId: z.string().min(1, 'Seleccioná un equipo'),
  litros: z.number().positive('Litros debe ser mayor a 0'),
  lecturaActual: z.number().optional(),
  fotoUrl: z.string().optional(), // ruta servida por el backend (/uploads/...)
});

export type CombustibleForm = z.infer<typeof combustibleFormSchema>;

export interface RegistroCombustible {
  id: string;
  equipoId: string;
  litros: number;
  fotoUrl: string | null;
  rendimiento: number | null;
  fecha: string;
  equipo?: { codigo: string };
}
