/**
 * Turnos de faena: DIURNO 08–20, NOCTURNO 20–08.
 *
 * Hasta acá el turno se elegía a mano en cada formulario o estaba escrito duro
 * en la pantalla ("DIURNO · 08–20", "24/09/2026 08:35"). Lo elige el reloj: el
 * supervisor no tiene por qué acordarse de cambiarlo a las 20:00, y si se
 * equivoca, el registro queda en el turno que no es.
 *
 * Lo que hace falta pensar es la FECHA del turno, no la del reloj. Un turno
 * NOCTURNO arranca a las 20:00 de un día y termina a las 08:00 del siguiente:
 * un registro de las 02:00 del 24 pertenece al nocturno que empezó el **23**.
 * Por eso `fechaDeTurno` resta un día antes de las 08:00 — si se usara la
 * fecha del reloj, media noche de trabajo se contaría en el día equivocado y
 * el reporte de salida no cuadraría con lo que vio el supervisor.
 */

export type Turno = 'DIURNO' | 'NOCTURNO';

/** Hora a la que empieza el turno diurno; el nocturno empieza en `FIN_DIURNO`. */
export const INICIO_DIURNO = 8;
export const FIN_DIURNO = 20;

/**
 * Los bordes van al turno que EMPIEZA: 08:00 es diurno y 20:00 es nocturno.
 * Cualquier otro criterio deja un minuto sin dueño o con dos.
 */
export function turnoDe(fecha: Date): Turno {
  const hora = fecha.getHours();
  return hora >= INICIO_DIURNO && hora < FIN_DIURNO ? 'DIURNO' : 'NOCTURNO';
}

/**
 * Día al que pertenece el turno, a medianoche. Antes de las 08:00 seguimos en
 * el nocturno que arrancó el día anterior, así que se resta un día — `setDate`
 * con 0 o negativo cruza mes y año solo (31/12 → 30/12, 01/01 → 31/12).
 */
export function fechaDeTurno(fecha: Date): Date {
  const dia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  if (fecha.getHours() < INICIO_DIURNO) dia.setDate(dia.getDate() - 1);
  return dia;
}

/** `08–20` / `20–08` — el rango evita tener que recordarlo. */
export function rangoTurno(turno: Turno): string {
  const hh = (h: number) => String(h).padStart(2, '0');
  return turno === 'DIURNO'
    ? `${hh(INICIO_DIURNO)}–${hh(FIN_DIURNO)}`
    : `${hh(FIN_DIURNO)}–${hh(INICIO_DIURNO)}`;
}

export function etiquetaTurno(turno: Turno): string {
  return `${turno} · ${rangoTurno(turno)}`;
}

/**
 * `mié 24-09` — el día de la semana ayuda a ubicarse en la lista de turnos.
 * Separador con guion, no con barra: es lo que da `es-CL` y lo que ya muestra
 * el resto de la app (`lib/format.ts#fmtDate`). Se le saca la coma que mete el
 * locale ("mié, 24-09"), que en un encabezado corto solo hace ruido.
 */
export function fechaCorta(fecha: Date): string {
  return fecha
    .toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: '2-digit' })
    .replace(',', '');
}

/** `24/09/2026 08:35` — fecha y hora del reloj, para el sello del registro. */
export function fechaHoraLarga(fecha: Date): string {
  return `${fecha.toLocaleDateString('es-CL')} ${fecha.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export interface ContextoTurno {
  turno: Turno;
  /** Día al que pertenece el turno (no necesariamente el del reloj). */
  fecha: Date;
  /** `DIURNO · 08–20` */
  etiqueta: string;
  /** `mié 24/09` — del día del turno. */
  fechaCorta: string;
  /** `24/09/2026 02:14` — del reloj, que es lo que firma el registro. */
  fechaHora: string;
}

/**
 * El turno inmediatamente anterior. Al diurno de un día lo precede el nocturno
 * del día anterior; al nocturno de un día, el diurno de ese mismo día — que es
 * justo lo que confunde si uno razona "anterior = ayer".
 */
export function turnoAnterior(turno: Turno, fecha: Date): { turno: Turno; fecha: Date } {
  if (turno === 'NOCTURNO') return { turno: 'DIURNO', fecha };
  const dia = new Date(fecha);
  dia.setDate(dia.getDate() - 1);
  return { turno: 'NOCTURNO', fecha: dia };
}

export function contextoTurno(ahora: Date): ContextoTurno {
  const turno = turnoDe(ahora);
  const fecha = fechaDeTurno(ahora);
  return {
    turno,
    fecha,
    etiqueta: etiquetaTurno(turno),
    fechaCorta: fechaCorta(fecha),
    fechaHora: fechaHoraLarga(ahora),
  };
}
