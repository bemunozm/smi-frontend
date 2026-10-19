import { useMemo, useState } from 'react';
import { Spinner } from '@heroui/react';
import { ArrowRight, Clock, TriangleAlert } from 'lucide-react';

// El taller se dibuja con el kit de Terreno: mismos chips/tarjetas/cifras
// táctiles que usa la tablet en terreno (y sin el bug de slots de HeroUI).
import { Boton, Chip, Segmentado, Tarjeta } from '../components/terreno/ui';
import { MarcaPendiente } from '../components/sync/MarcaPendiente';
import { PendientesStrip } from '../components/sync/PendientesStrip';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { usePendingWrites } from '../hooks/usePendingWrites';
import { usePermissions } from '../hooks/usePermissions';
import { useActualizarOrden, useOrdenes } from '../hooks/useOrdenes';
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
import { PreventiveChecklistModal, tareasHechas } from '../components/mantenimiento/PreventiveChecklistModal';
import { ViewOperationModal } from '../components/mantenimiento/ViewOperationModal';

/** Columna del tablero: chip de cabecera + conteo + tarjetas. */
function BoardColumn({
  title,
  color,
  count,
  conCabecera = true,
  vacio,
  children,
}: {
  title: string;
  color: 'neutral' | 'warning' | 'success';
  count: number;
  /** En tablet la cabecera la reemplaza el selector de columnas. */
  conCabecera?: boolean;
  /** Qué decir si la columna no tiene tarjetas. */
  vacio: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col">
      {conCabecera && (
        <div className="mb-3 flex items-center gap-2">
          <Chip tono={color}>{title}</Chip>
          <span className="tabular ms-auto text-[15px] font-bold text-foreground">{count}</span>
        </div>
      )}
      <div className="flex flex-col gap-3.5">
        {count === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[15px] text-[var(--label-color)]">
            {vacio}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/**
 * El resumen de arriba, en grande: el mantenedor lo lee de pie, con la tablet
 * en la mano. Etiquetas en minúscula (las mayúsculas chicas cuestan leerlas) y
 * números de 26 px; en pantallas angostas va en 2 × 2.
 */
function ResumenTaller({ items }: { items: { label: string; valor: number; destacado?: boolean }[] }) {
  return (
    <dl className="m-0 grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-card sm:grid-cols-4">
      {items.map((i, n) => (
        <div
          key={i.label}
          className={`flex flex-col gap-0.5 px-4 py-3 ${n % 2 === 1 ? 'border-l border-border' : ''} ${
            n >= 2 ? 'border-t border-border sm:border-t-0' : ''
          } ${n === 2 ? 'sm:border-l' : ''}`}
        >
          <dt className="text-[13.5px] leading-tight font-semibold text-[var(--label-color)]">{i.label}</dt>
          <dd
            className={`tabular m-0 text-[26px] leading-tight font-bold ${i.destacado ? 'text-[#0f2a7a]' : 'text-foreground'}`}
          >
            {i.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Línea "Hallazgo: …" de una OT originada en un hallazgo. */
function HallazgoAssoc({ orden }: { orden: OrdenTrabajo }) {
  if (orden.origen !== 'HALLAZGO' || !orden.origenDetalle) return null;
  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-[14px] leading-snug text-[var(--label-color)]">
      <TriangleAlert className="size-4 shrink-0" />
      Hallazgo: {orden.origenDetalle}
    </div>
  );
}

function BoardCard({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <Tarjeta className={`min-w-0 gap-3 ${muted ? 'bg-[#fafbfc]' : ''}`}>{children}</Tarjeta>;
}

/** Qué es la orden: la línea más importante después del equipo. */
function TituloOrden({ children }: { children: React.ReactNode }) {
  return <span className="text-[17px] leading-snug font-semibold tracking-[-0.01em] text-foreground">{children}</span>;
}

/** Tipo de operación con el chip del kit: preventiva azul, correctiva neutra. */
function TipoChip({ tipo }: { tipo: OrdenTrabajo['tipo'] }) {
  return tipo === 'PREVENTIVA' ? <PreventiveChip /> : <Chip tono="neutral">Correctiva</Chip>;
}

/**
 * Orden preventiva nacida de la pauta por horómetro/km: su tarjeta es un
 * CHECKLIST (las operaciones del hito como tareas), no el flujo iniciar →
 * finalizar de las correctivas.
 */
function esChecklistPauta(orden: OrdenTrabajo): boolean {
  return orden.origen === 'PREVENTIVO' && orden.tareas.length > 0;
}

/**
 * Iniciar la mantención preventiva: solo pasa la orden a EN_PROCESO — sin
 * modal, porque el título viene fijo de la pauta y el trabajo real (el
 * checklist) se registra en la columna "en proceso".
 */
function IniciarMantencion({ orden }: { orden: OrdenTrabajo }) {
  const actualizar = useActualizarOrden();
  return (
    <Boton
      ancho
      disabled={actualizar.isPending}
      type="button"
      variante="acento"
      onClick={() => actualizar.mutate({ orden, input: { estado: 'EN_PROCESO' } })}
    >
      <ArrowRight className="h-5 w-5" />
      Iniciar operación
    </Boton>
  );
}

/** «1 de 3 tareas» — el avance del checklist en la tarjeta del tablero. */
function TareasChip({ orden }: { orden: OrdenTrabajo }) {
  const { hechas, total } = tareasHechas(orden);
  return (
    <Chip tono={hechas === total ? 'success' : hechas > 0 ? 'warning' : 'neutral'}>
      {hechas} de {total} tareas
    </Chip>
  );
}

/** Titular de la tarjeta (boceto del taller): el EQUIPO primero y notorio —
 * código tabular en negrita + nombre de Flota en gris, como el Selector de
 * Terreno. */
function EquipoHead({ equipoId, fleet }: { equipoId: string; fleet: readonly EquipmentRef[] | undefined }) {
  const eq = findEquipment(equipoId, fleet);
  return (
    <span className="min-w-0 leading-snug">
      <span className="tabular text-[18px] font-bold text-foreground">{eq?.internalCode ?? equipoId}</span>
      {eq ? (
        <span className="text-[15px] text-[var(--label-color)]">
          {' '}
          · {eq.brand} {eq.model}
        </span>
      ) : null}
    </span>
  );
}

/** Fila de etiquetas, después del hallazgo y antes del origen (boceto). */
function ChipsRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

/** Meta de UNA línea, como las tarjetas del artboard tablet del Mantenedor. */
function CardMeta({ children }: { children: React.ReactNode }) {
  return <span className="text-[14px] leading-snug text-[var(--label-color)]">{children}</span>;
}

/** Chip que diferencia el ORIGEN de lo que espera en la bandeja: hallazgo
 * del supervisor (rojo) vs mantención preventiva del administrador (azul). */
function FindingChip() {
  return (
    <Chip tono="danger">
      <TriangleAlert className="size-3.5" />
      Hallazgo
    </Chip>
  );
}

function PreventiveChip() {
  return (
    <Chip tono="info">
      <Clock className="size-3.5" />
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
      <TituloOrden>{hallazgo.descripcion}</TituloOrden>
      <ChipsRow>
        <FindingChip />
        <Chip tono={chipColorToTono(prioridadOTChipColor(prioridad))}>{PRIORIDAD_OT_LABELS[prioridad]}</Chip>
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
  const { data: hallazgos, isPending: findingsPending, isError: findingsError } = useHallazgosList();
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
    () => (hallazgos ?? []).filter((hallazgo) => hallazgo.estado === 'ABIERTO' && hallazgo.equipoId.trim() !== ''),
    [hallazgos],
  );

  // Espejo de los `@Roles` del backend vía `lib/permissions`: el cierre de la
  // tarea (POST de intervención) es exclusivo del MANTENEDOR.
  const canCreate = can('orden.create');
  const canStart = can('orden.update');
  const canFinish = can('intervencion.create');
  const canTarea = can('orden.toggleTarea');
  const fleet: readonly EquipmentRef[] | undefined = equipment;

  // En tablet las tres columnas quedaban de 250 px: letra chica, nombres
  // cortados y botones partidos en dos líneas. Por debajo de `lg` se ve UNA
  // columna a todo el ancho y se cambia con el selector; desde `lg`, las tres.
  const tresColumnas = useMediaQuery(DESKTOP_QUERY);
  const [columna, setColumna] = useState<'ordenes' | 'proceso' | 'finalizadas'>('ordenes');
  const conteos = {
    ordenes: openFindings.length + board.backlog.length,
    proceso: board.inProgress.length,
    finalizadas: board.finished.length,
  };
  const ver = (c: typeof columna) => tresColumnas || columna === c;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-[24px] leading-tight font-bold tracking-[-0.02em] text-foreground">
            Taller — Hallazgos y operaciones
          </h2>
          <p className="text-[15px] leading-snug text-[var(--label-color)]">
            Los hallazgos reportados llegan a tu bandeja. Al iniciar una operación el hallazgo pasa a "en proceso".
          </p>
        </div>
        {canCreate ? <CreateOperationModal /> : null}
      </div>

      <PendientesStrip recursos={RECURSOS_DE_ORDENES} />

      <ResumenTaller
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

      {!isPending &&
      !findingsPending &&
      !isError &&
      !findingsError &&
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
        <div className="flex flex-col gap-3.5">
          {!tresColumnas && (
            <Segmentado
              etiqueta="Columna del tablero"
              opciones={[
                { valor: 'ordenes', label: 'Órdenes', sub: String(conteos.ordenes) },
                { valor: 'proceso', label: 'En proceso', sub: String(conteos.proceso) },
                { valor: 'finalizadas', label: 'Finalizadas', sub: String(conteos.finalizadas) },
              ]}
              valor={columna}
              onChange={setColumna}
            />
          )}
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {ver('ordenes') && (
              <BoardColumn
                color="neutral"
                conCabecera={tresColumnas}
                count={conteos.ordenes}
                title="Órdenes"
                vacio="No hay hallazgos ni órdenes esperando."
              >
                {openFindings.map((hallazgo) => (
                  <FindingCard key={hallazgo.id} canStart={can('orden.create')} fleet={fleet} hallazgo={hallazgo} />
                ))}
                {board.backlog.map((orden) => (
                  <BoardCard key={orden.id}>
                    <EquipoHead equipoId={orden.equipoId} fleet={fleet} />
                    <div className="flex items-start gap-2">
                      <TituloOrden>{orden.titulo}</TituloOrden>
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
                      {esChecklistPauta(orden) ? <TareasChip orden={orden} /> : null}
                    </ChipsRow>
                    <CardMeta>
                      {orden.origenDetalle ?? ORIGEN_OT_LABELS[orden.origen]} — {formatDate(orden.createdAt)}
                    </CardMeta>
                    {esChecklistPauta(orden) ? (
                      canStart ? (
                        <IniciarMantencion orden={orden} />
                      ) : null
                    ) : canStart ? (
                      <StartOperationModal equipment={fleet} orden={orden} />
                    ) : null}
                  </BoardCard>
                ))}
              </BoardColumn>
            )}

            {ver('proceso') && (
              <BoardColumn
                color="warning"
                conCabecera={tresColumnas}
                count={conteos.proceso}
                title="Operaciones en proceso"
                vacio="No hay operaciones en proceso."
              >
                {board.inProgress.map((orden) => (
                  <BoardCard key={orden.id}>
                    <EquipoHead equipoId={orden.equipoId} fleet={fleet} />
                    <div className="flex items-start gap-2">
                      <TituloOrden>{orden.titulo}</TituloOrden>
                      <MarcaPendiente marca={pendientes.marcaDe('orden', orden.id)} />
                    </div>
                    <HallazgoAssoc orden={orden} />
                    <ChipsRow>
                      <TipoChip tipo={orden.tipo} />
                      {esChecklistPauta(orden) ? <TareasChip orden={orden} /> : null}
                    </ChipsRow>
                    <CardMeta>
                      Iniciada {formatDate(orden.updatedAt)} · {orden.asignadoA?.nombre ?? 'Sin asignar'}
                    </CardMeta>
                    {/* Con una escritura de esta OT aún sin sincronizar, el botón
                    se retira: un segundo "Guardar y finalizar" generaría OTRA
                    intervención con OTRO id — y ahora eso descuenta stock real
                    dos veces. */}
                    {pendientes.marcaDe('orden', orden.id) ? (
                      <span className="text-[14px] font-medium text-[var(--label-color)]">
                        Sincronizando cambios de esta operación…
                      </span>
                    ) : esChecklistPauta(orden) ? (
                      canTarea ? (
                        <PreventiveChecklistModal equipment={fleet} orden={orden} />
                      ) : null
                    ) : canFinish ? (
                      <FinishTaskModal equipment={fleet} orden={orden} />
                    ) : null}
                  </BoardCard>
                ))}
              </BoardColumn>
            )}

            {ver('finalizadas') && (
              <BoardColumn
                color="success"
                conCabecera={tresColumnas}
                count={conteos.finalizadas}
                title="Finalizadas"
                vacio="Todavía no hay operaciones finalizadas."
              >
                {board.finished.map((orden) => (
                  <BoardCard key={orden.id} muted>
                    <EquipoHead equipoId={orden.equipoId} fleet={fleet} />
                    <div className="flex items-start gap-2">
                      <TituloOrden>{orden.titulo}</TituloOrden>
                      <MarcaPendiente marca={pendientes.marcaDe('orden', orden.id)} />
                    </div>
                    <HallazgoAssoc orden={orden} />
                    <ChipsRow>
                      {orden.estado === 'CANCELADA' ? <Chip tono="danger">Cancelada</Chip> : null}
                      <TipoChip tipo={orden.tipo} />
                    </ChipsRow>
                    <CardMeta>
                      {orden.estado === 'CANCELADA' ? 'Cancelada' : 'Finalizada'} {formatDate(orden.updatedAt)} ·{' '}
                      {orden.asignadoA?.nombre ?? 'Sin asignar'}
                    </CardMeta>
                    {esChecklistPauta(orden) ? (
                      <PreventiveChecklistModal equipment={fleet} orden={orden} soloLectura />
                    ) : (
                      <ViewOperationModal equipment={fleet} orden={orden} />
                    )}
                  </BoardCard>
                ))}
              </BoardColumn>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
