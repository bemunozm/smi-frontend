import { MarcaPendiente } from '../components/sync/MarcaPendiente';
import { usePendingWrites, type MarcaPendiente as Marca } from '../hooks/usePendingWrites';
import { operatorEntity } from '../offline/db';
import { PendientesStrip } from '../components/sync/PendientesStrip';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { ChevronRight, Pencil, PlusCircle, PowerOff, Power, Search, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  Button,
  Card,
  Chip,
  Drawer,
  Dropdown,
  FieldError,
  Input,
  InputGroup,
  Label,
  Modal,
  Spinner,
  Switch,
  Table,
  TextField,
} from '@heroui/react';

import { ActionTile } from '../components/ActionTile';
import { useCurrentUser } from '../hooks/useCurrentUser';
import {
  useCreateOperator,
  useDeleteOperator,
  useOperators,
  useToggleOperatorActive,
  useUpdateOperator,
} from '../hooks/useOperators';
import { ROLES } from '../types/roles';
import {
  OperatorFormSchema,
  toCreateOperatorPayload,
  toUpdateOperatorPayload,
  type Operator,
  type OperatorFormValues,
} from '../types/operator';

const DEFAULT_FORM_VALUES: OperatorFormValues = { name: '', rut: '', isActive: true };

/**
 * Plantilla de referencia: modal con RHF + zodResolver + `useCreateOperator`
 * — mismo patrón que `CreateUserModal` (`views/UsersView.tsx`). El backend
 * (`POST /api/operators`) solo acepta `{name, rut?}`: `isActive` del form se
 * ignora acá (todo operador nace activo).
 */
function CreateOperatorModal() {
  const createOperator = useCreateOperator();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OperatorFormValues>({
    resolver: zodResolver(OperatorFormSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  return (
    <Modal>
      <Button>
        <PlusCircle className="h-4 w-4" />
        Nuevo operador
      </Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            {({ close }) => {
              const onSubmit = (values: OperatorFormValues): void => {
                createOperator.mutate(toCreateOperatorPayload(values), {
                  onSuccess: () => {
                    reset(DEFAULT_FORM_VALUES);
                    close();
                  },
                });
              };

              return (
                <>
                  <Modal.CloseTrigger />
                  <Modal.Header>
                    <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                      Nuevo operador
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <form
                      className="flex flex-col gap-4"
                      id="create-operator-form"
                      noValidate
                      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                    >
                      <Controller
                        control={control}
                        name="name"
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            isInvalid={!!errors.name}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            value={field.value}
                          >
                            <Label>Nombre</Label>
                            <Input autoFocus placeholder="Nombre y apellido" />
                            {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
                          </TextField>
                        )}
                      />

                      <Controller
                        control={control}
                        name="rut"
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            isInvalid={!!errors.rut}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            value={field.value}
                          >
                            <Label>RUT (opcional)</Label>
                            <Input placeholder="12.345.678-9" />
                            {errors.rut ? <FieldError>{errors.rut.message}</FieldError> : null}
                          </TextField>
                        )}
                      />
                    </form>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="secondary" onPress={close}>
                      Cancelar
                    </Button>
                    <Button form="create-operator-form" isPending={createOperator.isPending} type="submit">
                      {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Crear operador')}
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

interface OperatorModalProps {
  operator: Operator;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/**
 * Modal de edición — mismo patrón que `EditUserModal`: `values` (no
 * `defaultValues`) para re-sincronizar si `operator` cambia mientras el
 * modal sigue montado en la fila/tarjeta. Sin el campo `isActive`: activar/
 * desactivar es una acción aparte de un click (`OperatorActionsMenu`), no
 * parte de este formulario.
 */
function EditOperatorModal({ operator, isOpen, onOpenChange }: OperatorModalProps) {
  const updateOperator = useUpdateOperator();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<OperatorFormValues>({
    resolver: zodResolver(OperatorFormSchema),
    values: { name: operator.name, rut: operator.rut ?? '', isActive: operator.isActive },
  });

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-md">
          {({ close }) => {
            const onSubmit = (values: OperatorFormValues): void => {
              updateOperator.mutate(
                { operator, input: toUpdateOperatorPayload(values) },
                { onSuccess: () => close() },
              );
            };

            return (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                    Editar operador
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <form
                    className="flex flex-col gap-4"
                    id={`edit-operator-form-${operator.id}`}
                    noValidate
                    onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                  >
                    <Controller
                      control={control}
                      name="name"
                      render={({ field }) => (
                        <TextField
                          fullWidth
                          isInvalid={!!errors.name}
                          name={field.name}
                          onBlur={field.onBlur}
                          onChange={field.onChange}
                          value={field.value}
                        >
                          <Label>Nombre</Label>
                          <Input autoFocus placeholder="Nombre y apellido" />
                          {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
                        </TextField>
                      )}
                    />

                    <Controller
                      control={control}
                      name="rut"
                      render={({ field }) => (
                        <TextField
                          fullWidth
                          isInvalid={!!errors.rut}
                          name={field.name}
                          onBlur={field.onBlur}
                          onChange={field.onChange}
                          value={field.value}
                        >
                          <Label>RUT (opcional)</Label>
                          <Input placeholder="12.345.678-9" />
                          {errors.rut ? <FieldError>{errors.rut.message}</FieldError> : null}
                        </TextField>
                      )}
                    />
                  </form>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onPress={close}>
                    Cancelar
                  </Button>
                  <Button form={`edit-operator-form-${operator.id}`} isPending={updateOperator.isPending} type="submit">
                    {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Guardar cambios')}
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
 * Confirmación destructiva — mismo patrón que `DeleteUserAlertDialog`. El
 * backend rechaza con 409 si el operador está en uso y sugiere desactivarlo
 * (ver `hooks/useOperators.ts#useDeleteOperator`); ese mensaje llega tal cual
 * al toast, así que acá solo se avisa la posibilidad, no se duplica el texto
 * exacto del backend.
 */
function DeleteOperatorAlertDialog({
  operator,
  isOpen,
  onOpenChange,
}: {
  operator: Operator;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const deleteOperator = useDeleteOperator();

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-105">
          {({ close }) => (
            <>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>¿Eliminar a {operator.name}?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  Esta acción no se puede deshacer. Si el operador ya tiene registros asociados, el
                  sistema rechazará el borrado — en ese caso, desactívalo en su lugar.
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="tertiary" onPress={close}>
                  Cancelar
                </Button>
                <Button
                  isPending={deleteOperator.isPending}
                  variant="danger"
                  onPress={() => {
                    deleteOperator.mutate(operator.id, { onSuccess: () => close() });
                  }}
                >
                  {deleteOperator.isPending ? <Spinner color="current" size="sm" /> : 'Eliminar'}
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
 * Menú de acciones de la fila de tabla (PC) — Editar / Activar·Desactivar
 * (toggle directo, sin modal) / Eliminar. En tablet/celular el equivalente es
 * la hoja de acciones de `OperatorCardMobile`.
 *
 * "Eliminar" solo se ofrece a ADMIN: el backend restringe el borrado a ese
 * rol (`DELETE /api/operators/:id`, ver `OperatorsController`) — SUPERVISOR
 * puede crear/editar/activar pero no borrar, y mostrarle una acción que
 * siempre rebota en 403 es peor que no mostrarla (mismo criterio que
 * `config/nav-items.ts`).
 */
function OperatorActionsMenu({ operator }: { operator: Operator }) {
  const { role } = useCurrentUser();
  const canDelete = role === ROLES.ADMIN;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const toggleActive = useToggleOperatorActive();

  return (
    <>
      <Dropdown>
        <Button isIconOnly aria-label={`Acciones para ${operator.name}`} size="sm" variant="secondary">
          <svg aria-hidden="true" fill="currentColor" height="15" viewBox="0 0 24 24" width="15">
            <circle cx="12" cy="5" r="1.9" />
            <circle cx="12" cy="12" r="1.9" />
            <circle cx="12" cy="19" r="1.9" />
          </svg>
        </Button>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu
            onAction={(key) => {
              if (key === 'edit') setIsEditOpen(true);
              if (key === 'toggle-active') {
                toggleActive.mutate({ operator, isActive: !operator.isActive });
              }
              if (key === 'delete') setIsDeleteOpen(true);
            }}
          >
            <Dropdown.Item id="edit" textValue="Editar">
              <Pencil className="h-3.5 w-3.5" />
              <Label>Editar</Label>
            </Dropdown.Item>
            <Dropdown.Item id="toggle-active" textValue={operator.isActive ? 'Desactivar' : 'Activar'}>
              {operator.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
              <Label>{operator.isActive ? 'Desactivar' : 'Activar'}</Label>
            </Dropdown.Item>
            {canDelete ? (
              <Dropdown.Item id="delete" textValue="Eliminar" variant="danger">
                <Trash2 className="h-3.5 w-3.5" />
                <Label>Eliminar</Label>
              </Dropdown.Item>
            ) : null}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <EditOperatorModal isOpen={isEditOpen} operator={operator} onOpenChange={setIsEditOpen} />
      {canDelete ? (
        <DeleteOperatorAlertDialog isOpen={isDeleteOpen} operator={operator} onOpenChange={setIsDeleteOpen} />
      ) : null}
    </>
  );
}

/**
 * Tarjeta de operador — tablet/celular (< lg), mismo patrón que
 * `EquipoCardMobile` (`EquiposView`): tabla en PC, tarjetas apiladas debajo, y
 * la tarjeta ENTERA es el botón que abre una hoja de acciones inferior. En una
 * pantalla táctil un kebab de 32 px es un blanco chico para quien opera con
 * guantes; la hoja además muestra cada acción con su nombre escrito.
 *
 * Cada tarjeta es dueña de sus overlays (hoja, edición, borrado): abrir la de
 * un operador nunca deja colgado el estado de otro. Las reglas de rol son las
 * de `OperatorActionsMenu` (solo ADMIN elimina).
 */
function OperatorCardMobile({ operator, marca }: { operator: Operator; marca: Marca | null }) {
  const { role } = useCurrentUser();
  const canDelete = role === ROLES.ADMIN;
  const toggleActive = useToggleOperatorActive();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const statusChip = (
    <Chip className="w-fit" color={operator.isActive ? 'success' : 'default'} size="sm" variant="soft">
      {operator.isActive ? 'Activo' : 'Inactivo'}
    </Chip>
  );

  return (
    <>
      <button
        // Sin etiqueta propia el nombre accesible sería la ristra de todo lo
        // que lleva la tarjeta; lo que hace el botón es abrir las acciones.
        aria-label={`Acciones de ${operator.name}`}
        className="block w-full rounded-(--radius) text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
        onClick={() => setIsSheetOpen(true)}
        type="button"
      >
        <Card className="transition-colors active:bg-surface-secondary">
          <Card.Content className="p-4">
            <div className="flex min-h-14 items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col items-start gap-1">
                <span className="max-w-full truncate text-base font-semibold text-foreground">{operator.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{operator.rut ?? 'Sin RUT'}</span>
                {statusChip}
                <MarcaPendiente marca={marca} />
              </div>
              <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-(--muted)" />
            </div>
          </Card.Content>
        </Card>
      </button>

      <Drawer.Backdrop isOpen={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <Drawer.Content placement="bottom">
          <Drawer.Dialog className="max-h-[85vh]">
            <Drawer.Handle />
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <div className="flex min-w-0 flex-col gap-1">
                <Drawer.Heading className="truncate text-lg font-semibold">{operator.name}</Drawer.Heading>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-muted-foreground">{operator.rut ?? 'Sin RUT'}</span>
                  {statusChip}
                </div>
              </div>
            </Drawer.Header>
            <Drawer.Body>
              <div className="flex flex-wrap justify-center gap-3">
                <ActionTile
                  icon={Pencil}
                  label="Editar"
                  onPress={() => {
                    setIsSheetOpen(false);
                    setIsEditOpen(true);
                  }}
                />
                <ActionTile
                  icon={operator.isActive ? PowerOff : Power}
                  label={operator.isActive ? 'Desactivar' : 'Activar'}
                  onPress={() => {
                    setIsSheetOpen(false);
                    toggleActive.mutate({ operator, isActive: !operator.isActive });
                  }}
                />
                {canDelete ? (
                  <ActionTile
                    icon={Trash2}
                    label="Eliminar"
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

      <EditOperatorModal isOpen={isEditOpen} operator={operator} onOpenChange={setIsEditOpen} />
      {canDelete ? (
        <DeleteOperatorAlertDialog isOpen={isDeleteOpen} operator={operator} onOpenChange={setIsDeleteOpen} />
      ) : null}
    </>
  );
}

/**
 * Vista de administración del catálogo de Operadores (Supervisión en
 * Terreno) — mismo patrón CRUD completo que `UsersView`: lista +
 * crear/editar con RHF+Zod+`useMutation` + activar/desactivar + borrado con
 * confirmación, responsive (tabla en PC, tarjetas en tablet/celular).
 */
const RECURSOS_DE_OPERADORES = ['operator'] as const;

export function OperadoresView() {
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const filtros = {
    ...(showInactive ? {} : { isActive: true }),
    ...(q.trim() ? { q: q.trim() } : {}),
  };
  const { data: operators, isPending, isError, error } = useOperators(filtros);
  const pendientes = usePendingWrites(RECURSOS_DE_OPERADORES);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
            SMI · Supervisión en terreno
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            Operadores
          </h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de operadores para Registro de equipo y la entrada de Flota.
          </p>
        </div>
        <CreateOperatorModal />
      </div>

      <PendientesStrip recursos={RECURSOS_DE_OPERADORES} />

      <div className="flex flex-wrap items-center gap-3">
        <TextField className="w-full sm:w-72" value={q} onChange={setQ}>
          <InputGroup>
            <InputGroup.Prefix>
              <Search className="size-4 text-muted-foreground" />
            </InputGroup.Prefix>
            <InputGroup.Input placeholder="Buscar por nombre o RUT" />
          </InputGroup>
        </TextField>
        <Switch isSelected={showInactive} onChange={setShowInactive}>
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            Mostrar inactivos
          </Switch.Content>
        </Switch>
      </div>

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner color="accent" size="lg" />
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground" role="alert">
          {error instanceof Error ? error.message : 'No se pudo cargar la lista de operadores.'}
        </div>
      ) : null}

      {!isPending && !isError && operators && operators.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">Todavía no hay operadores</p>
          <p className="text-sm text-muted-foreground">Crea el primero con el botón "Nuevo operador".</p>
        </div>
      ) : null}

      {!isPending && !isError && operators && operators.length > 0 ? (
        <>
          <div className="hidden xl:block">
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Operadores" className="min-w-160">
                  <Table.Header>
                    <Table.Column isRowHeader>Nombre</Table.Column>
                    <Table.Column>RUT</Table.Column>
                    <Table.Column>Estado</Table.Column>
                    <Table.Column>Acciones</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    <Table.Collection items={operators}>
                      {(operator) => (
                        <Table.Row>
                          <Table.Cell>
                            {operator.name}
                            <MarcaPendiente marca={pendientes.marcaDe(operatorEntity(operator.id))} />
                          </Table.Cell>
                          <Table.Cell className="font-mono text-sm">{operator.rut ?? '—'}</Table.Cell>
                          <Table.Cell>
                            <Chip color={operator.isActive ? 'success' : 'default'} size="sm" variant="soft">
                              {operator.isActive ? 'Activo' : 'Inactivo'}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex justify-end">
                              <OperatorActionsMenu operator={operator} />
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      )}
                    </Table.Collection>
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </div>

          <div className="flex flex-col gap-3 xl:hidden">
            {operators.map((operator) => (
              <OperatorCardMobile key={operator.id} marca={pendientes.marcaDe(operatorEntity(operator.id))} operator={operator} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
