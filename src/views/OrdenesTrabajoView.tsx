import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import {
  Button,
  Card,
  Chip,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  TextField,
} from '@heroui/react';
import { Clock, TriangleAlert } from 'lucide-react';

import { MarcaPendiente } from '../components/sync/MarcaPendiente';
import { PendientesStrip } from '../components/sync/PendientesStrip';
import { usePendingWrites } from '../hooks/usePendingWrites';
import { usePermissions } from '../hooks/usePermissions';
import { useCrearOrden, useOrdenes } from '../hooks/useOrdenes';
import { useEquipment } from '../hooks/useEquipment';
import { useHallazgosList } from '../hooks/useHallazgos';
import { RECURSOS_DE_ORDENES } from '../lib/pending-resources';
import {
  ORIGEN_OT_LABELS,
  ORIGEN_OT_OPTIONS,
  PRIORIDAD_OT_LABELS,
  PRIORIDAD_OT_OPTIONS,
  TIPO_OT_LABELS,
  TIPO_OT_OPTIONS,
  prioridadOTChipColor,
} from '../config/mantenimiento-colors';
import {
  CreateOrdenSchema,
  ORIGEN_OT,
  PRIORIDAD_OT,
  TIPO_OT,
  type CreateOrdenInput,
  type OrdenTrabajo,
} from '../types/mantenimiento';
import type { Hallazgo } from '../types/hallazgos';
import {
  buildWorkshopStats,
  equipmentLabel,
  formatDate,
  groupWorkshopBoard,
  toPrioridadOT,
  type EquipmentRef,
} from '../components/mantenimiento/workshop';
import { StartFromHallazgoModal } from '../components/mantenimiento/StartFromHallazgoModal';
import { StartOperationModal } from '../components/mantenimiento/StartOperationModal';
import { FinishTaskModal } from '../components/mantenimiento/FinishTaskModal';
import { ViewOperationModal } from '../components/mantenimiento/ViewOperationModal';

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
      <Button variant="secondary">Crear orden</Button>
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

/** KPI card — mismo patrón que `Contador`/`KpiCard` (Dashboard, Flota). */
function StatCard({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warning' }) {
  const toneClass =
    tone === 'success'
      ? 'text-success-soft-foreground'
      : tone === 'warning'
        ? 'text-warning-soft-foreground'
        : 'text-foreground';
  return (
    <Card>
      <Card.Header>
        <Card.Description className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
          {label}
        </Card.Description>
        <Card.Title className={`font-display text-[26px] font-semibold tracking-[-0.02em] ${toneClass}`}>
          {value}
        </Card.Title>
      </Card.Header>
    </Card>
  );
}

/** Columna del tablero: chip de cabecera + conteo + tarjetas. */
function BoardColumn({
  title,
  color,
  count,
  children,
}: {
  title: string;
  color: 'default' | 'warning' | 'success';
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col">
      <div className="mb-3 flex items-center gap-2">
        <Chip color={color} size="sm" variant="soft">
          {title}
        </Chip>
        <span className="ms-auto text-xs font-semibold text-muted-foreground">{count}</span>
      </div>
      <div className="flex flex-col gap-3.5">{children}</div>
    </section>
  );
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 text-sm text-foreground">
      <span className="text-[10px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Línea "Hallazgo: …" de una OT originada en un hallazgo. */
function HallazgoAssoc({ orden }: { orden: OrdenTrabajo }) {
  if (orden.origen !== 'HALLAZGO' || !orden.origenDetalle) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
      <TriangleAlert className="size-3.5 shrink-0" />
      Hallazgo: {orden.origenDetalle}
    </div>
  );
}

function BoardCard({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <article
      className={`flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm ${
        muted ? 'opacity-90' : ''
      }`}
    >
      {children}
    </article>
  );
}

/** Chip que diferencia el ORIGEN de lo que espera en la bandeja: hallazgo
 * del supervisor (rojo) vs mantención preventiva del administrador (azul). */
function FindingChip() {
  return (
    <Chip color="danger" size="sm" variant="soft">
      <TriangleAlert className="size-3" />
      Hallazgo
    </Chip>
  );
}

function PreventiveChip() {
  return (
    <Chip color="accent" size="sm" variant="soft">
      <Clock className="size-3" />
      Preventiva
    </Chip>
  );
}

/** Tarjeta de un hallazgo REAL de Terreno esperando que el taller lo tome. */
function FindingCard({
  hallazgo,
  fleet,
  canStart,
}: {
  hallazgo: Hallazgo;
  fleet: readonly EquipmentRef[] | undefined;
  canStart: boolean;
}) {
  const prioridad = toPrioridadOT(hallazgo.prioridad);
  const resolved = equipmentLabel(hallazgo.equipoId, fleet);
  const equipo =
    resolved === hallazgo.equipoId ? (hallazgo.equipo?.internalCode ?? resolved) : resolved;

  return (
    <BoardCard>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">{equipo}</span>
        <div className="flex gap-1.5">
          <FindingChip />
          <Chip color={prioridadOTChipColor(prioridad)} size="sm" variant="soft">
            {PRIORIDAD_OT_LABELS[prioridad]}
          </Chip>
        </div>
      </div>
      <span className="text-[15px] font-semibold tracking-[-0.01em]">{hallazgo.descripcion}</span>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <MetaItem label="Reportado">{formatDate(hallazgo.fecha)}</MetaItem>
        <MetaItem label="Origen">Terreno · Supervisor</MetaItem>
      </div>
      {canStart ? <StartFromHallazgoModal equipment={fleet} hallazgo={hallazgo} /> : null}
    </BoardCard>
  );
}

/**
 * Sub-vista "Órdenes" del taller (diseño Mantenedor Taller): los hallazgos
 * reportados llegan como OT PENDIENTE/ASIGNADA a la bandeja, "Iniciar
 * operación" las pasa a EN_PROCESO y "Finalizar tarea" registra la bitácora
 * de cierre y las completa. Sin try/catch ni toasts acá — viven en los hooks.
 */
export function OrdenesTrabajoView() {
  const { can } = usePermissions();
  const { data: ordenes, isPending, isError, error } = useOrdenes();
  const { data: hallazgos } = useHallazgosList();
  const { data: equipment } = useEquipment();
  const pendientes = usePendingWrites(RECURSOS_DE_ORDENES);

  const board = useMemo(() => groupWorkshopBoard(ordenes ?? []), [ordenes]);
  const stats = useMemo(() => buildWorkshopStats(ordenes ?? []), [ordenes]);
  // Los hallazgos ABIERTOS del supervisor esperan acá; al iniciar la operación
  // pasan a EN_PROCESO (lo hace el backend en la misma transacción) y su lugar
  // en el tablero lo toma la OT ligada.
  const openFindings = useMemo(
    () => (hallazgos ?? []).filter((hallazgo) => hallazgo.estado === 'ABIERTO'),
    [hallazgos],
  );

  // Espejo de los `@Roles` del backend vía `lib/permissions`: el cierre de la
  // tarea (POST de intervención) es exclusivo del MANTENEDOR.
  const canCreate = can('orden.create');
  const canStart = can('orden.update');
  const canFinish = can('intervencion.create');
  const fleet: readonly EquipmentRef[] | undefined = equipment;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground">
            Taller — Hallazgos y operaciones
          </h2>
          <p className="text-sm text-muted-foreground">
            Los hallazgos reportados llegan a tu bandeja. Al iniciar una operación el hallazgo pasa
            a "en proceso".
          </p>
        </div>
        {canCreate ? <CreateOrdenModal /> : null}
      </div>

      <PendientesStrip recursos={RECURSOS_DE_ORDENES} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Hallazgos pendientes" value={openFindings.length} />
        <StatCard label="En proceso" tone="warning" value={stats.inProgress} />
        <StatCard label="Finalizadas hoy" tone="success" value={stats.finishedToday} />
        <StatCard label="Total asignadas" value={stats.total} />
      </div>

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

      {!isPending && !isError && (ordenes?.length ?? 0) + openFindings.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">No hay nada en el tablero</p>
          <p className="text-sm text-muted-foreground">
            Los hallazgos reportados y las mantenciones preventivas asignadas aparecen acá.
          </p>
        </div>
      ) : null}

      {!isPending && !isError && (ordenes?.length ?? 0) + openFindings.length > 0 ? (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <BoardColumn
            color="default"
            count={openFindings.length + board.backlog.length}
            title="Órdenes"
          >
            {openFindings.map((hallazgo) => (
              <FindingCard
                key={hallazgo.id}
                canStart={can('orden.create')}
                fleet={fleet}
                hallazgo={hallazgo}
              />
            ))}
            {board.backlog.map((orden) => (
              <BoardCard key={orden.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {equipmentLabel(orden.equipoId, fleet)}
                  </span>
                  <div className="flex gap-1.5">
                    {orden.tipo === 'PREVENTIVA' ? (
                      <PreventiveChip />
                    ) : orden.origen === 'HALLAZGO' ? (
                      <FindingChip />
                    ) : null}
                    <Chip color={prioridadOTChipColor(orden.prioridad)} size="sm" variant="soft">
                      {PRIORIDAD_OT_LABELS[orden.prioridad]}
                    </Chip>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold tracking-[-0.01em]">{orden.titulo}</span>
                  <MarcaPendiente marca={pendientes.marcaDe('orden', orden.id)} />
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <MetaItem label="Reportado por">
                    {orden.origenDetalle ?? ORIGEN_OT_LABELS[orden.origen]}
                  </MetaItem>
                  <MetaItem label="Fecha">{formatDate(orden.createdAt)}</MetaItem>
                </div>
                {canStart ? <StartOperationModal equipment={fleet} orden={orden} /> : null}
              </BoardCard>
            ))}
          </BoardColumn>

          <BoardColumn color="warning" count={board.inProgress.length} title="Operaciones en proceso">
            {board.inProgress.map((orden) => (
              <BoardCard key={orden.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {equipmentLabel(orden.equipoId, fleet)}
                  </span>
                  <Chip size="sm" variant="secondary">
                    {TIPO_OT_LABELS[orden.tipo]}
                  </Chip>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold tracking-[-0.01em]">{orden.titulo}</span>
                  <MarcaPendiente marca={pendientes.marcaDe('orden', orden.id)} />
                </div>
                <HallazgoAssoc orden={orden} />
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <MetaItem label="Iniciada">{formatDate(orden.updatedAt)}</MetaItem>
                  <MetaItem label="Asignado">{orden.asignadoA?.nombre ?? '—'}</MetaItem>
                </div>
                {canFinish ? <FinishTaskModal equipment={fleet} orden={orden} /> : null}
              </BoardCard>
            ))}
          </BoardColumn>

          <BoardColumn color="success" count={board.finished.length} title="Finalizadas">
            {board.finished.map((orden) => (
              <BoardCard key={orden.id} muted>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {equipmentLabel(orden.equipoId, fleet)}
                  </span>
                  <div className="flex gap-1.5">
                    {orden.estado === 'CANCELADA' ? (
                      <Chip color="danger" size="sm" variant="soft">
                        Cancelada
                      </Chip>
                    ) : null}
                    <Chip size="sm" variant="secondary">
                      {TIPO_OT_LABELS[orden.tipo]}
                    </Chip>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold tracking-[-0.01em]">{orden.titulo}</span>
                  <MarcaPendiente marca={pendientes.marcaDe('orden', orden.id)} />
                </div>
                <HallazgoAssoc orden={orden} />
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <MetaItem label={orden.estado === 'CANCELADA' ? 'Cancelada' : 'Finalizada'}>
                    {formatDate(orden.updatedAt)}
                  </MetaItem>
                  <MetaItem label="Asignado">{orden.asignadoA?.nombre ?? '—'}</MetaItem>
                </div>
                <ViewOperationModal equipment={fleet} orden={orden} />
              </BoardCard>
            ))}
          </BoardColumn>
        </div>
      ) : null}
    </div>
  );
}
