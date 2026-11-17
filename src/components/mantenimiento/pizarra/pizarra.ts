import { fmtDecimales } from '../../../lib/format';
import type { MaintenanceBoardRow } from '../../../types/maintenance-board';

export type Tono = 'atrasado' | 'alerta' | 'normal';

/**
 * Grupo de orden de una fila: lo que se puede atender arriba, lo que no tiene
 * números al medio y los equipos fuera de servicio al final (atenuados, no
 * ocultos: siguen siendo parte de la flota).
 */
function grupo(fila: MaintenanceBoardRow): number {
  if (fila.status === 'OUT_OF_SERVICE') return 3;
  if (fila.source === 'SIN_PAUTA') return 2;
  if (fila.remaining == null) return 1; // con pauta pero sin lectura
  return 0;
}

/**
 * Orden de la pizarra: lo más urgente arriba, como se lee la pizarra de faena.
 * Los atrasados (pendientes negativos) quedan primero solos. Con pendientes
 * iguales, la fila con último cambio real va antes que la estimada: su número
 * es más confiable. Devuelve una copia.
 */
export function ordenarFilas(filas: readonly MaintenanceBoardRow[]): MaintenanceBoardRow[] {
  return [...filas].sort((a, b) => {
    const porGrupo = grupo(a) - grupo(b);
    if (porGrupo !== 0) return porGrupo;
    if (a.remaining != null && b.remaining != null && a.remaining !== b.remaining) return a.remaining - b.remaining;
    if (a.estimated !== b.estimated) return a.estimated ? 1 : -1;
    return a.internalCode.localeCompare(b.internalCode, 'es');
  });
}

/**
 * Separa la pizarra en dos: los equipos con algo que seguir (pauta o liviano)
 * van a la tabla principal, y los sin pauta a su propia sección debajo, porque
 * no tienen números que comparar y solo esperan que se les asigne una. Las dos
 * listas salen ya ordenadas.
 */
export function separarSinPauta(filas: readonly MaintenanceBoardRow[]): {
  conPauta: MaintenanceBoardRow[];
  sinPauta: MaintenanceBoardRow[];
} {
  const ordenadas = ordenarFilas(filas);
  return {
    conPauta: ordenadas.filter((f) => f.source !== 'SIN_PAUTA'),
    sinPauta: ordenadas.filter((f) => f.source === 'SIN_PAUTA'),
  };
}

/**
 * Color de los pendientes: rojo fuerte si ya pasó, rojo si entró al margen de
 * aviso de la pauta (el mismo que dispara la orden preventiva). Sin margen
 * configurado, solo lo que toca ahora se marca.
 */
export function tono(fila: MaintenanceBoardRow): Tono {
  if (fila.remaining == null) return 'normal';
  if (fila.remaining < 0) return 'atrasado';
  if (fila.remaining <= (fila.alertBefore ?? 0)) return 'alerta';
  return 'normal';
}

/** «2.250,5 h» — los contadores pueden traer un decimal. */
export function lectura(valor: number | null, unidad: 'h' | 'km'): string | null {
  return valor == null ? null : `${fmtDecimales(valor, 1)} ${unidad}`;
}

/**
 * «+38 h» (atrasado) o «150 h»; `null` sin pendientes (sin pauta o sin
 * lectura). El «atrasado» ya no va en el texto: lo dice la burbuja roja de al
 * lado (con su tooltip), así la columna queda solo con números.
 */
export function textoPendientes(fila: MaintenanceBoardRow): string | null {
  if (fila.remaining == null) return null;
  if (fila.remaining < 0) return `+${lectura(-fila.remaining, fila.unit)}`;
  return lectura(fila.remaining, fila.unit);
}

/** `2026-10-01T12:00:00.000Z` → «01-10-2026» en la hora local. */
export function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** Encabezados del panel: los pesados se leen en horómetro, los livianos en km. */
export function etiquetas(panel: 'pesados' | 'livianos') {
  return panel === 'livianos'
    ? {
        cambio: 'Km cambio',
        ultimo: 'Km último cambio',
        proximo: 'Km próximo cambio',
        actual: 'Km actual',
        pendientes: 'Km pendientes',
      }
    : {
        cambio: 'Horas cambio',
        ultimo: 'Horómetro último cambio',
        proximo: 'Horómetro próximo cambio',
        actual: 'Horómetro actual',
        pendientes: 'Horas pendientes',
      };
}
