import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import {
  Button,
  Card,
  Checkbox,
  Chip,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@heroui/react';

import { useCurrentUser } from '../hooks/useCurrentUser';
import { useActualizarOrden, useCrearOrden, useOrdenes, useToggleTarea } from '../hooks/useOrdenes';
import {
  ESTADO_OT_LABELS,
  ESTADO_OT_OPTIONS,
  ORIGEN_OT_LABELS,
  ORIGEN_OT_OPTIONS,
  PRIORIDAD_OT_LABELS,
  PRIORIDAD_OT_OPTIONS,
  TIPO_OT_LABELS,
  TIPO_OT_OPTIONS,
  estadoOTChipColor,
  prioridadOTChipColor,
} from '../config/mantenimiento-colors';
import { ROLES } from '../types/roles';
import {
  CreateOrdenSchema,
  ORIGEN_OT,
  PRIORIDAD_OT,
  TIPO_OT,
  type CreateOrdenInput,
  type EstadoOT,
  type OrdenTrabajo,
} from '../types/mantenimiento';

type FiltroEstado = 'TODAS' | EstadoOT;

function formatFecha(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
}

/**
 * Modal de creación — mismo patrón que `CreateUserModal` (`views/UsersView.tsx`):
 * RHF + `zodResolver` + `useCrearOrden`, toast/invalidate viven en el hook.
 * `equipoId`/`asignadoAId` son texto libre a propósito (ver TODOs inline):
 * Flota (equipos) e Inventario/Usuarios (asignado) no exponen todavía un
 * selector real consumible desde acá.
 */
function CreateOrdenModal() {
  const crearOrden = useCrearOrden();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateOrdenInput>({
    resolver: zodResolver(CreateOrdenSchema),
    defaultValues: {
      equipoId: '',
      titulo: '',
      prioridad: PRIORIDAD_OT.MEDIA,
      tipo: TIPO_OT.CORRECTIVA,
      origen: ORIGEN_OT.MANUAL,
      origenDetalle: '',
      asignadoAId: '',
    },
  });

  return (
    <Modal>
      <Button>Crear orden</Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-lg">
            {({ close }) => {
              const onSubmit = (values: CreateOrdenInput): void => {
                const payload: CreateOrdenInput = {
                  ...values,
                  origenDetalle: values.origenDetalle?.trim() ? values.origenDetalle.trim() : undefined,
                  asignadoAId: values.asignadoAId?.trim() ? values.asignadoAId.trim() : undefined,
                };
                crearOrden.mutate(payload, {
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
                      Nueva orden de trabajo
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <form
                      className="flex flex-col gap-4"
                      id="create-orden-form"
                      noValidate
                      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                    >
                      <Controller
                        control={control}
                        name="equipoId"
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            isInvalid={!!errors.equipoId}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            value={field.value}
                          >
                            <Label>Equipo</Label>
                            {/* TODO(flota): reemplazar por selector real de equipos cuando Flota exponga el endpoint */}
                            <Input autoFocus placeholder="Código del equipo (ej. EX-001)" />
                            {errors.equipoId ? <FieldError>{errors.equipoId.message}</FieldError> : null}
                          </TextField>
                        )}
                      />

                      <Controller
                        control={control}
                        name="titulo"
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            isInvalid={!!errors.titulo}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            value={field.value}
                          >
                            <Label>Título</Label>
                            <Input placeholder="Describe el trabajo a realizar" />
                            {errors.titulo ? <FieldError>{errors.titulo.message}</FieldError> : null}
                          </TextField>
                        )}
                      />

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Controller
                          control={control}
                          name="prioridad"
                          render={({ field }) => (
                            <Select
                              fullWidth
                              isInvalid={!!errors.prioridad}
                              name={field.name}
                              value={field.value}
                              onChange={(value) => {
                                if (value) field.onChange(value);
                              }}
                            >
                              <Label>Prioridad</Label>
                              <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                              </Select.Trigger>
                              <Select.Popover>
                                <ListBox>
                                  {PRIORIDAD_OT_OPTIONS.map((option) => (
                                    <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                                      {option.label}
                                      <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                  ))}
                                </ListBox>
                              </Select.Popover>
                            </Select>
                          )}
                        />

                        <Controller
                          control={control}
                          name="tipo"
                          render={({ field }) => (
                            <Select
                              fullWidth
                              isInvalid={!!errors.tipo}
                              name={field.name}
                              value={field.value}
                              onChange={(value) => {
                                if (value) field.onChange(value);
                              }}
                            >
                              <Label>Tipo</Label>
                              <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                              </Select.Trigger>
                              <Select.Popover>
                                <ListBox>
                                  {TIPO_OT_OPTIONS.map((option) => (
                                    <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                                      {option.label}
                                      <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                  ))}
                                </ListBox>
                              </Select.Popover>
                            </Select>
                          )}
                        />

                        <Controller
                          control={control}
                          name="origen"
                          render={({ field }) => (
                            <Select
                              fullWidth
                              isInvalid={!!errors.origen}
                              name={field.name}
                              value={field.value}
                              onChange={(value) => {
                                if (value) field.onChange(value);
                              }}
                            >
                              <Label>Origen</Label>
                              <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                              </Select.Trigger>
                              <Select.Popover>
                                <ListBox>
                                  {ORIGEN_OT_OPTIONS.map((option) => (
                                    <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                                      {option.label}
                                      <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                  ))}
                                </ListBox>
                              </Select.Popover>
                            </Select>
                          )}
                        />
                      </div>

                      <Controller
                        control={control}
                        name="origenDetalle"
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            isInvalid={!!errors.origenDetalle}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            value={field.value}
                          >
                            <Label>Detalle del origen (opcional)</Label>
                            <Input placeholder="Ej. nombre de quien reportó el hallazgo" />
                            {errors.origenDetalle ? (
                              <FieldError>{errors.origenDetalle.message}</FieldError>
                            ) : null}
                          </TextField>
                        )}
                      />

                      <Controller
                        control={control}
                        name="asignadoAId"
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            isInvalid={!!errors.asignadoAId}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            value={field.value}
                          >
                            <Label>Asignado a (opcional)</Label>
                            {/* TODO: reemplazar por selector real de usuarios (rol MANTENEDOR) — no hay
                                endpoint público de usuarios para roles no-admin todavía */}
                            <Input placeholder="ID del usuario mantenedor" />
                            {errors.asignadoAId ? <FieldError>{errors.asignadoAId.message}</FieldError> : null}
                          </TextField>
                        )}
                      />
                    </form>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="secondary" onPress={close}>
                      Cancelar
                    </Button>
                    <Button form="create-orden-form" isPending={crearOrden.isPending} type="submit">
                      {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Crear orden')}
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

/** Tarjeta de una OT: chips de prioridad/estado, metadata, cambio de estado y checklist. */
function OrdenCard({ orden }: { orden: OrdenTrabajo }) {
  const actualizarOrden = useActualizarOrden();
  const toggleTarea = useToggleTarea();
  const tareasHechas = orden.tareas.filter((tarea) => tarea.hecha).length;
  const tareasOrdenadas = [...orden.tareas].sort((a, b) => a.posicion - b.posicion);

  return (
    <Card>
      <Card.Header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Card.Description className="font-mono text-xs text-muted">{orden.equipoId}</Card.Description>
            <Card.Title className="font-display text-lg font-semibold text-foreground">
              {orden.titulo}
            </Card.Title>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip color={prioridadOTChipColor(orden.prioridad)} size="sm" variant="soft">
              {PRIORIDAD_OT_LABELS[orden.prioridad]}
            </Chip>
            <Chip color={estadoOTChipColor(orden.estado)} size="sm" variant="soft">
              {ESTADO_OT_LABELS[orden.estado]}
            </Chip>
          </div>
        </div>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 text-sm text-foreground sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
              Tipo
            </span>
            {TIPO_OT_LABELS[orden.tipo]}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
              Origen
            </span>
            {ORIGEN_OT_LABELS[orden.origen]}
            {orden.origenDetalle ? ` · ${orden.origenDetalle}` : ''}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
              Asignado a
            </span>
            {orden.asignadoA?.nombre ?? 'Sin asignar'}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
              Actualizada
            </span>
            {formatFecha(orden.updatedAt)}
          </div>
        </div>

        <Select
          className="max-w-64"
          isDisabled={actualizarOrden.isPending}
          value={orden.estado}
          onChange={(value) => {
            if (value && value !== orden.estado) {
              actualizarOrden.mutate({ id: orden.id, input: { estado: value as EstadoOT } });
            }
          }}
        >
          <Label>Cambiar estado</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {ESTADO_OT_OPTIONS.map((option) => (
                <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                  {option.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        {tareasOrdenadas.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
              Tareas ({tareasHechas}/{tareasOrdenadas.length})
            </span>
            <div className="flex flex-col gap-1.5">
              {tareasOrdenadas.map((tarea) => (
                <Checkbox
                  key={tarea.id}
                  isSelected={tarea.hecha}
                  onChange={(hecha) => {
                    toggleTarea.mutate({ ordenId: orden.id, tareaId: tarea.id, hecha });
                  }}
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <span className={tarea.hecha ? 'text-sm text-muted line-through' : 'text-sm text-foreground'}>
                      {tarea.texto}
                    </span>
                  </Checkbox.Content>
                </Checkbox>
              ))}
            </div>
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
}

/**
 * Sub-vista "Órdenes" del dominio Mantenimiento: bandeja de OT con stat
 * chips, filtro por estado y checklist de tareas. Consume `useOrdenes` +
 * `useActualizarOrden`/`useToggleTarea` — sin try/catch ni toasts acá (viven
 * en los hooks).
 */
export function OrdenesTrabajoView() {
  const { role } = useCurrentUser();
  const [filtro, setFiltro] = useState<FiltroEstado>('TODAS');
  const { data: ordenes, isPending, isError, error } = useOrdenes(filtro === 'TODAS' ? undefined : filtro);

  const stats = useMemo(() => {
    const lista = ordenes ?? [];
    return {
      abiertas: lista.filter((orden) => orden.estado === 'PENDIENTE' || orden.estado === 'ASIGNADA').length,
      enProceso: lista.filter((orden) => orden.estado === 'EN_PROCESO').length,
      cerradas: lista.filter((orden) => orden.estado === 'COMPLETADA' || orden.estado === 'CANCELADA').length,
    };
  }, [ordenes]);

  const puedeCrear = role === ROLES.ADMIN || role === ROLES.SUPERVISOR;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground">
            Órdenes de trabajo
          </h2>
          <p className="text-sm text-muted">Bandeja de OT correctivas y preventivas.</p>
        </div>
        {puedeCrear ? <CreateOrdenModal /> : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <Card.Header>
            <Card.Description className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
              Abiertas
            </Card.Description>
            <Card.Title className="font-display text-2xl font-semibold text-foreground">
              {stats.abiertas}
            </Card.Title>
          </Card.Header>
        </Card>
        <Card>
          <Card.Header>
            <Card.Description className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
              En proceso
            </Card.Description>
            <Card.Title className="font-display text-2xl font-semibold text-foreground">
              {stats.enProceso}
            </Card.Title>
          </Card.Header>
        </Card>
        <Card>
          <Card.Header>
            <Card.Description className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
              Cerradas
            </Card.Description>
            <Card.Title className="font-display text-2xl font-semibold text-foreground">
              {stats.cerradas}
            </Card.Title>
          </Card.Header>
        </Card>
      </div>

      <ToggleButtonGroup
        aria-label="Filtrar por estado"
        disallowEmptySelection
        selectedKeys={new Set([filtro])}
        onSelectionChange={(keys) => {
          const key = [...keys][0];
          if (typeof key === 'string') setFiltro(key as FiltroEstado);
        }}
      >
        <ToggleButton id="TODAS">Todas</ToggleButton>
        {ESTADO_OT_OPTIONS.map((option) => (
          <ToggleButton key={option.value} id={option.value}>
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner color="accent" size="lg" />
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground" role="alert">
          {error instanceof Error ? error.message : 'No se pudo cargar la lista de órdenes.'}
        </div>
      ) : null}

      {!isPending && !isError && ordenes && ordenes.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">No hay órdenes de trabajo para este filtro</p>
          <p className="text-sm text-muted">Crea una nueva con el botón "Crear orden".</p>
        </div>
      ) : null}

      {!isPending && !isError && ordenes && ordenes.length > 0 ? (
        <div className="flex flex-col gap-3">
          {ordenes.map((orden) => (
            <OrdenCard key={orden.id} orden={orden} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
