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

/**
 * Totales del turno a partir de las tres secciones de camiones.
 *
 * El campo de vueltas de cada sección es **por camión**, no el total ya
 * sumado: una sección de 8 camiones a 6 vueltas aporta 48 al turno, no 6. Es
 * el mismo significado que tenía el campo único «Vueltas por camión» antes de
 * abrirse en tres.
 */
export function calcularTotales(s: SeccionesCamiones): { camiones: number; vueltas: number } {
  const secciones: [string, string][] = [
    [s.camionesInternos, s.vueltasInternos],
    [s.camionesMinaCaleta, s.vueltasMinaCaleta],
    [s.camionesMinera, s.vueltasMinera],
  ];
  return {
    camiones: secciones.reduce((total, [camiones]) => total + aNumero(camiones), 0),
    vueltas: secciones.reduce(
      (total, [camiones, vueltas]) => total + aNumero(camiones) * aNumero(vueltas),
      0,
    ),
  };
}
