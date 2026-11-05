/**
 * Cobro de un trabajo extraordinario.
 *
 * Por regla se cobra un **mínimo de una
 * hora máquina**, aunque la tarea tome minutos. El horómetro marca décimas de
 * hora, así que una tarea corta puede leerse 0,2 h o incluso 0,0 h, y lo que
 * se cobra sigue siendo una hora.
 *
 * Las horas reales se guardan tal cual (`totalHoras`): son el respaldo de lo
 * que pasó. El mínimo se aplica al leerlas para cobrar, no al guardarlas —
 * así, si el cliente cambia la regla, no hay registros viejos que corregir.
 */

export const COBRO_MINIMO_HORAS = 1;

/**
 * El correlativo del sistema: «#12». Sin él (todavía en el equipo, sin señal),
 * «Sin correlativo aún». No es el folio del report en papel (`reportNumero`,
 * «Report N°»), que escribe el supervisor: este lo asigna la base y nadie lo
 * cambia.
 */
export function numeroReport(numero: number | null | undefined): string {
  return numero == null ? 'Sin correlativo aún' : `#${numero}`;
}

export function horasCobrables(horasReales: number): number {
  return Math.max(COBRO_MINIMO_HORAS, horasReales);
}

/** ¿Se está cobrando el mínimo y no las horas reales? */
export function cobraMinimo(horasReales: number): boolean {
  return horasReales < COBRO_MINIMO_HORAS;
}
