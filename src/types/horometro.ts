import { z } from 'zod';
import { nonNegNumber, optNumber } from '../lib/forms';

export const horometroFormSchema = z.object({
  equipoId: z.string().min(1, 'Seleccioná un equipo'),
  operador: z.string().min(1, 'Indicá el operador'),
  turno: z.enum(['DIURNO', 'NOCTURNO']),
  valorInicial: nonNegNumber('Valor inválido'),
  valorFinal: optNumber,
  nivelCombustible: optNumber,
  fotoUrl: z.string().optional(), // ruta servida por el backend (/uploads/...)
});

export type HorometroForm = z.infer<typeof horometroFormSchema>;
export type HorometroFormInput = z.input<typeof horometroFormSchema>;

export interface RegistroHorometro {
  id: string;
  equipoId: string;
  operador: string;
  turno: string;
  valorInicial: number;
  valorFinal: number | null;
  nivelCombustible: number | null;
  fotoUrl: string | null;
  fecha: string;
  equipo?: { internalCode: string };
}
