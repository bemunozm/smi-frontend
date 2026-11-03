import { useMemo, useState } from 'react';
import { Button, Card, Checkbox, Chip, Input, Label, ListBox, Modal, Select, Spinner, Table, TextArea, TextField } from '@heroui/react';

import { useEquipment } from '../hooks/useEquipment';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { useOperators } from '../hooks/useOperators';
import { usePermissions } from '../hooks/usePermissions';
import { useCrearTrabajoExtra, useEditarTrabajoExtra, useTrabajosExtraList } from '../hooks/useTrabajosExtra';
import { turnoLabel } from '../config/flota-colors';
import { RESPONSIVE_SHEET_DIALOG_WIDE_CLASS } from '../components/flota/modal-styles';
import { NUM_CL, NUM_CL_1 } from '../lib/dashboard-format';
import { fechaRegistroIso, toDateTimeLocal } from '../lib/format';
import { ACTIVIDADES, actividadLabel, trabajoExtraFormSchema } from '../types/trabajosExtra';
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
/** Popup de detalle; «Editar» al pie solo si llega `onEditar` (quien puede corregir). */
function DetalleTrabajoModal({
  trabajo,
  onClose,
  onEditar,
}: {
  trabajo: TrabajoExtraordinario | null;
  onClose: () => void;
  onEditar?: () => void;
}) {
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
                  <Dato label="Registrado por" value={trabajo.registradoPor ?? 'Sin registro'} />
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
          {onEditar ? (
            <Modal.Footer>
              <Button onPress={onEditar}>Editar</Button>
            </Modal.Footer>
          ) : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

const SELECT_FILTRO = 'rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground';

/**
 * Alta directa desde el panel, o corrección de uno ya registrado (`trabajo`):
 * el mismo formulario que Terreno (operador del catálogo, horómetros,
 * actividades múltiples), validado con `trabajoExtraFormSchema`. El alta es un
 * POST online con id idempotente del cliente (`useCrearTrabajoExtra`); la
 * corrección va por la cola con solo lo que cambió (`useEditarTrabajoExtra`),
 * igual que en Terreno, y queda en el historial de cambios.
 *
 * La fecha se elige solo en el alta (parte en ahora; se cambia para cargar uno
 * olvidado): la corrección no la toca, igual que en Terreno.
 */
function TrabajoExtraModal({ trabajo, onClose }: { trabajo?: TrabajoExtraordinario; onClose: () => void }) {
  const { data: equipos } = useEquipment();
  const { data: operadores } = useOperators();
  const crear = useCrearTrabajoExtra();
  const { guardar, isGuardando } = useEditarTrabajoExtra();
  const [equipoId, setEquipoId] = useState(trabajo?.equipoId ?? '');
  const [operatorId, setOperatorId] = useState(trabajo?.operatorId ?? '');
  const [turno, setTurno] = useState(trabajo?.turno === 'NOCTURNO' ? 'NOCTURNO' : 'DIURNO');
  const [faena, setFaena] = useState(trabajo?.faena ?? '');
  const [horometroInicial, setHorometroInicial] = useState(trabajo ? String(trabajo.horometroInicial) : '');
  const [horometroFinal, setHorometroFinal] = useState(trabajo ? String(trabajo.horometroFinal) : '');
  const [actividades, setActividades] = useState<string[]>(trabajo?.actividades ?? []);
  const [otraActividad, setOtraActividad] = useState(trabajo?.otraActividad ?? '');
  const [descripcion, setDescripcion] = useState(trabajo?.descripcion ?? '');
  const [observaciones, setObservaciones] = useState(trabajo?.observaciones ?? '');
  const [fecha, setFecha] = useState(() => toDateTimeLocal(new Date()));
  const fechaIso = trabajo ? null : fechaRegistroIso(fecha);
  const fechaValida = trabajo != null || fechaIso !== null;

  const alternarActividad = (valor: string, marcada: boolean) => {
    setActividades((previas) => (marcada ? [...previas, valor] : previas.filter((a) => a !== valor)));
  };

  // El schema espera números (inputs `valueAsNumber` en Terreno); acá los
  // campos son de texto — vacío queda NaN, que el schema trata como requerido.
  const aNumero = (texto: string) => (texto.trim() === '' ? Number.NaN : Number(texto));

  const parsed = trabajoExtraFormSchema.safeParse({
    equipoId,
    operatorId,
    faena,
    turno,
    horometroInicial: aNumero(horometroInicial),
    horometroFinal: aNumero(horometroFinal),
    actividades,
    otraActividad: otraActividad.trim() || undefined,
    descripcion,
    observaciones: observaciones.trim() || undefined,
  });

  const registrar = () => {
    if (!parsed.success) return;
    if (trabajo) {
      void guardar(trabajo, parsed.data).then((ok) => {
        if (ok) onClose();
      });
      return;
    }
    if (!fechaIso) return;
    crear.mutate({ ...parsed.data, fecha: fechaIso }, { onSuccess: onClose });
  };
  const pendiente = trabajo ? isGuardando : crear.isPending;

  return (
    <Modal.Backdrop
      isDismissable
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={`${RESPONSIVE_SHEET_DIALOG_WIDE_CLASS} sm:w-full`}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              {trabajo ? `Editar actividad · ${trabajo.equipo?.internalCode ?? '—'}` : 'Nueva actividad'}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Select fullWidth placeholder="Elegir equipo" value={equipoId} onChange={(value) => value && setEquipoId(String(value))}>
                  <Label>Equipo</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {(equipos ?? []).map((equipo) => (
                        <ListBox.Item id={equipo.id} key={equipo.id} textValue={equipo.internalCode}>
                          {equipo.internalCode}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>

                <Select fullWidth placeholder="Elegir operador" value={operatorId} onChange={(value) => value && setOperatorId(String(value))}>
                  <Label>Operador</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {(operadores ?? [])
                        .filter((operador) => operador.isActive)
                        .map((operador) => (
                          <ListBox.Item id={operador.id} key={operador.id} textValue={operador.name}>
                            {operador.name}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                    </ListBox>
                  </Select.Popover>
                </Select>

                <Select fullWidth value={turno} onChange={(value) => value && setTurno(String(value))}>
                  <Label>Turno</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {TURNOS.map((opcion) => (
                        <ListBox.Item id={opcion} key={opcion} textValue={turnoLabel(opcion)}>
                          {turnoLabel(opcion)}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              {trabajo ? null : (
                <TextField fullWidth isInvalid={fechaIso === null} name="fecha" onChange={setFecha} value={fecha}>
                  <Label>Fecha y hora del trabajo</Label>
                  <Input max={toDateTimeLocal(new Date())} type="datetime-local" />
                </TextField>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <TextField fullWidth name="faena" onChange={setFaena} value={faena}>
                  <Label>Faena</Label>
                  <Input placeholder="Dónde se hizo el trabajo" />
                </TextField>
                <TextField fullWidth name="horometroInicial" onChange={setHorometroInicial} value={horometroInicial}>
                  <Label>Horómetro inicial</Label>
                  <Input inputMode="decimal" placeholder="0" />
                </TextField>
                <TextField fullWidth name="horometroFinal" onChange={setHorometroFinal} value={horometroFinal}>
                  <Label>Horómetro final</Label>
                  <Input inputMode="decimal" placeholder="0" />
                </TextField>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">Actividades</span>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {ACTIVIDADES.map((actividad) => (
                    <Checkbox
                      aria-label={actividad.label}
                      isSelected={actividades.includes(actividad.value)}
                      key={actividad.value}
                      onChange={(marcada) => alternarActividad(actividad.value, marcada)}
                    >
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <span className="text-sm text-foreground">{actividad.label}</span>
                      </Checkbox.Content>
                    </Checkbox>
                  ))}
                </div>
                {actividades.includes('OTRO') ? (
                  <TextField fullWidth name="otraActividad" onChange={setOtraActividad} value={otraActividad}>
                    <Label>Cuál fue la otra actividad</Label>
                    <Input placeholder="Describí la actividad" />
                  </TextField>
                ) : null}
              </div>

              <TextField fullWidth name="descripcion" onChange={setDescripcion} value={descripcion}>
                <Label>Descripción</Label>
                <TextArea placeholder="Qué se hizo…" rows={3} />
              </TextField>

              <TextField fullWidth name="observaciones" onChange={setObservaciones} value={observaciones}>
                <Label>Observaciones (opcional)</Label>
                <TextArea placeholder=" " rows={2} />
              </TextField>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button onPress={onClose} variant="tertiary">
              Cancelar
            </Button>
            <Button isDisabled={!parsed.success || !fechaValida} isPending={pendiente} onPress={registrar}>
              {({ isPending }) =>
                isPending ? <Spinner color="current" size="sm" /> : trabajo ? 'Guardar cambios' : 'Registrar trabajo'
              }
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/**
 * Vista de trabajos extraordinarios del ADMINISTRADOR (`/trabajos-extra`,
 * ruta solo ADMIN): todos los registros de Terreno con filtros por equipo,
 * turno y rango de fechas, el total de horas máquina de lo filtrado y el
 * detalle de cada trabajo en popup. Es el destino de «Ver todo» de la KPI
 * card «HM Trabajos extraordinarios» del dashboard. Quien puede corregir
 * (`trabajoExtra.edit`: ADMIN, SECRETARIA) tiene «Editar» en el detalle; el
 * cambio queda en el mismo historial que las correcciones de Terreno.
 */
export function TrabajosExtraAdminView() {
  const { data, isPending, isError, error } = useTrabajosExtraList();
  const [equipoFiltro, setEquipoFiltro] = useState('TODOS');
  const [turnoFiltro, setTurnoFiltro] = useState('TODOS');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [detalle, setDetalle] = useState<TrabajoExtraordinario | null>(null);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<TrabajoExtraordinario | null>(null);
  const puedeEditar = usePermissions().can('trabajoExtra.edit');

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

  // La tabla solo en escritorio: en tablet y celular, tarjetas que caben en el ancho.
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);

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
            SMI · Report
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            Report
          </h1>
          <p className="text-sm text-muted-foreground">
            Todos los trabajos extra registrados en terreno. Abre uno para ver su detalle completo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip color="accent" data-testid="total-filtrado" size="md" variant="soft">
            {NUM_CL_1.format(totalHoras)} h en {NUM_CL.format(lista.length)}{' '}
            {lista.length === 1 ? 'trabajo' : 'trabajos'}
          </Chip>
          <Button onPress={() => setCreando(true)}>Nueva actividad</Button>
        </div>
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

          {!isPending && !isError && lista.length > 0 && !esEscritorio ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {lista.map((t) => (
                <li key={t.id}>
                  <button
                    data-testid={`trabajo-fila-${t.id}`}
                    className="flex w-full cursor-pointer flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:bg-default"
                    type="button"
                    onClick={() => setDetalle(t)}
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <span className="text-[15px] font-semibold text-foreground">
                        {formatFecha(t.fecha)} · <span className="font-mono">{t.equipo?.internalCode ?? '—'}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[15px] font-semibold text-foreground">
                        {NUM_CL_1.format(t.totalHoras)} h
                      </span>
                    </div>
                    <p className="m-0 text-sm text-foreground">{actividadesDe(t)}</p>
                    <dl className="m-0 grid w-full grid-cols-2 gap-2 rounded-xl bg-surface-secondary px-3 py-2.5 text-sm">
                        <div className="flex flex-col">
                          <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                            Operador
                          </dt>
                          <dd className="m-0 text-foreground">{t.operador}</dd>
                        </div>
                        <div className="flex flex-col">
                          <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                            Turno
                          </dt>
                          <dd className="m-0 text-foreground">{turnoLabel(t.turno)}</dd>
                        </div>
                        <div className="flex flex-col">
                          <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                            Faena
                          </dt>
                          <dd className="m-0 text-foreground">{t.faena}</dd>
                        </div>
                        <div className="flex flex-col">
                          <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                            Registrado por
                          </dt>
                          <dd className="m-0 text-foreground">{t.registradoPor ?? 'Sin registro'}</dd>
                        </div>
                    </dl>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {!isPending && !isError && lista.length > 0 && esEscritorio ? (
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Report" className="min-w-full">
                  <Table.Header>
                    <Table.Column isRowHeader>Fecha</Table.Column>
                    <Table.Column>Equipo</Table.Column>
                    <Table.Column>Operador</Table.Column>
                    <Table.Column>Turno</Table.Column>
                    <Table.Column>Faena</Table.Column>
                    <Table.Column>Registrado por</Table.Column>
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
                        {/* `whitespace-nowrap` en todas las columnas cortas: sin él, la
                           columna ancha (Actividades, `w-full`) las aprieta y la fecha
                           se parte en 5 líneas. */}
                        <Table.Cell className="text-sm whitespace-nowrap text-muted-foreground">
                          {formatFecha(t.fecha)}
                        </Table.Cell>
                        <Table.Cell className="font-mono text-sm whitespace-nowrap">
                          {t.equipo?.internalCode ?? '—'}
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap">{t.operador}</Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap">{turnoLabel(t.turno)}</Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap">{t.faena}</Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap">{t.registradoPor ?? 'Sin registro'}</Table.Cell>
                        <Table.Cell className="max-w-0 truncate text-sm">{actividadesDe(t)}</Table.Cell>
                        <Table.Cell className="text-right font-mono text-sm font-semibold whitespace-nowrap">
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

      <DetalleTrabajoModal
        trabajo={detalle}
        onClose={() => setDetalle(null)}
        onEditar={
          puedeEditar
            ? () => {
                setEditando(detalle);
                setDetalle(null);
              }
            : undefined
        }
      />

      {editando ? <TrabajoExtraModal trabajo={editando} onClose={() => setEditando(null)} /> : null}

      {creando ? <TrabajoExtraModal onClose={() => setCreando(false)} /> : null}
    </div>
  );
}
