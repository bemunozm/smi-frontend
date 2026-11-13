import { useMemo, useState } from 'react';
import {
  AlertDialog,
  Button,
  Card,
  Chip,
  Label,
  ListBox,
  Modal,
  RangeCalendar,
  Select,
  Spinner,
  Table,
} from '@heroui/react';
import { Dialog, DialogTrigger, Popover } from 'react-aria-components';
import type { DateValue } from 'react-aria-components/Calendar';
import { CalendarDays } from 'lucide-react';

import { assetUrl } from '../api/UploadsAPI';
import { RecordPhoto } from '../components/RecordPhoto';
import { EditarCargaCombustibleModal } from '../components/flota/EditarCargaCombustibleModal';
import { NuevaCargaCombustibleModal } from '../components/flota/NuevaCargaCombustibleModal';
import { RESPONSIVE_SHEET_DIALOG_WIDE_CLASS } from '../components/flota/modal-styles';
import { EQUIPMENT_CLASS_OPTIONS, equipmentClassLabel } from '../config/flota-colors';
import { useCombustibleList, useEliminarCargaCombustible } from '../hooks/useCombustible';
import { useEquipment } from '../hooks/useEquipment';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { usePermissions } from '../hooks/usePermissions';
import { canDeleteCombustible, canEditCombustible } from '../lib/permissions';
import { NUM_CL, NUM_CL_1 } from '../lib/dashboard-format';
import type { RegistroCombustible } from '../types/combustible';
import type { EquipmentClass } from '../types/equipment';

const TIPO_LABEL: Record<string, string> = { PETROLEO: 'Petróleo', BENCINA: 'Bencina' };

const ORIGEN_LABEL: Record<string, string> = { TARJETA: 'Tarjeta de turno', MANUAL: 'Manual' };

function tipoDe(carga: RegistroCombustible): string {
  return TIPO_LABEL[carga.tipo] ?? carga.tipo;
}

function origenDe(carga: RegistroCombustible): string {
  return (carga.origen && ORIGEN_LABEL[carga.origen]) || '—';
}

/** Unidad de la lectura del contador al cargar: por el `controlUnit` del
 * equipo, con fallback a la clase (liviano → km, pesado → h). */
function unidadLectura(carga: RegistroCombustible, clase: EquipmentClass | undefined): 'h' | 'km' {
  if (carga.equipo?.controlUnit) {
    return carga.equipo.controlUnit === 'KM' ? 'km' : 'h';
  }
  return clase === 'LIGHT' ? 'km' : 'h';
}

function nombreLectura(carga: RegistroCombustible, clase: EquipmentClass | undefined): string {
  return unidadLectura(carga, clase) === 'km' ? 'Kilometraje' : 'Horómetro';
}

function lecturaTexto(carga: RegistroCombustible, clase: EquipmentClass | undefined): string {
  return carga.lectura != null ? `${NUM_CL_1.format(carga.lectura)} ${unidadLectura(carga, clase)}` : '—';
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

/** Día local (YYYY-MM-DD) de un timestamp — para comparar contra los inputs
 * `type="date"` del filtro con el mismo día que ve el usuario en la tabla. */
function diaLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3.5 border-t border-separator py-2.5">
      <span className="shrink-0 text-[11px] font-bold tracking-wider text-(--label-color) uppercase">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

/** Popup de detalle de UNA carga: todo lo que la tabla trunca, más la foto del
 * surtidor cuando existe — solo lectura. */
function DetalleCargaModal({
  carga,
  clase,
  onClose,
  onEditar,
  onEliminar,
}: {
  carga: RegistroCombustible | null;
  clase: EquipmentClass | undefined;
  onClose: () => void;
  /** Presente solo cuando el rol puede corregir la carga (ADMIN). */
  onEditar?: () => void;
  /** Presente solo cuando el rol puede eliminarla (ADMIN). */
  onEliminar?: () => void;
}) {
  // `assetUrl`: las fotoUrl legacy de combustible son rutas relativas del
  // backend (/uploads/...) — crudas se rompen cuando front y API viven en
  // orígenes distintos.
  const fotoSrc = assetUrl(carga?.fotoUrl);
  return (
    <Modal.Backdrop
      isDismissable
      isOpen={carga !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={`${RESPONSIVE_SHEET_DIALOG_WIDE_CLASS} sm:w-full`}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              {`Carga de combustible · ${carga?.equipo?.internalCode ?? '—'}`}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {carga ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-x-7 sm:grid-cols-2 [&>*:first-child]:border-t-0 sm:[&>*:nth-child(2)]:border-t-0">
                  <Dato label="Fecha" value={formatFecha(carga.fecha)} />
                  <Dato
                    label="Equipo"
                    value={`${carga.equipo?.internalCode ?? '—'}${carga.equipo?.type ? ` · ${carga.equipo.type}` : ''}`}
                  />
                  <Dato label="Clase" value={clase ? equipmentClassLabel(clase) : '—'} />
                  <Dato label="Litros" value={`${NUM_CL_1.format(carga.litros)} L`} />
                  <Dato label="Combustible" value={tipoDe(carga)} />
                  <Dato label={`${nombreLectura(carga, clase)} al cargar`} value={lecturaTexto(carga, clase)} />
                  <Dato label="Realizó" value={carga.realizadoPor ?? '—'} />
                  <Dato label="Origen" value={origenDe(carga)} />
                </div>
                {fotoSrc ? (
                  <RecordPhoto alt={`Foto de la carga de ${carga.equipo?.internalCode ?? 'equipo'}`} src={fotoSrc} />
                ) : (
                  <p className="text-sm text-muted-foreground">Sin foto adjunta.</p>
                )}
              </div>
            ) : null}
          </Modal.Body>
          {onEditar || onEliminar ? (
            <Modal.Footer>
              {onEliminar ? (
                <Button onPress={onEliminar} variant="danger">
                  Eliminar carga
                </Button>
              ) : null}
              {onEditar ? (
                <Button onPress={onEditar} variant="secondary">
                  Editar carga
                </Button>
              ) : null}
            </Modal.Footer>
          ) : null}
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

const TODOS = 'TODOS';

/** `DateValue.toString()` es `YYYY-MM-DD` → `dd/mm/aaaa` para el botón. */
const fmtDiaRango = (dia: DateValue) => dia.toString().split('-').reverse().join('/');

/**
 * Cargas de combustible del ADMINISTRADOR (`/cargas-combustible`, ADMIN +
 * SECRETARIA): TODAS las cargas — las que nacen del cierre de tarjeta en
 * Terreno y las manuales — de la última a la primera, con filtros por equipo,
 * clase (liviano/pesado), supervisor y rango de fechas, y alta manual para
 * cualquier equipo. El detalle de cada carga (con su foto) va en popup.
 */
export function CargasCombustibleAdminView() {
  const { data, isPending, isError, error } = useCombustibleList();
  const { data: catalogo } = useEquipment();
  const [equipoFiltro, setEquipoFiltro] = useState(TODOS);
  const [claseFiltro, setClaseFiltro] = useState(TODOS);
  const [supervisorFiltro, setSupervisorFiltro] = useState(TODOS);
  // Período en UN calendario de rango: el rango es una decisión («esta
  // semana»), no dos campos sueltos. Se abre desde un botón, sin segmentos
  // dd/mm/aaaa a la vista (pedido del administrador).
  const [range, setRange] = useState<{ start: DateValue; end: DateValue } | null>(null);
  const [periodoAbierto, setPeriodoAbierto] = useState(false);
  // `DateValue.toString()` es `YYYY-MM-DD`: comparable contra `diaLocal`.
  const desde = range?.start.toString() ?? '';
  const hasta = range?.end.toString() ?? '';
  const [detalle, setDetalle] = useState<RegistroCombustible | null>(null);
  const [editando, setEditando] = useState<RegistroCombustible | null>(null);
  const [eliminando, setEliminando] = useState<RegistroCombustible | null>(null);
  const [creando, setCreando] = useState(false);
  const permisos = usePermissions();
  const puedeCrear = permisos.can('combustible.create');
  const puedeEditar = canEditCombustible(permisos.role);
  const puedeEliminar = canDeleteCombustible(permisos.role);
  const eliminar = useEliminarCargaCombustible();

  const cargas = useMemo(() => [...(data ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha)), [data]);

  // Clase por equipo del catálogo: fallback para cargas de un backend que aún
  // no manda `equipo.equipmentClass` (lo que trae la carga manda).
  const clasePorEquipo = useMemo(() => {
    const porId = new Map<string, EquipmentClass>();
    for (const equipo of catalogo ?? []) porId.set(equipo.id, equipo.equipmentClass);
    return porId;
  }, [catalogo]);

  const claseDe = (carga: RegistroCombustible): EquipmentClass | undefined =>
    carga.equipo?.equipmentClass ?? clasePorEquipo.get(carga.equipoId);

  // Opciones de los filtros: solo lo que existe en los datos cargados.
  const equipos = useMemo(() => {
    const porId = new Map<string, string>();
    for (const c of cargas) porId.set(c.equipoId, c.equipo?.internalCode ?? c.equipoId);
    return [...porId.entries()]
      .map(([id, codigo]) => ({ id, codigo }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [cargas]);

  const supervisores = useMemo(
    () =>
      [...new Set(cargas.map((c) => c.realizadoPor).filter((nombre): nombre is string => Boolean(nombre)))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [cargas],
  );

  // La tabla solo en escritorio: en tablet y celular, tarjetas que caben en el ancho.
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);

  const lista = useMemo(
    () =>
      cargas.filter((c) => {
        if (equipoFiltro !== TODOS && c.equipoId !== equipoFiltro) return false;
        if (claseFiltro !== TODOS && claseDe(c) !== claseFiltro) return false;
        if (supervisorFiltro !== TODOS && c.realizadoPor !== supervisorFiltro) return false;
        const dia = diaLocal(c.fecha);
        if (desde && dia < desde) return false;
        if (hasta && dia > hasta) return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `claseDe` deriva de `clasePorEquipo`
    [cargas, equipoFiltro, claseFiltro, supervisorFiltro, desde, hasta, clasePorEquipo],
  );

  const totalLitros = lista.reduce((acc, c) => acc + c.litros, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
            SMI · Combustible
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            Cargas de combustible
          </h1>
          <p className="text-sm text-muted-foreground">
            Todas las cargas: las del cierre de tarjeta en terreno y las manuales. Abre una para ver su detalle y la
            foto del surtidor.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip color="accent" data-testid="total-filtrado" size="md" variant="soft">
            {NUM_CL_1.format(totalLitros)} L en {NUM_CL.format(lista.length)} {lista.length === 1 ? 'carga' : 'cargas'}
          </Chip>
          {puedeCrear ? <Button onPress={() => setCreando(true)}>Nueva carga</Button> : null}
        </div>
      </div>

      <Card>
        <Card.Header>
          <div className="flex flex-col gap-4">
            <div>
              <Card.Title>Listado</Card.Title>
              <Card.Description>
                De la más reciente a la más antigua. El total de arriba sigue al filtro.
              </Card.Description>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="filtros-cargas">
              <SelectFiltro
                label="Equipo"
                onChange={setEquipoFiltro}
                opciones={[
                  { value: TODOS, label: 'Todos' },
                  ...equipos.map((equipo) => ({ value: equipo.id, label: equipo.codigo })),
                ]}
                value={equipoFiltro}
              />
              <SelectFiltro
                label="Clase"
                onChange={setClaseFiltro}
                opciones={[{ value: TODOS, label: 'Todos' }, ...EQUIPMENT_CLASS_OPTIONS]}
                value={claseFiltro}
              />
              <SelectFiltro
                label="Supervisor"
                onChange={setSupervisorFiltro}
                opciones={[
                  { value: TODOS, label: 'Todos' },
                  ...supervisores.map((nombre) => ({ value: nombre, label: nombre })),
                ]}
                value={supervisorFiltro}
              />
              <div className="flex h-full flex-col gap-1">
                <DialogTrigger isOpen={periodoAbierto} onOpenChange={setPeriodoAbierto}>
                  <Button className="w-full flex-1 justify-start" variant="secondary">
                    <CalendarDays aria-hidden className="size-[18px]" />
                    {range ? `${fmtDiaRango(range.start)} → ${fmtDiaRango(range.end)}` : 'Filtrar por fecha'}
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
              {error instanceof Error ? error.message : 'No se pudieron cargar las cargas de combustible.'}
            </p>
          ) : null}

          {!isPending && !isError && lista.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              {cargas.length === 0 ? 'No hay cargas de combustible registradas.' : 'Ninguna carga calza con el filtro.'}
            </p>
          ) : null}

          {!isPending && !isError && lista.length > 0 && !esEscritorio ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {lista.map((c) => {
                const clase = claseDe(c);
                return (
                  <li key={c.id}>
                    <button
                      data-testid={`carga-fila-${c.id}`}
                      className="flex w-full cursor-pointer flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:bg-default"
                      type="button"
                      onClick={() => setDetalle(c)}
                    >
                      <div className="flex w-full items-start justify-between gap-2">
                        <span className="text-[15px] font-semibold text-foreground">
                          {formatFecha(c.fecha)} · <span className="font-mono">{c.equipo?.internalCode ?? '—'}</span>
                        </span>
                        <span className="shrink-0 font-mono text-[15px] font-semibold text-foreground">
                          {NUM_CL_1.format(c.litros)} L
                        </span>
                      </div>
                      <dl className="m-0 grid w-full grid-cols-2 gap-2 rounded-xl bg-surface-secondary px-3 py-2.5 text-sm">
                        <div className="flex flex-col">
                          <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                            Combustible
                          </dt>
                          <dd className="m-0 text-foreground">{tipoDe(c)}</dd>
                        </div>
                        <div className="flex flex-col">
                          <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                            Clase
                          </dt>
                          <dd className="m-0 text-foreground">{clase ? equipmentClassLabel(clase) : '—'}</dd>
                        </div>
                        <div className="flex flex-col">
                          <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                            {nombreLectura(c, clase)}
                          </dt>
                          <dd className="m-0 text-foreground">{lecturaTexto(c, clase)}</dd>
                        </div>
                        <div className="flex flex-col">
                          <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                            Realizó
                          </dt>
                          <dd className="m-0 text-foreground">{c.realizadoPor ?? '—'}</dd>
                        </div>
                        <div className="flex flex-col">
                          <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                            Origen
                          </dt>
                          <dd className="m-0 text-foreground">{origenDe(c)}</dd>
                        </div>
                      </dl>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {!isPending && !isError && lista.length > 0 && esEscritorio ? (
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Cargas de combustible" className="min-w-full">
                  <Table.Header>
                    <Table.Column isRowHeader>Fecha</Table.Column>
                    <Table.Column>Equipo</Table.Column>
                    <Table.Column>Clase</Table.Column>
                    <Table.Column>Combustible</Table.Column>
                    <Table.Column>Lectura</Table.Column>
                    <Table.Column>Realizó</Table.Column>
                    <Table.Column className="w-full">Origen</Table.Column>
                    <Table.Column>Foto</Table.Column>
                    <Table.Column className="text-right">Litros</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {lista.map((c) => {
                      const clase = claseDe(c);
                      return (
                        <Table.Row
                          className="cursor-pointer"
                          data-testid={`carga-fila-${c.id}`}
                          key={c.id}
                          onAction={() => setDetalle(c)}
                        >
                          <Table.Cell className="text-sm whitespace-nowrap text-muted-foreground">
                            {formatFecha(c.fecha)}
                          </Table.Cell>
                          <Table.Cell className="font-mono text-sm whitespace-nowrap">
                            {c.equipo?.internalCode ?? '—'}
                          </Table.Cell>
                          <Table.Cell className="text-sm whitespace-nowrap">
                            {clase ? equipmentClassLabel(clase) : '—'}
                          </Table.Cell>
                          <Table.Cell className="text-sm whitespace-nowrap">{tipoDe(c)}</Table.Cell>
                          <Table.Cell className="font-mono text-sm whitespace-nowrap">
                            {lecturaTexto(c, clase)}
                          </Table.Cell>
                          <Table.Cell className="text-sm whitespace-nowrap">{c.realizadoPor ?? '—'}</Table.Cell>
                          <Table.Cell className="text-sm whitespace-nowrap">{origenDe(c)}</Table.Cell>
                          <Table.Cell className="text-sm whitespace-nowrap">{c.fotoUrl ? 'Sí' : '—'}</Table.Cell>
                          <Table.Cell className="text-right font-mono text-sm font-semibold whitespace-nowrap">
                            {NUM_CL_1.format(c.litros)} L
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          ) : null}
        </Card.Content>
      </Card>

      <DetalleCargaModal
        carga={detalle}
        clase={detalle ? claseDe(detalle) : undefined}
        onClose={() => setDetalle(null)}
        onEditar={
          puedeEditar && detalle
            ? () => {
                setEditando(detalle);
                setDetalle(null);
              }
            : undefined
        }
        onEliminar={
          puedeEliminar && detalle
            ? () => {
                setEliminando(detalle);
                setDetalle(null);
              }
            : undefined
        }
      />

      {editando ? <EditarCargaCombustibleModal carga={editando} onClose={() => setEditando(null)} /> : null}

      {creando ? <NuevaCargaCombustibleModal onClose={() => setCreando(false)} /> : null}

      <AlertDialog.Backdrop
        isOpen={eliminando !== null}
        onOpenChange={(open) => {
          if (!open) setEliminando(null);
        }}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-105">
            {({ close }) => (
              <>
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status="danger" />
                  <AlertDialog.Heading>¿Eliminar carga?</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>
                    La carga de {eliminando?.equipo?.internalCode ?? 'este equipo'} del{' '}
                    {eliminando ? formatFecha(eliminando.fecha) : ''} (
                    {eliminando ? NUM_CL_1.format(eliminando.litros) : ''} L) se eliminará definitivamente y el borrado
                    quedará anotado en el Registro de actividad.{' '}
                    {eliminando?.registroHorometroId
                      ? 'Como nació del cierre de una tarjeta de turno, esa tarjeta quedará sin litros declarados; su foto se conserva.'
                      : 'Su foto se eliminará también.'}{' '}
                    Esta acción no se puede deshacer.
                  </p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button onPress={close} variant="tertiary">
                    Cancelar
                  </Button>
                  <Button
                    isPending={eliminar.isPending}
                    onPress={() => {
                      if (!eliminando) return;
                      eliminar.mutate(eliminando.id, {
                        onSuccess: () => {
                          close();
                          setEliminando(null);
                        },
                      });
                    }}
                    variant="danger"
                  >
                    {eliminar.isPending ? <Spinner color="current" size="sm" /> : 'Eliminar'}
                  </Button>
                </AlertDialog.Footer>
              </>
            )}
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}
