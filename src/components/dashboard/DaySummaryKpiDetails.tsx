import { useState } from 'react';
import { Spinner, Table } from '@heroui/react';

import { KpiDetailModal } from './KpiDetailModal';
import { useDashboardVueltas } from '../../hooks/useDashboard';
import { useKardex } from '../../hooks/useInventory';
import { NUM_CL, NUM_CL_1, formatDia } from '../../lib/dashboard-format';
import { toDateOnly } from '../../lib/turno';
import { MovementKindChip, movementKind } from '../inventario/shared';
import { MOVEMENT_REASON_LABELS, UNIT_SYMBOLS, type UnitOfMeasure } from '../../types/inventory';
import type { ResumenDia } from '../../types/dashboard';

/** Las cinco tarjetas de colores del resumen del día; cada una abre su popup de detalle. */
export type DaySummaryKpi = 'hm' | 'diesel' | 'reports' | 'production' | 'adblue';

const CELL = 'font-mono text-sm';
const CELL_TOTAL = 'font-mono text-sm font-semibold';
const ROW_LISTA = 'flex flex-wrap items-center gap-2 border-t border-border py-2.5 first:border-t-0 first:pt-0';
/** Fila que expande/colapsa su detalle (clic y Enter vía `onAction`). */
const ROW_TOGGLE = 'cursor-pointer hover:bg-surface-secondary';
const HORA = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' });

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
 * suma los camiones del endpoint de vueltas; AdBlue muestra el kardex del día
 * del ítem. Los modales cerrados no se montan (react-aria), así que las
 * consultas extra (vueltas, kardex) solo corren con el popup abierto.
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
        <ReportsDetail data={data} />
      </KpiDetailModal>
      <KpiDetailModal
        isOpen={open === 'production'}
        onOpenChange={cerrar}
        title={`Producción – ${dia}`}
        verTodoTo="/reportes-diarios"
      >
        <ProductionDetail data={data} enabled={open === 'production'} />
      </KpiDetailModal>
      {data.adBlue ? (
        <KpiDetailModal
          isOpen={open === 'adblue'}
          onOpenChange={cerrar}
          title="AdBlue"
          verTodoTo={`/inventario/${data.adBlue.itemId}`}
        >
          <AdBlueDetail adBlue={data.adBlue} enabled={open === 'adblue'} fecha={data.fecha} past={past} />
        </KpiDetailModal>
      ) : null}
    </>
  );
}

/** Las tarjetas de un equipo ese día, dentro de la fila expandida del popup HM. */
function ShiftCardsOfEquipment({ lecturas }: { lecturas: ResumenDia['lecturas'] }) {
  const n = (v: number) => NUM_CL_1.format(v);
  if (lecturas.length === 0)
    return <span className="text-xs text-muted-foreground">Sin tarjetas de este equipo.</span>;
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
                      <Table.Row data-testid={`hm-exp-${f.internalCode}`} id={`exp-${f.internalCode}`} key={`exp-${f.internalCode}`}>
                        <Table.Cell colSpan={4}>
                          <ShiftCardsOfEquipment lecturas={data.lecturas.filter((l) => l.internalCode === f.internalCode)} />
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
  if (delEquipo.length === 0)
    return <span className="text-xs text-muted-foreground">Sin cargas de este equipo.</span>;
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

/** El día completo de reports por equipo — la card corta en 3 y pone «+n más». */
function ReportsDetail({ data }: { data: ResumenDia }) {
  const { totalHoras, porEquipo } = data.reports;
  if (porEquipo.length === 0) return <p className="text-sm text-muted-foreground">Sin reports este día.</p>;
  return (
    <>
      {porEquipo.map((e) => (
        <div className={ROW_LISTA} data-testid={`reports-det-${e.internalCode}`} key={e.internalCode}>
          <span className="font-mono text-sm text-foreground">{e.internalCode}</span>
          <span className="ms-auto font-mono text-sm font-semibold text-foreground">{NUM_CL_1.format(e.horas)} HM</span>
        </div>
      ))}
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

/** Saldo del ítem AdBlue + su kardex del día consultado. */
function AdBlueDetail({
  adBlue,
  fecha,
  enabled,
  past,
}: {
  adBlue: NonNullable<ResumenDia['adBlue']>;
  fecha: string;
  enabled: boolean;
  past: boolean;
}) {
  const { data, isPending, isError, error } = useKardex(enabled ? adBlue.itemId : null);
  const unidad = UNIT_SYMBOLS[adBlue.unidad as UnitOfMeasure] ?? adBlue.unidad;
  const delDia = (data?.movements ?? []).filter((m) => toDateOnly(new Date(m.occurredAt)) === fecha);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{adBlue.nombre}</span>
        <span className="font-mono text-sm text-foreground">
          {`Saldo actual: ${NUM_CL_1.format(adBlue.stock)} ${unidad}`}
          {adBlue.stockLitros != null ? ` = ${NUM_CL_1.format(adBlue.stockLitros)} L` : ''}
        </span>
        {past ? (
          <span className="text-xs text-muted-foreground">
            El saldo es el vivo de Inventario; los movimientos listados sí son los del día consultado.
          </span>
        ) : null}
      </div>
      <div className="flex flex-col">
        <h4 className="mb-1.5 text-sm font-semibold text-foreground">Movimientos del {formatDia(fecha)}</h4>
        {isPending ? (
          <div className="flex justify-center py-4">
            <Spinner color="accent" size="sm" />
          </div>
        ) : null}
        {isError ? (
          <p className="text-sm text-danger-soft-foreground" role="alert">
            {error instanceof Error ? error.message : 'No se pudo cargar el kardex del ítem.'}
          </p>
        ) : null}
        {!isPending && !isError && delDia.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin movimientos este día.</p>
        ) : null}
        {delDia.map((m) => (
          <div className={ROW_LISTA} data-testid={`adblue-mov-${m.id}`} key={m.id}>
            <span className="font-mono text-xs text-muted-foreground">{HORA.format(new Date(m.occurredAt))}</span>
            <MovementKindChip kind={movementKind(m)} />
            <span className="text-xs text-muted-foreground">{MOVEMENT_REASON_LABELS[m.reason]}</span>
            {m.equipment ? (
              <span className="font-mono text-xs text-muted-foreground">{m.equipment.internalCode}</span>
            ) : null}
            <span className="ms-auto font-mono text-sm font-semibold text-foreground">
              {`${m.direction === 'IN' ? '+' : '−'}${NUM_CL_1.format(m.quantity)} ${unidad}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
