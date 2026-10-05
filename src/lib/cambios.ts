import type { CambioCampo } from '../types/cambios';

/** Un dato comparable de un registro, con su valor ya legible. */
export interface CampoComparable {
  field: string;
  label: string;
  antes: string;
  despues: string;
}

const legible = (v: string) => (v.trim() === '' ? '—' : v.trim());

/**
 * Lo que cambió entre dos versiones de un registro. La misma regla que el
 * backend (`diffFields`): se compara el valor legible, así que guardar sin
 * tocar nada no produce un cambio que avisar.
 *
 * La usan las pantallas que todavía son maqueta (Registro de equipo y Reporte
 * diario); Trabajos extra recibe los cambios ya calculados del servidor.
 */
export function diferencias(campos: readonly CampoComparable[]): CambioCampo[] {
  return campos.flatMap(({ field, label, antes, despues }) => {
    const before = legible(antes);
    const after = legible(despues);
    return before === after ? [] : [{ field, label, before, after }];
  });
}
