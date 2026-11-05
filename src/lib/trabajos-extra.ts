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

import { actividadLabel, destinoLabel } from '../types/trabajosExtra';
import type { ActividadDetalle, DetalleActividadRegistro } from '../types/trabajosExtra';

export const COBRO_MINIMO_HORAS = 1;

/**
 * El desglose en su forma de servidor (`planta` solo en filas PLANTA, `horas`
 * a 2 decimales — el mismo redondeo que aplica el backend): sirve de cuerpo
 * del PATCH y de término de comparación contra `detalleActividades`, para que
 * un formulario abierto y guardado sin tocar no marque el desglose como
 * cambiado. OJO: el desglose NO entra en la precondición `X-Expected` (el
 * header solo acepta primitivos); el servidor audita el reemplazo completo.
 */
export function detalleComparable(
  filas: readonly (ActividadDetalle | DetalleActividadRegistro)[] | null | undefined,
): DetalleActividadRegistro[] | undefined {
  if (filas == null || filas.length === 0) return undefined;
  return filas.map((f) => ({
    actividad: f.actividad,
    lugar: f.lugar,
    planta: f.lugar === 'PLANTA' ? (f.planta?.trim() || null) : null,
    horas: Number(Number(f.horas).toFixed(2)),
  }));
}

/** `Limpieza de silos · Planta (P.P.1)` — el lugar de una fila, legible. */
export function lugarDeFila(fila: { lugar: string; planta?: string | null }): string {
  if (fila.lugar === 'PLANTA' && fila.planta) return `Planta (${fila.planta})`;
  return destinoLabel[fila.lugar] ?? fila.lugar;
}

/** La actividad de una fila, legible; «Otro» muestra el texto libre si existe. */
export function actividadDeFila(
  fila: { actividad: string },
  otraActividad?: string | null,
): string {
  if (fila.actividad === 'OTRO' && otraActividad?.trim()) return otraActividad.trim();
  return actividadLabel[fila.actividad] ?? fila.actividad;
}

/** Suma del desglose, para el aviso (no bloqueante) contra las horas a cobrar. */
export function horasDelDetalle(filas: readonly { horas: number }[]): number {
  return Number(filas.reduce((acc, f) => acc + (Number.isFinite(f.horas) ? f.horas : 0), 0).toFixed(2));
}

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

/** Lo que el formulario dice bajo «N° del report». */
export interface PistaFolio {
  /** El folio más alto ya registrado (tal como se escribió), o null si no hay. */
  ultimo: string | null;
  /** El que seguiría en la secuencia (`ultimo + 1`, con sus ceros a la izquierda). */
  siguiente: string | null;
  /** El folio escrito ya está en otro Report. */
  repetido: boolean;
}

/**
 * Pista para el folio del report en papel (pedido del 05/11): los reports
 * vienen foliados en secuencia, así que se muestra el último registrado y el
 * que seguiría — para que el siguiente se cargue con el número correcto.
 *
 * «Último» es el folio NUMÉRICO más alto, no el último que se cargó: un report
 * olvidado que se carga días después trae un folio viejo y no debe mover la
 * sugerencia. Los folios que no son solo dígitos no cuentan para la secuencia.
 * `exceptoId`: al corregir un Report, el suyo no cuenta como repetido.
 */
export function pistaFolio(
  registros: readonly { id: string; reportNumero?: string | null }[],
  escrito: string,
  exceptoId?: string,
): PistaFolio {
  let ultimo: string | null = null;
  let maximo = -1;
  for (const r of registros) {
    const folio = r.reportNumero?.trim() ?? '';
    if (!/^\d+$/.test(folio)) continue;
    const valor = Number(folio);
    if (valor > maximo) {
      maximo = valor;
      ultimo = folio;
    }
  }
  const siguiente = ultimo == null ? null : String(maximo + 1).padStart(ultimo.length, '0');
  const buscado = escrito.trim();
  const repetido =
    buscado !== '' && registros.some((r) => r.id !== exceptoId && r.reportNumero?.trim() === buscado);
  return { ultimo, siguiente, repetido };
}

/** La pista en una línea: «Último report registrado: 4508 · el siguiente sería 4509.» */
export function textoPistaFolio(pista: PistaFolio): string | null {
  if (pista.ultimo == null) return null;
  return `Último report registrado: ${pista.ultimo} · el siguiente sería ${pista.siguiente}.`;
}
