import { useRef, useState, type ReactNode } from 'react';
import { Card, Chip } from '@heroui/react';

import { estadoFlotaChipColor, estadoFlotaLabel, type EstadoHoy } from '../../config/dashboard-colors';
import { FichaEquipoModal } from './FichaEquipoModal';
import { FuelGauge } from '../flota/FuelGauge';
import { NUM_CL_1 } from '../../lib/dashboard-format';
import { mantencionesProximas, type MantencionProxima } from '../../lib/mantenciones-proximas';
import type { FlotaDia } from '../../types/dashboard';
import type { MaintenanceStatusRow } from '../../types/maintenance-plan';

const CONTADORES_HOY: { estado: EstadoHoy; texto: string }[] = [
  { estado: 'EN_USO', texto: 'en uso' },
  { estado: 'DISPONIBLE', texto: 'disponibles' },
  { estado: 'INOPERATIVO', texto: 'inoperativos' },
];

const MOTIVO_INOPERATIVO: Record<NonNullable<FlotaDia['status']>, string> = {
  OPERATIONAL: 'No operativo',
  IN_WORKSHOP: 'En taller',
  OUT_OF_SERVICE: 'Fuera de servicio',
};

const BOTON_FLECHA =
  'flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground hover:bg-surface-secondary';

function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-b-0">
      <span className="shrink-0 text-sm text-muted-foreground">{etiqueta}</span>
      <div className="min-w-0 truncate text-right text-base font-medium text-foreground">{children}</div>
    </div>
  );
}

function EquipoCard({
  equipo,
  esHoy,
  mantencion,
  onOpen,
}: {
  equipo: FlotaDia;
  esHoy: boolean;
  mantencion?: MantencionProxima;
  /** Abre la ficha del equipo en un popup (ver `FichaEquipoModal`), sin navegar. */
  onOpen: () => void;
}) {
  const conUso = equipo.estado === 'EN_USO' || equipo.estado === 'OPERO';
  const km = equipo.unidadControl === 'KM';
  // El contador es el valor ACTUAL del equipo: en un día pasado se rotula para no leerlo como histórico.
  const etiquetaContador = `${km ? 'Odómetro' : 'Horómetro'}${esHoy ? ' actual' : ' (actual)'}`;
  return (
    <button
      aria-label={`Ver ficha de ${equipo.internalCode}`}
      className="block h-full w-full rounded-(--radius) text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
      onClick={onOpen}
      type="button"
    >
      <Card className="h-full transition-colors hover:bg-surface-secondary active:bg-surface-secondary" data-testid={`equipo-card-${equipo.equipmentId}`}>
        <Card.Content className="flex h-full min-h-80 flex-col gap-3 py-5">
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-4xl font-semibold text-foreground">{equipo.internalCode}</span>
            <Chip color={estadoFlotaChipColor(equipo.estado)} size="md" variant="soft">
              {estadoFlotaLabel(equipo.estado)}
            </Chip>
          </div>

          {esHoy && !conUso ? (
            <div className="min-h-5 text-base">
              {equipo.estado === 'INOPERATIVO' ? (
                <span className="text-foreground">{MOTIVO_INOPERATIVO[equipo.status ?? 'OUT_OF_SERVICE']}</span>
              ) : (
                <span className="text-muted-foreground">Sin turno abierto</span>
              )}
            </div>
          ) : null}

          <div className="flex flex-col">
            <Fila etiqueta="Operador">
              {conUso ? `${equipo.operador ?? 'Sin operador'}${equipo.turno ? ` · ${equipo.turno}` : ''}` : '—'}
            </Fila>
            <Fila etiqueta="Supervisor">{conUso && equipo.supervisor ? equipo.supervisor : '—'}</Fila>
            <Fila etiqueta="Combustible">
              <FuelGauge className="justify-end" pct={equipo.nivelCombustible ?? null} />
            </Fila>
            <Fila etiqueta={etiquetaContador}>
              {equipo.contadorActual == null ? '—' : `${NUM_CL_1.format(equipo.contadorActual)} ${km ? 'km' : 'h'}`}
            </Fila>
          </div>

          {esHoy && mantencion ? (
            <Chip className="self-start" color="warning" size="md" variant="soft">
              {mantencion.remaining <= 0
                ? 'Mantención: toca ahora'
                : `Mantención: quedan ${mantencion.remaining.toLocaleString('es-CL')} ${mantencion.unit}`}
            </Chip>
          ) : null}
        </Card.Content>
      </Card>
    </button>
  );
}

/**
 * Sub-bloque «Flota» del resumen del día: chips de conteo + carrusel de tarjetas por equipo
 * (CSS scroll-snap, sin dependencias; el swipe táctil es scroll nativo). No consulta nada:
 * recibe `flota` del resumen del día (undefined = payload cacheado sin el campo) y `esHoy`.
 * `mantenciones` es el estado de mantención que ya cargó el dashboard (solo se muestra hoy).
 */
export function FlotaDiaCarrusel({
  flota,
  esHoy,
  mantenciones,
}: {
  flota?: FlotaDia[];
  esHoy: boolean;
  mantenciones?: Map<string, MaintenanceStatusRow>;
}) {
  const carruselRef = useRef<HTMLUListElement>(null);
  // Equipo cuya ficha está abierta en el popup; null = cerrado.
  const [fichaId, setFichaId] = useState<string | null>(null);

  const mover = (sentido: 1 | -1) => {
    const el = carruselRef.current;
    if (el) el.scrollBy({ left: sentido * el.clientWidth, behavior: 'smooth' });
  };

  const proximas = new Map(mantencionesProximas(mantenciones?.values() ?? []).map((m) => [m.equipmentId, m]));
  const cuenta = (estado: FlotaDia['estado']) => (flota ?? []).filter((e) => e.estado === estado).length;
  const fmt = (n: number, texto: string) => `${n.toLocaleString('es-CL')} ${texto}`;

  return (
    <section aria-label="Flota" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">Flota</h3>
        {flota && flota.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {esHoy ? (
              CONTADORES_HOY.map(({ estado, texto }) => (
                <Chip
                  color={estadoFlotaChipColor(estado)}
                  data-testid={`contador-${estado}`}
                  key={estado}
                  size="md"
                  variant="soft"
                >
                  {fmt(cuenta(estado), texto)}
                </Chip>
              ))
            ) : (
              <>
                <Chip color={estadoFlotaChipColor('OPERO')} data-testid="contador-OPERO" size="md" variant="soft">
                  {fmt(cuenta('OPERO'), 'operaron')}
                </Chip>
                <Chip
                  color={estadoFlotaChipColor('SIN_ACTIVIDAD')}
                  data-testid="contador-SIN_ACTIVIDAD"
                  size="md"
                  variant="soft"
                >
                  {fmt(cuenta('SIN_ACTIVIDAD'), 'sin actividad')}
                </Chip>
              </>
            )}
          </div>
        ) : null}
      </div>

      {flota === undefined ? (
        <p className="text-sm text-muted-foreground" data-testid="flota-sin-datos">
          Sin información de flota para este día.
        </p>
      ) : null}

      {flota && flota.length === 0 ? <p className="text-sm text-muted-foreground">No hay equipos registrados.</p> : null}

      {flota && flota.length > 0 ? (
        <div className="flex items-center gap-2">
          <button aria-label="Equipos anteriores" className={BOTON_FLECHA} onClick={() => mover(-1)} type="button">
            <span aria-hidden="true">◀</span>
          </button>
          <ul
            className="flex min-w-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            ref={carruselRef}
            role="list"
          >
            {flota.map((equipo) => (
              <li
                className="w-full shrink-0 snap-start md:w-[calc((100%-1rem)/2)] xl:w-[calc((100%-2rem)/3)]"
                key={equipo.equipmentId}
              >
                <EquipoCard
                  equipo={equipo}
                  esHoy={esHoy}
                  mantencion={proximas.get(equipo.equipmentId)}
                  onOpen={() => setFichaId(equipo.equipmentId)}
                />
              </li>
            ))}
          </ul>
          <button aria-label="Equipos siguientes" className={BOTON_FLECHA} onClick={() => mover(1)} type="button">
            <span aria-hidden="true">▶</span>
          </button>
        </div>
      ) : null}

      <FichaEquipoModal equipoId={fichaId} onClose={() => setFichaId(null)} />
    </section>
  );
}
