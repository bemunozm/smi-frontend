import { useMemo, useState } from 'react';
import { Card, Chip, Modal, Spinner, Table } from '@heroui/react';

import { useTrabajosExtraList } from '../hooks/useTrabajosExtra';
import { turnoLabel } from '../config/flota-colors';
import { RESPONSIVE_SHEET_DIALOG_WIDE_CLASS } from '../components/flota/modal-styles';
import { NUM_CL, NUM_CL_1 } from '../lib/dashboard-format';
import { actividadLabel } from '../types/trabajosExtra';
import type { TrabajoExtraordinario } from '../types/trabajosExtra';

const TURNOS = ['DIURNO', 'NOCTURNO'] as const;

function formatFecha(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Día local (YYYY-MM-DD) de un timestamp — para comparar contra los inputs
 * `type="date"` del filtro con el mismo día que ve el usuario en la tabla. */
function diaLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Actividades legibles; «Otro» muestra el texto libre si lo trae. */
function actividadesDe(trabajo: TrabajoExtraordinario): string {
  return trabajo.actividades
    .map((a) => (a === 'OTRO' && trabajo.otraActividad ? `Otro: ${trabajo.otraActividad}` : (actividadLabel[a] ?? a)))
    .join(', ');
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3.5 border-t border-separator py-2.5">
      <span className="shrink-0 text-[11px] font-bold tracking-wider text-(--label-color) uppercase">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

/** Popup de detalle de UN trabajo: todo lo que la tabla trunca (horómetros,
 * descripción, observaciones), solo lectura — los trabajos se corrigen desde
 * Terreno, con historial. */
function DetalleTrabajoModal({ trabajo, onClose }: { trabajo: TrabajoExtraordinario | null; onClose: () => void }) {
  return (
    <Modal.Backdrop
      isDismissable
      isOpen={trabajo !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={`${RESPONSIVE_SHEET_DIALOG_WIDE_CLASS} sm:w-full`}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              {`Trabajo extraordinario · ${trabajo?.equipo?.internalCode ?? '—'}`}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {trabajo ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-x-7 sm:grid-cols-2 [&>*:first-child]:border-t-0 sm:[&>*:nth-child(2)]:border-t-0">
                  <Dato label="Fecha" value={formatFecha(trabajo.fecha)} />
                  <Dato label="Equipo" value={trabajo.equipo?.internalCode ?? '—'} />
                  <Dato label="Operador" value={trabajo.operador} />
                  <Dato label="Turno" value={turnoLabel(trabajo.turno)} />
                  <Dato label="Faena" value={trabajo.faena} />
                  <Dato
                    label="Horómetro"
                    value={`${NUM_CL_1.format(trabajo.horometroInicial)} → ${NUM_CL_1.format(trabajo.horometroFinal)} h`}
                  />
                  <Dato label="Horas máquina" value={`${NUM_CL_1.format(trabajo.totalHoras)} h`} />
                  <Dato label="Actividades" value={actividadesDe(trabajo)} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold tracking-wider text-(--label-color) uppercase">
                    Descripción
                  </span>
                  <p className="text-sm text-foreground">{trabajo.descripcion}</p>
                </div>
                {trabajo.observaciones ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold tracking-wider text-(--label-color) uppercase">
                      Observaciones
                    </span>
                    <p className="text-sm text-foreground">{trabajo.observaciones}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

const SELECT_FILTRO = 'rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground';

/**
 * Vista de trabajos extraordinarios del ADMINISTRADOR (`/trabajos-extra`,
 * ruta solo ADMIN): todos los registros de Terreno con filtros por equipo,
 * turno y rango de fechas, el total de horas máquina de lo filtrado y el
 * detalle de cada trabajo en popup. Es el destino de «Ver todo» de la KPI
 * card «HM Trabajos extraordinarios» del dashboard. Solo lectura: las
 * correcciones siguen saliendo de Terreno, con su historial de cambios.
 */
export function TrabajosExtraAdminView() {
  const { data, isPending, isError, error } = useTrabajosExtraList();
  const [equipoFiltro, setEquipoFiltro] = useState('TODOS');
  const [turnoFiltro, setTurnoFiltro] = useState('TODOS');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [detalle, setDetalle] = useState<TrabajoExtraordinario | null>(null);

  const trabajos = useMemo(
    () => [...(data ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [data],
  );

  // Opciones del filtro de equipo: solo los que tienen trabajos registrados.
  const equipos = useMemo(() => {
    const porId = new Map<string, string>();
    for (const t of trabajos) porId.set(t.equipoId, t.equipo?.internalCode ?? t.equipoId);
    return [...porId.entries()].map(([id, codigo]) => ({ id, codigo })).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [trabajos]);

  const lista = useMemo(
    () =>
      trabajos.filter((t) => {
        if (equipoFiltro !== 'TODOS' && t.equipoId !== equipoFiltro) return false;
        if (turnoFiltro !== 'TODOS' && t.turno !== turnoFiltro) return false;
        const dia = diaLocal(t.fecha);
        if (desde && dia < desde) return false;
        if (hasta && dia > hasta) return false;
        return true;
      }),
    [trabajos, equipoFiltro, turnoFiltro, desde, hasta],
  );

  const totalHoras = lista.reduce((acc, t) => acc + t.totalHoras, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
            SMI · Trabajos extraordinarios
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            Trabajos extraordinarios
          </h1>
          <p className="text-sm text-muted-foreground">
            Todos los trabajos extra registrados en terreno. Abre uno para ver su detalle completo.
          </p>
        </div>
        <Chip color="accent" data-testid="total-filtrado" size="md" variant="soft">
          {NUM_CL_1.format(totalHoras)} h en {NUM_CL.format(lista.length)}{' '}
          {lista.length === 1 ? 'trabajo' : 'trabajos'}
        </Chip>
      </div>

      <Card>
        <Card.Header>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Card.Title>Listado</Card.Title>
              <Card.Description>Del más reciente al más antiguo. El total de arriba sigue al filtro.</Card.Description>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Equipo
                <select
                  className={SELECT_FILTRO}
                  onChange={(event) => setEquipoFiltro(event.target.value)}
                  value={equipoFiltro}
                >
                  <option value="TODOS">Todos</option>
                  {equipos.map((equipo) => (
                    <option key={equipo.id} value={equipo.id}>
                      {equipo.codigo}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Turno
                <select
                  className={SELECT_FILTRO}
                  onChange={(event) => setTurnoFiltro(event.target.value)}
                  value={turnoFiltro}
                >
                  <option value="TODOS">Todos</option>
                  {TURNOS.map((turno) => (
                    <option key={turno} value={turno}>
                      {turnoLabel(turno)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Desde
                <input
                  className={SELECT_FILTRO}
                  max={hasta || undefined}
                  onChange={(event) => setDesde(event.target.value)}
                  type="date"
                  value={desde}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Hasta
                <input
                  className={SELECT_FILTRO}
                  min={desde || undefined}
                  onChange={(event) => setHasta(event.target.value)}
                  type="date"
                  value={hasta}
                />
              </label>
            </div>
          </div>
        </Card.Header>
        <Card.Content>
          {isPending ? (
            <div className="flex justify-center py-10">
              <Spinner color="accent" size="sm" />
            </div>
          ) : null}

          {isError ? (
            <p className="text-sm text-danger-soft-foreground" role="alert">
              {error instanceof Error ? error.message : 'No se pudo cargar los trabajos extraordinarios.'}
            </p>
          ) : null}

          {!isPending && !isError && lista.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              {trabajos.length === 0
                ? 'No hay trabajos extraordinarios registrados.'
                : 'Ningún trabajo calza con el filtro.'}
            </p>
          ) : null}

          {!isPending && !isError && lista.length > 0 ? (
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Trabajos extraordinarios" className="min-w-full">
                  <Table.Header>
                    <Table.Column isRowHeader>Fecha</Table.Column>
                    <Table.Column>Equipo</Table.Column>
                    <Table.Column>Operador</Table.Column>
                    <Table.Column>Turno</Table.Column>
                    <Table.Column>Faena</Table.Column>
                    <Table.Column className="w-full">Actividades</Table.Column>
                    <Table.Column className="text-right">HM</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {lista.map((t) => (
                      <Table.Row
                        className="cursor-pointer"
                        data-testid={`trabajo-fila-${t.id}`}
                        key={t.id}
                        onAction={() => setDetalle(t)}
                      >
                        <Table.Cell className="text-sm text-muted-foreground">{formatFecha(t.fecha)}</Table.Cell>
                        <Table.Cell className="font-mono text-sm">{t.equipo?.internalCode ?? '—'}</Table.Cell>
                        <Table.Cell className="text-sm">{t.operador}</Table.Cell>
                        <Table.Cell className="text-sm">{turnoLabel(t.turno)}</Table.Cell>
                        <Table.Cell className="text-sm">{t.faena}</Table.Cell>
                        <Table.Cell className="max-w-0 truncate text-sm">{actividadesDe(t)}</Table.Cell>
                        <Table.Cell className="text-right font-mono text-sm font-semibold">
                          {NUM_CL_1.format(t.totalHoras)} h
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          ) : null}
        </Card.Content>
      </Card>

      <DetalleTrabajoModal trabajo={detalle} onClose={() => setDetalle(null)} />
    </div>
  );
}
