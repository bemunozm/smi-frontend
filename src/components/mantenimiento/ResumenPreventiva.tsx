import { diaCorto, lineaPronostico } from '../../lib/pronostico';
import type { MaintenanceBoardRow } from '../../types/maintenance-board';
import type { MaintenanceForecastRow } from '../../types/maintenance-forecast';
import { lectura, textoPendientes, tono } from './pizarra/pizarra';

const TONO_CLASE = {
  atrasado: 'font-bold text-danger',
  alerta: 'font-semibold text-warning-soft-foreground',
  normal: 'text-foreground',
} as const;

/** La fecha estimada como la muestra la pizarra (misma fuente: el pronóstico por uso). */
function fechaEstimada(fila: MaintenanceBoardRow, pronostico?: MaintenanceForecastRow): string {
  if ((fila.remaining != null && fila.remaining <= 0) || pronostico?.status === 'TOCA_AHORA') return 'Vencida';
  if (!pronostico || pronostico.status === 'FALTAN_DATOS') return 'Sin datos de uso';
  if (pronostico.status === 'LEJANA') return 'Más de un año';
  if (pronostico.status === 'ESTIMADA' && pronostico.estimatedDate) return diaCorto(pronostico.estimatedDate);
  return lineaPronostico(pronostico) ?? '—';
}

/**
 * Horómetro actual, horas pendientes y fecha estimada de una mantención
 * preventiva, en su tarjeta del tablero (pedido del cliente, 17/11/2026): lo
 * mismo que dice la pizarra para ese equipo, sin tener que ir a buscarlo.
 */
export function ResumenPreventiva({
  fila,
  pronostico,
}: {
  fila: MaintenanceBoardRow;
  pronostico?: MaintenanceForecastRow;
}) {
  const km = fila.unit === 'km';
  // Sin pauta no hay hito al que contar: igual se muestra la lectura actual.
  const sinPauta = fila.source === 'SIN_PAUTA';
  const pendientes = sinPauta ? null : textoPendientes(fila);
  const estado = tono(fila);
  const fecha = sinPauta ? '—' : fechaEstimada(fila, pronostico);
  return (
    <dl
      className="m-0 grid grid-cols-3 gap-2 rounded-xl bg-[#f5f6f8] px-3 py-2.5 text-[12.5px]"
      data-testid="resumen-preventiva"
    >
      <div className="flex flex-col gap-0.5">
        <dt className="text-[11px] font-semibold text-muted-foreground">{km ? 'Km actual' : 'Horómetro actual'}</dt>
        <dd className="m-0 font-medium tabular-nums text-foreground">{lectura(fila.counter, fila.unit) ?? 'Sin lectura'}</dd>
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className="text-[11px] font-semibold text-muted-foreground">{km ? 'Km pendientes' : 'Horas pendientes'}</dt>
        <dd className={`m-0 tabular-nums ${TONO_CLASE[estado]}`}>
          {sinPauta ? (
            <span className="text-muted-foreground">Sin pauta</span>
          ) : pendientes == null ? (
            '—'
          ) : estado === 'atrasado' ? (
            `Atrasada ${pendientes}`
          ) : (
            pendientes
          )}
        </dd>
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className="text-[11px] font-semibold text-muted-foreground">Fecha estimada</dt>
        <dd className={`m-0 tabular-nums ${fecha === 'Vencida' ? 'font-semibold text-danger' : 'font-medium text-foreground'}`}>
          {fecha}
        </dd>
      </div>
    </dl>
  );
}
