import { useMemo } from 'react';
import { Spinner } from '@heroui/react';
import { Clock, TriangleAlert } from 'lucide-react';

// El taller se dibuja con el kit de Terreno: mismos chips/tarjetas/cifras
// táctiles que usa la tablet en terreno (y sin el bug de slots de HeroUI).
import { Chip, Cifras, Tarjeta } from '../components/terreno/ui';
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
  chipColorToTono,
  prioridadOTChipColor,
} from '../config/mantenimiento-colors';
import type { OrdenTrabajo } from '../types/mantenimiento';
import type { Hallazgo } from '../types/hallazgos';
import {
  buildWorkshopStats,
  formatDate,
  findEquipment,
  groupWorkshopBoard,
  toPrioridadOT,
  type EquipmentRef,
} from '../components/mantenimiento/workshop';
import { CreateOperationModal } from '../components/mantenimiento/CreateOperationModal';
import { StartFromHallazgoModal } from '../components/mantenimiento/StartFromHallazgoModal';
import { StartOperationModal } from '../components/mantenimiento/StartOperationModal';
import { FinishTaskModal } from '../components/mantenimiento/FinishTaskModal';
import { ViewOperationModal } from '../components/mantenimiento/ViewOperationModal';

/** Columna del tablero: chip de cabecera + conteo + tarjetas. */
function BoardColumn({
  title,
  color,
  count,
  children,
}: {
  title: string;
  color: 'neutral' | 'warning' | 'success';
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col">
      <div className="mb-3 flex items-center gap-2">
        <Chip tono={color}>{title}</Chip>
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
  return <Tarjeta className={`min-w-0 gap-2.5 ${muted ? 'opacity-90' : ''}`}>{children}</Tarjeta>;
}

/** Tipo de operación con el chip del kit: preventiva azul, correctiva neutra. */
function TipoChip({ tipo }: { tipo: OrdenTrabajo['tipo'] }) {
  return tipo === 'PREVENTIVA' ? <PreventiveChip /> : <Chip tono="neutral">Correctiva</Chip>;
}

/** Titular de la tarjeta (boceto del taller): el EQUIPO primero y notorio —
 * código tabular en negrita + nombre de Flota en gris, como el Selector de
 * Terreno. */
function EquipoHead({
  equipoId,
  fleet,
}: {
  equipoId: string;
  fleet: readonly EquipmentRef[] | undefined;
}) {
  const eq = findEquipment(equipoId, fleet);
  return (
    <span className="min-w-0 truncate leading-tight">
      <span className="tabular text-[15.5px] font-bold">{eq?.internalCode ?? equipoId}</span>
      {eq ? (
        <span className="text-[14.5px] text-muted-foreground"> · {eq.brand} {eq.model}</span>
      ) : null}
    </span>
  );
}

/** Fila de etiquetas, después del hallazgo y antes del origen (boceto). */
function ChipsRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

/** Meta de UNA línea, como las tarjetas del artboard tablet del Mantenedor. */
function CardMeta({ children }: { children: React.ReactNode }) {
  return <span className="text-xs leading-5 text-muted-foreground">{children}</span>;
}

/** Chip que diferencia el ORIGEN de lo que espera en la bandeja: hallazgo
 * del supervisor (rojo) vs mantención preventiva del administrador (azul). */
function FindingChip() {
  return (
    <Chip tono="danger">
      <TriangleAlert className="size-3" />
      Hallazgo
    </Chip>
  );
}

function PreventiveChip() {
  return (
    <Chip tono="info">
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

  return (
    <BoardCard>
      <EquipoHead equipoId={hallazgo.equipoId} fleet={fleet} />
      <span className="text-[15px] font-semibold tracking-[-0.01em]">{hallazgo.descripcion}</span>
      <ChipsRow>
        <FindingChip />
        <Chip tono={chipColorToTono(prioridadOTChipColor(prioridad))}>
          {PRIORIDAD_OT_LABELS[prioridad]}
        </Chip>
      </ChipsRow>
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

      <Cifras
        items={[
          { label: 'Hallazgos pendientes', valor: openFindings.length },
          { label: 'En proceso', valor: stats.inProgress },
          { label: 'Finalizadas hoy', valor: stats.finishedToday, destacado: true },
          { label: 'Total asignadas', valor: stats.total },
        ]}
      />

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
            color="neutral"
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
                <EquipoHead equipoId={orden.equipoId} fleet={fleet} />
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold tracking-[-0.01em]">{orden.titulo}</span>
                  <MarcaPendiente marca={pendientes.marcaDe('orden', orden.id)} />
                </div>
                <ChipsRow>
                  {orden.tipo === 'PREVENTIVA' ? (
                    <PreventiveChip />
                  ) : orden.origen === 'HALLAZGO' ? (
                    <FindingChip />
                  ) : null}
                  <Chip tono={chipColorToTono(prioridadOTChipColor(orden.prioridad))}>
                    {PRIORIDAD_OT_LABELS[orden.prioridad]}
                  </Chip>
                </ChipsRow>
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
                <EquipoHead equipoId={orden.equipoId} fleet={fleet} />
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold tracking-[-0.01em]">{orden.titulo}</span>
                  <MarcaPendiente marca={pendientes.marcaDe('orden', orden.id)} />
                </div>
                <HallazgoAssoc orden={orden} />
                <ChipsRow>
                  <TipoChip tipo={orden.tipo} />
                </ChipsRow>
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
                <EquipoHead equipoId={orden.equipoId} fleet={fleet} />
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold tracking-[-0.01em]">{orden.titulo}</span>
                  <MarcaPendiente marca={pendientes.marcaDe('orden', orden.id)} />
                </div>
                <HallazgoAssoc orden={orden} />
                <ChipsRow>
                  {orden.estado === 'CANCELADA' ? <Chip tono="danger">Cancelada</Chip> : null}
                  <TipoChip tipo={orden.tipo} />
                </ChipsRow>
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
