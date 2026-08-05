import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Chip, Spinner, ToggleButton, ToggleButtonGroup } from '@heroui/react';

import { EventoTimelineItem } from '../components/ficha/EventoTimelineItem';
import { isOneOf } from '../config/ficha-colors';
import { estadoEquipoChipColor, estadoEquipoLabel } from '../config/flota-colors';
import { useFicha } from '../hooks/useFicha';
import { EVENTO_TIPOS, type EventoFichaTipo } from '../types/ficha';
import { eventoTipoLabel } from '../config/ficha-colors';

const NUMERO = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

function ResumenTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <Card.Header>
        <Card.Description className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
          {label}
        </Card.Description>
        <Card.Title className="font-display text-[26px] font-semibold tracking-[-0.02em] text-foreground">
          {value}
        </Card.Title>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </Card.Header>
    </Card>
  );
}

/**
 * Vista Núcleo de la ficha consolidada de un equipo (requerimientos §5.5):
 * cabecera técnica + contadores por dominio + una línea de tiempo única que
 * cruza eventos de Terreno (combustible/horómetro/trabajo extra/hallazgo) y
 * Mantenimiento (orden de trabajo/intervención) más Actividades. Distinta de
 * `EquipoDetalleView` (ficha técnica de Flota, sin cruzar dominios).
 */
export function FichaEquipoView() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: ficha, isPending, isError, error } = useFicha(id);

  const [selectedTipos, setSelectedTipos] = useState<Set<EventoFichaTipo>>(() => new Set(EVENTO_TIPOS));

  const timeline = useMemo(() => ficha?.timeline ?? [], [ficha]);

  const tipoCounts = useMemo(() => {
    const counts = new Map<EventoFichaTipo, number>();
    for (const evento of timeline) {
      counts.set(evento.tipo, (counts.get(evento.tipo) ?? 0) + 1);
    }
    return counts;
  }, [timeline]);

  const timelineFiltrada = useMemo(
    () => timeline.filter((evento) => selectedTipos.has(evento.tipo)),
    [timeline, selectedTipos],
  );

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner color="accent" size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <div
          className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground"
          role="alert"
        >
          {error instanceof Error ? error.message : 'No se pudo cargar la ficha consolidada del equipo.'}
        </div>
        <Link className="text-sm text-(--accent) hover:underline" to="/equipos">
          ← Volver a equipos
        </Link>
      </div>
    );
  }

  const { equipo, resumen } = ficha;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link
          className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase hover:underline"
          to={`/equipos/${equipo.id}`}
        >
          ← SMI · Ficha del equipo
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            {equipo.codigo}
          </h1>
          <Chip color={estadoEquipoChipColor(equipo.estado)} variant="soft">
            {estadoEquipoLabel(equipo.estado)}
          </Chip>
        </div>
        <p className="text-sm text-muted-foreground">
          {equipo.tipo} · {equipo.marca} {equipo.modelo}
          {equipo.anio ? ` · ${equipo.anio}` : ''} · Horómetro {NUMERO.format(equipo.horometroActual)} h
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <ResumenTile label="Combustible" value={resumen.combustibles} />
        <ResumenTile label="Horómetro" value={resumen.horometros} />
        <ResumenTile label="Trabajos extra" value={resumen.trabajosExtra} />
        <ResumenTile
          hint={`${resumen.hallazgosAbiertos} abierto${resumen.hallazgosAbiertos === 1 ? '' : 's'}`}
          label="Hallazgos"
          value={resumen.hallazgos}
        />
        <ResumenTile
          hint={`${resumen.ordenesAbiertas} abierta${resumen.ordenesAbiertas === 1 ? '' : 's'}`}
          label="Órdenes"
          value={resumen.ordenes}
        />
        <ResumenTile label="Actividades" value={resumen.actividades} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
            Línea de tiempo
          </span>
          {timeline.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {timelineFiltrada.length} de {timeline.length} eventos
            </span>
          ) : null}
        </div>

        {timeline.length > 0 ? (
          <ToggleButtonGroup
            aria-label="Filtrar eventos por tipo"
            selectedKeys={selectedTipos}
            selectionMode="multiple"
            onSelectionChange={(keys) => {
              const next = new Set<EventoFichaTipo>();
              keys.forEach((key) => {
                if (typeof key === 'string' && isOneOf(EVENTO_TIPOS, key)) next.add(key);
              });
              setSelectedTipos(next);
            }}
          >
            {EVENTO_TIPOS.map((tipo) => (
              <ToggleButton key={tipo} id={tipo}>
                {eventoTipoLabel(tipo)} ({tipoCounts.get(tipo) ?? 0})
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        ) : null}

        {timeline.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-sm font-medium text-foreground">Sin eventos registrados</p>
            <p className="text-sm text-muted-foreground">
              Esta unidad todavía no tiene eventos en ningún dominio (combustible, horómetro, trabajos
              extra, hallazgos, mantenimiento o actividades).
            </p>
          </div>
        ) : null}

        {timeline.length > 0 && timelineFiltrada.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-sm font-medium text-foreground">Ningún evento coincide con el filtro</p>
            <p className="text-sm text-muted-foreground">
              Prueba seleccionando otro tipo de evento en los filtros de arriba.
            </p>
            <Button size="sm" variant="tertiary" onPress={() => setSelectedTipos(new Set(EVENTO_TIPOS))}>
              Mostrar todos los tipos
            </Button>
          </div>
        ) : null}

        {timelineFiltrada.length > 0 ? (
          <div className="flex flex-col gap-2">
            {timelineFiltrada.map((evento) => (
              <EventoTimelineItem key={evento.id} evento={evento} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
