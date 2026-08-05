import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
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
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from '../hooks/useUsers';
import { ROLE_OPTIONS, roleChipColor } from '../config/role-colors';
import { ROLES } from '../types/roles';
import {
  CreateUserSchema,
  UpdateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type User,
} from '../types/user';

function PencilIcon() {
  return (
    <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="15">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="15">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

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
 * Plantilla de referencia: modal con RHF + zodResolver + `useCreateUser`.
 * Totalmente no controlado (`<Modal>` maneja su propio open/close); usa el
 * render-prop `close` de `Modal.Dialog` para cerrar solo después de que la
 * mutación resuelve, no antes.
 *
 * El feedback (toast de éxito/error) vive en `useCreateUser` (ver
 * `hooks/useUsers.ts`) — acá solo reaccionamos al éxito para la UI que es
 * responsabilidad de ESTA vista: resetear el form y cerrar el modal. `mutate`
 * (no `mutateAsync`) porque no necesitamos awaitear nada acá; el `isPending`
 * del botón viene del hook de mutación, no de `isSubmitting` de RHF (que con
 * `mutate` fire-and-forget no refleja el estado real de la petición).
 */
function CreateUserModal() {
  const createUser = useCreateUser();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(CreateUserSchema),
    defaultValues: { name: '', email: '', password: '', role: ROLES.OPERADOR },
  });

  return (
    <Modal>
      <Button>Nuevo usuario</Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            {({ close }) => {
              const onSubmit = (values: CreateUserInput): void => {
                createUser.mutate(values, {
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
                      Nuevo usuario
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <form
                      className="flex flex-col gap-4"
                      id="create-user-form"
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
                            <Input autoFocus placeholder="Nombre completo" />
                            {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
                          </TextField>
                        )}
                      />

                      <Controller
                        control={control}
                        name="email"
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            isInvalid={!!errors.email}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            type="email"
                            value={field.value}
                          >
                            <Label>Email</Label>
                            <Input placeholder="nombre@smi.local" />
                            {errors.email ? <FieldError>{errors.email.message}</FieldError> : null}
                          </TextField>
                        )}
                      />

                      <Controller
                        control={control}
                        name="password"
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            isInvalid={!!errors.password}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            type="password"
                            value={field.value}
                          >
                            <Label>Contraseña</Label>
                            <Input autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
                            {errors.password ? <FieldError>{errors.password.message}</FieldError> : null}
                          </TextField>
                        )}
                      />

                      <Controller
                        control={control}
                        name="role"
                        render={({ field }) => (
                          <Select
                            fullWidth
                            isInvalid={!!errors.role}
                            name={field.name}
                            value={field.value}
                            onChange={(value) => {
                              if (value) field.onChange(value);
                            }}
                          >
                            <Label>Rol</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                {ROLE_OPTIONS.map((option) => (
                                  <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                                    {option.label}
                                    <ListBox.ItemIndicator />
                                  </ListBox.Item>
                                ))}
                              </ListBox>
                            </Select.Popover>
                            {errors.role ? <FieldError>{errors.role.message}</FieldError> : null}
                          </Select>
                        )}
                      />
                    </form>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="secondary" onPress={close}>
                      Cancelar
                    </Button>
                    <Button form="create-user-form" isPending={createUser.isPending} type="submit">
                      {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Crear usuario')}
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

interface UserModalProps {
  user: User;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/**
 * Plantilla de referencia: modal de edición con RHF + zodResolver +
 * `useUpdateUser`. Usa `values` (no `defaultValues`) en `useForm` para que
 * el formulario se re-sincronice si `user` cambia (p. ej. tras refrescar la
 * tabla) mientras el modal sigue montado en la fila.
 *
 * Igual que `CreateUserModal`: el toast vive en el hook, acá solo cerramos
 * el modal en éxito (`mutate` + `onSuccess` del call-site), y el `isPending`
 * del botón es el de la mutación, no el de RHF. Controlado (`isOpen`/
 * `onOpenChange`) en vez de auto-contenido: el trigger real es un item del
 * `Dropdown` de acciones (ver `UserActionsMenu`), no un botón propio.
 */
function EditUserModal({ user, isOpen, onOpenChange }: UserModalProps) {
  const updateUser = useUpdateUser();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(UpdateUserSchema),
    values: { name: user.name, email: user.email, role: user.role },
  });

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-md">
          {({ close }) => {
            const onSubmit = (values: UpdateUserInput): void => {
              updateUser.mutate({ id: user.id, input: values }, { onSuccess: () => close() });
            };

            return (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                    Editar usuario
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <form
                    className="flex flex-col gap-4"
                    id={`edit-user-form-${user.id}`}
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
                          <Input autoFocus placeholder="Nombre completo" />
                          {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
                        </TextField>
                      )}
                    />

                    <Controller
                      control={control}
                      name="email"
                      render={({ field }) => (
                        <TextField
                          fullWidth
                          isInvalid={!!errors.email}
                          name={field.name}
                          onBlur={field.onBlur}
                          onChange={field.onChange}
                          type="email"
                          value={field.value}
                        >
                          <Label>Email</Label>
                          <Input placeholder="nombre@smi.local" />
                          {errors.email ? <FieldError>{errors.email.message}</FieldError> : null}
                        </TextField>
                      )}
                    />

                    <Controller
                      control={control}
                      name="role"
                      render={({ field }) => (
                        <Select
                          fullWidth
                          isInvalid={!!errors.role}
                          name={field.name}
                          value={field.value}
                          onChange={(value) => {
                            if (value) field.onChange(value);
                          }}
                        >
                          <Label>Rol</Label>
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              {ROLE_OPTIONS.map((option) => (
                                <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                                  {option.label}
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              ))}
                            </ListBox>
                          </Select.Popover>
                          {errors.role ? <FieldError>{errors.role.message}</FieldError> : null}
                        </Select>
                      )}
                    />
                  </form>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onPress={close}>
                    Cancelar
                  </Button>
                  <Button form={`edit-user-form-${user.id}`} isPending={updateUser.isPending} type="submit">
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
 * Plantilla de referencia: confirmación destructiva con `AlertDialog` +
 * `useDeleteUser`. El guard "no puedes eliminarte a ti mismo" se refuerza
 * en dos capas: acá se deshabilita el botón de forma preventiva, y si de
 * todos modos se envía, el 403 real del backend llega tal cual al toast del
 * hook (fuente de verdad: el backend, esto es solo UX preventiva). El
 * diálogo se cierra únicamente en éxito — en error `mutate` no llama a
 * `close()`, así que el usuario ve el toast con el diálogo todavía abierto.
 * Controlado, igual que `EditUserModal`: el trigger es el item "Eliminar"
 * del `Dropdown` de acciones (ver `UserActionsMenu`).
 */
function DeleteUserAlertDialog({
  user,
  isSelf,
  isOpen,
  onOpenChange,
}: {
  user: User;
  isSelf: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const deleteUser = useDeleteUser();

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-105">
          {({ close }) => (
            <>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>¿Eliminar a {user.name}?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  Esta acción no se puede deshacer. <strong>{user.email}</strong> perderá el
                  acceso al sistema de inmediato.
                </p>
                {isSelf ? (
                  <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
                    No puedes eliminar tu propia cuenta.
                  </p>
                ) : null}
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="tertiary" onPress={close}>
                  Cancelar
                </Button>
                <Button
                  isDisabled={isSelf}
                  isPending={deleteUser.isPending}
                  variant="danger"
                  onPress={() => {
                    deleteUser.mutate(user.id, { onSuccess: () => close() });
                  }}
                >
                  {deleteUser.isPending ? <Spinner color="current" size="sm" /> : 'Eliminar'}
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
 * Columna "Acciones" de la tabla: un único botón kebab que abre un
 * `Dropdown` (HeroUI) con "Editar" y "Eliminar" (danger). Cada item solo
 * setea el estado `isOpen` del modal/alertdialog correspondiente — los
 * triggers reales de `EditUserModal`/`DeleteUserAlertDialog` quedan
 * controlados desde acá en vez de ser botones sueltos en la fila.
 */
function UserActionsMenu({ user, isSelf }: { user: User; isSelf: boolean }) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  return (
    <>
      <Dropdown>
        <Button isIconOnly aria-label={`Acciones para ${user.name}`} size="sm" variant="secondary">
          <KebabIcon />
        </Button>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu
            disabledKeys={isSelf ? ['delete'] : []}
            onAction={(key) => {
              if (key === 'edit') setIsEditOpen(true);
              if (key === 'delete') setIsDeleteOpen(true);
            }}
          >
            <Dropdown.Item id="edit" textValue="Editar">
              <PencilIcon />
              <Label>Editar</Label>
            </Dropdown.Item>
            <Dropdown.Item id="delete" textValue="Eliminar" variant="danger">
              <TrashIcon />
              <Label>Eliminar</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <EditUserModal isOpen={isEditOpen} user={user} onOpenChange={setIsEditOpen} />
      <DeleteUserAlertDialog isOpen={isDeleteOpen} isSelf={isSelf} user={user} onOpenChange={setIsDeleteOpen} />
    </>
  );
}

/**
 * Vista de gestión de usuarios — plantilla de referencia del patrón CRUD
 * completo: `useUsers()` (lista) + modales de creación/edición con
 * RHF+Zod+`useMutation` + confirmación de borrado, todo sobre el design
 * system de la app.
 */
export function UsersView() {
  const { user: currentUser } = useCurrentUser();
  const { data: users, isPending, isError, error } = useUsers();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
            SMI · Administración
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            Usuarios
          </h1>
          <p className="text-sm text-muted-foreground">Crea, edita y elimina las cuentas del sistema.</p>
        </div>
        <CreateUserModal />
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
          {error instanceof Error ? error.message : 'No se pudo cargar la lista de usuarios.'}
        </div>
      ) : null}

      {!isPending && !isError && users && users.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">Todavía no hay usuarios</p>
          <p className="text-sm text-muted-foreground">Crea el primero con el botón "Nuevo usuario".</p>
        </div>
      ) : null}

      {!isPending && !isError && users && users.length > 0 ? (
        // `variant="secondary"`: un solo contenedor (header como card, filas
        // con separador simple) — el default `primary` anida una superficie
        // gris con las filas como una card blanca adentro, lo que se leía
        // como "doble card" contra el resto de la página.
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="Usuarios" className="min-w-180">
              <Table.Header>
                <Table.Column isRowHeader>Nombre</Table.Column>
                <Table.Column>Email</Table.Column>
                <Table.Column>Rol</Table.Column>
                <Table.Column>Email verificado</Table.Column>
                <Table.Column>Acciones</Table.Column>
              </Table.Header>
              <Table.Body>
                <Table.Collection items={users}>
                  {(user) => (
                    <Table.Row>
                      <Table.Cell>{user.name}</Table.Cell>
                      <Table.Cell>{user.email}</Table.Cell>
                      <Table.Cell>
                        <Chip color={roleChipColor(user.role)} size="sm" variant="soft">
                          {user.role}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip color={user.emailVerified ? 'success' : 'default'} size="sm" variant="soft">
                          {user.emailVerified ? 'Verificado' : 'Sin verificar'}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex justify-end">
                          <UserActionsMenu isSelf={user.id === currentUser?.id} user={user} />
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
