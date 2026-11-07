/** Espejo de `AsistenciaService` (smi-backend/src/asistencia). */
export interface PersonaAsistencia {
  id: string;
  nombre: string;
  tipo: 'SUPERVISOR' | 'OPERADOR';
  /** Días del mes con X, ascendente (ej. `[1, 2, 6]`). */
  dias: number[];
  /** `dias.length` — el número que va a la liquidación. */
  total: number;
}

export interface AsistenciaMes {
  mes: string;
  /** Cantidad de días del mes (28–31). */
  dias: number;
  /** SUPERVISOR primero, luego OPERADOR; alfabético dentro del grupo. */
  personas: PersonaAsistencia[];
}
