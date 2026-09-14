import { useState } from 'react';
import { Link } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, type Control, type FieldErrors } from 'react-hook-form';
import {
  AlertDialog,
  Button,
  Chip,
  Dropdown,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  Table,
  TextField,
} from '@heroui/react';

import { useCurrentUser } from '../hooks/useCurrentUser';
import { useBranch, useBranches } from '../hooks/useBranches';
import {
  useCreateEquipment,
  useDeleteEquipment,
  useEquipment,
  useResumenFleet,
  useUpdateEquipment,
  useUpdateEquipmentStatus,
} from '../hooks/useEquipment';
import {
  CONTROL_UNIT_OPTIONS,
  EQUIPMENT_CLASS_OPTIONS,
  EQUIPMENT_STATUS_OPTIONS,
  equipmentClassLabel,
  equipmentStatusChipColor,
  equipmentStatusLabel,
} from '../config/flota-colors';
import { ROLES } from '../types/roles';
import {
  EquipmentFormSchema,
  EQUIPMENT_STATUS,
  toEquipmentPayload,
  toUpdateEquipmentPayload,
  type Equipment,
  type EquipmentClass,
  type EquipmentFormValues,
  type EquipmentStatus,
} from '../types/equipment';

const NUMERO = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

function KebabIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" height="15" viewBox="0 0 24 24" width="15">
      <circle cx="12" cy="5" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="12" cy="19" r="1.9" />
    </svg>
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
};

/** `''` en el form significa "sin sucursal asignada" — el Select de HeroUI no
 * admite un `id` vacío, así que se usa este sentinel solo para el widget. */
const SIN_SUCURSAL = '__sin_sucursal__';

interface CamposProps {
  control: Control<EquipmentFormValues>;
  errors: FieldErrors<EquipmentFormValues>;
  /** El código interno es la clave de negocio: se fija al crear y el backend
   * no lo edita. */
  internalCodeEditable: boolean;
  /** Sucursal asignada HOY al equipo que se está editando (`undefined` en
   * creación). Existe para el caso borde de la sucursal base: el selector
   * solo ofrece sucursales activas, pero si el equipo quedó homed a una que
   * mientras tanto pasó a inactiva, igual debe verse seleccionada — si no,
   * el `Select` queda en blanco aunque el campo sí tenga valor. */
  currentHomeBranchId?: string | null;
}

/**
 * Campos del equipo, compartidos por el modal de creación y el de edición. Se
 * extraen en vez de duplicarse porque son varios y la única diferencia entre
 * ambos formularios es si `internalCode` se puede escribir.
 */
function CamposEquipo({ control, errors, internalCodeEditable, currentHomeBranchId }: CamposProps) {
  // El selector de sucursal base solo debe ofrecer sucursales activas.
  const { data: sucursalesActivas } = useBranches({ isActive: true });
  // Solo se pide si estamos editando (ver `currentHomeBranchId`); `useBranch`
  // ya trae `enabled: !!id`, así que en creación (`undefined`) no dispara nada.
  const { data: sucursalActual } = useBranch(currentHomeBranchId ?? '');
  const yaEstaEnActivas = (sucursalesActivas ?? []).some((sucursal) => sucursal.id === sucursalActual?.id);
  const opcionesSucursal =
    sucursalActual && !yaEstaEnActivas ? [...(sucursalesActivas ?? []), sucursalActual] : (sucursalesActivas ?? []);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="internalCode"
          render={({ field }) => (
            <TextField
              fullWidth
              isDisabled={!internalCodeEditable}
              isInvalid={!!errors.internalCode}
              name={field.name}
              onBlur={field.onBlur}
              onChange={field.onChange}
              value={field.value}
            >
              <Label>Código interno</Label>
              <Input autoFocus={internalCodeEditable} placeholder="EX-001" />
              {errors.internalCode ? <FieldError>{errors.internalCode.message}</FieldError> : null}
            </TextField>
          )}
        />

        <Controller
          control={control}
          name="licensePlate"
          render={({ field }) => (
            <TextField
              fullWidth
              isInvalid={!!errors.licensePlate}
              name={field.name}
              onBlur={field.onBlur}
              onChange={field.onChange}
              value={field.value}
            >
              <Label>Patente (opcional)</Label>
              <Input placeholder="AB-CD-12" />
              {errors.licensePlate ? <FieldError>{errors.licensePlate.message}</FieldError> : null}
            </TextField>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="equipmentClass"
          render={({ field }) => (
            <Select
              fullWidth
              isInvalid={!!errors.equipmentClass}
              name={field.name}
              value={field.value}
              onChange={(value) => {
                if (value) field.onChange(value as EquipmentClass);
              }}
            >
              <Label>Clase</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {EQUIPMENT_CLASS_OPTIONS.map((option) => (
                    <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                      {option.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
              {errors.equipmentClass ? <FieldError>{errors.equipmentClass.message}</FieldError> : null}
            </Select>
          )}
        />

        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <TextField
              fullWidth
              isInvalid={!!errors.type}
              name={field.name}
              onBlur={field.onBlur}
              onChange={field.onChange}
              value={field.value}
            >
              <Label>Tipo</Label>
              <Input placeholder="Excavadora, Camión, Cargador…" />
              {errors.type ? <FieldError>{errors.type.message}</FieldError> : null}
            </TextField>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="brand"
          render={({ field }) => (
            <TextField
              fullWidth
              isInvalid={!!errors.brand}
              name={field.name}
              onBlur={field.onBlur}
              onChange={field.onChange}
              value={field.value}
            >
              <Label>Marca</Label>
              <Input placeholder="Caterpillar" />
              {errors.brand ? <FieldError>{errors.brand.message}</FieldError> : null}
            </TextField>
          )}
        />

        <Controller
          control={control}
          name="model"
          render={({ field }) => (
            <TextField
              fullWidth
              isInvalid={!!errors.model}
              name={field.name}
              onBlur={field.onBlur}
              onChange={field.onChange}
              value={field.value}
            >
              <Label>Modelo</Label>
              <Input placeholder="336" />
              {errors.model ? <FieldError>{errors.model.message}</FieldError> : null}
            </TextField>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="year"
          render={({ field }) => (
            <TextField
              fullWidth
              isInvalid={!!errors.year}
              name={field.name}
              onBlur={field.onBlur}
              onChange={field.onChange}
              value={field.value}
            >
              <Label>Año (opcional)</Label>
              <Input inputMode="numeric" placeholder="2019" />
              {errors.year ? <FieldError>{errors.year.message}</FieldError> : null}
            </TextField>
          )}
        />

        <Controller
          control={control}
          name="controlUnit"
          render={({ field }) => (
            <Select
              fullWidth
              isInvalid={!!errors.controlUnit}
              name={field.name}
              value={field.value}
              onChange={(value) => {
                if (value) field.onChange(value);
              }}
            >
              <Label>Unidad de control</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {CONTROL_UNIT_OPTIONS.map((option) => (
                    <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                      {option.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
              {errors.controlUnit ? <FieldError>{errors.controlUnit.message}</FieldError> : null}
            </Select>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select
              fullWidth
              isInvalid={!!errors.status}
              name={field.name}
              value={field.value}
              onChange={(value) => {
                if (value) field.onChange(value as EquipmentStatus);
              }}
            >
              <Label>Estado</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {EQUIPMENT_STATUS_OPTIONS.map((option) => (
                    <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                      {option.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
              {errors.status ? <FieldError>{errors.status.message}</FieldError> : null}
            </Select>
          )}
        />

        <Controller
          control={control}
          name="homeBranchId"
          render={({ field }) => (
            <Select
              fullWidth
              isInvalid={!!errors.homeBranchId}
              name={field.name}
              value={field.value || SIN_SUCURSAL}
              onChange={(value) => {
                if (value) field.onChange(value === SIN_SUCURSAL ? '' : value);
              }}
            >
              <Label>Sucursal base (opcional)</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id={SIN_SUCURSAL} textValue="Sin sucursal">
                    Sin sucursal
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  {opcionesSucursal.map((sucursal) => (
                    <ListBox.Item key={sucursal.id} id={sucursal.id} textValue={sucursal.name}>
                      {sucursal.name}
                      {!sucursal.isActive ? (
                        <span className="text-(--muted)"> (inactiva)</span>
                      ) : null}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
              {errors.homeBranchId ? <FieldError>{errors.homeBranchId.message}</FieldError> : null}
            </Select>
          )}
        />
      </div>
    </>
  );
}

function CreateEquipoModal() {
  const createEquipment = useCreateEquipment();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EquipmentFormValues>({
    resolver: zodResolver(EquipmentFormSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  return (
    <Modal>
      <Button>Nuevo equipo</Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-lg">
            {({ close }) => {
              const onSubmit = (values: EquipmentFormValues): void => {
                createEquipment.mutate(toEquipmentPayload(values), {
                  onSuccess: () => {
                    reset();
                    close();
                  },
                });
              };

              return (
                <>
                  <Modal.CloseTrigger />
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
                      <CamposEquipo control={control} errors={errors} internalCodeEditable />
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
    </Modal>
  );
}

interface EquipoModalProps {
  equipo: Equipment;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

function EditEquipoModal({ equipo, isOpen, onOpenChange }: EquipoModalProps) {
  const updateEquipment = useUpdateEquipment();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EquipmentFormValues>({
    resolver: zodResolver(EquipmentFormSchema),
    // `values` (no `defaultValues`): el modal vive montado en la fila, así que
    // el form debe re-sincronizarse cuando la tabla se refresca.
    values: {
      internalCode: equipo.internalCode,
      licensePlate: equipo.licensePlate ?? '',
      equipmentClass: equipo.equipmentClass,
      type: equipo.type,
      brand: equipo.brand,
      model: equipo.model,
      year: equipo.year ? String(equipo.year) : '',
      controlUnit: equipo.controlUnit,
      status: equipo.status,
      homeBranchId: equipo.homeBranchId ?? '',
    },
  });

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-lg">
          {({ close }) => {
            const onSubmit = (values: EquipmentFormValues): void => {
              updateEquipment.mutate(
                { id: equipo.id, input: toUpdateEquipmentPayload(values) },
                { onSuccess: () => close() },
              );
            };

            return (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                    Editar {equipo.internalCode}
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <form
                    className="flex flex-col gap-4"
                    id={`edit-equipo-form-${equipo.id}`}
                    noValidate
                    onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                  >
                    <CamposEquipo
                      control={control}
                      currentHomeBranchId={equipo.homeBranchId}
                      errors={errors}
                      internalCodeEditable={false}
                    />
                  </form>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onPress={close}>
                    Cancelar
                  </Button>
                  <Button
                    form={`edit-equipo-form-${equipo.id}`}
                    isPending={updateEquipment.isPending}
                    type="submit"
                  >
                    {({ isPending }) =>
                      isPending ? <Spinner color="current" size="sm" /> : 'Guardar cambios'
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

function DeleteEquipoAlertDialog({ equipo, isOpen, onOpenChange }: EquipoModalProps) {
  const deleteEquipment = useDeleteEquipment();

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-105">
          {({ close }) => (
            <>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>¿Eliminar {equipo.internalCode}?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  Esta acción no se puede deshacer. Si la unidad ya tiene registros de terreno,
                  mantenciones o consumos, el sistema la rechazará: en ese caso, cámbiala a{' '}
                  <strong>Fuera de servicio</strong> para retirarla conservando su historial.
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="tertiary" onPress={close}>
                  Cancelar
                </Button>
                <Button
                  isPending={deleteEquipment.isPending}
                  variant="danger"
                  onPress={() => {
                    deleteEquipment.mutate(equipo.id, { onSuccess: () => close() });
                  }}
                >
                  {deleteEquipment.isPending ? <Spinner color="current" size="sm" /> : 'Eliminar'}
                </Button>
              </AlertDialog.Footer>
            </>
          )}
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
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
      <Chip size="sm" variant="secondary">
        {resumen.total} equipos
      </Chip>
      {EQUIPMENT_STATUS.map((status) => (
        <Chip color={equipmentStatusChipColor(status)} key={status} size="sm" variant="soft">
          {equipmentStatusLabel(status)}: {resumen.porEstado[status] ?? 0}
        </Chip>
      ))}
    </div>
  );
}

const TODOS = '__todos__';

export function EquiposView() {
  const { user, role } = useCurrentUser();
  const [status, setStatus] = useState<EquipmentStatus | typeof TODOS>(TODOS);
  const [equipmentClass, setEquipmentClass] = useState<EquipmentClass | typeof TODOS>(TODOS);
  const [busqueda, setBusqueda] = useState('');

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
    ...(busqueda.trim() ? { q: busqueda.trim() } : {}),
  });

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
            Maquinaria y vehículos de la operación, con su estado y uso acumulado.
          </p>
        </div>
        {puedeEditarFicha ? <CreateEquipoModal /> : null}
      </div>

      <ResumenFlota />

      <div className="flex flex-wrap items-end gap-3">
        <TextField
          className="w-full sm:w-64"
          aria-label="Buscar equipo"
          value={busqueda}
          onChange={setBusqueda}
        >
          <Label>Buscar</Label>
          <Input placeholder="Código, patente, marca o modelo" />
        </TextField>

        <Select
          className="w-full sm:w-48"
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
          className="w-full sm:w-56"
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
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="Equipos" className="min-w-200">
              <Table.Header>
                <Table.Column isRowHeader>Código</Table.Column>
                <Table.Column>Clase</Table.Column>
                <Table.Column>Tipo</Table.Column>
                <Table.Column>Marca / modelo</Table.Column>
                <Table.Column>Estado</Table.Column>
                <Table.Column>Uso</Table.Column>
                <Table.Column>Acciones</Table.Column>
              </Table.Header>
              <Table.Body>
                <Table.Collection items={equipos}>
                  {(equipo) => (
                    <Table.Row>
                      <Table.Cell>
                        <Link
                          className="font-mono text-sm font-medium text-(--accent) hover:underline"
                          to={`/equipos/${equipo.id}`}
                        >
                          {equipo.internalCode}
                        </Link>
                      </Table.Cell>
                      <Table.Cell>{equipmentClassLabel(equipo.equipmentClass)}</Table.Cell>
                      <Table.Cell>{equipo.type}</Table.Cell>
                      <Table.Cell>
                        {equipo.brand} {equipo.model}
                        {equipo.year ? <span className="text-(--muted)"> · {equipo.year}</span> : null}
                      </Table.Cell>
                      <Table.Cell>
                        <Chip color={equipmentStatusChipColor(equipo.status)} size="sm" variant="soft">
                          {equipmentStatusLabel(equipo.status)}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="font-mono text-sm">{formatearUso(equipo)}</Table.Cell>
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
                  )}
                </Table.Collection>
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      ) : null}
    </div>
  );
}
