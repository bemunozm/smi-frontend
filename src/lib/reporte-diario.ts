import { parseInteger } from './decimal';

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
 * Lee un conteo del formulario (`parseInteger`: `1.200` es 1200). Un campo vacío, a
 * medio escribir o con decimales vale cero en vez de `null`: el supervisor borra un campo para
 * corregirlo y el total no tiene por qué romperse mientras tanto.
 */
export function enteroOCero(valor: string): number {
  return parseInteger(valor) ?? 0;
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
 * Vueltas que aporta una sección al turno.
 *
 * Las vueltas de cada sección son **por camión**, no el total ya sumado: una
 * sección de 8 camiones a 6 vueltas aporta 48 al turno, no 6.
 *
 * Es un contador **por sección** y no hay un total que las sume: cada tipo de
 * camión —internos, Mina Caleta, mineras— se cobra con su propia tarifa
 * (cada tipo tiene tarifa distinta). Sumarlas daría una cifra que no corresponde a ninguna
 * tarifa y que invita a facturar mal.
 *
 * Vive acá, y no en la vista, porque la regla la aplican dos lados: el
 * formulario del turno en curso y el historial de turnos pasados. Partida en
 * dos se arreglaría en uno solo el día que cambie.
 */
export function vueltasDeSeccion(s: SeccionNumerica): number {
  return s.camiones * s.vueltas;
}

/**
 * Las tres secciones del formulario ya numéricas, en el orden de pantalla:
 * internos, Mina Caleta, mineras. Los campos son texto en formato es-CL.
 */
export function seccionesDelFormulario(s: SeccionesCamiones): SeccionNumerica[] {
  return [
    { camiones: enteroOCero(s.camionesInternos), vueltas: enteroOCero(s.vueltasInternos) },
    { camiones: enteroOCero(s.camionesMinaCaleta), vueltas: enteroOCero(s.vueltasMinaCaleta) },
    { camiones: enteroOCero(s.camionesMinera), vueltas: enteroOCero(s.vueltasMinera) },
  ];
}
