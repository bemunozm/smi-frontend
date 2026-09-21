import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { ChevronRight, Droplet, Eye, FileWarning, Gauge, Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react';
import {
  Button,
  Card,
  Drawer,
  Dropdown,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  Table,
  TextField,
} from '@heroui/react';

import {
  CamposEquipo,
  DeleteEquipoAlertDialog,
  EditEquipoModal,
  EquipoPhotoBanner,
  idDesdeSentinel,
  SIN_ASIGNAR,
} from '../components/flota/EquipoEditDelete';
import { EquipoThumb } from '../components/flota/EquipoThumb';
import { FuelGauge } from '../components/flota/FuelGauge';
import { RESPONSIVE_SHEET_DIALOG_WIDE_CLASS } from '../components/flota/modal-styles';
import { RegistrarCargaCombustibleModal } from '../components/flota/RegistrarCargaCombustibleModal';
import { registrarHorometroLabel, RegistrarHorometroModal } from '../components/flota/RegistrarHorometroModal';
import { StatusChip } from '../components/flota/StatusChip';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useBranches } from '../hooks/useBranches';
import {
  useAssignEquipment,
  useCreateEquipment,
  useEquipment,
  useResumenFleet,
  useUpdateEquipmentStatus,
} from '../hooks/useEquipment';
import {
  EQUIPMENT_CLASS_OPTIONS,
  EQUIPMENT_STATUS_OPTIONS,
  equipmentClassLabel,
  equipmentStatusChipColor,
  equipmentStatusLabel,
  equipmentStatusSelectedClasses,
  equipoDocumentAlertTone,
  equipoEstadoUsoLabel,
  equipoIdentidad,
} from '../config/flota-colors';
import { ROLES } from '../types/roles';
import {
  EquipmentFormSchema,
  EQUIPMENT_STATUS,
  toEquipmentPayload,
  type ControlUnit,
  type Equipment,
  type EquipmentClass,
  type EquipmentFormValues,
  type EquipmentStatus,
} from '../types/equipment';

const NUMERO = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

/** Segunda línea de la celda "Horómetro / KM" (tabla PC) — unidad descriptiva
 * en minúsculas, calca `unit` de `FlotaClientePC.dc.html#uso`. */
const USO_UNIDAD_LABEL: Record<ControlUnit, string> = {
  HOURS: 'horómetro (h)',
  KM: 'kilómetros (km)',
};

function KebabIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" height="15" viewBox="0 0 24 24" width="15">
      <circle cx="12" cy="5" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="12" cy="19" r="1.9" />
    </svg>
  );
}

/**
 * Indicador discreto de R1/R2 (revisión técnica/seguro) para el LISTADO —
 * badge chico con el tono más urgente entre ambos documentos
 * (`equipoDocumentAlertTone`), sin recargar la fila: no se repite el detalle
 * de cuál venció, eso ya vive en la ficha (bloque "Vencimientos"). No
 * renderiza nada cuando ambos documentos están vigentes o sin dato.
 */
function DocumentAlertBadge({ equipo }: { equipo: Pick<Equipment, 'documents'> }) {
  const tone = equipoDocumentAlertTone(equipo);
  if (!tone) return null;

  const label =
    tone === 'danger' ? 'Revisión técnica o seguro vencidos' : 'Revisión técnica o seguro por vencer';

  return (
    <span
      aria-label={label}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
        tone === 'danger' ? 'bg-danger-soft text-danger-soft-foreground' : 'bg-warning-soft text-warning-soft-foreground'
      }`}
      title={label}
    >
      <FileWarning className="h-3 w-3" />
    </span>
  );
}

/** Uso acumulado de la unidad — horómetro o kilometraje según `controlUnit`;
 * solo uno de los dos aplica (ver `types/equipment.ts`). */
function formatearUso(equipo: Pick<Equipment, 'controlUnit' | 'currentHourmeter' | 'currentMileage'>): string {
  if (equipo.controlUnit === 'HOURS') {
    return equipo.currentHourmeter != null ? `${NUMERO.format(equipo.currentHourmeter)} h` : '—';
  }
  return equipo.currentMileage != null ? `${NUMERO.format(equipo.currentMileage)} km` : '—';
}

/** Segunda línea de la celda "Equipo": "Liviano · Camioneta · 2022" — calca
 * `row.classType + row.yearSuffix` de `FlotaClientePC.dc.html`. */
function claseTipoAnio(equipo: Pick<Equipment, 'equipmentClass' | 'type' | 'year'>): string {
  const base = `${equipmentClassLabel(equipo.equipmentClass)} · ${equipo.type}`;
  return equipo.year ? `${base} · ${equipo.year}` : base;
}

/**
 * "En uso por" — chip "En uso" + operador/supervisor, o "Disponible"/
 * "Detenido" cuando nadie lo tiene asignado (calca `row.enUso`/`row.libre` del
 * artefacto). `stacked` = celda de tabla (PC); `inline` = tarjeta tablet/
 * celular, dentro de una barra `surface-secondary`.
 */
function AsignacionCell({
  equipo,
  layout,
}: {
  equipo: Pick<Equipment, 'operator' | 'supervisor' | 'status'>;
  layout: 'stacked' | 'inline';
}) {
  const { operator, supervisor } = equipo;
  // Fuente única con `EstadoDeUso` de `EquipoDetalleView` — ver
  // `equipoEstadoUsoLabel` (`flota-colors.ts`): antes esta rama decidía
  // "Disponible"/"Detenido" con su propio branching inline, que había
  // divergido del de la ficha (Fix F-ALTA, review adversarial).
  const chipLabel = equipoEstadoUsoLabel(equipo);

  // Antes esto se decidía leyendo `equipo.inUse` (que el backend deriva de
  // `!!operator`): un equipo con supervisor asignado pero SIN operador
  // quedaba mostrando "Disponible" y el supervisor desaparecía por completo
  // de la fila, aunque la asignación sí existía (Fix 4, review QA). Ahora se
  // decide por presencia real de cualquiera de los dos.
  if (!operator && !supervisor) {
    return <span className="text-sm text-(--muted)">{chipLabel}</span>;
  }

  if (layout === 'inline') {
    return (
      <div className="flex items-center gap-2.5 rounded-lg bg-surface-secondary px-3 py-2.5">
        <StatusChip tone="success">{chipLabel}</StatusChip>
        <span className="text-[13px] text-foreground">
          {operator ? (
            <>
              Op. <strong className="font-semibold">{operator.name}</strong>
            </>
          ) : (
            <>
              Sup. <strong className="font-semibold">{supervisor?.name}</strong>
            </>
          )}
          {operator && supervisor ? ` · Sup. ${supervisor.name}` : null}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <StatusChip tone="success">{chipLabel}</StatusChip>
      <span className="text-[12.5px] text-foreground">
        {operator ? (
          <>
            Op. <strong className="font-semibold">{operator.name}</strong>
          </>
        ) : (
          <>
            Sup. <strong className="font-semibold">{supervisor?.name}</strong>
          </>
        )}
      </span>
      {operator && supervisor ? <span className="text-xs text-(--muted)">Sup. {supervisor.name}</span> : null}
    </div>
  );
}

const DEFAULT_FORM_VALUES: EquipmentFormValues = {
  internalCode: '',
  licensePlate: '',
  equipmentClass: 'LIGHT',
  type: '',
  brand: '',
  model: '',
  year: '',
  controlUnit: 'HOURS',
  status: 'OPERATIONAL',
  homeBranchId: '',
  photoUrl: null,
  technicalInspectionExpiry: '',
  insuranceExpiry: '',
};

interface CreateEquipoModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/**
 * Controlado desde `EquiposView` (no dueño de su propio trigger): tanto el
 * botón "Nuevo equipo" del header (PC) como el FAB (tablet/celular) deben
 * abrir el MISMO modal, así que el trigger vive afuera — mismo criterio que
 * `EditEquipoModal`/`DeleteEquipoAlertDialog`, que ya son controlados.
 */
function CreateEquipoModal({ isOpen, onOpenChange }: CreateEquipoModalProps) {
  const createEquipment = useCreateEquipment();
  const assignEquipment = useAssignEquipment();
  const [operatorId, setOperatorId] = useState(SIN_ASIGNAR);
  const [supervisorId, setSupervisorId] = useState(SIN_ASIGNAR);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EquipmentFormValues>({
    resolver: zodResolver(EquipmentFormSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  // El modal es controlado y queda montado entre aperturas (mismo patrón que
  // `EditEquipoModal`) — sin esto, cancelar (`Cancelar`, backdrop, Escape)
  // dejaba el código/marca/modelo y el operador/supervisor elegidos, y
  // reaparecían "viejos" la próxima vez que se abría (Fix 1, review QA).
  useEffect(() => {
    if (isOpen) {
      reset(DEFAULT_FORM_VALUES);
      setOperatorId(SIN_ASIGNAR);
      setSupervisorId(SIN_ASIGNAR);
    }
  }, [isOpen, reset]);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className={RESPONSIVE_SHEET_DIALOG_WIDE_CLASS}>
          {({ close }) => {
            const onSubmit = (values: EquipmentFormValues): void => {
              createEquipment.mutate(toEquipmentPayload(values), {
                onSuccess: (equipment) => {
                  const operatorIdFinal = idDesdeSentinel(operatorId);
                  const supervisorIdFinal = idDesdeSentinel(supervisorId);
                  if (operatorIdFinal || supervisorIdFinal) {
                    assignEquipment.mutate({
                      id: equipment.id,
                      input: { operatorId: operatorIdFinal, supervisorId: supervisorIdFinal },
                    });
                  }
                  // El reset al reabrir (arriba) deja el form limpio para la
                  // próxima vez — no hace falta duplicarlo acá.
                  close();
                },
              });
            };

            return (
              <>
                <Modal.CloseTrigger />
                <Controller
                  control={control}
                  name="photoUrl"
                  render={({ field }) => <EquipoPhotoBanner onChange={field.onChange} value={field.value} />}
                />
                <Modal.Header>
                  <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                    Nuevo equipo
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <form
                    className="flex flex-col gap-4"
                    id="create-equipo-form"
                    noValidate
                    onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                  >
                    <CamposEquipo
                      control={control}
                      errors={errors}
                      internalCodeEditable
                      onOperatorIdChange={setOperatorId}
                      onSupervisorIdChange={setSupervisorId}
                      operatorId={operatorId}
                      supervisorId={supervisorId}
                    />
                  </form>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onPress={close}>
                    Cancelar
                  </Button>
                  <Button form="create-equipo-form" isPending={createEquipment.isPending} type="submit">
                    {({ isPending }) =>
                      isPending ? <Spinner color="current" size="sm" /> : 'Crear equipo'
                    }
                  </Button>
                </Modal.Footer>
              </>
            );
          }}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/**
 * Menú de acciones de la fila. El submenú de estados existe porque cambiar el
 * estado es la operación más frecuente en terreno y no debería exigir abrir el
 * modal de edición completo — además es la única escritura que el SUPERVISOR
 * tiene permitida sobre la flota.
 */
function EquipoActionsMenu({
  equipo,
  puedeEditarFicha,
  puedeCambiarEstado,
}: {
  equipo: Equipment;
  puedeEditarFicha: boolean;
  /** `PATCH /equipment/:id/status` solo lo autoriza el backend a ADMIN y
   * SUPERVISOR — MANTENEDOR recibe 403 si lo intenta, así que los ítems
   * "Marcar como…" ni se muestran para el resto de los roles. */
  puedeCambiarEstado: boolean;
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const updateStatus = useUpdateEquipmentStatus();

  const otrosEstados = puedeCambiarEstado
    ? EQUIPMENT_STATUS.filter((status) => status !== equipo.status)
    : [];

  return (
    <>
      <Dropdown>
        <Button isIconOnly aria-label={`Acciones para ${equipo.internalCode}`} size="sm" variant="secondary">
          <KebabIcon />
        </Button>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu
            disabledKeys={puedeEditarFicha ? [] : ['edit', 'delete']}
            onAction={(key) => {
              const clave = String(key);
              if (clave === 'edit') return setIsEditOpen(true);
              if (clave === 'delete') return setIsDeleteOpen(true);
              if (clave.startsWith('status:')) {
                updateStatus.mutate({
                  id: equipo.id,
                  status: clave.slice('status:'.length) as EquipmentStatus,
                });
              }
            }}
          >
            {otrosEstados.map((status) => (
              <Dropdown.Item
                key={status}
                id={`status:${status}`}
                textValue={`Marcar como ${equipmentStatusLabel(status)}`}
              >
                <Label>Marcar como {equipmentStatusLabel(status)}</Label>
              </Dropdown.Item>
            ))}
            <Dropdown.Item id="edit" textValue="Editar ficha">
              <Label>Editar ficha</Label>
            </Dropdown.Item>
            <Dropdown.Item id="delete" textValue="Eliminar" variant="danger">
              <Label>Eliminar</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <EditEquipoModal equipo={equipo} isOpen={isEditOpen} onOpenChange={setIsEditOpen} />
      <DeleteEquipoAlertDialog equipo={equipo} isOpen={isDeleteOpen} onOpenChange={setIsDeleteOpen} />
    </>
  );
}

/** Contadores por estado — el mismo dato que alimenta el KPI del dashboard. */
function ResumenFlota() {
  const { data: resumen } = useResumenFleet();

  if (!resumen) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusChip tone="default">{resumen.total} equipos</StatusChip>
      {EQUIPMENT_STATUS.map((status) => (
        <StatusChip key={status} tone={equipmentStatusChipColor(status)}>
          {equipmentStatusLabel(status)}: {resumen.porEstado[status] ?? 0}
        </StatusChip>
      ))}
    </div>
  );
}

/**
 * Tile de acción de la hoja de acciones móvil (`EquipoCardMobile`) — ícono en
 * una insignia redondeada + etiqueta debajo, calca `.qa`/`.qa-ic` de
 * `FlotaClienteTablet/Phone.dc.html`. `tone="danger"` solo tiñe la insignia
 * (igual que el artefacto: el tile en sí queda neutro, no se pinta rojo
 * entero) — se usa para "Eliminar equipo".
 *
 * `variant="outline"` (no `secondary`/`tertiary`) + `bg-surface` explícito:
 * antes usaba `secondary`, que pinta `--button-bg: var(--default)` (gris) —
 * el usuario lo veía "apagado" sobre el fondo blanco del sheet. `outline` ya
 * fija su propio `--button-fg` (a diferencia de `tertiary`, que hereda
 * `currentColor` y por eso NUNCA se usa acá — ver el fix de `.drawer__body`
 * en `index.css`), así que se mantiene libre del mismo bug; la etiqueta igual
 * queda en su propio `<span className="text-foreground">` a contraste pleno
 * pase lo que pase con la variante (mismo criterio que ya usa el badge del
 * ícono, que nunca dependió de `currentColor`).
 *
 * Ancho fijo a `calc(50% - gap/2)` (no `fullWidth`/grid): el padre es un
 * `flex flex-wrap justify-center`, así que 2 tiles entran por fila y — como
 * `justify-content` en flexbox se aplica POR LÍNEA — un tile impar al final
 * (3 tiles para MANTENEDOR/no-ADMIN, 5 para ADMIN) queda centrado solo en su
 * propia fila sin lógica condicional adicional en el llamador.
 */
function AccionTile({
  icon: Icon,
  label,
  onPress,
  isDisabled,
  tone = 'accent',
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  isDisabled?: boolean;
  tone?: 'accent' | 'danger';
}) {
  return (
    <Button
      className="h-auto w-[calc(50%-0.375rem)] flex-col gap-2.5 rounded-2xl border border-border bg-surface py-4 text-center text-[13px] font-semibold whitespace-normal"
      isDisabled={isDisabled}
      onPress={onPress}
      variant="outline"
    >
      <span
        className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${
          tone === 'danger' ? 'bg-danger-soft text-danger-soft-foreground' : 'bg-accent-soft text-accent-soft-foreground'
        }`}
      >
        <Icon aria-hidden className="h-5 w-5" />
      </span>
      <span className="text-foreground">{label}</span>
    </Button>
  );
}

/**
 * Tarjeta de equipo para tablet/celular: ya no navega directo a la ficha
 * (`Link`) — al tocarla abre una hoja de acciones inferior (`Drawer`
 * `placement="bottom"`), calcando la hoja de `FlotaClienteTablet/Phone.dc.html`
 * (foto+código+estado en el encabezado, acciones abajo). Antes de este fix,
 * editar/eliminar/cambiar estado solo existían en el kebab de PC
 * (`EquipoActionsMenu`) — acá viven las mismas mutaciones, gateadas igual.
 *
 * Cada tarjeta es dueña de sus propios overlays (mismo criterio que
 * `EquipoActionsMenu` en PC): así abrir la hoja de un equipo nunca deja
 * "colgado" el estado de otro, y no hace falta levantar un id seleccionado
 * al padre.
 */
function EquipoCardMobile({
  equipo,
  sucursalPorId,
  puedeEditarFicha,
  puedeCambiarEstado,
}: {
  equipo: Equipment;
  sucursalPorId: Map<string, string>;
  puedeEditarFicha: boolean;
  puedeCambiarEstado: boolean;
}) {
  const navigate = useNavigate();
  const updateStatus = useUpdateEquipmentStatus();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  // Un solo estado para el tile de horómetro — `RegistrarHorometroModal`
  // decide internamente entre `RegistrarEntradaModal`/`RegistrarSalidaModal`
  // según `equipo.openShift`, así que acá solo se controla si está abierto.
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isCargaOpen, setIsCargaOpen] = useState(false);
  // R3 (vista diferenciada por clase): patente destacada en pesados, o
  // integrada en `marcaModelo` en livianos — fuente única, ver `flota-colors.ts`.
  const identidad = equipoIdentidad(equipo);

  return (
    <>
      <button
        className="block w-full rounded-(--radius) text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
        onClick={() => setIsSheetOpen(true)}
        type="button"
      >
        <Card className="transition-colors active:bg-surface-secondary">
          <Card.Content className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <EquipoThumb alt={equipo.internalCode} photoUrl={equipo.photoUrl} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-(--accent)">
                      {equipo.internalCode}
                    </span>
                    {identidad.patenteDestacada ? (
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {identidad.patenteDestacada}
                      </span>
                    ) : null}
                    <StatusChip tone={equipmentStatusChipColor(equipo.status)}>
                      {equipmentStatusLabel(equipo.status)}
                    </StatusChip>
                    <DocumentAlertBadge equipo={equipo} />
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-(--muted)" />
                </div>
                <p className="mt-1 text-sm text-foreground">{identidad.marcaModelo}</p>
                <p className="mt-0.5 text-xs text-(--muted)">
                  {claseTipoAnio(equipo)} ·{' '}
                  {equipo.homeBranchId ? (sucursalPorId.get(equipo.homeBranchId) ?? '—') : 'Sin sucursal'}
                </p>
              </div>
            </div>

            <div className="flex gap-4 border-t border-separator pt-3">
              <div className="flex min-w-24 flex-col gap-0.5">
                <span className="text-[11px] font-bold tracking-wide text-(--muted) uppercase">
                  Horómetro / KM
                </span>
                <span className="font-mono text-base font-semibold text-foreground">
                  {formatearUso(equipo)}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-[11px] font-bold tracking-wide text-(--muted) uppercase">
                  Combustible
                </span>
                <FuelGauge pct={equipo.currentFuelLevel} />
              </div>
            </div>

            <AsignacionCell equipo={equipo} layout="inline" />
          </Card.Content>
        </Card>
      </button>

      <Drawer.Backdrop isOpen={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <Drawer.Content placement="bottom">
          <Drawer.Dialog className="max-h-[85vh]">
            <Drawer.Handle />
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <div className="flex items-center gap-3">
                <EquipoThumb alt={equipo.internalCode} photoUrl={equipo.photoUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Drawer.Heading className="font-mono text-lg font-semibold text-(--accent)">
                      {equipo.internalCode}
                    </Drawer.Heading>
                    {identidad.patenteDestacada ? (
                      <span className="font-mono text-base font-semibold text-foreground">
                        {identidad.patenteDestacada}
                      </span>
                    ) : null}
                    <StatusChip tone={equipmentStatusChipColor(equipo.status)}>
                      {equipmentStatusLabel(equipo.status)}
                    </StatusChip>
                  </div>
                  <p className="mt-0.5 text-sm text-(--muted)">
                    {identidad.marcaModelo}
                    {equipo.year ? ` · ${equipo.year}` : ''}
                  </p>
                </div>
              </div>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-5">
              {puedeCambiarEstado ? (
                <div>
                  <p className="mb-2.5 text-[12px] font-bold tracking-[0.08em] text-(--muted) uppercase">
                    Cambiar estado
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {EQUIPMENT_STATUS.map((opcionEstado) => {
                      const esActual = opcionEstado === equipo.status;
                      return (
                        <Button
                          className={
                            esActual
                              ? `border ${equipmentStatusSelectedClasses(opcionEstado)}`
                              : 'border border-border bg-surface text-foreground'
                          }
                          fullWidth
                          isDisabled={esActual || updateStatus.isPending}
                          key={opcionEstado}
                          size="sm"
                          // Los NO seleccionados quedan "outline" + blanco
                          // explícito (`bg-surface`) — claramente clickeables
                          // (borde + texto a contraste pleno), no apagados.
                          // El actual se resalta en su color semántico
                          // (`equipmentStatusSelectedClasses`, tokens
                          // --success/--warning/--danger + su "-soft" — el
                          // mismo look que ya usa `StatusChip`) y queda
                          // disabled: marca dónde estás, no un botón más.
                          variant="outline"
                          onPress={() =>
                            updateStatus.mutate(
                              { id: equipo.id, status: opcionEstado },
                              { onSuccess: () => setIsSheetOpen(false) },
                            )
                          }
                        >
                          {equipmentStatusLabel(opcionEstado)}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-center gap-3">
                <AccionTile
                  icon={Eye}
                  label="Ver ficha completa"
                  onPress={() => {
                    setIsSheetOpen(false);
                    navigate(`/equipos/${equipo.id}`);
                  }}
                />
                <AccionTile
                  icon={Gauge}
                  label={registrarHorometroLabel(equipo)}
                  onPress={() => {
                    setIsSheetOpen(false);
                    setIsShiftModalOpen(true);
                  }}
                />
                <AccionTile
                  icon={Droplet}
                  label="Registrar combustible"
                  onPress={() => {
                    setIsSheetOpen(false);
                    setIsCargaOpen(true);
                  }}
                />
                {puedeEditarFicha ? (
                  <AccionTile
                    icon={Pencil}
                    label="Editar equipo"
                    onPress={() => {
                      setIsSheetOpen(false);
                      setIsEditOpen(true);
                    }}
                  />
                ) : null}
                {puedeEditarFicha ? (
                  <AccionTile
                    icon={Trash2}
                    label="Eliminar equipo"
                    onPress={() => {
                      setIsSheetOpen(false);
                      setIsDeleteOpen(true);
                    }}
                    tone="danger"
                  />
                ) : null}
              </div>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>

      <EditEquipoModal equipo={equipo} isOpen={isEditOpen} onOpenChange={setIsEditOpen} />
      <DeleteEquipoAlertDialog equipo={equipo} isOpen={isDeleteOpen} onOpenChange={setIsDeleteOpen} />
      <RegistrarHorometroModal equipo={equipo} isOpen={isShiftModalOpen} onOpenChange={setIsShiftModalOpen} />
      <RegistrarCargaCombustibleModal
        equipoId={equipo.id}
        equipoLabel={equipo.internalCode}
        isOpen={isCargaOpen}
        onOpenChange={setIsCargaOpen}
      />
    </>
  );
}

const TODOS = '__todos__';

export function EquiposView() {
  const { user, role } = useCurrentUser();
  const [status, setStatus] = useState<EquipmentStatus | typeof TODOS>(TODOS);
  const [equipmentClass, setEquipmentClass] = useState<EquipmentClass | typeof TODOS>(TODOS);
  const [homeBranchId, setHomeBranchId] = useState<string>(TODOS);
  const [busqueda, setBusqueda] = useState('');
  // Un solo modal de creación, dos triggers: el botón del header (PC, `lg:`)
  // y el FAB (tablet/celular, `lg:hidden`) — ver `CreateEquipoModal`.
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const puedeEditarFicha = user?.role === ROLES.ADMIN;
  // `PATCH /equipment/:id/status` solo lo autoriza el backend a ADMIN y
  // SUPERVISOR (MANTENEDOR recibe 403 vía `/equipos`) — ver Fix 3 del review QA.
  const puedeCambiarEstado = role === ROLES.ADMIN || role === ROLES.SUPERVISOR;

  const {
    data: equipos,
    isPending,
    isError,
    error,
  } = useEquipment({
    ...(status === TODOS ? {} : { status }),
    ...(equipmentClass === TODOS ? {} : { equipmentClass }),
    ...(homeBranchId === TODOS ? {} : { homeBranchId }),
    ...(busqueda.trim() ? { q: busqueda.trim() } : {}),
  });

  // Reusa la MISMA query que ya usa el formulario de creación/edición
  // (`CamposEquipo` → `useBranches({ isActive: true })`): alimenta tanto el
  // filtro "Sucursal" como la resolución de nombre en tabla/tarjetas, sin
  // disparar un segundo round-trip.
  // Trade-off aceptado: un equipo homed a una sucursal ya INACTIVA no aparece
  // en el filtro ni encuentra su nombre acá — cae al fallback '—'.
  const { data: sucursalesActivas } = useBranches({ isActive: true });
  const sucursalPorId = useMemo(
    () => new Map((sucursalesActivas ?? []).map((sucursal) => [sucursal.id, sucursal.name])),
    [sucursalesActivas],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
            SMI · Flota
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            Equipos
          </h1>
          <p className="text-sm text-(--muted)">
            Maquinaria y vehículos de la operación: foto, horómetro, combustible, quién lo usa y su estado.
          </p>
        </div>
        {/* PC: botón de texto en el header. En tablet/celular la creación es
           por el FAB flotante (ver más abajo, junto a la lista de tarjetas) —
           calca `openCreateForm`/`.fab` de FlotaClienteTablet/Phone.dc.html. */}
        {puedeEditarFicha ? (
          <Button className="hidden lg:block" onPress={() => setIsCreateOpen(true)}>
            Nuevo equipo
          </Button>
        ) : null}
      </div>

      <ResumenFlota />

      <div className="flex flex-wrap items-end gap-3">
        <TextField
          className="w-full md:w-64"
          aria-label="Buscar equipo"
          value={busqueda}
          onChange={setBusqueda}
        >
          <Label>Buscar</Label>
          <Input placeholder="Código, patente, marca o modelo" />
        </TextField>

        <Select
          className="w-full md:w-48"
          aria-label="Filtrar por clase"
          value={equipmentClass}
          onChange={(value) => {
            if (value) setEquipmentClass(value as EquipmentClass | typeof TODOS);
          }}
        >
          <Label>Clase</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={TODOS} textValue="Todas las clases">
                Todas las clases
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {EQUIPMENT_CLASS_OPTIONS.map((option) => (
                <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                  {option.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select
          className="w-full md:w-56"
          aria-label="Filtrar por estado"
          value={status}
          onChange={(value) => {
            if (value) setStatus(value as EquipmentStatus | typeof TODOS);
          }}
        >
          <Label>Estado</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={TODOS} textValue="Todos los estados">
                Todos los estados
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {EQUIPMENT_STATUS_OPTIONS.map((option) => (
                <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                  {option.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select
          className="w-full md:w-56"
          aria-label="Filtrar por sucursal"
          value={homeBranchId}
          onChange={(value) => {
            if (value) setHomeBranchId(String(value));
          }}
        >
          <Label>Sucursal</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={TODOS} textValue="Todas las sucursales">
                Todas las sucursales
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {(sucursalesActivas ?? []).map((sucursal) => (
                <ListBox.Item key={sucursal.id} id={sucursal.id} textValue={sucursal.name}>
                  {sucursal.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner color="accent" size="lg" />
        </div>
      ) : null}

      {isError ? (
        <div
          className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground"
          role="alert"
        >
          {error instanceof Error ? error.message : 'No se pudo cargar la lista de equipos.'}
        </div>
      ) : null}

      {!isPending && !isError && equipos.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">No hay equipos que coincidan</p>
          <p className="text-sm text-(--muted)">Ajusta los filtros o crea el primero.</p>
        </div>
      ) : null}

      {!isPending && !isError && equipos.length > 0 ? (
        <>
          {/* PC: tabla completa (≥ md) — columnas calcan FlotaClientePC.dc.html:
             Foto · Equipo · Sucursal · Horómetro/KM · Combustible · En uso
             por · Estado · Acciones. */}
          <div className="hidden lg:block">
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Equipos" className="min-w-[1120px]">
                  <Table.Header>
                    <Table.Column>Foto</Table.Column>
                    <Table.Column isRowHeader>Equipo</Table.Column>
                    <Table.Column>Sucursal</Table.Column>
                    <Table.Column className="text-right">Horómetro / KM</Table.Column>
                    <Table.Column>Combustible</Table.Column>
                    <Table.Column>En uso por</Table.Column>
                    <Table.Column>Estado</Table.Column>
                    <Table.Column>Acciones</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    <Table.Collection items={equipos}>
                      {(equipo) => {
                        // R3 (vista diferenciada por clase): patente
                        // destacada en pesados, integrada en `marcaModelo`
                        // en livianos — fuente única, ver `flota-colors.ts`.
                        const identidad = equipoIdentidad(equipo);
                        return (
                          <Table.Row>
                          <Table.Cell>
                            <EquipoThumb alt={equipo.internalCode} photoUrl={equipo.photoUrl} size="sm" />
                          </Table.Cell>
                          <Table.Cell>
                            <Link className="block" to={`/equipos/${equipo.id}`}>
                              <span className="block font-mono text-sm font-semibold text-(--accent) hover:underline">
                                {equipo.internalCode}
                              </span>
                              {identidad.patenteDestacada ? (
                                <span className="mt-0.5 block font-mono text-sm font-semibold text-foreground">
                                  {identidad.patenteDestacada}
                                </span>
                              ) : null}
                              <span className="mt-0.5 block text-sm text-foreground">{identidad.marcaModelo}</span>
                              <span className="mt-0.5 block text-xs text-(--muted)">{claseTipoAnio(equipo)}</span>
                            </Link>
                          </Table.Cell>
                          <Table.Cell>
                            {equipo.homeBranchId ? (sucursalPorId.get(equipo.homeBranchId) ?? '—') : 'Sin sucursal'}
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            <span className="block font-mono text-sm font-semibold text-foreground">
                              {formatearUso(equipo)}
                            </span>
                            <span className="mt-0.5 block text-xs text-(--muted)">
                              {USO_UNIDAD_LABEL[equipo.controlUnit]}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <FuelGauge pct={equipo.currentFuelLevel} />
                          </Table.Cell>
                          <Table.Cell>
                            <AsignacionCell equipo={equipo} layout="stacked" />
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex items-center gap-1.5">
                              <StatusChip tone={equipmentStatusChipColor(equipo.status)}>
                                {equipmentStatusLabel(equipo.status)}
                              </StatusChip>
                              <DocumentAlertBadge equipo={equipo} />
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex justify-end">
                              <EquipoActionsMenu
                                equipo={equipo}
                                puedeCambiarEstado={puedeCambiarEstado}
                                puedeEditarFicha={puedeEditarFicha}
                              />
                            </div>
                          </Table.Cell>
                        </Table.Row>
                        );
                      }}
                    </Table.Collection>
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </div>

          {/* Tablet/celular (< lg): tarjetas apiladas en una sola columna,
             calcando FlotaClienteTablet/Phone.dc.html — foto, código+estado,
             marca/modelo, horómetro+combustible y la barra "en uso por".
             Tocar la tarjeta abre la hoja de acciones (`EquipoCardMobile`),
             no navega directo a la ficha — ahí viven editar/eliminar/cambiar
             estado, que antes solo existían en el kebab de PC. */}
          <div className="flex flex-col gap-3 lg:hidden">
            {equipos.map((equipo) => (
              <EquipoCardMobile
                equipo={equipo}
                key={equipo.id}
                puedeCambiarEstado={puedeCambiarEstado}
                puedeEditarFicha={puedeEditarFicha}
                sucursalPorId={sucursalPorId}
              />
            ))}
          </div>
        </>
      ) : null}

      {/* FAB de creación — tablet/celular únicamente (el PC usa el botón de
         texto del header). Fuera del bloque de arriba a propósito: debe
         verse también con la lista vacía, para crear el primer equipo.
         Mismo gate de rol y mismo modal (`CreateEquipoModal`, controlado)
         que ese botón. */}
      {puedeEditarFicha ? (
        <Button
          aria-label="Crear equipo"
          className="fixed right-4 bottom-20 z-20 h-14 w-14 rounded-full shadow-lg shadow-black/25 lg:hidden"
          isIconOnly
          onPress={() => setIsCreateOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      ) : null}

      <CreateEquipoModal isOpen={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
