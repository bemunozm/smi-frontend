import { z } from 'zod';

export const trabajoExtraFormSchema = z.object({
  equipoId: z.string().min(1, 'Seleccioná un equipo'),
  cliente: z.string().min(1, 'Indicá el cliente'),
  horasMaquina: z.coerce.number().positive('Debe ser mayor a 0'),
  tonelaje: z.coerce.number().optional(),
  tarifa: z.coerce.number().positive('Debe ser mayor a 0'),
});

export type TrabajoExtraForm = z.infer<typeof trabajoExtraFormSchema>;
export type TrabajoExtraFormInput = z.input<typeof trabajoExtraFormSchema>;

export function calcMonto(horasMaquina: number, tarifa: number): number {
  return Number((horasMaquina * tarifa).toFixed(2));
}

export interface TrabajoExtraordinario {
  id: string;
  equipoId: string;
  cliente: string;
  horasMaquina: number;
  tonelaje: number | null;
  tarifa: number;
  monto: number;
  fotoUrl: string | null;
  fecha: string;
  equipo?: { codigo: string };
}
