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
import { plantasDeFila } from '../types/trabajosExtra';
import type { ActividadDetalle, DetalleActividadRegistro } from '../types/trabajosExtra';

export const COBRO_MINIMO_HORAS = 1;

/** Una fila del desglose como viaja al servidor (POST y PATCH). */
export interface DetalleActividadCuerpo {
  actividad: string;
  lugar: string;
  plantas: string[];
  horas: number;
  descripcion: string | null;
}

/**
 * El desglose en su forma de servidor (`plantas` solo en filas PLANTA, sin
 * repetir; `horas` a 2 decimales — el mismo redondeo que aplica el backend):
 * sirve de cuerpo del POST/PATCH y de término de comparación contra
 * `detalleActividades`, para que un formulario abierto y guardado sin tocar no
 * marque el desglose como cambiado. OJO: el desglose NO entra en la
 * precondición `X-Expected` (el header solo acepta primitivos); el servidor
 * audita el reemplazo completo.
 */
export function detalleComparable(
  filas: readonly (ActividadDetalle | DetalleActividadRegistro)[] | null | undefined,
): DetalleActividadCuerpo[] | undefined {
  if (filas == null || filas.length === 0) return undefined;
  return filas.map((f) => ({
    actividad: f.actividad,
    lugar: f.lugar,
    plantas:
      f.lugar === 'PLANTA'
        ? [...new Set(plantasDeFila({ plantas: f.plantas, planta: 'planta' in f ? f.planta : null }).map((p) => p.trim()))]
            .filter((p) => p !== '')
        : [],
    horas: Number(Number(f.horas).toFixed(2)),
    descripcion: f.descripcion?.trim() || null,
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
 * El folio del papel en su forma canónica: dígitos sin ceros a la izquierda
 * («04615» → «4615»), igual que lo guarda el servidor. `null` si no es un
 * entero positivo (vacío, letras, signos o cero).
 */
export function normalizarFolio(texto: string | null | undefined): string | null {
  const limpio = (texto ?? '').trim();
  if (!/^\d+$/.test(limpio)) return null;
  const sinCeros = limpio.replace(/^0+/, '');
  return sinCeros === '' ? null : sinCeros;
}

/**
 * EL número del Report: el folio del papel que escribe el supervisor
 * (`reportNumero`, único — decisión del cliente, 26-11), «N° 4615». El
 * correlativo automático (`numero`) ya no se muestra. Un registro previo al
 * folio sale «Sin N°».
 */
export function numeroReport(reportNumero: string | null | undefined): string {
  const folio = reportNumero?.trim();
  return folio ? `N° ${folio}` : 'Sin N°';
}

/** Horas a cobrar: las reales con el mínimo de 1 h. Un report NULO (papel
 * anulado) no se cobra: 0 h, sin mínimo. */
export function horasCobrables(horasReales: number, nulo = false): number {
  if (nulo) return 0;
  return Math.max(COBRO_MINIMO_HORAS, horasReales);
}

/** ¿Se está cobrando el mínimo y no las horas reales? Nunca en un nulo. */
export function cobraMinimo(horasReales: number, nulo = false): boolean {
  return !nulo && horasReales < COBRO_MINIMO_HORAS;
}

/** Etiqueta del chip de un report nulo (lista, tabla, detalle, Excel). */
export const ETIQUETA_NULO = 'NULO';

/** El código del equipo de un Report, o `—` (un nulo puede no tenerlo). */
export function codigoEquipoReport(t: { equipo?: { internalCode: string } | null; equipoId: string | null }): string {
  return t.equipo?.internalCode ?? t.equipoId ?? '—';
}

/** Lo que el formulario dice bajo «N° de report». */
export interface PistaFolio {
  /** El folio más alto ya registrado (tal como se escribió), o null si no hay. */
  ultimo: string | null;
  /** El que seguiría en la secuencia (`ultimo + 1`, con sus ceros a la izquierda). */
  siguiente: string | null;
  /** El folio escrito ya está en otro Report — BLOQUEA el envío (es único). */
  repetido: boolean;
}

/**
 * Pista para el folio del report en papel (pedido del 05/11): los reports
 * vienen foliados en secuencia, así que se muestra el último registrado y el
 * que seguiría — para que el siguiente se cargue con el número correcto. Un
 * report NULO cuenta igual: su folio está tomado.
 *
 * «Último» es el folio NUMÉRICO más alto, no el último que se cargó: un report
 * olvidado que se carga días después trae un folio viejo y no debe mover la
 * sugerencia. Los folios que no son solo dígitos no cuentan para la secuencia.
 * `repetido` compara normalizado (`0099` = `99`), como el servidor, que no
 * deja repetirlo. `exceptoId`: al corregir un Report, el suyo no cuenta.
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
  const buscado = normalizarFolio(escrito);
  const repetido =
    buscado != null &&
    registros.some((r) => r.id !== exceptoId && normalizarFolio(r.reportNumero) === buscado);
  return { ultimo, siguiente, repetido };
}

/** La pista en una línea: «Último report registrado: 4508 · el siguiente sería 4509.» */
export function textoPistaFolio(pista: PistaFolio): string | null {
  if (pista.ultimo == null) return null;
  return `Último report registrado: ${pista.ultimo} · el siguiente sería ${pista.siguiente}.`;
}

/** El error (bloqueante) de un folio que ya tiene otro Report. */
export function mensajeFolioRepetido(folio: string): string {
  return `El N° ${normalizarFolio(folio) ?? folio.trim()} ya está registrado en otro Report: revisa el folio.`;
}
