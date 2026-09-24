import { z } from 'zod';
import { posNumber } from '../lib/forms';

export const combustibleFormSchema = z.object({
  equipoId: z.string().min(1, 'Seleccioná un equipo'),
  litros: posNumber('Litros debe ser mayor a 0'),
  tipo: z.enum(['PETROLEO', 'BENCINA']),
  fotoUrl: z.string().optional(), // ruta servida por el backend (/uploads/...)
  // ISO datetime — auto-rellenada en el modal desde la EXIF de la foto (o
  // "ahora" sin EXIF), editable. Opcional en el schema porque el backend cae
  // a `@default(now())` sin ella, pero el modal siempre la manda con valor.
  fecha: z.string().optional(),
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
  equipo?: { internalCode: string };
}
