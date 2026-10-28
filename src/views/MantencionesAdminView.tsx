import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Chip, Modal, Spinner, Table } from '@heroui/react';

import { useEquipment } from '../hooks/useEquipment';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { useIntervenciones } from '../hooks/useIntervenciones';
import { useItems } from '../hooks/useInventory';
import { useOrdenes } from '../hooks/useOrdenes';
import { RESPONSIVE_SHEET_DIALOG_WIDE_CLASS } from '../components/flota/modal-styles';
import { NUM_CL_1 } from '../lib/dashboard-format';
import type { OrdenTrabajo, Tarea } from '../types/mantenimiento';

const TIPOS = ['PREVENTIVA', 'CORRECTIVA'] as const;

const TIPO_LABEL: Record<string, string> = {
  PREVENTIVA: 'Preventiva',
  CORRECTIVA: 'Correctiva',
};

const TIPO_COLOR: Record<string, 'accent' | 'warning'> = {
  PREVENTIVA: 'accent',
  CORRECTIVA: 'warning',
};

function formatFecha(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Día local (YYYY-MM-DD) — mismo criterio que los filtros de fecha de
 * `TrabajosExtraAdminView`: se compara contra lo que el usuario ve. */
function diaLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Cuándo se hizo la mantención: la última tarea completada manda; sin
 * `hechaAt` (tareas viejas) cae al `updatedAt` de la orden (el cruce a
 * COMPLETADA fue su última escritura). */
function fechaDeMantencion(orden: OrdenTrabajo): string {
  const hechas = orden.tareas.map((t) => t.hechaAt).filter((v): v is string => Boolean(v));
  if (hechas.length === 0) return orden.updatedAt;
  return hechas.reduce((max, v) => (v > max ? v : max));
}

/** Nombres únicos de quienes completaron tareas, en orden de aparición. */
function mantenedoresDe(orden: OrdenTrabajo): string[] {
  const nombres: string[] = [];
  for (const tarea of orden.tareas) {
    if (tarea.hechaPorNombre && !nombres.includes(tarea.hechaPorNombre)) {
      nombres.push(tarea.hechaPorNombre);
    }
  }
  return nombres;
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3.5 border-t border-separator py-2.5">
      <span className="shrink-0 text-[11px] font-bold tracking-wider text-(--label-color) uppercase">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-bold tracking-wider text-(--label-color) uppercase">{titulo}</span>
      {children}
    </div>
  );
}

function TareaRealizada({ tarea }: { tarea: Tarea }) {
  return (
    <div className="rounded-xl border border-border bg-surface-secondary/50 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{tarea.texto}</span>
        <span className="text-xs text-muted-foreground">
          {tarea.hechaPorNombre ?? '—'}
          {tarea.hechaAt ? ` · ${formatFecha(tarea.hechaAt)}` : ''}
        </span>
      </div>
      {tarea.notas ? <p className="mt-1 text-sm text-muted-foreground">{tarea.notas}</p> : null}
      {tarea.fotoUrl ? (
        <a className="mt-1 inline-block text-xs text-(--accent) hover:underline" href={tarea.fotoUrl} rel="noreferrer" target="_blank">
          Ver foto de respaldo
        </a>
      ) : null}
    </div>
  );
}

/**
 * Detalle de UNA mantención: los datos de la orden, las tareas realizadas (qué
 * se hizo, quién, cuándo, foto) y las intervenciones del cierre con los
 * insumos descontados del stock. Los nombres de insumo salen del catálogo de
 * Inventario ya cacheado; un insumo que ya no está en el catálogo se muestra
 * por su id.
 */
function DetalleMantencionModal({
  orden,
  codigoEquipo,
  onClose,
}: {
  orden: OrdenTrabajo | null;
  codigoEquipo: string;
  onClose: () => void;
}) {
  const { data: intervenciones, isPending: cargandoIntervenciones } = useIntervenciones(orden?.id);
  const { data: items } = useItems({ isActive: true });
  const nombreInsumo = (insumoId: string) => items?.find((item) => item.id === insumoId)?.name ?? insumoId;

  return (
    <Modal.Backdrop
      isDismissable
      isOpen={orden !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={`${RESPONSIVE_SHEET_DIALOG_WIDE_CLASS} sm:w-full`}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              {orden?.titulo ?? ''}
            </Modal.Heading>
            {orden ? (
              <div className="flex flex-wrap items-center gap-2 pt-1.5">
                <Chip color={TIPO_COLOR[orden.tipo] ?? 'default'} size="sm" variant="soft">
                  {TIPO_LABEL[orden.tipo] ?? orden.tipo}
                </Chip>
                <span className="font-mono text-sm text-muted-foreground">{codigoEquipo}</span>
              </div>
            ) : null}
          </Modal.Header>
          <Modal.Body>
            {orden ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-x-7 sm:grid-cols-2 [&>*:first-child]:border-t-0 sm:[&>*:nth-child(2)]:border-t-0">
                  <Dato label="Fecha" value={formatFecha(fechaDeMantencion(orden))} />
                  <Dato label="Equipo" value={codigoEquipo} />
                  <Dato label="Tipo" value={TIPO_LABEL[orden.tipo] ?? orden.tipo} />
                  <Dato label="Realizada por" value={mantenedoresDe(orden).join(', ') || '—'} />
                </div>

                <Seccion titulo={`Tareas realizadas (${orden.tareas.filter((t) => t.hecha).length}/${orden.tareas.length})`}>
                  <div className="flex flex-col gap-1.5">
                    {orden.tareas.map((tarea) => (
                      <TareaRealizada key={tarea.id} tarea={tarea} />
                    ))}
                    {orden.tareas.length === 0 ? (
                      <p className="text-sm text-muted-foreground">La orden no tenía checklist de tareas.</p>
                    ) : null}
                  </div>
                </Seccion>

                <Seccion titulo="Intervenciones e insumos">
                  {cargandoIntervenciones ? (
                    <div className="flex justify-center py-4">
                      <Spinner color="accent" size="sm" />
                    </div>
                  ) : (intervenciones ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin intervenciones registradas en esta orden.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {(intervenciones ?? []).map((intervencion) => (
                        <div className="rounded-xl border border-border px-3 py-2.5" key={intervencion.id}>
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-sm font-medium text-foreground">{intervencion.detalle}</span>
                            <span className="text-xs text-muted-foreground">
                              {intervencion.realizadaPor ?? '—'} · {formatFecha(intervencion.fecha)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {NUM_CL_1.format(intervencion.horasHombre)} h hombre
                            {intervencion.horometro != null ? ` · horómetro ${NUM_CL_1.format(intervencion.horometro)}` : ''}
                          </p>
                          {intervencion.insumos.length > 0 ? (
                            <ul className="mt-1.5 flex flex-col gap-0.5">
                              {intervencion.insumos.map((insumo) => (
                                <li className="text-sm text-foreground" key={insumo.id}>
                                  {nombreInsumo(insumo.insumoId)} <span className="text-muted-foreground">× {insumo.cantidad}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {intervencion.fotoUrl ? (
                            <a
                              className="mt-1 inline-block text-xs text-(--accent) hover:underline"
                              href={intervencion.fotoUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Ver foto del cierre
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </Seccion>
              </div>
            ) : null}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

const SELECT_FILTRO = 'rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground';

/**
 * Registro de mantenciones del ADMINISTRADOR (`/mantenciones`, ruta solo
 * ADMIN): cada fila es una orden de trabajo COMPLETADA del taller —preventiva
 * o correctiva—, con filtros por fecha, mantenedor y tipo, y el detalle en
 * popup (tareas, intervenciones, insumos). Es también el destino del aviso
 * «Orden de trabajo completada» del administrador (`?id=` abre el detalle).
 */
export function MantencionesAdminView() {
  const { data, isPending, isError, error } = useOrdenes();
  const { data: equipos } = useEquipment();
  const [params, setParams] = useSearchParams();
  // La tabla solo en escritorio: en tablet y celular, tarjetas que caben en el ancho.
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);

  // `equipoId` de la OT es soft-ref: puede traer el id del equipo o su código.
  const codigoDe = (equipoRef: string) =>
    equipos?.find((equipo) => equipo.id === equipoRef || equipo.internalCode === equipoRef)?.internalCode ?? equipoRef;

  const mantenciones = useMemo(
    () =>
      (data ?? [])
        .filter((orden) => orden.estado === 'COMPLETADA')
        .sort((a, b) => fechaDeMantencion(b).localeCompare(fechaDeMantencion(a))),
    [data],
  );

  const mantenedores = useMemo(() => {
    const nombres = new Set<string>();
    for (const orden of mantenciones) for (const nombre of mantenedoresDe(orden)) nombres.add(nombre);
    return [...nombres].sort((a, b) => a.localeCompare(b));
  }, [mantenciones]);

  const tipoFiltro = params.get('tipo') ?? 'TODOS';
  const mantenedorFiltro = params.get('mantenedor') ?? 'TODOS';
  const desde = params.get('desde') ?? '';
  const hasta = params.get('hasta') ?? '';
  const detalleId = params.get('id');

  const setFiltro = (clave: string, valor: string, vacio: string) => {
    const siguientes = new URLSearchParams(params);
    if (valor === vacio) siguientes.delete(clave);
    else siguientes.set(clave, valor);
    setParams(siguientes, { replace: true });
  };

  const lista = useMemo(
    () =>
      mantenciones.filter((orden) => {
        if (tipoFiltro !== 'TODOS' && orden.tipo !== tipoFiltro) return false;
        if (mantenedorFiltro !== 'TODOS' && !mantenedoresDe(orden).includes(mantenedorFiltro)) return false;
        const dia = diaLocal(fechaDeMantencion(orden));
        if (desde && dia < desde) return false;
        if (hasta && dia > hasta) return false;
        return true;
      }),
    [mantenciones, tipoFiltro, mantenedorFiltro, desde, hasta],
  );

  const detalle = detalleId ? (mantenciones.find((orden) => orden.id === detalleId) ?? null) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
            SMI · Mantenciones
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">Mantenciones</h1>
          <p className="text-sm text-muted-foreground">
            Todas las mantenciones realizadas por el taller. Abre una para ver qué se hizo, quién y con qué insumos.
          </p>
        </div>
        <Chip color="accent" data-testid="total-filtrado" size="md" variant="soft">
          {lista.length.toLocaleString('es-CL')} {lista.length === 1 ? 'mantención' : 'mantenciones'}
        </Chip>
      </div>

      <Card>
        <Card.Header>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Card.Title>Registro</Card.Title>
              <Card.Description>De la más reciente a la más antigua. El total sigue al filtro.</Card.Description>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Tipo
                <select className={SELECT_FILTRO} onChange={(e) => setFiltro('tipo', e.target.value, 'TODOS')} value={tipoFiltro}>
                  <option value="TODOS">Todas</option>
                  {TIPOS.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {TIPO_LABEL[tipo]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Mantenedor
                <select
                  className={SELECT_FILTRO}
                  onChange={(e) => setFiltro('mantenedor', e.target.value, 'TODOS')}
                  value={mantenedorFiltro}
                >
                  <option value="TODOS">Todos</option>
                  {mantenedores.map((nombre) => (
                    <option key={nombre} value={nombre}>
                      {nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Desde
                <input
                  className={SELECT_FILTRO}
                  max={hasta || undefined}
                  onChange={(e) => setFiltro('desde', e.target.value, '')}
                  type="date"
                  value={desde}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Hasta
                <input
                  className={SELECT_FILTRO}
                  min={desde || undefined}
                  onChange={(e) => setFiltro('hasta', e.target.value, '')}
                  type="date"
                  value={hasta}
                />
              </label>
            </div>
          </div>
        </Card.Header>
        <Card.Content>
          {isPending ? (
            <div className="flex justify-center py-10">
              <Spinner color="accent" size="sm" />
            </div>
          ) : null}

          {isError ? (
            <p className="text-sm text-danger-soft-foreground" role="alert">
              {error instanceof Error ? error.message : 'No se pudo cargar las mantenciones.'}
            </p>
          ) : null}

          {!isPending && !isError && lista.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              {mantenciones.length === 0
                ? 'Todavía no hay mantenciones completadas.'
                : 'Ninguna mantención calza con el filtro.'}
            </p>
          ) : null}

          {!isPending && !isError && lista.length > 0 && !esEscritorio ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {lista.map((orden) => (
                <li
                  className="flex cursor-pointer flex-col gap-3 rounded-2xl border border-border bg-card p-4 hover:bg-default"
                  data-testid={`mantencion-fila-${orden.id}`}
                  key={orden.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setFiltro('id', orden.id, '')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setFiltro('id', orden.id, '');
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm text-muted-foreground">
                      {formatFecha(fechaDeMantencion(orden))} ·{' '}
                      <span className="font-mono whitespace-nowrap text-foreground">{codigoDe(orden.equipoId)}</span>
                    </span>
                    <Chip color={TIPO_COLOR[orden.tipo] ?? 'default'} size="sm" variant="soft">
                      {TIPO_LABEL[orden.tipo] ?? orden.tipo}
                    </Chip>
                  </div>
                  <p className="m-0 text-[15px] font-semibold break-words text-foreground">{orden.titulo}</p>
                  <dl className="m-0 grid grid-cols-2 gap-2 rounded-xl bg-surface-secondary px-3 py-2.5 text-sm">
                    <div className="flex min-w-0 flex-col">
                      <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                        Mantenedor
                      </dt>
                      <dd className="m-0 break-words text-foreground">{mantenedoresDe(orden).join(', ') || '—'}</dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Tareas</dt>
                      <dd className="m-0 font-mono font-semibold text-foreground">
                        {orden.tareas.filter((t) => t.hecha).length}/{orden.tareas.length}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          ) : null}

          {!isPending && !isError && lista.length > 0 && esEscritorio ? (
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Mantenciones realizadas" className="min-w-full">
                  <Table.Header>
                    <Table.Column isRowHeader>Fecha</Table.Column>
                    <Table.Column>Equipo</Table.Column>
                    <Table.Column className="w-full">Mantención</Table.Column>
                    <Table.Column>Tipo</Table.Column>
                    <Table.Column>Mantenedor</Table.Column>
                    <Table.Column className="text-right">Tareas</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {lista.map((orden) => (
                      <Table.Row
                        className="cursor-pointer"
                        data-testid={`mantencion-fila-${orden.id}`}
                        key={orden.id}
                        onAction={() => setFiltro('id', orden.id, '')}
                      >
                        <Table.Cell className="text-sm whitespace-nowrap text-muted-foreground">
                          {formatFecha(fechaDeMantencion(orden))}
                        </Table.Cell>
                        <Table.Cell className="font-mono text-sm whitespace-nowrap">{codigoDe(orden.equipoId)}</Table.Cell>
                        <Table.Cell className="max-w-0 truncate text-sm">{orden.titulo}</Table.Cell>
                        <Table.Cell className="whitespace-nowrap">
                          <Chip color={TIPO_COLOR[orden.tipo] ?? 'default'} size="sm" variant="soft">
                            {TIPO_LABEL[orden.tipo] ?? orden.tipo}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap">
                          {mantenedoresDe(orden).join(', ') || '—'}
                        </Table.Cell>
                        <Table.Cell className="text-right font-mono text-sm whitespace-nowrap">
                          {orden.tareas.filter((t) => t.hecha).length}/{orden.tareas.length}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          ) : null}
        </Card.Content>
      </Card>

      <DetalleMantencionModal
        codigoEquipo={detalle ? codigoDe(detalle.equipoId) : ''}
        orden={detalle}
        onClose={() => setFiltro('id', '', '')}
      />
    </div>
  );
}
