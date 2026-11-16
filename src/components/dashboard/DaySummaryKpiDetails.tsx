import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner, Table } from '@heroui/react';

import { KpiDetailModal } from './KpiDetailModal';
import { adBlueDisponible, conSigno } from './adblue-disponible';
import { useDashboardAdBlue, useDashboardVueltas } from '../../hooks/useDashboard';
import { NUM_CL, NUM_CL_1, formatDia } from '../../lib/dashboard-format';
import type { ResumenDia } from '../../types/dashboard';

/** Las cinco tarjetas de colores del resumen del día; cada una abre su popup de detalle. */
export type DaySummaryKpi = 'hm' | 'diesel' | 'reports' | 'production' | 'adblue';

const CELL = 'font-mono text-sm';
const CELL_TOTAL = 'font-mono text-sm font-semibold';
const ROW_LISTA = 'flex flex-wrap items-center gap-2 border-t border-border py-2.5 first:border-t-0 first:pt-0';
/** Fila que expande/colapsa su detalle (clic y Enter vía `onAction`). */
const ROW_TOGGLE = 'cursor-pointer hover:bg-surface-secondary';
const HORA = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' });
const FECHA_HORA = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** Set de equipos con su fila de detalle expandida (toggle por `internalCode`). */
function useExpandedRows() {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const toggle = (code: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(code)) next.add(code);
      return next;
    });
  return { expanded, toggle };
}

/** «08:00–18:30», «08:00–en curso», o '' si el payload (cacheado) no trae horas. */
function rangoHoras(entrada?: string, salida?: string | null): string {
  if (!entrada) return '';
  return `${HORA.format(new Date(entrada))}–${salida ? HORA.format(new Date(salida)) : 'en curso'}`;
}

/**
 * Popups de detalle de las KPI cards de colores del «Resumen del día». HM y
 * Diésel desglosan `operacionPorEquipo` (la misma fuente de los totales de la
 * card); Reports lista el día completo (la card corta en 3 equipos); Producción
 * suma los camiones del endpoint de vueltas; AdBlue muestra el saldo disponible
 * y TODAS las cargas declaradas. Los modales cerrados no se montan
 * (react-aria), así que las consultas extra (vueltas, AdBlue) solo corren con
 * el popup abierto.
 */
export function DaySummaryKpiDetails({
  open,
  onClose,
  data,
  past,
}: {
  open: DaySummaryKpi | null;
  onClose: () => void;
  data: ResumenDia;
  /** Día pasado: el popup de AdBlue aclara que el saldo es el vivo, no el histórico. */
  past: boolean;
}) {
  const cerrar = (isOpen: boolean) => {
    if (!isOpen) onClose();
  };
  const dia = formatDia(data.fecha);
  return (
    <>
      <KpiDetailModal isOpen={open === 'hm'} onOpenChange={cerrar} title={`HM operacionales – ${dia}`}>
        <HmDetail data={data} />
      </KpiDetailModal>
      <KpiDetailModal
        isOpen={open === 'diesel'}
        onOpenChange={cerrar}
        title={`Diésel – ${dia}`}
        verTodoTo="/cargas-combustible"
      >
        <DieselDetail data={data} />
      </KpiDetailModal>
      <KpiDetailModal
        isOpen={open === 'reports'}
        onOpenChange={cerrar}
        title={`Reports – ${dia}`}
        verTodoTo="/trabajos-extra"
      >
        <ReportsDetail data={data} onClose={onClose} />
      </KpiDetailModal>
      <KpiDetailModal
        isOpen={open === 'production'}
        onOpenChange={cerrar}
        title={`Producción – ${dia}`}
        verTodoTo="/reportes-diarios"
      >
        <ProductionDetail data={data} enabled={open === 'production'} />
      </KpiDetailModal>
      <KpiDetailModal
        isOpen={open === 'adblue'}
        onOpenChange={cerrar}
        title="AdBlue disponible"
        // Las cargas de AdBlue viven en Cargas de combustible (con su filtro
        // «Solo con AdBlue»).
        verTodoTo="/cargas-combustible"
      >
        <AdBlueDetail enabled={open === 'adblue'} onClose={onClose} past={past} />
      </KpiDetailModal>
    </>
  );
}

/** Las tarjetas de un equipo ese día, dentro de la fila expandida del popup HM. */
function ShiftCardsOfEquipment({ lecturas }: { lecturas: ResumenDia['lecturas'] }) {
  const n = (v: number) => NUM_CL_1.format(v);
  if (lecturas.length === 0) return <span className="text-xs text-muted-foreground">Sin tarjetas de este equipo.</span>;
  return (
    <div className="flex flex-col gap-1.5">
      {lecturas.map((l) => (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs" key={l.id}>
          <span className="font-medium text-foreground">{l.turno}</span>
          <span className="text-muted-foreground">{l.operador ?? '—'}</span>
          <span className="text-muted-foreground">Registró: {l.registradoPor ?? '—'}</span>
          <span className="font-mono text-foreground">
            {`${n(l.inicial)} → ${l.final === null ? 'en curso' : n(l.final)}${l.avance == null ? '' : ` (+${n(l.avance)})`}`}
          </span>
          {rangoHoras(l.horaEntrada, l.horaSalida) ? (
            <span className="text-muted-foreground">{rangoHoras(l.horaEntrada, l.horaSalida)}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** HM por equipo (Día/Noche/Total) — mismas filas de `operacionPorEquipo`, solo las que aportan HM.
 * Cada fila expande las tarjetas que originan sus horas (quién registró, inicial→final, horario). */
function HmDetail({ data }: { data: ResumenDia }) {
  const { expanded, toggle } = useExpandedRows();
  const rows = data.operacionPorEquipo.filter((f) => f.total.hm !== 0);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Sin horas máquina este día.</p>;
  const n = (v: number) => NUM_CL_1.format(v);
  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content aria-label="Horas máquina por equipo" className="min-w-full">
          <Table.Header>
            <Table.Column isRowHeader>Equipo</Table.Column>
            <Table.Column>Día</Table.Column>
            <Table.Column>Noche</Table.Column>
            <Table.Column>Total HM</Table.Column>
          </Table.Header>
          <Table.Body>
            {[
              ...rows.flatMap((f) => [
                <Table.Row
                  className={ROW_TOGGLE}
                  data-testid={`hm-det-${f.internalCode}`}
                  id={f.internalCode}
                  key={f.internalCode}
                  onAction={() => toggle(f.internalCode)}
                >
                  <Table.Cell className={CELL}>{f.internalCode}</Table.Cell>
                  <Table.Cell className={CELL}>{n(f.dia.hm)}</Table.Cell>
                  <Table.Cell className={CELL}>{n(f.noche.hm)}</Table.Cell>
                  <Table.Cell className={CELL}>{n(f.total.hm)}</Table.Cell>
                </Table.Row>,
                ...(expanded.has(f.internalCode)
                  ? [
                      <Table.Row
                        data-testid={`hm-exp-${f.internalCode}`}
                        id={`exp-${f.internalCode}`}
                        key={`exp-${f.internalCode}`}
                      >
                        <Table.Cell colSpan={4}>
                          <ShiftCardsOfEquipment
                            lecturas={data.lecturas.filter((l) => l.internalCode === f.internalCode)}
                          />
                        </Table.Cell>
                      </Table.Row>,
                    ]
                  : []),
              ]),
              <Table.Row data-testid="hm-det-TOTAL" id="TOTAL" key="TOTAL">
                <Table.Cell className="text-sm font-semibold">TOTAL</Table.Cell>
                <Table.Cell className={CELL_TOTAL}>{n(data.hm.dia)}</Table.Cell>
                <Table.Cell className={CELL_TOTAL}>{n(data.hm.noche)}</Table.Cell>
                <Table.Cell className={CELL_TOTAL}>{n(data.hm.total)}</Table.Cell>
              </Table.Row>,
            ]}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

const FUEL_LABELS: Record<string, string> = { PETROLEO: 'Petróleo', BENCINA: 'Bencina' };

/** Las cargas de un equipo ese día, dentro de la fila expandida del popup Diésel. */
function FuelLoadsOfEquipment({ cargas, internalCode }: { cargas: ResumenDia['cargas']; internalCode: string }) {
  // Payload cacheado por la PWA anterior al campo: no hay detalle que mostrar.
  if (!cargas) return <span className="text-xs text-muted-foreground">Detalle no disponible en este payload.</span>;
  const delEquipo = cargas.filter((c) => c.internalCode === internalCode);
  if (delEquipo.length === 0) return <span className="text-xs text-muted-foreground">Sin cargas de este equipo.</span>;
  return (
    <div className="flex flex-col gap-1.5">
      {delEquipo.map((c, i) => (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs" key={`${c.hora}-${i}`}>
          <span className="font-mono text-muted-foreground">{HORA.format(new Date(c.hora))}</span>
          <span className="font-mono text-foreground">{`${NUM_CL_1.format(c.litros)} L · ${FUEL_LABELS[c.tipo] ?? c.tipo}`}</span>
          <span className="text-muted-foreground">Cargó: {c.cargadoPor ?? '—'}</span>
          <span className="text-muted-foreground">Operador: {c.operador ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}

/** Litros por equipo (Día/Noche/Total) + rendimiento L/HM de cada uno.
 * Cada fila expande las cargas que originan sus litros (hora, quién cargó, operador). */
function DieselDetail({ data }: { data: ResumenDia }) {
  const { expanded, toggle } = useExpandedRows();
  const rows = data.operacionPorEquipo.filter((f) => f.total.litros !== 0);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Sin cargas de diésel este día.</p>;
  const n = (v: number) => NUM_CL_1.format(v);
  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content aria-label="Diésel por equipo" className="min-w-full">
          <Table.Header>
            <Table.Column isRowHeader>Equipo</Table.Column>
            <Table.Column>Día L</Table.Column>
            <Table.Column>Noche L</Table.Column>
            <Table.Column>Total L</Table.Column>
            <Table.Column>L/HM</Table.Column>
          </Table.Header>
          <Table.Body>
            {[
              ...rows.flatMap((f) => [
                <Table.Row
                  className={ROW_TOGGLE}
                  data-testid={`diesel-det-${f.internalCode}`}
                  id={f.internalCode}
                  key={f.internalCode}
                  onAction={() => toggle(f.internalCode)}
                >
                  <Table.Cell className={CELL}>{f.internalCode}</Table.Cell>
                  <Table.Cell className={CELL}>{n(f.dia.litros)}</Table.Cell>
                  <Table.Cell className={CELL}>{n(f.noche.litros)}</Table.Cell>
                  <Table.Cell className={CELL}>{n(f.total.litros)}</Table.Cell>
                  <Table.Cell className={CELL}>{f.total.hm > 0 ? n(f.total.litros / f.total.hm) : '—'}</Table.Cell>
                </Table.Row>,
                ...(expanded.has(f.internalCode)
                  ? [
                      <Table.Row
                        data-testid={`diesel-exp-${f.internalCode}`}
                        id={`exp-${f.internalCode}`}
                        key={`exp-${f.internalCode}`}
                      >
                        <Table.Cell colSpan={5}>
                          <FuelLoadsOfEquipment cargas={data.cargas} internalCode={f.internalCode} />
                        </Table.Cell>
                      </Table.Row>,
                    ]
                  : []),
              ]),
              <Table.Row data-testid="diesel-det-TOTAL" id="TOTAL" key="TOTAL">
                <Table.Cell className="text-sm font-semibold">TOTAL</Table.Cell>
                <Table.Cell className={CELL_TOTAL}>{n(data.diesel.dia)}</Table.Cell>
                <Table.Cell className={CELL_TOTAL}>{n(data.diesel.noche)}</Table.Cell>
                <Table.Cell className={CELL_TOTAL}>{n(data.diesel.total)}</Table.Cell>
                <Table.Cell className={CELL_TOTAL}>
                  {data.diesel.porHm === null ? '—' : n(data.diesel.porHm)}
                </Table.Cell>
              </Table.Row>,
            ]}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

/** El día completo de reports por equipo — la card corta en 3 y pone «+n más».
 * Cada fila navega a la vista Report filtrada por ese equipo y ese día; sin
 * `equipmentId` (payload cacheado viejo) la fila queda informativa. */
function ReportsDetail({ data, onClose }: { data: ResumenDia; onClose: () => void }) {
  const navigate = useNavigate();
  const { totalHoras, porEquipo } = data.reports;
  if (porEquipo.length === 0) return <p className="text-sm text-muted-foreground">Sin reports este día.</p>;
  return (
    <>
      {porEquipo.map((e) => {
        const fila = (
          <>
            <span className="font-mono text-sm text-foreground">{e.internalCode}</span>
            <span className="ms-auto font-mono text-sm font-semibold text-foreground">
              {NUM_CL_1.format(e.horas)} HM
            </span>
          </>
        );
        if (!e.equipmentId)
          return (
            <div className={ROW_LISTA} data-testid={`reports-det-${e.internalCode}`} key={e.internalCode}>
              {fila}
            </div>
          );
        return (
          <button
            aria-label={`Ver reports de ${e.internalCode}`}
            className={`${ROW_LISTA} ${ROW_TOGGLE} w-full text-left`}
            data-testid={`reports-det-${e.internalCode}`}
            key={e.internalCode}
            onClick={() => {
              onClose();
              void navigate(`/trabajos-extra?equipo=${e.equipmentId}&desde=${data.fecha}&hasta=${data.fecha}`);
            }}
            type="button"
          >
            {fila}
          </button>
        );
      })}
      <div className="flex items-center gap-2 border-t border-border pt-2.5">
        <span className="text-sm font-semibold text-foreground">TOTAL</span>
        <span className="ms-auto font-mono text-sm font-semibold text-foreground">
          {NUM_CL_1.format(totalHoras)} HM
        </span>
      </div>
    </>
  );
}

/** Vueltas por sección (del payload de la card) + camiones del endpoint de vueltas del mismo día. */
function ProductionDetail({ data, enabled }: { data: ResumenDia; enabled: boolean }) {
  const rango = { desde: data.fecha, hasta: data.fecha };
  const { data: vueltas, isPending, isError } = useDashboardVueltas(rango, enabled);
  const camionesDe = (seccion: 'INTERNOS' | 'MINA_CALETA' | 'MINERAS') => {
    if (isPending) return '…';
    const fila = vueltas?.porSeccion.find((s) => s.seccion === seccion);
    return fila ? NUM_CL.format(fila.camiones) : '—';
  };
  const filas = [
    { id: 'INTERNOS', nombre: 'Internos', vueltas: data.produccion.internos },
    { id: 'MINA_CALETA', nombre: 'Mina Caleta', vueltas: data.produccion.minaCaleta },
    { id: 'MINERAS', nombre: 'Mineras', vueltas: data.produccion.mineras },
  ] as const;
  const totalVueltas = filas.reduce((a, f) => a + f.vueltas, 0);
  const totalCamiones = isPending
    ? '…'
    : vueltas
      ? NUM_CL.format(vueltas.porSeccion.reduce((a, s) => a + s.camiones, 0))
      : '—';
  return (
    <div className="flex flex-col gap-3">
      <Table variant="secondary">
        <Table.ScrollContainer>
          <Table.Content aria-label="Producción por sección" className="min-w-full">
            <Table.Header>
              <Table.Column isRowHeader>Sección</Table.Column>
              <Table.Column>Camiones</Table.Column>
              <Table.Column>Vueltas</Table.Column>
            </Table.Header>
            <Table.Body>
              {[
                ...filas.map((f) => (
                  <Table.Row data-testid={`prod-det-${f.id}`} id={f.id} key={f.id}>
                    <Table.Cell className="text-sm">{f.nombre}</Table.Cell>
                    <Table.Cell className={CELL}>{camionesDe(f.id)}</Table.Cell>
                    <Table.Cell className={CELL}>{NUM_CL.format(f.vueltas)}</Table.Cell>
                  </Table.Row>
                )),
                <Table.Row data-testid="prod-det-TOTAL" id="TOTAL" key="TOTAL">
                  <Table.Cell className="text-sm font-semibold">TOTAL</Table.Cell>
                  <Table.Cell className={CELL_TOTAL}>{totalCamiones}</Table.Cell>
                  <Table.Cell className={CELL_TOTAL}>{NUM_CL.format(totalVueltas)}</Table.Cell>
                </Table.Row>,
              ]}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      {isError ? (
        <p className="text-xs text-muted-foreground">No se pudo cargar el número de camiones por sección.</p>
      ) : null}
    </div>
  );
}

/** Turno de la carga de AdBlue, legible: tarjeta → Día/Noche; manual → Manual. */
function turnoAdBlue(c: { turno: string | null; origen: 'TARJETA' | 'MANUAL' }): string {
  if (c.turno === 'NOCTURNO') return 'Noche';
  if (c.turno === 'DIURNO') return 'Día';
  return c.origen === 'MANUAL' ? 'Manual' : '—';
}

/** De dónde salió la carga, legible: «Cierre de tarjeta · Día» o «Carga manual». */
function origenAdBlue(c: { turno: string | null; origen: 'TARJETA' | 'MANUAL' }): string {
  if (c.origen === 'MANUAL') return 'Carga manual';
  return `Cierre de tarjeta · ${turnoAdBlue(c)}`;
}

/**
 * Popup «AdBlue disponible»: el saldo vivo del ítem AdBlue (en negativo si
 * se cargó más de lo que había en bodega) y TODAS las cargas declaradas, de
 * la más reciente a la más antigua, cada una restando su litros.
 */
function AdBlueDetail({ enabled, past, onClose }: { enabled: boolean; past: boolean; onClose: () => void }) {
  const { data, isPending, isError, error } = useDashboardAdBlue(enabled);
  const navigate = useNavigate();

  if (isPending) {
    return (
      <div className="flex justify-center py-6">
        <Spinner color="accent" size="sm" />
      </div>
    );
  }
  if (isError) {
    return (
      <p className="text-sm text-danger-soft-foreground" role="alert">
        {error instanceof Error ? error.message : 'No se pudo cargar el AdBlue disponible.'}
      </p>
    );
  }

  const disponible = data.saldo ? adBlueDisponible(data.saldo) : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5" data-testid="adblue-saldo">
        <span className="text-sm font-medium text-foreground">
          {data.saldo ? data.saldo.nombre : 'Saldo en Inventario'}
        </span>
        {disponible ? (
          <>
            <span
              className={`font-mono text-2xl font-semibold ${disponible.negativo ? 'text-danger' : 'text-foreground'}`}
            >
              {`${disponible.valor} ${disponible.unidad}`}
              {disponible.enLitros ? (
                <span className="ms-2 text-sm font-normal text-muted-foreground">= {disponible.enLitros}</span>
              ) : null}
            </span>
            {disponible.negativo ? (
              <span className="text-xs text-danger-soft-foreground">
                Saldo negativo: se cargó más AdBlue del que figura en bodega. Registra la reposición o haz un conteo
                físico en Inventario.
              </span>
            ) : null}
            {past ? (
              <span className="text-xs text-muted-foreground">Es el saldo de hoy, no el del día consultado.</span>
            ) : null}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            Sin ítem AdBlue en Inventario: crea el ítem para llevar el saldo disponible.
          </span>
        )}
      </div>

      <div className="flex flex-col">
        <h4 className="mb-1.5 text-sm font-semibold text-foreground">Cargas de AdBlue</h4>
        {data.cargas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay cargas de AdBlue registradas.</p>
        ) : (
          <>
            <div className="max-h-96 overflow-y-auto pe-1">
              {data.cargas.map((c) => {
                const contenido = (
                  <>
                    <span className="font-mono text-xs text-muted-foreground">
                      {FECHA_HORA.format(new Date(c.fecha))}
                    </span>
                    <span className="font-mono text-sm text-foreground">{c.internalCode}</span>
                    <span className="text-xs text-muted-foreground">{origenAdBlue(c)}</span>
                    <span className="text-xs text-muted-foreground">Cargó: {c.cargadoPor ?? '—'}</span>
                    {c.cargaId ? null : <span className="text-xs text-muted-foreground">(sin carga de diésel)</span>}
                    <span className="ms-auto font-mono text-sm font-semibold text-danger">{conSigno(-c.litros)} L</span>
                  </>
                );
                // Con carga de diésel, la fila abre su detalle en Cargas de
                // combustible (fecha, equipo, clase, litros y AdBlue).
                return c.cargaId ? (
                  <button
                    aria-label={`Ver la carga de ${c.internalCode}`}
                    className={`${ROW_LISTA} w-full cursor-pointer rounded-md text-start hover:bg-surface-secondary`}
                    data-testid={`adblue-carga-${c.id}`}
                    key={`${c.origen}-${c.id}`}
                    onClick={() => {
                      onClose();
                      void navigate(`/cargas-combustible?id=${encodeURIComponent(c.cargaId as string)}`);
                    }}
                    type="button"
                  >
                    {contenido}
                  </button>
                ) : (
                  <div className={ROW_LISTA} data-testid={`adblue-carga-${c.id}`} key={`${c.origen}-${c.id}`}>
                    {contenido}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 border-t border-border pt-2.5">
              <span className="text-sm font-semibold text-foreground">
                TOTAL CARGADO ({data.cargas.length} {data.cargas.length === 1 ? 'carga' : 'cargas'})
              </span>
              <span className="ms-auto font-mono text-sm font-semibold text-foreground">
                {conSigno(-data.totalCargado)} L
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
