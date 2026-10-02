import { z } from 'zod';
import { nonNegNumber } from '../lib/forms';

export const ACTIVIDADES = [
  { value: 'REGULACION_CARGA', label: 'Regulación y carga' },
  { value: 'LIMPIEZA_CANCHA', label: 'Limpieza de cancha' },
  { value: 'SOLTAR_MATERIAL', label: 'Soltar material' },
  { value: 'LIMPIEZA_SILOS', label: 'Limpieza de silos' },
  // «Pretil», no «petril» (Acta N.° 004, punto 3). Solo cambia la etiqueta:
  // el valor guardado en la base sigue siendo `HACER_PETRIL`.
  { value: 'HACER_PETRIL', label: 'Hacer pretil' },
  { value: 'ARREGLO_CANCHA', label: 'Arreglo cancha' },
  // Válvula de escape para la tarea que no estaba en la lista. El texto va en
  // `otraActividad`; el servidor lo exige cuando se elige esta opción.
  { value: 'OTRO', label: 'Otro' },
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
    // Varias: una misma salida suele mezclar tareas.
    actividades: z.array(z.enum(actividadValues)).min(1, 'Elegí al menos una actividad'),
    otraActividad: z.string().optional(),
    descripcion: z.string().min(3, 'Describí la tarea'),
    observaciones: z.string().optional(),
  })
  .refine((d) => Number(d.horometroFinal) >= Number(d.horometroInicial), {
    message: 'El horómetro final debe ser ≥ inicial',
    path: ['horometroFinal'],
  })
  /**
   * «Otro» sin texto deja la actividad registrada como «otro» a secas, y el
   * trabajo no se podría justificar ni cobrar. El servidor aplica la misma
   * regla; acá solo se avisa antes de mandar.
   */
  .refine((d) => !d.actividades.includes('OTRO') || !!d.otraActividad?.trim(), {
    message: 'Describí cuál fue la otra actividad',
    path: ['otraActividad'],
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
  actividades: string[];
  otraActividad: string | null;
  descripcion: string;
  observaciones: string | null;
  fecha: string;
  equipo?: { internalCode: string };
}
