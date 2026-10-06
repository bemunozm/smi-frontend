import { useMemo } from 'react';
import { Card, Spinner } from '@heroui/react';
import { Clock, TriangleAlert } from 'lucide-react';

// StatusChip y no <Chip> de HeroUI: su slot API comparte estado entre
// instancias (bug documentado en StatusChip.tsx) y los colores se pisan.
import { StatusChip } from '../components/flota/StatusChip';
import { MarcaPendiente } from '../components/sync/MarcaPendiente';
import { PendientesStrip } from '../components/sync/PendientesStrip';
import { usePendingWrites } from '../hooks/usePendingWrites';
import { usePermissions } from '../hooks/usePermissions';
import { useOrdenes } from '../hooks/useOrdenes';
import { useEquipment } from '../hooks/useEquipment';
import { useHallazgosList } from '../hooks/useHallazgos';
import { RECURSOS_DE_ORDENES } from '../lib/pending-resources';
import {
  ORIGEN_OT_LABELS,
  PRIORIDAD_OT_LABELS,
  TIPO_OT_LABELS,
  prioridadOTChipColor,
} from '../config/mantenimiento-colors';
import type { OrdenTrabajo } from '../types/mantenimiento';
import type { Hallazgo } from '../types/hallazgos';
import {
  buildWorkshopStats,
  equipmentLabel,
  formatDate,
  groupWorkshopBoard,
  toPrioridadOT,
  type EquipmentRef,
} from '../components/mantenimiento/workshop';
import { CreateOperationModal } from '../components/mantenimiento/CreateOperationModal';
import { StartFromHallazgoModal } from '../components/mantenimiento/StartFromHallazgoModal';
import { StartOperationModal } from '../components/mantenimiento/StartOperationModal';
import { FinishTaskModal } from '../components/mantenimiento/FinishTaskModal';
import { ViewOperationModal } from '../components/mantenimiento/ViewOperationModal';

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
        <StatusChip tone={color}>{title}</StatusChip>
        <span className="ms-auto text-xs font-semibold text-muted-foreground">{count}</span>
      </div>
      <div className="flex flex-col gap-3.5">{children}</div>
    </section>
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
      className={`flex min-w-0 flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5 shadow-sm ${
        muted ? 'opacity-90' : ''
      }`}
    >
      {children}
    </article>
  );
}

/** Fila superior compacta del artboard tablet: código truncado + chips fijos. */
function CardTopRow({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{code}</span>
      <div className="flex shrink-0 gap-1.5">{children}</div>
    </div>
  );
}

/** Meta de UNA línea, como las tarjetas del artboard tablet del Mantenedor. */
function CardMeta({ children }: { children: React.ReactNode }) {
  return <span className="text-xs leading-5 text-muted-foreground">{children}</span>;
}

/** Chip que diferencia el ORIGEN de lo que espera en la bandeja: hallazgo
 * del supervisor (rojo) vs mantención preventiva del administrador (azul). */
function FindingChip() {
  return (
    <StatusChip className="gap-1" tone="danger">
      <TriangleAlert className="size-3" />
      Hallazgo
    </StatusChip>
  );
}

function PreventiveChip() {
  return (
    <StatusChip className="gap-1" tone="accent">
      <Clock className="size-3" />
      Preventiva
    </StatusChip>
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
      <CardTopRow code={equipo}>
        <FindingChip />
        <StatusChip tone={prioridadOTChipColor(prioridad)}>
          {PRIORIDAD_OT_LABELS[prioridad]}
        </StatusChip>
      </CardTopRow>
      <span className="text-[15px] font-semibold tracking-[-0.01em]">{hallazgo.descripcion}</span>
      <CardMeta>Terreno · Supervisor — {formatDate(hallazgo.fecha)}</CardMeta>
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
  const {
    data: hallazgos,
    isPending: findingsPending,
    isError: findingsError,
  } = useHallazgosList();
  const { data: equipment } = useEquipment();
  const pendientes = usePendingWrites(RECURSOS_DE_ORDENES);

  const board = useMemo(() => groupWorkshopBoard(ordenes ?? []), [ordenes]);
  const stats = useMemo(() => buildWorkshopStats(ordenes ?? []), [ordenes]);
  // Los hallazgos ABIERTOS del supervisor esperan acá; al iniciar la operación
  // pasan a EN_PROCESO (lo hace el backend en la misma transacción) y su lugar
  // en el tablero lo toma la OT ligada. Regla del taller: al mantenedor SOLO
  // le llegan hallazgos con un equipo asociado — una operación sin unidad no
  // tiene sobre qué trabajarse ni a qué imputar el consumo.
  const openFindings = useMemo(
    () =>
      (hallazgos ?? []).filter(
        (hallazgo) => hallazgo.estado === 'ABIERTO' && hallazgo.equipoId.trim() !== '',
      ),
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
        {canCreate ? <CreateOperationModal /> : null}
      </div>

      <PendientesStrip recursos={RECURSOS_DE_ORDENES} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatCard label="Hallazgos pendientes" value={openFindings.length} />
        <StatCard label="En proceso" tone="warning" value={stats.inProgress} />
        <StatCard label="Finalizadas hoy" tone="success" value={stats.finishedToday} />
        <StatCard label="Total asignadas" value={stats.total} />
      </div>

      {isPending || (findingsPending && !findingsError) ? (
        <div className="flex justify-center py-16">
          <Spinner color="accent" size="lg" />
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground" role="alert">
          {error instanceof Error ? error.message : 'No se pudo cargar la lista de órdenes.'}
        </div>
      ) : null}

      {/* La bandeja sin sus hallazgos NO puede hacerse pasar por vacía: si la
          carga falla, se dice — las órdenes siguen abajo. */}
      {findingsError ? (
        <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground" role="alert">
          No se pudieron cargar los hallazgos de Terreno — la bandeja puede estar incompleta.
        </div>
      ) : null}

      {!isPending && !findingsPending && !isError && !findingsError &&
      (ordenes?.length ?? 0) + openFindings.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">No hay nada en el tablero</p>
          <p className="text-sm text-muted-foreground">
            Los hallazgos reportados y las mantenciones preventivas asignadas aparecen acá.
          </p>
        </div>
      ) : null}

      {!isPending && !isError && (ordenes?.length ?? 0) + openFindings.length > 0 ? (
        // El tablero se dibuja aunque los hallazgos hayan fallado: esa mitad
        // ya avisó arriba y las órdenes no tienen por qué esconderse.
        // Tablet es el dispositivo principal del taller: las TRES columnas se
        // quedan en pantalla desde md (834px de una tablet vertical incluida).
        <div className="grid items-start gap-3 md:grid-cols-3 lg:gap-4">
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
                <CardTopRow code={equipmentLabel(orden.equipoId, fleet)}>
                  {orden.tipo === 'PREVENTIVA' ? (
                    <PreventiveChip />
                  ) : orden.origen === 'HALLAZGO' ? (
                    <FindingChip />
                  ) : null}
                  <StatusChip tone={prioridadOTChipColor(orden.prioridad)}>
                    {PRIORIDAD_OT_LABELS[orden.prioridad]}
                  </StatusChip>
                </CardTopRow>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold tracking-[-0.01em]">{orden.titulo}</span>
                  <MarcaPendiente marca={pendientes.marcaDe('orden', orden.id)} />
                </div>
                <CardMeta>
                  {orden.origenDetalle ?? ORIGEN_OT_LABELS[orden.origen]} —{' '}
                  {formatDate(orden.createdAt)}
                </CardMeta>
                {canStart ? <StartOperationModal equipment={fleet} orden={orden} /> : null}
              </BoardCard>
            ))}
          </BoardColumn>

          <BoardColumn color="warning" count={board.inProgress.length} title="Operaciones en proceso">
            {board.inProgress.map((orden) => (
              <BoardCard key={orden.id}>
                <CardTopRow code={equipmentLabel(orden.equipoId, fleet)}>
                  <StatusChip tone="secondary">{TIPO_OT_LABELS[orden.tipo]}</StatusChip>
                </CardTopRow>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold tracking-[-0.01em]">{orden.titulo}</span>
                  <MarcaPendiente marca={pendientes.marcaDe('orden', orden.id)} />
                </div>
                <HallazgoAssoc orden={orden} />
                <CardMeta>
                  Iniciada {formatDate(orden.updatedAt)} · {orden.asignadoA?.nombre ?? 'Sin asignar'}
                </CardMeta>
                {/* Con una escritura de esta OT aún sin sincronizar, el botón
                    se retira: un segundo "Guardar y finalizar" generaría OTRA
                    intervención con OTRO id — y ahora eso descuenta stock real
                    dos veces. */}
                {pendientes.marcaDe('orden', orden.id) ? (
                  <span className="text-xs font-medium text-muted-foreground">
                    Sincronizando cambios de esta operación…
                  </span>
                ) : canFinish ? (
                  <FinishTaskModal equipment={fleet} orden={orden} />
                ) : null}
              </BoardCard>
            ))}
          </BoardColumn>

          <BoardColumn color="success" count={board.finished.length} title="Finalizadas">
            {board.finished.map((orden) => (
              <BoardCard key={orden.id} muted>
                <CardTopRow code={equipmentLabel(orden.equipoId, fleet)}>
                  {orden.estado === 'CANCELADA' ? (
                    <StatusChip tone="danger">Cancelada</StatusChip>
                  ) : null}
                  <StatusChip tone="secondary">{TIPO_OT_LABELS[orden.tipo]}</StatusChip>
                </CardTopRow>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold tracking-[-0.01em]">{orden.titulo}</span>
                  <MarcaPendiente marca={pendientes.marcaDe('orden', orden.id)} />
                </div>
                <HallazgoAssoc orden={orden} />
                <CardMeta>
                  {orden.estado === 'CANCELADA' ? 'Cancelada' : 'Finalizada'}{' '}
                  {formatDate(orden.updatedAt)} · {orden.asignadoA?.nombre ?? 'Sin asignar'}
                </CardMeta>
                <ViewOperationModal equipment={fleet} orden={orden} />
              </BoardCard>
            ))}
          </BoardColumn>
        </div>
      ) : null}
    </div>
  );
}
