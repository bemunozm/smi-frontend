import { z } from 'zod';
import { nonNegNumber } from '../lib/forms';

export const ACTIVIDADES = [
  { value: 'REGULACION_CARGA', label: 'Regulación y carga' },
  { value: 'LIMPIEZA_CANCHA', label: 'Limpieza de cancha' },
  { value: 'SOLTAR_MATERIAL', label: 'Soltar material' },
  { value: 'LIMPIEZA_SILOS', label: 'Limpieza de silos' },
  { value: 'HACER_PETRIL', label: 'Hacer petril' },
  { value: 'ARREGLO_CANCHA', label: 'Arreglo cancha' },
] as const;

export const actividadLabel: Record<string, string> = Object.fromEntries(
  ACTIVIDADES.map((a) => [a.value, a.label]),
);

const actividadValues = ACTIVIDADES.map((a) => a.value) as [string, ...string[]];

export const trabajoExtraFormSchema = z
  .object({
    equipoId: z.string().min(1, 'Seleccioná un equipo'),
    operador: z.string().min(1, 'Indicá el operador'),
    faena: z.string().min(1, 'Indicá la faena'),
    turno: z.enum(['DIURNO', 'NOCTURNO']),
    horometroInicial: nonNegNumber('Valor inválido'),
    horometroFinal: nonNegNumber('Valor inválido'),
    actividad: z.enum(actividadValues),
    descripcion: z.string().min(3, 'Describí la tarea'),
    observaciones: z.string().optional(),
  })
  .refine((d) => Number(d.horometroFinal) >= Number(d.horometroInicial), {
    message: 'El horómetro final debe ser ≥ inicial',
    path: ['horometroFinal'],
  });

export type TrabajoExtraForm = z.infer<typeof trabajoExtraFormSchema>;
export type TrabajoExtraFormInput = z.input<typeof trabajoExtraFormSchema>;

export interface TrabajoExtraordinario {
  id: string;
  equipoId: string;
  operador: string;
  faena: string;
  turno: string;
  horometroInicial: number;
  horometroFinal: number;
  totalHoras: number;
  actividad: string;
  descripcion: string;
  observaciones: string | null;
  fecha: string;
  equipo?: { codigo: string };
}
