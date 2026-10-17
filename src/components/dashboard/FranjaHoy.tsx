import { useRef, type ReactNode } from 'react';
import { Card, Chip, Spinner } from '@heroui/react';

import { estadoHoyChipColor, estadoHoyLabel, type EstadoHoy } from '../../config/dashboard-colors';
import { FuelGauge } from '../flota/FuelGauge';
import { useDashboardHoy } from '../../hooks/useDashboard';
import { NUM_CL_1 } from '../../lib/dashboard-format';
import { mantencionesProximas, type MantencionProxima } from '../../lib/mantenciones-proximas';
import type { ResumenHoy } from '../../types/dashboard';
import type { MaintenanceStatusRow } from '../../types/maintenance-plan';

type EquipoHoy = ResumenHoy['equipos'][number];

const CONTADORES: { estado: EstadoHoy; clave: 'enUso' | 'disponibles' | 'inoperativos'; texto: string }[] = [
  { estado: 'EN_USO', clave: 'enUso', texto: 'en uso' },
  { estado: 'DISPONIBLE', clave: 'disponibles', texto: 'disponibles' },
  { estado: 'INOPERATIVO', clave: 'inoperativos', texto: 'inoperativos' },
];

const MOTIVO_INOPERATIVO: Record<NonNullable<EquipoHoy['status']>, string> = {
  OPERATIONAL: 'No operativo',
  IN_WORKSHOP: 'En taller',
  OUT_OF_SERVICE: 'Fuera de servicio',
};

const BOTON_FLECHA =
  'flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground hover:bg-surface-secondary';

function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0">
      <span className="shrink-0 text-xs text-muted-foreground">{etiqueta}</span>
      <div className="min-w-0 truncate text-right text-sm text-foreground">{children}</div>
    </div>
  );
}

function EquipoCard({ equipo, mantencion }: { equipo: EquipoHoy; mantencion?: MantencionProxima }) {
  const enUso = equipo.estado === 'EN_USO';
  const km = equipo.unidadControl === 'KM';
  return (
    <Card className="h-full" data-testid={`equipo-card-${equipo.equipmentId}`}>
      <Card.Content className="flex h-full min-h-72 flex-col gap-3 py-5">
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-3xl font-semibold text-foreground">{equipo.internalCode}</span>
          <Chip color={estadoHoyChipColor(equipo.estado)} size="sm" variant="soft">
            {estadoHoyLabel(equipo.estado)}
          </Chip>
        </div>

        <div className="min-h-5 text-sm">
          {equipo.estado === 'INOPERATIVO' ? (
            <span className="text-foreground">{MOTIVO_INOPERATIVO[equipo.status ?? 'OUT_OF_SERVICE']}</span>
          ) : null}
          {equipo.estado === 'DISPONIBLE' ? <span className="text-muted-foreground">Sin turno abierto</span> : null}
        </div>

        <div className="flex flex-col">
          <Fila etiqueta="Operador">
            {enUso ? `${equipo.operador ?? 'Sin operador'}${equipo.turno ? ` · ${equipo.turno}` : ''}` : '—'}
          </Fila>
          <Fila etiqueta="Supervisor">{enUso && equipo.supervisor ? equipo.supervisor : '—'}</Fila>
          <Fila etiqueta="Combustible">
            <FuelGauge className="justify-end" pct={equipo.nivelCombustible ?? null} />
          </Fila>
          <Fila etiqueta={km ? 'Odómetro actual' : 'Horómetro actual'}>
            {equipo.contadorActual == null ? '—' : `${NUM_CL_1.format(equipo.contadorActual)} ${km ? 'km' : 'h'}`}
          </Fila>
        </div>

        {mantencion ? (
          <Chip className="self-start" color="warning" size="sm" variant="soft">
            {mantencion.remaining <= 0
              ? 'Mantención: toca ahora'
              : `Mantención: quedan ${mantencion.remaining.toLocaleString('es-CL')} ${mantencion.unit}`}
          </Chip>
        ) : null}
      </Card.Content>
    </Card>
  );
}

/**
 * Franja HOY: contadores compactos + carrusel de tarjetas por equipo
 * (CSS scroll-snap, sin dependencias; el swipe táctil es scroll nativo).
 * `mantenciones` es el estado de mantención que ya cargó el dashboard.
 */
export function FranjaHoy({ mantenciones }: { mantenciones?: Map<string, MaintenanceStatusRow> }) {
  const { data, isPending, isError, error, refetch } = useDashboardHoy();
  const carruselRef = useRef<HTMLUListElement>(null);

  const mover = (sentido: 1 | -1) => {
    const el = carruselRef.current;
    if (el) el.scrollBy({ left: sentido * el.clientWidth, behavior: 'smooth' });
  };

  const proximas = new Map(mantencionesProximas(mantenciones?.values() ?? []).map((m) => [m.equipmentId, m]));

  return (
    <section aria-label="Flota hoy" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">Hoy</h2>
        {data ? (
          <div className="flex flex-wrap items-center gap-2">
            {CONTADORES.map(({ estado, clave, texto }) => (
              <Chip
                color={estadoHoyChipColor(estado)}
                data-testid={`contador-${estado}`}
                key={estado}
                size="sm"
                variant="soft"
              >
                {`${data.totales[clave].toLocaleString('es-CL')} ${texto}`}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>

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

      {data && data.equipos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay equipos registrados.</p>
      ) : null}

      {data && data.equipos.length > 0 ? (
        <div className="flex items-center gap-2">
          <button aria-label="Equipos anteriores" className={BOTON_FLECHA} onClick={() => mover(-1)} type="button">
            <span aria-hidden="true">◀</span>
          </button>
          <ul
            className="flex min-w-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            ref={carruselRef}
            role="list"
          >
            {data.equipos.map((equipo) => (
              <li
                className="w-full shrink-0 snap-start md:w-[calc((100%-1rem)/2)] xl:w-[calc((100%-2rem)/3)]"
                key={equipo.equipmentId}
              >
                <EquipoCard equipo={equipo} mantencion={proximas.get(equipo.equipmentId)} />
              </li>
            ))}
          </ul>
          <button aria-label="Equipos siguientes" className={BOTON_FLECHA} onClick={() => mover(1)} type="button">
            <span aria-hidden="true">▶</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
