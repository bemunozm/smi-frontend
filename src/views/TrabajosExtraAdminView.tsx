import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  Card,
  Chip,
  DateField,
  DateRangePicker,
  Input,
  Label,
  ListBox,
  Modal,
  RangeCalendar,
  Select,
  Spinner,
  Table,
  TextArea,
  TextField,
} from '@heroui/react';
import { Group } from 'react-aria-components/Group';
import type { DateValue } from 'react-aria-components/Calendar';

import { useEquipment } from '../hooks/useEquipment';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { useOperators } from '../hooks/useOperators';
import { usePermissions } from '../hooks/usePermissions';
import { useCrearTrabajoExtra, useEditarTrabajoExtra, useTrabajosExtraList } from '../hooks/useTrabajosExtra';
import { usePlantas } from '../hooks/useReporteDiario';
import { turnoLabel } from '../config/flota-colors';
import { RESPONSIVE_SHEET_DIALOG_WIDE_CLASS } from '../components/flota/modal-styles';
import { NUM_CL, NUM_CL_1 } from '../lib/dashboard-format';
import {
  actividadDeFila,
  horasDelDetalle,
  horasCobrables,
  lugarDeFila,
  numeroReport,
  pistaFolio,
  textoPistaFolio,
} from '../lib/trabajos-extra';
import { parseDecimal } from '../lib/decimal';
import { fechaRegistroIso, toDateTimeLocal } from '../lib/format';
import { construirExcelReport } from '../lib/report-excel';
import { ACTIVIDADES, DESTINOS, actividadLabel, trabajoExtraEdicionSchema, trabajoExtraFormSchema } from '../types/trabajosExtra';
import type { TrabajoExtraForm, TrabajoExtraordinario } from '../types/trabajosExtra';

const TURNOS = ['DIURNO', 'NOCTURNO'] as const;

/** Una fila del desglose mientras se escribe (horas como texto, igual que los
 * horómetros de este modal): el schema valida la forma final. */
interface FilaDetalleAdmin {
  actividad: string;
  lugar: string;
  planta: string;
  horas: string;
}

const FILA_VACIA: FilaDetalleAdmin = { actividad: '', lugar: '', planta: '', horas: '' };

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

/** Columna «Dónde» de la tabla: los lugares del desglose, sin repetir. */
function lugaresDe(trabajo: TrabajoExtraordinario): string {
  const filas = trabajo.detalleActividades ?? [];
  if (filas.length === 0) return '—';
  return [...new Set(filas.map((f) => lugarDeFila(f)))].join(', ');
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
              {`Report ${numeroReport(trabajo?.numero)} · ${trabajo?.equipo?.internalCode ?? '—'}`}
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
                  <Dato label="Report N°" value={trabajo.reportNumero || '—'} />
                  <Dato label="Registrado por" value={trabajo.registradoPor ?? 'Sin registro'} />
                </div>
                {trabajo.detalleActividades?.length ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold tracking-wider text-(--label-color) uppercase">
                      Actividades
                    </span>
                    <div className="overflow-hidden rounded-xl border border-separator">
                      {trabajo.detalleActividades.map((f, i) => (
                        <div
                          className="flex items-center justify-between gap-3 border-t border-separator px-3 py-2 first:border-t-0"
                          key={i}
                        >
                          <span className="min-w-0 text-sm text-foreground">
                            {actividadDeFila(f, trabajo.otraActividad)}
                            <span className="text-muted-foreground"> · {lugarDeFila(f)}</span>
                          </span>
                          <span className="shrink-0 font-mono text-sm font-semibold">
                            {NUM_CL_1.format(f.horas)} h
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Dato label="Actividades" value={actividadesDe(trabajo)} />
                )}
                {trabajo.fotoUrl ? (
                  <a
                    className="text-sm font-medium text-(--accent) hover:underline"
                    href={trabajo.fotoUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Ver foto del report
                  </a>
                ) : null}
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
  const { data: plantas } = usePlantas();
  const crear = useCrearTrabajoExtra();
  const { guardar, isGuardando } = useEditarTrabajoExtra();
  const [equipoId, setEquipoId] = useState(trabajo?.equipoId ?? '');
  const [operatorId, setOperatorId] = useState(trabajo?.operatorId ?? '');
  const [turno, setTurno] = useState(trabajo?.turno === 'NOCTURNO' ? 'NOCTURNO' : 'DIURNO');
  const [faena, setFaena] = useState(trabajo?.faena ?? '');
  const [horometroInicial, setHorometroInicial] = useState(trabajo ? String(trabajo.horometroInicial) : '');
  const [horometroFinal, setHorometroFinal] = useState(trabajo ? String(trabajo.horometroFinal) : '');
  // El desglose, una fila por actividad. En la edición de un trabajo LEGACY
  // (anterior al desglose) la tabla parte vacía y, si se deja así, el diff no
  // la toca; agregar filas reemplaza el desglose completo.
  const [filas, setFilas] = useState<FilaDetalleAdmin[]>(() =>
    trabajo
      ? (trabajo.detalleActividades ?? []).map((f) => ({
          actividad: f.actividad,
          lugar: f.lugar,
          planta: f.planta ?? '',
          horas: String(f.horas),
        }))
      : [FILA_VACIA],
  );
  const [otraActividad, setOtraActividad] = useState(trabajo?.otraActividad ?? '');
  const [descripcion, setDescripcion] = useState(trabajo?.descripcion ?? '');
  const [observaciones, setObservaciones] = useState(trabajo?.observaciones ?? '');
  const [reportNumero, setReportNumero] = useState(trabajo?.reportNumero ?? '');
  // La lista ya está en caché (la pantalla la cargó): de ahí, el último folio.
  const { data: registrados = [] } = useTrabajosExtraList();
  const pista = pistaFolio(registrados, reportNumero, trabajo?.id);
  const textoPista = textoPistaFolio(pista);
  // Foto del report — obligatoria al CREAR, igual que en Terreno; acá se
  // sube online antes del POST (`useCrearTrabajoExtra`). Al editar se
  // conserva la existente.
  const [foto, setFoto] = useState<File | null>(null);
  const [fecha, setFecha] = useState(() => toDateTimeLocal(new Date()));
  const fechaIso = trabajo ? null : fechaRegistroIso(fecha);
  const fechaValida = trabajo != null || fechaIso !== null;

  const cambiarFila = (i: number, cambios: Partial<FilaDetalleAdmin>) => {
    setFilas((previas) => previas.map((f, j) => (j === i ? { ...f, ...cambios } : f)));
  };

  // Los campos son texto y el schema los lee igual (`lib/forms.ts#leerNumero`:
  // punto o coma sueltos son el decimal). `aNumero` es para las cuentas de la
  // vista: vacío o ilegible queda NaN.
  const aNumero = (texto: string) => parseDecimal(texto) ?? Number.NaN;

  const detalleEntrada = filas.map((f) => ({
    actividad: f.actividad,
    lugar: f.lugar,
    planta: f.planta || undefined,
    horas: f.horas,
  }));

  const entrada = {
    equipoId,
    operatorId,
    faena,
    turno,
    horometroInicial,
    horometroFinal,
    otraActividad: otraActividad.trim() || undefined,
    descripcion,
    observaciones: observaciones.trim() || undefined,
  };
  // Al CREAR, folio y desglose son obligatorios. Al EDITAR un trabajo legacy
  // (anterior a esos campos) se pueden dejar vacíos: se omiten del parse y el
  // diff de la edición no los toca (`edicionContraBase` ignora `undefined`).
  const parsed = trabajo
    ? trabajoExtraEdicionSchema.safeParse({
        ...entrada,
        ...(reportNumero.trim() ? { reportNumero: reportNumero.trim() } : {}),
        ...(filas.length > 0 ? { detalle: detalleEntrada } : {}),
      })
    : trabajoExtraFormSchema.safeParse({ ...entrada, reportNumero, detalle: detalleEntrada });

  // Aviso del descuadre del desglose, que NO bloquea (decisión del cliente);
  // la regla de PLANTA se avisa por fila y la corta el schema con el botón.
  const totalHorometros = aNumero(horometroFinal) - aNumero(horometroInicial);
  const horasFilas = filas.map((f) => aNumero(f.horas)).filter((h) => Number.isFinite(h) && h > 0);
  const sumaDetalle = horasDelDetalle(horasFilas.map((horas) => ({ horas })));
  const descuadre =
    Number.isFinite(totalHorometros) &&
    totalHorometros >= 0 &&
    filas.length > 0 &&
    horasFilas.length === filas.length &&
    Math.abs(sumaDetalle - totalHorometros) > 0.01 &&
    Math.abs(sumaDetalle - horasCobrables(totalHorometros)) > 0.01;

  const registrar = () => {
    if (!parsed.success) return;
    if (trabajo) {
      void guardar(trabajo, parsed.data).then((ok) => {
        if (ok) onClose();
      });
      return;
    }
    if (!fechaIso || !foto) return;
    crear.mutate({ values: { ...(parsed.data as TrabajoExtraForm), fecha: fechaIso }, foto }, { onSuccess: onClose });
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
              {trabajo
                ? `Editar Report ${numeroReport(trabajo.numero)} · ${trabajo.equipo?.internalCode ?? '—'}`
                : 'Nueva actividad'}
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

              {/* El correlativo lo pone el sistema: se informa, no se edita. El
                  folio del papel es «N° del report», que sí se escribe. */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-secondary px-3.5 py-2.5">
                <span className="text-sm text-muted-foreground">Correlativo</span>
                <span className="font-mono text-sm font-semibold text-foreground">
                  {trabajo ? numeroReport(trabajo.numero) : 'Se asigna al guardar'}
                </span>
                <span className="text-[11px] font-bold tracking-wide text-(--accent) uppercase">
                  {trabajo ? 'No se cambia' : 'Automático'}
                </span>
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

              <div className="flex flex-col gap-1">
                <TextField fullWidth name="reportNumero" onChange={setReportNumero} value={reportNumero}>
                  <Label>N° del report</Label>
                  <Input inputMode="numeric" placeholder={pista.siguiente ? `Ej: ${pista.siguiente}` : 'Ej: 4509'} />
                </TextField>
                {pista.repetido ? (
                  <p className="m-0 text-xs font-semibold text-(--warning)">
                    El N° {reportNumero.trim()} ya está registrado en otro Report: revisa el folio.
                  </p>
                ) : textoPista ? (
                  <p className="m-0 text-xs text-muted-foreground">{textoPista}</p>
                ) : null}
              </div>

              {/* El desglose: una fila por actividad con dónde se hizo y sus
                  horas máquina. En un trabajo legacy la tabla parte vacía;
                  agregar filas reemplaza el desglose completo. */}
              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium text-foreground">Actividades (qué · dónde · HM)</span>
                {trabajo && filas.length === 0 ? (
                  <p className="m-0 text-sm text-muted-foreground">
                    Este trabajo es anterior al desglose ({actividadesDe(trabajo)}). Si agregás filas, el
                    desglose nuevo lo reemplaza.
                  </p>
                ) : null}
                {filas.map((fila, i) => (
                  <div className="flex flex-col gap-3 rounded-xl border border-separator p-3" key={i}>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_96px]">
                      <Select
                        fullWidth
                        placeholder="Actividad"
                        value={fila.actividad}
                        onChange={(value) => value && cambiarFila(i, { actividad: String(value) })}
                      >
                        <Label>Actividad</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {ACTIVIDADES.map((a) => (
                              <ListBox.Item id={a.value} key={a.value} textValue={a.label}>
                                {a.label}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>

                      <Select
                        fullWidth
                        placeholder="Dónde"
                        value={fila.lugar}
                        onChange={(value) =>
                          value &&
                          cambiarFila(i, {
                            lugar: String(value),
                            ...(String(value) !== 'PLANTA' ? { planta: '' } : {}),
                          })
                        }
                      >
                        <Label>Dónde se hizo</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {DESTINOS.map((d) => (
                              <ListBox.Item id={d.value} key={d.value} textValue={d.label}>
                                {d.label}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>

                      <TextField
                        fullWidth
                        name={`detalle-horas-${i}`}
                        onChange={(valor) => cambiarFila(i, { horas: valor })}
                        value={fila.horas}
                      >
                        <Label>HM</Label>
                        <Input inputMode="decimal" placeholder="0" />
                      </TextField>
                    </div>

                    {fila.lugar === 'PLANTA' ? (
                      <Select
                        fullWidth
                        placeholder="Elegir planta"
                        value={fila.planta}
                        onChange={(value) => value && cambiarFila(i, { planta: String(value) })}
                      >
                        <Label>¿En qué planta?</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {(plantas ?? []).map((p) => (
                              <ListBox.Item id={p.nombre} key={p.id} textValue={p.nombre}>
                                {p.nombre}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    ) : null}

                    {fila.lugar === 'PLANTA' && fila.actividad !== 'LIMPIEZA_SILOS' ? (
                      <p className="m-0 text-sm text-danger-soft-foreground">
                        Solo una limpieza de silos puede hacerse en planta: usá Transporte o Variado.
                      </p>
                    ) : null}

                    {filas.length > 1 || trabajo ? (
                      <div className="flex justify-end">
                        <Button onPress={() => setFilas((previas) => previas.filter((_, j) => j !== i))} size="sm" variant="tertiary">
                          Quitar actividad
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
                <div>
                  <Button onPress={() => setFilas((previas) => [...previas, FILA_VACIA])} size="sm" variant="secondary">
                    Agregar actividad
                  </Button>
                </div>
                {descuadre ? (
                  <p className="m-0 text-sm text-warning-soft-foreground" role="status">
                    Las actividades suman {NUM_CL_1.format(sumaDetalle)} h, pero por horómetros el trabajo da{' '}
                    {NUM_CL_1.format(horasCobrables(totalHorometros))} h a cobrar. Se puede guardar igual — revisá
                    el desglose por si un dato quedó mal.
                  </p>
                ) : null}
                {filas.some((f) => f.actividad === 'OTRO') ? (
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

              {/* Foto del report en papel — obligatoria: el trabajo se cobra
                  contra el report. */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Foto del report (obligatoria)</span>
                <input
                  accept="image/*"
                  aria-label="Foto del report"
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-default file:px-3 file:py-1 file:text-sm"
                  onChange={(event) => setFoto(event.target.files?.[0] ?? null)}
                  type="file"
                />
                {foto ? (
                  <span className="text-xs text-muted-foreground">{foto.name}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Encuadrá el report completo, con el folio legible.
                  </span>
                )}
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button onPress={onClose} variant="tertiary">
              Cancelar
            </Button>
            <Button
              isDisabled={!parsed.success || !fechaValida || (!trabajo && foto == null)}
              isPending={pendiente}
              onPress={registrar}
            >
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
  // Deep-link del dashboard (popup Reports): la URL siembra el estado INICIAL
  // de los filtros; después mandan los controles de la vista.
  const [searchParams] = useSearchParams();
  const [equipoFiltro, setEquipoFiltro] = useState(() => searchParams.get('equipo') ?? 'TODOS');
  const [turnoFiltro, setTurnoFiltro] = useState('TODOS');
  const [desde, setDesde] = useState(() => searchParams.get('desde') ?? '');
  const [hasta, setHasta] = useState(() => searchParams.get('hasta') ?? '');
  const [detalle, setDetalle] = useState<TrabajoExtraordinario | null>(null);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<TrabajoExtraordinario | null>(null);
  const puedeEditar = usePermissions().can('trabajoExtra.edit');
  // «Exportar Excel» pide el rango de fechas en un diálogo propio (pedido del
  // cliente): el rango es obligatorio y se elige en UN solo calendario de
  // rango — mismo selector que el período de Movimientos de inventario.
  const [exportando, setExportando] = useState(false);
  const [exportRange, setExportRange] = useState<{ start: DateValue; end: DateValue } | null>(null);
  // `DateValue.toString()` es `YYYY-MM-DD`: comparable contra `diaLocal`.
  const exportDesde = exportRange?.start.toString() ?? '';
  const exportHasta = exportRange?.end.toString() ?? '';

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

  // Un `?equipo=` que no está en el listado (deep-link viejo o equipo sin trabajos) cae a TODOS.
  const equipoEfectivo =
    equipoFiltro === 'TODOS' || equipos.some((e) => e.id === equipoFiltro) ? equipoFiltro : 'TODOS';

  // La tabla solo en escritorio: en tablet y celular, tarjetas que caben en el ancho.
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);

  const lista = useMemo(
    () =>
      trabajos.filter((t) => {
        if (equipoEfectivo !== 'TODOS' && t.equipoId !== equipoEfectivo) return false;
        if (turnoFiltro !== 'TODOS' && t.turno !== turnoFiltro) return false;
        const dia = diaLocal(t.fecha);
        if (desde && dia < desde) return false;
        if (hasta && dia > hasta) return false;
        return true;
      }),
    [trabajos, equipoEfectivo, turnoFiltro, desde, hasta],
  );

  const totalHoras = lista.reduce((acc, t) => acc + t.totalHoras, 0);

  /** Los trabajos del rango elegido en el diálogo de exportación — TODOS los
   * equipos y turnos: el Excel es la planilla del período, no hereda en
   * silencio los filtros de la tabla. */
  const enRangoExport = useMemo(() => {
    if (!exportDesde || !exportHasta) return [];
    return trabajos.filter((t) => {
      const dia = diaLocal(t.fecha);
      return dia >= exportDesde && dia <= exportHasta;
    });
  }, [trabajos, exportDesde, exportHasta]);

  /**
   * Exporta el rango elegido: el armado del archivo (columnas de la planilla
   * del cliente + su formato) vive en `lib/report-excel.ts`, probado
   * releyendo el archivo generado.
   */
  const exportarExcel = async () => {
    const blob = await construirExcelReport(enRangoExport, exportDesde, exportHasta);
    const nombre = `Report_${exportDesde}_a_${exportHasta}.xlsx`;
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
    URL.revokeObjectURL(url);
    setExportando(false);
  };

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
          <Button isDisabled={trabajos.length === 0} onPress={() => setExportando(true)} variant="secondary">
            Exportar Excel
          </Button>
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
                  value={equipoEfectivo}
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
                        <span className="font-mono">{numeroReport(t.numero)}</span> · {formatFecha(t.fecha)} ·{' '}
                        <span className="font-mono">{t.equipo?.internalCode ?? '—'}</span>
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
                    <Table.Column isRowHeader>Correlativo</Table.Column>
                    <Table.Column>Fecha</Table.Column>
                    <Table.Column>Equipo</Table.Column>
                    <Table.Column>Operador</Table.Column>
                    <Table.Column>Turno</Table.Column>
                    <Table.Column>Report N°</Table.Column>
                    <Table.Column>Dónde</Table.Column>
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
                        <Table.Cell className="font-mono text-sm font-semibold whitespace-nowrap">
                          {t.numero ?? '—'}
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap text-muted-foreground">
                          {formatFecha(t.fecha)}
                        </Table.Cell>
                        <Table.Cell className="font-mono text-sm whitespace-nowrap">
                          {t.equipo?.internalCode ?? '—'}
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap">{t.operador}</Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap">{turnoLabel(t.turno)}</Table.Cell>
                        <Table.Cell className="font-mono text-sm whitespace-nowrap">{t.reportNumero ?? '—'}</Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap">{lugaresDe(t)}</Table.Cell>
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
      {/* Diálogo de exportación: elegir de qué fecha hasta qué fecha es
          OBLIGATORIO (pedido del cliente) — el Excel es la planilla del
          período, con todos los trabajos del rango sin importar los filtros
          de la tabla. Se monta solo al abrir: un backdrop montado cerrado
          deja `aria-hidden` sobre la vista y rompe los otros modales. */}
      {exportando && (
      <Modal.Backdrop
        isDismissable
        isOpen={exportando}
        onOpenChange={(open) => {
          if (!open) setExportando(false);
        }}
      >
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                Exportar a Excel
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Elegí de qué fecha hasta qué fecha exportar. Salen todos los trabajos del rango, sin
                  importar los filtros de la tabla.
                </p>
                {/* UN solo calendario de rango, calcado del filtro «Período» de
                    Movimientos de inventario: el rango es una decisión, no dos
                    campos sueltos que hay que cuadrar a mano. */}
                <DateRangePicker aria-label="Período a exportar" onChange={setExportRange} value={exportRange}>
                  <Label>Período</Label>
                  {/* El `Group` de react-aria es el ancla del popover: sin él el
                      calendario se dibuja en la esquina de la pantalla. */}
                  <Group className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3">
                    <DateField.Input slot="start">
                      {(segment) => <DateField.Segment segment={segment} />}
                    </DateField.Input>
                    <DateRangePicker.RangeSeparator>→</DateRangePicker.RangeSeparator>
                    <DateField.Input slot="end">
                      {(segment) => <DateField.Segment segment={segment} />}
                    </DateField.Input>
                    <DateRangePicker.Trigger className="ml-auto">
                      <DateRangePicker.TriggerIndicator />
                    </DateRangePicker.Trigger>
                  </Group>
                  <DateRangePicker.Popover>
                    <RangeCalendar>
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
                  </DateRangePicker.Popover>
                </DateRangePicker>
                <p className="text-sm text-muted-foreground" data-testid="export-conteo">
                  {!exportRange
                    ? 'Elegí el período para exportar.'
                    : enRangoExport.length === 0
                      ? 'No hay trabajos en ese período.'
                      : `Se van a exportar ${NUM_CL.format(enRangoExport.length)} ${
                          enRangoExport.length === 1 ? 'trabajo' : 'trabajos'
                        }.`}
                </p>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button onPress={() => setExportando(false)} variant="tertiary">
                Cancelar
              </Button>
              <Button isDisabled={enRangoExport.length === 0} onPress={() => void exportarExcel()}>
                Exportar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      )}

      {editando ? <TrabajoExtraModal trabajo={editando} onClose={() => setEditando(null)} /> : null}

      {creando ? <TrabajoExtraModal onClose={() => setCreando(false)} /> : null}
    </div>
  );
}
