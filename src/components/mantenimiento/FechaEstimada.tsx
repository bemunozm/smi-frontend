import { CalendarClock } from 'lucide-react';

import { useMaintenanceForecastByEquipment } from '../../hooks/useMaintenancePlans';
import { fmtNum } from '../../lib/format';
import { diaCorto, lineaPronostico, ritmo } from '../../lib/pronostico';

/**
 * Fecha estimada de la próxima mantención según el uso promedio del equipo.
 * Solo informa: las órdenes del taller siguen saliendo por el margen de h/km.
 *
 * - `linea`: texto corto bajo la próxima mantención (lista de Equipos). Un
 *   liviano sin pauta no tiene fila de pauta: acá se dice también su próxima por km.
 * - `bloque`: fecha, ritmo y día sugerido (ventana de la pauta y del liviano).
 */
export function FechaEstimada({
  equipmentId,
  variante = 'linea',
  enabled = true,
}: {
  equipmentId: string;
  variante?: 'linea' | 'bloque';
  enabled?: boolean;
}) {
  const { data } = useMaintenanceForecastByEquipment(enabled);
  const f = data?.get(equipmentId);
  if (!f) return null;

  if (variante === 'linea') {
    const texto = lineaPronostico(f);
    return (
      <>
        {f.source === 'LIVIANO' && (
          <span className={`block text-xs tabular-nums ${f.remaining <= 0 ? 'text-danger' : 'text-muted-foreground'}`}>
            Próx. mant. {fmtNum(f.nextAt)} km · {f.remaining <= 0 ? 'toca ahora' : `faltan ${fmtNum(f.remaining)} km`}
          </span>
        )}
        {texto && <span className="block text-xs text-muted-foreground tabular-nums">{texto}</span>}
      </>
    );
  }

  return (
    <section className="flex items-start gap-3 rounded-2xl border border-border bg-surface-secondary p-4">
      <CalendarClock className="mt-0.5 size-5 shrink-0 text-[var(--accent)]" aria-hidden />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Fecha estimada por uso
        </span>
        {f.status === 'ESTIMADA' ? (
          <>
            <span className="text-base font-semibold tabular-nums">
              {diaCorto(f.estimatedDate!)} <span className="text-sm font-normal text-muted-foreground">{ritmo(f)}</span>
            </span>
            <span className="text-sm">
              {f.suggestedDate ? (
                <>
                  Día sugerido: <b className="tabular-nums">{diaCorto(f.suggestedDate)}</b>, su día de menos uso esa
                  semana.
                </>
              ) : (
                <>
                  Conviene hacerla la semana del <b className="tabular-nums">{diaCorto(f.weekStart!)}</b> al{' '}
                  <b className="tabular-nums">{diaCorto(f.estimatedDate!)}</b>. Con 3 semanas de registros se sugiere el
                  día de menos uso.
                </>
              )}
            </span>
          </>
        ) : f.status === 'TOCA_AHORA' ? (
          <span className="text-base font-semibold text-danger">Toca ahora</span>
        ) : f.status === 'FALTAN_DATOS' ? (
          <span className="text-sm">Faltan registros de uso: con 7 días de tarjetas de turno se calcula la fecha.</span>
        ) : f.status === 'SIN_USO' ? (
          <span className="text-sm">El equipo no registra uso en las últimas 4 semanas.</span>
        ) : (
          <span className="text-sm">A este ritmo, en más de un año ({ritmo(f)}).</span>
        )}
      </div>
    </section>
  );
}
