import { z } from 'zod';

export const horometroFormSchema = z.object({
  equipoId: z.string().min(1, 'Seleccioná un equipo'),
  operadorId: z.string().min(1, 'Indicá el operador'),
  turno: z.enum(['MANANA', 'TARDE', 'NOCHE']),
  valorInicial: z.number().nonnegative('Valor inválido'),
  valorFinal: z.number().optional(),
});

export type HorometroForm = z.infer<typeof horometroFormSchema>;

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
