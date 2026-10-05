/**
 * Cobro de un trabajo extraordinario.
 *
 * Acta N.° 004 (28/09/2026), punto 4: por regla se cobra un **mínimo de una
 * hora máquina**, aunque la tarea tome minutos. El horómetro marca décimas de
 * hora, así que una tarea corta puede leerse 0,2 h o incluso 0,0 h, y lo que
 * se cobra sigue siendo una hora.
 *
 * Las horas reales se guardan tal cual (`totalHoras`): son el respaldo de lo
 * que pasó. El mínimo se aplica al leerlas para cobrar, no al guardarlas —
 * así, si el cliente cambia la regla, no hay registros viejos que corregir.
 */

export const COBRO_MINIMO_HORAS = 1;

export function horasCobrables(horasReales: number): number {
  return Math.max(COBRO_MINIMO_HORAS, horasReales);
}

/** ¿Se está cobrando el mínimo y no las horas reales? */
export function cobraMinimo(horasReales: number): boolean {
  return horasReales < COBRO_MINIMO_HORAS;
}
