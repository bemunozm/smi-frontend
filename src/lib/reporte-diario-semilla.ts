import type { ReporteDiario } from '../types/reporte-diario';

type Turno = ReporteDiario['turno'];

/** `2026-11-06|1`: ordena por fecha y, en el mismo día, el DIURNO antes que el NOCTURNO. */
const claveTurno = (fecha: string, turno: Turno) => `${fecha.slice(0, 10)}|${turno === 'NOCTURNO' ? 1 : 0}`;

/** Lo que se copia de un reporte anterior al formulario nuevo. */
export interface SemillaReporte {
  /** El reporte de donde sale, para avisarlo bajo el formulario. */
  desde: { fecha: string; turno: Turno };
  /** rol → nombre, tal como lo escribió. */
  personal: Record<string, string>;
  /** plantaId → producto. */
  productos: Record<string, string>;
}

/**
 * Pedido del 06/11: el personal del turno (jefes, HSE, asistente) y las
 * operaciones en planta casi no cambian de un turno al siguiente, así que el
 * formulario parte con lo que ESTE supervisor puso en su reporte anterior más
 * reciente — antes del turno que está cargando, nunca uno posterior — y él lo
 * corrige si algo cambió. Solo cuenta un reporte que tenga algo de eso
 * escrito; los de otros supervisores no (cada uno tiene su cuadrilla).
 */
export function semillaDeReporte(
  reportes: readonly ReporteDiario[],
  supervisorId: string | null | undefined,
  fecha: string,
  turno: Turno,
): SemillaReporte | null {
  if (!supervisorId) return null;
  const limite = claveTurno(fecha, turno);
  const base = reportes
    .filter(
      (r) =>
        r.supervisorId === supervisorId &&
        claveTurno(r.fecha, r.turno) < limite &&
        (r.personal.some((p) => p.nombre.trim() !== '') || r.plantas.some((p) => p.producto.trim() !== '')),
    )
    .sort((a, b) => (claveTurno(b.fecha, b.turno) < claveTurno(a.fecha, a.turno) ? -1 : 1))[0];
  if (!base) return null;
  return {
    desde: { fecha: base.fecha.slice(0, 10), turno: base.turno },
    personal: Object.fromEntries(base.personal.map((p) => [p.rol, p.nombre])),
    productos: Object.fromEntries(base.plantas.map((p) => [p.plantaId, p.producto])),
  };
}
