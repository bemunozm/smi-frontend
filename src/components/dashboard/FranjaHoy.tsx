import { Card, Chip, Spinner } from '@heroui/react';

import {
  ESTADO_HOY_NUMERO_CLASS,
  estadoHoyChipColor,
  estadoHoyLabel,
  type EstadoHoy,
} from '../../config/dashboard-colors';
import { useDashboardHoy } from '../../hooks/useDashboard';

const CONTADORES: { estado: EstadoHoy; clave: 'enUso' | 'disponibles' | 'inoperativos' }[] = [
  { estado: 'EN_USO', clave: 'enUso' },
  { estado: 'DISPONIBLE', clave: 'disponibles' },
  { estado: 'INOPERATIVO', clave: 'inoperativos' },
];

/** Franja HOY: semáforo de la flota (contadores grandes + grilla de equipos). */
export function FranjaHoy() {
  const { data, isPending, isError, error, refetch } = useDashboardHoy();

  return (
    <section aria-label="Flota hoy" className="flex flex-col gap-3">
      <h2 className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">Hoy</h2>

      {isPending ? (
        <div className="flex justify-center py-8">
          <Spinner color="accent" size="sm" />
        </div>
      ) : null}

      {isError ? (
        <div
          className="flex items-center justify-between gap-3 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground"
          role="alert"
        >
          <span>{error instanceof Error ? error.message : 'No se pudo cargar el estado de la flota.'}</span>
          <button className="font-medium underline" onClick={() => void refetch()} type="button">
            Reintentar
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {CONTADORES.map(({ estado, clave }) => (
              <Card key={estado}>
                <Card.Content className="flex flex-col gap-1 py-5">
                  <span
                    className={`font-display text-6xl font-semibold tracking-[-0.03em] ${ESTADO_HOY_NUMERO_CLASS[estado]}`}
                    data-testid={`contador-${estado}`}
                  >
                    {data.totales[clave].toLocaleString('es-CL')}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">{estadoHoyLabel(estado)}</span>
                </Card.Content>
              </Card>
            ))}
          </div>

          {data.equipos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay equipos registrados.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.equipos.map((equipo) => {
                const detalle =
                  equipo.estado === 'EN_USO' && equipo.operador
                    ? `${equipo.operador}${equipo.turno ? ` · ${equipo.turno}` : ''}`
                    : null;
                return (
                  <li
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                    key={equipo.equipmentId}
                    title={equipo.supervisor ? `Supervisor: ${equipo.supervisor}` : undefined}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="font-mono text-sm text-foreground">{equipo.internalCode}</span>
                      {detalle ? <span className="truncate text-xs text-muted-foreground">{detalle}</span> : null}
                      {equipo.estado === 'EN_USO' && equipo.supervisor ? (
                        <span className="truncate text-xs text-muted-foreground">Sup. {equipo.supervisor}</span>
                      ) : null}
                    </div>
                    <Chip color={estadoHoyChipColor(equipo.estado)} size="sm" variant="soft">
                      {estadoHoyLabel(equipo.estado)}
                    </Chip>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
}
