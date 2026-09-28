/**
 * Cálculos del reporte diario del supervisor.
 *
 * Vive fuera de `views/ReporteDiarioView.tsx` para que ese archivo exporte
 * solo su componente: exportar además una función rompe Fast Refresh de Vite
 * ("export is incompatible") y cada edición de la pantalla recarga la página
 * entera, perdiendo lo que hubiera escrito en el formulario. En una maqueta
 * que se está iterando eso se siente en cada guardado.
 */

/**
 * Lee un número escrito en formato es-CL, como lo guardan los campos del
 * formulario: «2.160» son dos mil ciento sesenta y «3,5» son tres y medio.
 * Un campo vacío o a medio escribir vale cero en vez de NaN — el supervisor
 * borra un campo para corregirlo y el total no tiene por qué romperse
 * mientras tanto.
 */
export function aNumero(valor: string): number {
  const n = Number.parseFloat(valor.replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
}

export interface SeccionesCamiones {
  camionesInternos: string;
  vueltasInternos: string;
  camionesMinaCaleta: string;
  vueltasMinaCaleta: string;
  camionesMinera: string;
  vueltasMinera: string;
}

export interface SeccionNumerica {
  camiones: number;
  vueltas: number;
}

/**
 * Totales de un turno a partir de sus secciones de camiones.
 *
 * Las vueltas de cada sección son **por camión**, no el total ya sumado: una
 * sección de 8 camiones a 6 vueltas aporta 48 al turno, no 6. Es el mismo
 * significado que tenía el campo único «Vueltas por camión» antes de abrirse
 * en tres.
 *
 * Vive acá, y no en la vista, porque la regla la aplican dos lados: el
 * formulario del turno en curso y el historial de turnos pasados. Partida en
 * dos se arreglaría en uno solo el día que cambie.
 */
export function totalesDeSecciones(secciones: readonly SeccionNumerica[]): {
  camiones: number;
  vueltas: number;
} {
  return {
    camiones: secciones.reduce((total, s) => total + s.camiones, 0),
    vueltas: secciones.reduce((total, s) => total + s.camiones * s.vueltas, 0),
  };
}

/** Los totales del formulario, cuyos campos son texto en formato es-CL. */
export function calcularTotales(s: SeccionesCamiones): { camiones: number; vueltas: number } {
  return totalesDeSecciones([
    { camiones: aNumero(s.camionesInternos), vueltas: aNumero(s.vueltasInternos) },
    { camiones: aNumero(s.camionesMinaCaleta), vueltas: aNumero(s.vueltasMinaCaleta) },
    { camiones: aNumero(s.camionesMinera), vueltas: aNumero(s.vueltasMinera) },
  ]);
}
