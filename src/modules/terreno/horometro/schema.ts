import { z } from 'zod';
import { nonNegNumber, optNumber } from '../../../shared/lib/forms';

export const horometroFormSchema = z.object({
  equipoId: z.string().min(1, 'Seleccioná un equipo'),
  operadorId: z.string().min(1, 'Indicá el operador'),
  turno: z.enum(['MANANA', 'TARDE', 'NOCHE']),
  valorInicial: nonNegNumber('Valor inválido'),
  valorFinal: optNumber,
});

export type HorometroForm = z.infer<typeof horometroFormSchema>;
export type HorometroFormInput = z.input<typeof horometroFormSchema>;

export interface RegistroHorometro {
  id: string;
  equipoId: string;
  operadorId: string;
  turno: string;
  valorInicial: number;
  valorFinal: number | null;
  fecha: string;
  equipo?: { codigo: string };
}
