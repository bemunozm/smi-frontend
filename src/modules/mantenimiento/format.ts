// Utilidades de formato — contexto minería chilena.

/** Formatea números en formato es-CL (punto como separador de miles). */
export function formatNumber(value: number): string {
  return value.toLocaleString('es-CL')
}
