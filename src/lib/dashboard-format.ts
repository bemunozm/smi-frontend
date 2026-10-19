/** Formatos es-CL compartidos por las vistas del dashboard. */

/** Un decimal máximo (miles con punto, decimales con coma). */
export const NUM_CL_1 = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

/** Enteros es-CL. */
export const NUM_CL = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

/** `2026-10-02` → `02/10` sin pasar por Date (evita corrimientos de zona horaria). */
export function formatDia(fecha: string): string {
  const [, mes, dia] = fecha.split('-');
  return mes && dia ? `${dia}/${mes}` : fecha;
}
