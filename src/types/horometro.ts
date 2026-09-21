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
  /** Hora de SALIDA (flujo de dos pasos, Flota) — `null` mientras el turno
   * sigue abierto (`valorFinal == null`). Ver `PATCH /horometro/:id/salida`. */
  fechaSalida: string | null;
  /** Foto de respaldo de la SALIDA — igual que `fotoUrl`, pero de la lectura
   * final. `null` mientras el turno sigue abierto. */
  fotoUrlSalida: string | null;
  equipo?: { internalCode: string };
}

/** Body de `PATCH /api/horometro/:id/salida` — cierra un turno abierto (ver
 * `RegistroHorometro`). El backend valida que el registro esté abierto
 * (404 si no existe, 409 si ya está cerrado) y que `valorFinal >=
 * valorInicial` (400 en caso contrario). */
export interface CerrarHorometroInput {
  valorFinal: number;
  fotoUrlSalida?: string;
  nivelCombustible?: number;
}
