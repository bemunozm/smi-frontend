import { z } from 'zod';

export const horometroFormSchema = z.object({
  equipoId: z.string().min(1, 'Seleccioná un equipo'),
  operadorId: z.string().min(1, 'Indicá el operador'),
  turno: z.enum(['MANANA', 'TARDE', 'NOCHE']),
  valorInicial: z.coerce.number().nonnegative('Valor inválido'),
  valorFinal: z.coerce.number().optional(),
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
