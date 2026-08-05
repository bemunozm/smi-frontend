import { z } from 'zod';
import { posNumber } from '../../../shared/lib/forms';

export const combustibleFormSchema = z.object({
  equipoId: z.string().min(1, 'Seleccioná un equipo'),
  litros: posNumber('Litros debe ser mayor a 0'),
  tipo: z.enum(['PETROLEO', 'BENCINA']),
  fotoUrl: z.string().optional(), // ruta servida por el backend (/uploads/...)
});

export type CombustibleForm = z.infer<typeof combustibleFormSchema>;
export type CombustibleFormInput = z.input<typeof combustibleFormSchema>;

export interface RegistroCombustible {
  id: string;
  equipoId: string;
  litros: number;
  tipo: string;
  fotoUrl: string | null;
  fecha: string;
  equipo?: { codigo: string };
}
