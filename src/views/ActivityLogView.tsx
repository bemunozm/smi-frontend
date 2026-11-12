import { useMemo, useState } from 'react';
import { Button, Card, Chip, Label, ListBox, Modal, RangeCalendar, Select, Spinner, Table } from '@heroui/react';
import { Dialog, DialogTrigger, Popover } from 'react-aria-components';
import type { DateValue } from 'react-aria-components/Calendar';
import { CalendarDays } from 'lucide-react';

import { useActivityLog } from '../hooks/useActivityLog';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import type { ActivityAction, ActivityEvent, ActivityKind } from '../types/activity-log';

const KIND_LABEL: Record<ActivityKind, string> = {
  FUEL_LOAD: 'Carga de combustible',
  SHIFT_CARD: 'Tarjeta de turno',
  DAILY_REPORT: 'Producción diaria',
  EXTRA_WORK: 'Report',
  FINDING: 'Hallazgo',
  WORK_ORDER: 'Mantenimiento',
  MAINTENANCE: 'Pauta de mantención',
  EXIT_REPORT: 'Informe diario equipos',
  OTHER: 'Otro',
};

const ACTION_LABEL: Record<ActivityAction, string> = {
  CREATED: 'Creación',
  CLOSED: 'Cierre',
  UPDATED: 'Edición',
  DELETED: 'Eliminación',
};

/** Color del chip por acción: lo nuevo en verde, los cierres en azul, lo
 * corregido en ámbar y lo eliminado en rojo — se lee sin leer. */
const ACTION_CHIP: Record<ActivityAction, 'success' | 'accent' | 'warning' | 'danger'> = {
  CREATED: 'success',
  CLOSED: 'accent',
  UPDATED: 'warning',
  DELETED: 'danger',
};

function kindLabel(kind: ActivityKind): string {
  return KIND_LABEL[kind] ?? kind;
}

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

/** `YYYY-MM-DD` → `dd/mm/aaaa` (día de calendario, sin hora ni huso). */
function formatDia(ymd: string): string {
  return ymd.split('-').reverse().join('/');
}

/** Día local `YYYY-MM-DD` — el rango por defecto se arma con el día que ve el
 * usuario, igual que los filtros de Cargas de combustible. */
function diaLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const TODOS = 'TODOS';
const DIA_MS = 24 * 60 * 60 * 1000;

/** `DateValue.toString()` es `YYYY-MM-DD` → `dd/mm/aaaa` para el botón. */
const fmtDiaRango = (dia: DateValue) => formatDia(dia.toString());

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3.5 border-t border-separator py-2.5">
      <span className="shrink-0 text-[11px] font-bold tracking-wider text-(--label-color) uppercase">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

/** Popup de detalle de UN evento: las dos fechas completas y, en ediciones y
 * eliminaciones, el antes → después de cada dato — solo lectura. */
function DetalleEventoModal({ evento, onClose }: { evento: ActivityEvent | null; onClose: () => void }) {
  return (
    <Modal.Backdrop
      isDismissable
      isOpen={evento !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="sm:w-full sm:max-w-xl">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              {evento ? `${ACTION_LABEL[evento.action]} · ${kindLabel(evento.kind)}` : ''}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {evento ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-x-7 sm:grid-cols-2 [&>*:first-child]:border-t-0 sm:[&>*:nth-child(2)]:border-t-0">
                  <Dato label="Registrado el" value={formatFecha(evento.occurredAt)} />
                  <Dato label="Corresponde al" value={evento.dataDate ? formatDia(evento.dataDate) : '—'} />
                  <Dato label="Usuario" value={evento.actorName ?? '—'} />
                  <Dato label="Acción" value={ACTION_LABEL[evento.action]} />
                </div>
                <p className="text-sm text-foreground">{evento.summary}</p>
                {evento.backdated && evento.dataDate ? (
                  <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
                    Registro retroactivo: se hizo el {formatFecha(evento.occurredAt)}, pero corresponde al día{' '}
                    {formatDia(evento.dataDate)}.
                  </p>
                ) : null}
                {evento.changes && evento.changes.length > 0 ? (
                  <div className="flex flex-col gap-1 rounded-xl bg-surface-secondary px-3 py-2.5">
                    <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                      Qué cambió
                    </span>
                    {evento.changes.map((cambio) => (
                      <p className="text-sm text-foreground" key={`${evento.id}-${cambio.field}-${cambio.label}`}>
                        <span className="font-semibold">{cambio.label}:</span> {cambio.before}
                        <span className="text-muted-foreground"> → </span>
                        {cambio.after}
                      </p>
                    ))}
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

/** Select HeroUI de la barra de filtros (label flotante del patrón del repo):
 * nunca un `<select>` nativo — pedido explícito del administrador. */
function SelectFiltro({
  label,
  onChange,
  opciones,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  opciones: ReadonlyArray<{ value: string; label: string }>;
  value: string;
}) {
  return (
    <Select
      fullWidth
      onChange={(elegido) => {
        if (elegido) onChange(String(elegido));
      }}
      value={value}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {opciones.map((opcion) => (
            <ListBox.Item id={opcion.value} key={opcion.value} textValue={opcion.label}>
              {opcion.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/**
 * Registro de actividad del administrador (`/registro-actividad`, ADMIN +
 * SECRETARIA): TODO lo que se registra en la plataforma — cargas, tarjetas,
 * reportes, Reports, hallazgos, mantenimiento, ediciones y eliminaciones — en
 * una sola línea de tiempo, con las DOS fechas de cada evento: cuándo se hizo
 * y a qué día corresponde el dato. Lo retroactivo (reporte antiguo, carga de
 * un turno pasado) queda marcado. Parte en los últimos 7 días.
 */
export function ActivityLogView() {
  // Período en UN calendario de rango (mismo patrón que Cargas de
  // combustible); sin elección rige «últimos 7 días», y «Limpiar» vuelve ahí.
  const [range, setRange] = useState<{ start: DateValue; end: DateValue } | null>(null);
  const [periodoAbierto, setPeriodoAbierto] = useState(false);
  const hasta = range ? range.end.toString() : diaLocal(new Date());
  const desde = range ? range.start.toString() : diaLocal(new Date(Date.now() - 6 * DIA_MS));

  const { data, isPending, isError, error } = useActivityLog(desde, hasta);

  const [usuarioFiltro, setUsuarioFiltro] = useState(TODOS);
  const [moduloFiltro, setModuloFiltro] = useState(TODOS);
  const [accionFiltro, setAccionFiltro] = useState(TODOS);
  const [detalle, setDetalle] = useState<ActivityEvent | null>(null);

  const eventos = useMemo(() => data?.events ?? [], [data?.events]);

  // Opciones de los filtros: solo lo que existe en el rango cargado.
  const usuarios = useMemo(
    () =>
      [...new Set(eventos.map((e) => e.actorName).filter((nombre): nombre is string => Boolean(nombre)))].sort((a, b) =>
        a.localeCompare(b, 'es'),
      ),
    [eventos],
  );
  const modulos = useMemo(() => {
    const presentes = [...new Set(eventos.map((e) => e.kind))];
    return presentes
      .map((kind) => ({ value: kind, label: kindLabel(kind) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [eventos]);

  const lista = useMemo(
    () =>
      eventos.filter((e) => {
        if (usuarioFiltro !== TODOS && e.actorName !== usuarioFiltro) return false;
        if (moduloFiltro !== TODOS && e.kind !== moduloFiltro) return false;
        if (accionFiltro !== TODOS && e.action !== accionFiltro) return false;
        return true;
      }),
    [eventos, usuarioFiltro, moduloFiltro, accionFiltro],
  );
  const retroactivos = lista.filter((e) => e.backdated).length;

  // La tabla solo en escritorio: en tablet y celular, tarjetas que caben en el ancho.
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);

  const fechaRegistro = (e: ActivityEvent, compacta = false) => (
    <>
      {formatFecha(e.occurredAt)}
      {e.backdated && e.dataDate ? (
        <span className={`block text-xs text-warning-soft-foreground ${compacta ? '' : 'whitespace-nowrap'}`}>
          corresponde al {formatDia(e.dataDate)}
        </span>
      ) : null}
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
            SMI · Registro de actividad
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            Registro de actividad
          </h1>
          <p className="text-sm text-muted-foreground">
            Todo lo que se registra en la plataforma, con quién lo hizo y cuándo. Un registro hecho para un día distinto
            (reporte antiguo, carga de un turno pasado) queda marcado con el día al que corresponde.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip color="accent" data-testid="total-acciones" size="md" variant="soft">
            {lista.length} {lista.length === 1 ? 'acción' : 'acciones'}
          </Chip>
          {retroactivos > 0 ? (
            <Chip color="warning" data-testid="total-retroactivos" size="md" variant="soft">
              {retroactivos} {retroactivos === 1 ? 'retroactiva' : 'retroactivas'}
            </Chip>
          ) : null}
        </div>
      </div>

      <Card>
        <Card.Header>
          <div className="flex flex-col gap-4">
            <div>
              <Card.Title>Actividad</Card.Title>
              <Card.Description>
                De la más reciente a la más antigua. Abre una fila para ver su detalle; en ediciones y eliminaciones, el
                antes y el después de cada dato.
              </Card.Description>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="filtros-actividad">
              <SelectFiltro
                label="Usuario"
                onChange={setUsuarioFiltro}
                opciones={[
                  { value: TODOS, label: 'Todos' },
                  ...usuarios.map((nombre) => ({ value: nombre, label: nombre })),
                ]}
                value={usuarioFiltro}
              />
              <SelectFiltro
                label="Módulo"
                onChange={setModuloFiltro}
                opciones={[{ value: TODOS, label: 'Todos' }, ...modulos]}
                value={moduloFiltro}
              />
              <SelectFiltro
                label="Acción"
                onChange={setAccionFiltro}
                opciones={[
                  { value: TODOS, label: 'Todas' },
                  ...Object.entries(ACTION_LABEL).map(([value, label]) => ({ value, label })),
                ]}
                value={accionFiltro}
              />
              <div className="flex h-full flex-col gap-1">
                <DialogTrigger isOpen={periodoAbierto} onOpenChange={setPeriodoAbierto}>
                  <Button className="w-full flex-1 justify-start" variant="secondary">
                    <CalendarDays aria-hidden className="size-[18px]" />
                    {range ? `${fmtDiaRango(range.start)} → ${fmtDiaRango(range.end)}` : 'Últimos 7 días'}
                  </Button>
                  <Popover
                    className="rounded-2xl border border-border bg-card p-2 shadow-[0_18px_44px_rgba(20,23,28,.18)] outline-none"
                    offset={6}
                  >
                    <Dialog aria-label="Período" className="outline-none">
                      <RangeCalendar
                        onChange={(valor) => {
                          setRange(valor);
                          // Con el rango completo (segundo clic) el popover se
                          // cierra solo: lo elegido queda a la vista en el botón.
                          setPeriodoAbierto(false);
                        }}
                        value={range}
                      >
                        <RangeCalendar.Header>
                          <RangeCalendar.NavButton slot="previous" />
                          <RangeCalendar.Heading />
                          <RangeCalendar.NavButton slot="next" />
                        </RangeCalendar.Header>
                        <RangeCalendar.Grid>
                          <RangeCalendar.GridHeader>
                            {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                          </RangeCalendar.GridHeader>
                          <RangeCalendar.GridBody>
                            {(date) => <RangeCalendar.Cell date={date} />}
                          </RangeCalendar.GridBody>
                        </RangeCalendar.Grid>
                      </RangeCalendar>
                    </Dialog>
                  </Popover>
                </DialogTrigger>
                {range ? (
                  <button
                    className="self-end text-sm font-semibold text-(--accent) hover:underline"
                    onClick={() => setRange(null)}
                    type="button"
                  >
                    Limpiar período
                  </button>
                ) : null}
              </div>
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
              {error instanceof Error ? error.message : 'No se pudo cargar el registro de actividad.'}
            </p>
          ) : null}

          {!isPending && !isError && lista.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              {eventos.length === 0 ? 'Sin actividad en el período.' : 'Ninguna actividad calza con el filtro.'}
            </p>
          ) : null}

          {!isPending && !isError && lista.length > 0 && !esEscritorio ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {lista.map((e) => (
                <li key={e.id}>
                  <button
                    className="flex w-full cursor-pointer flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-left hover:bg-default"
                    data-testid={`evento-fila-${e.id}`}
                    onClick={() => setDetalle(e)}
                    type="button"
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">{fechaRegistro(e, true)}</span>
                      <Chip color={ACTION_CHIP[e.action]} size="sm" variant="soft">
                        {ACTION_LABEL[e.action]}
                      </Chip>
                    </div>
                    <span className="text-[13px] font-medium text-muted-foreground">
                      {kindLabel(e.kind)} · {e.actorName ?? '—'}
                    </span>
                    <span className="line-clamp-2 text-sm text-foreground">{e.summary}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {!isPending && !isError && lista.length > 0 && esEscritorio ? (
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Registro de actividad" className="min-w-full">
                  <Table.Header>
                    <Table.Column isRowHeader>Registrado</Table.Column>
                    <Table.Column>Usuario</Table.Column>
                    <Table.Column>Acción</Table.Column>
                    <Table.Column>Módulo</Table.Column>
                    <Table.Column className="w-full">Detalle</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {lista.map((e) => (
                      <Table.Row
                        className="cursor-pointer"
                        data-testid={`evento-fila-${e.id}`}
                        key={e.id}
                        onAction={() => setDetalle(e)}
                      >
                        <Table.Cell className="text-sm whitespace-nowrap text-muted-foreground">
                          {fechaRegistro(e)}
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap">{e.actorName ?? '—'}</Table.Cell>
                        <Table.Cell>
                          <Chip color={ACTION_CHIP[e.action]} size="sm" variant="soft">
                            {ACTION_LABEL[e.action]}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap">{kindLabel(e.kind)}</Table.Cell>
                        <Table.Cell className="max-w-120 truncate text-sm">{e.summary}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          ) : null}
        </Card.Content>
      </Card>

      <DetalleEventoModal evento={detalle} onClose={() => setDetalle(null)} />
    </div>
  );
}
