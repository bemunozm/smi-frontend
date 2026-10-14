import { parseInteger } from './decimal';
import { fromDateOnly, type Turno } from './turno';
import type { EntradaCambios } from '../types/cambios';
import {
  SECCIONES,
  SECCION_LABEL,
  TRASPASO_LABEL,
  type ReporteDiario,
} from '../types/reporte-diario';

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

/**
 * Lo que el supervisor escribió en un turno ya enviado. Los totales NO se
 * guardan acá: se calculan desde `secciones` con la misma regla que el
 * formulario.
 */
export interface ContenidoReporte {
  personal: [string, string][];
  secciones: { label: string; camiones: number; vueltas: number }[];
  tolvas: number[];
  plantas: [string, string][];
  traspasos: [string, string][];
  empresas: string[];
  /** Quién corrigió qué después de enviarlo, del más reciente al más viejo. */
  cambios?: EntradaCambios[];
}

/** Un turno ya enviado: su contenido más a qué turno pertenece y quién firmó. */
export interface ReporteAnterior extends ContenidoReporte {
  /** Id del reporte en el servidor: la corrección lo necesita para el PATCH. */
  id: string;
  fecha: Date;
  turno: Turno;
  supervisor: string;
}

/**
 * Reporte del servidor → forma que muestra el historial. Las secciones salen
 * siempre en el orden canónico de `SECCIONES`, y una sección o tolva que el
 * servidor no trajo vale 0, para que las columnas del historial no se corran.
 */
export function aReporteAnterior(r: ReporteDiario): ReporteAnterior {
  const porSeccion = new Map(r.produccion.map((p) => [p.seccion, p]));
  return {
    id: r.id,
    // `fecha` puede venir como ISO completo: se toma el día y se arma en local
    // (`new Date('YYYY-MM-DD')` es medianoche UTC y en Chile muestra el día anterior).
    fecha: fromDateOnly(r.fecha.slice(0, 10)),
    turno: r.turno,
    supervisor: r.supervisorNombre,
    personal: r.personal.map((p) => [p.rol, p.nombre] as [string, string]),
    secciones: SECCIONES.map((s) => ({
      label: SECCION_LABEL[s],
      camiones: porSeccion.get(s)?.camiones ?? 0,
      vueltas: porSeccion.get(s)?.vueltasPorCamion ?? 0,
    })),
    tolvas: [1, 2, 3].map((n) => r.tolvas.find((t) => t.tolva === n)?.cargas ?? 0),
    plantas: r.plantas.map((p) => [p.planta.nombre, p.producto] as [string, string]),
    traspasos: r.traspasos.map((t) => [TRASPASO_LABEL[t.tipo], String(t.cantidad)] as [string, string]),
    empresas: r.empresas.map((e) => e.empresa.nombre),
  };
}
