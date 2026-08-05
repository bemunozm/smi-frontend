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
import {
  useCreateEquipo,
  useDeleteEquipo,
  useEquipos,
  useResumenFlota,
  useUpdateEquipo,
  useUpdateEstadoEquipo,
} from '../hooks/useEquipos';
import {
  ESTADO_OPTIONS,
  estadoEquipoChipColor,
  estadoEquipoLabel,
} from '../config/flota-colors';
import { ROLES } from '../types/roles';
import {
  EquipoFormSchema,
  ESTADOS_EQUIPO,
  toEquipoPayload,
  type Equipo,
  type EquipoFormValues,
  type EstadoEquipo,
} from '../types/equipo';

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

const DEFAULT_FORM_VALUES: EquipoFormValues = {
  codigo: '',
  tipo: '',
  marca: '',
  modelo: '',
  anio: '',
  estado: 'DISPONIBLE',
};

interface CamposProps {
  control: Control<EquipoFormValues>;
  errors: FieldErrors<EquipoFormValues>;
  /** El código es la clave de negocio: se fija al crear y el backend no lo edita. */
  codigoEditable: boolean;
}

/**
 * Campos del equipo, compartidos por el modal de creación y el de edición. Se
 * extraen en vez de duplicarse porque son seis y la única diferencia entre
 * ambos formularios es si `codigo` se puede escribir.
 */
function CamposEquipo({ control, errors, codigoEditable }: CamposProps) {
  return (
    <>
      <Controller
        control={control}
        name="codigo"
        render={({ field }) => (
          <TextField
            fullWidth
            isDisabled={!codigoEditable}
            isInvalid={!!errors.codigo}
            name={field.name}
            onBlur={field.onBlur}
            onChange={field.onChange}
            value={field.value}
          >
            <Label>Código / patente</Label>
            <Input autoFocus={codigoEditable} placeholder="EX-001" />
            {errors.codigo ? <FieldError>{errors.codigo.message}</FieldError> : null}
          </TextField>
        )}
      />

      <Controller
        control={control}
        name="tipo"
        render={({ field }) => (
          <TextField
            fullWidth
            isInvalid={!!errors.tipo}
            name={field.name}
            onBlur={field.onBlur}
            onChange={field.onChange}
            value={field.value}
          >
            <Label>Tipo</Label>
            <Input placeholder="Excavadora, Camión, Cargador…" />
            {errors.tipo ? <FieldError>{errors.tipo.message}</FieldError> : null}
          </TextField>
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="marca"
          render={({ field }) => (
            <TextField
              fullWidth
              isInvalid={!!errors.marca}
              name={field.name}
              onBlur={field.onBlur}
              onChange={field.onChange}
              value={field.value}
            >
              <Label>Marca</Label>
              <Input placeholder="Caterpillar" />
              {errors.marca ? <FieldError>{errors.marca.message}</FieldError> : null}
            </TextField>
          )}
        />

        <Controller
          control={control}
          name="modelo"
          render={({ field }) => (
            <TextField
              fullWidth
              isInvalid={!!errors.modelo}
              name={field.name}
              onBlur={field.onBlur}
              onChange={field.onChange}
              value={field.value}
            >
              <Label>Modelo</Label>
              <Input placeholder="336" />
              {errors.modelo ? <FieldError>{errors.modelo.message}</FieldError> : null}
            </TextField>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="anio"
          render={({ field }) => (
            <TextField
              fullWidth
              isInvalid={!!errors.anio}
              name={field.name}
              onBlur={field.onBlur}
              onChange={field.onChange}
              value={field.value}
            >
              <Label>Año (opcional)</Label>
              <Input inputMode="numeric" placeholder="2019" />
              {errors.anio ? <FieldError>{errors.anio.message}</FieldError> : null}
            </TextField>
          )}
        />

        <Controller
          control={control}
          name="estado"
          render={({ field }) => (
            <Select
              fullWidth
              isInvalid={!!errors.estado}
              name={field.name}
              value={field.value}
              onChange={(value) => {
                if (value) field.onChange(value);
              }}
            >
              <Label>Estado</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {ESTADO_OPTIONS.map((option) => (
                    <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                      {option.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
              {errors.estado ? <FieldError>{errors.estado.message}</FieldError> : null}
            </Select>
          )}
        />
      </div>
    </>
  );
}

function CreateEquipoModal() {
  const createEquipo = useCreateEquipo();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EquipoFormValues>({
    resolver: zodResolver(EquipoFormSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  return (
    <Modal>
      <Button>Nuevo equipo</Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-lg">
            {({ close }) => {
              const onSubmit = (values: EquipoFormValues): void => {
                createEquipo.mutate(toEquipoPayload(values), {
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
                      <CamposEquipo codigoEditable control={control} errors={errors} />
                    </form>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="secondary" onPress={close}>
                      Cancelar
                    </Button>
                    <Button form="create-equipo-form" isPending={createEquipo.isPending} type="submit">
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
  equipo: Equipo;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

function EditEquipoModal({ equipo, isOpen, onOpenChange }: EquipoModalProps) {
  const updateEquipo = useUpdateEquipo();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EquipoFormValues>({
    resolver: zodResolver(EquipoFormSchema),
    // `values` (no `defaultValues`): el modal vive montado en la fila, así que
    // el form debe re-sincronizarse cuando la tabla se refresca.
    values: {
      codigo: equipo.codigo,
      tipo: equipo.tipo,
      marca: equipo.marca,
      modelo: equipo.modelo,
      anio: equipo.anio ? String(equipo.anio) : '',
      estado: equipo.estado,
    },
  });

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-lg">
          {({ close }) => {
            const onSubmit = (values: EquipoFormValues): void => {
              const { codigo: _codigo, ...input } = toEquipoPayload(values);
              updateEquipo.mutate({ id: equipo.id, input }, { onSuccess: () => close() });
            };

            return (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                    Editar {equipo.codigo}
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <form
                    className="flex flex-col gap-4"
                    id={`edit-equipo-form-${equipo.id}`}
                    noValidate
                    onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                  >
                    <CamposEquipo codigoEditable={false} control={control} errors={errors} />
                  </form>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onPress={close}>
                    Cancelar
                  </Button>
                  <Button
                    form={`edit-equipo-form-${equipo.id}`}
                    isPending={updateEquipo.isPending}
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
  const deleteEquipo = useDeleteEquipo();

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-105">
          {({ close }) => (
            <>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>¿Eliminar {equipo.codigo}?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  Esta acción no se puede deshacer. Si la unidad ya tiene registros de terreno,
                  mantenciones o consumos, el sistema la rechazará: en ese caso, cámbiala a{' '}
                  <strong>De baja</strong> para retirarla conservando su historial.
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="tertiary" onPress={close}>
                  Cancelar
                </Button>
                <Button
                  isPending={deleteEquipo.isPending}
                  variant="danger"
                  onPress={() => {
                    deleteEquipo.mutate(equipo.id, { onSuccess: () => close() });
                  }}
                >
                  {deleteEquipo.isPending ? <Spinner color="current" size="sm" /> : 'Eliminar'}
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
function EquipoActionsMenu({ equipo, puedeEditarFicha }: { equipo: Equipo; puedeEditarFicha: boolean }) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const updateEstado = useUpdateEstadoEquipo();

  const otrosEstados = ESTADOS_EQUIPO.filter((estado) => estado !== equipo.estado);

  return (
    <>
      <Dropdown>
        <Button isIconOnly aria-label={`Acciones para ${equipo.codigo}`} size="sm" variant="secondary">
          <KebabIcon />
        </Button>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu
            disabledKeys={puedeEditarFicha ? [] : ['edit', 'delete']}
            onAction={(key) => {
              const clave = String(key);
              if (clave === 'edit') return setIsEditOpen(true);
              if (clave === 'delete') return setIsDeleteOpen(true);
              if (clave.startsWith('estado:')) {
                updateEstado.mutate({
                  id: equipo.id,
                  estado: clave.slice('estado:'.length) as EstadoEquipo,
                });
              }
            }}
          >
            {otrosEstados.map((estado) => (
              <Dropdown.Item
                key={estado}
                id={`estado:${estado}`}
                textValue={`Marcar como ${estadoEquipoLabel(estado)}`}
              >
                <Label>Marcar como {estadoEquipoLabel(estado)}</Label>
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
  const { data: resumen } = useResumenFlota();

  if (!resumen) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip size="sm" variant="secondary">
        {resumen.total} equipos
      </Chip>
      {ESTADOS_EQUIPO.map((estado) => (
        <Chip color={estadoEquipoChipColor(estado)} key={estado} size="sm" variant="soft">
          {estadoEquipoLabel(estado)}: {resumen.porEstado[estado] ?? 0}
        </Chip>
      ))}
    </div>
  );
}

const TODOS = '__todos__';

export function EquiposView() {
  const { user } = useCurrentUser();
  const [estado, setEstado] = useState<EstadoEquipo | typeof TODOS>(TODOS);
  const [busqueda, setBusqueda] = useState('');

  const puedeEditarFicha = user?.role === ROLES.ADMIN;

  const {
    data: equipos,
    isPending,
    isError,
    error,
  } = useEquipos({
    ...(estado === TODOS ? {} : { estado }),
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
          <p className="text-sm text-muted">
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
          <Input placeholder="Código, marca o modelo" />
        </TextField>

        <Select
          className="w-full sm:w-56"
          aria-label="Filtrar por estado"
          value={estado}
          onChange={(value) => {
            if (value) setEstado(value as EstadoEquipo | typeof TODOS);
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
              {ESTADO_OPTIONS.map((option) => (
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
          <p className="text-sm text-muted">Ajusta los filtros o crea el primero.</p>
        </div>
      ) : null}

      {!isPending && !isError && equipos.length > 0 ? (
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="Equipos" className="min-w-200">
              <Table.Header>
                <Table.Column isRowHeader>Código</Table.Column>
                <Table.Column>Tipo</Table.Column>
                <Table.Column>Marca / modelo</Table.Column>
                <Table.Column>Estado</Table.Column>
                <Table.Column>Horómetro</Table.Column>
                <Table.Column>Kilometraje</Table.Column>
                <Table.Column>Acciones</Table.Column>
              </Table.Header>
              <Table.Body>
                <Table.Collection items={equipos}>
                  {(equipo) => (
                    <Table.Row>
                      <Table.Cell>
                        <Link
                          className="font-mono text-sm font-medium text-accent hover:underline"
                          to={`/equipos/${equipo.id}`}
                        >
                          {equipo.codigo}
                        </Link>
                      </Table.Cell>
                      <Table.Cell>{equipo.tipo}</Table.Cell>
                      <Table.Cell>
                        {equipo.marca} {equipo.modelo}
                        {equipo.anio ? <span className="text-muted"> · {equipo.anio}</span> : null}
                      </Table.Cell>
                      <Table.Cell>
                        <Chip color={estadoEquipoChipColor(equipo.estado)} size="sm" variant="soft">
                          {estadoEquipoLabel(equipo.estado)}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="font-mono text-sm">
                        {NUMERO.format(equipo.horometroActual)} h
                      </Table.Cell>
                      <Table.Cell className="font-mono text-sm">
                        {equipo.kilometrajeActual > 0
                          ? `${NUMERO.format(equipo.kilometrajeActual)} km`
                          : '—'}
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex justify-end">
                          <EquipoActionsMenu equipo={equipo} puedeEditarFicha={puedeEditarFicha} />
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
