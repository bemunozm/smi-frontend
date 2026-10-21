import { useMemo, useState } from 'react';
import { Card, Chip, Modal, Spinner, Table } from '@heroui/react';

import { useReportesDiarios } from '../hooks/useReporteDiario';
import { RESPONSIVE_SHEET_DIALOG_WIDE_CLASS } from '../components/flota/modal-styles';
import { NUM_CL } from '../lib/dashboard-format';
import { fromDateOnly } from '../lib/turno';
import { SECCION_LABEL, TRASPASO_LABEL } from '../types/reporte-diario';
import type { ReporteDiario } from '../types/reporte-diario';

const TURNO_LABEL: Record<string, string> = { DIURNO: 'Diurno', NOCTURNO: 'Nocturno' };

/** `fecha` es un `@db.Date` serializado (T00:00:00.000Z): el día válido es el
 * de la parte de fecha, nunca `new Date(iso)` directo (corre el día en Chile). */
function diaDe(reporte: ReporteDiario): string {
  return reporte.fecha.slice(0, 10);
}

function formatFechaReporte(reporte: ReporteDiario): string {
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    fromDateOnly(diaDe(reporte)),
  );
}

/** Vueltas totales del reporte: Σ camiones × vueltas por camión de cada sección. */
function vueltasTotales(reporte: ReporteDiario): number {
  return reporte.produccion.reduce((acc, p) => acc + p.camiones * p.vueltasPorCamion, 0);
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3.5 border-t border-separator py-2.5">
      <span className="shrink-0 text-[11px] font-bold tracking-wider text-(--label-color) uppercase">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold tracking-wider text-(--label-color) uppercase">{titulo}</span>
      {children}
    </div>
  );
}

/** Popup con el reporte completo, solo lectura: las correcciones siguen
 * saliendo de Terreno, con su historial de cambios. */
function DetalleReporteModal({ reporte, onClose }: { reporte: ReporteDiario | null; onClose: () => void }) {
  const personal = reporte ? [...reporte.personal].sort((a, b) => a.orden - b.orden) : [];
  return (
    <Modal.Backdrop
      isDismissable
      isOpen={reporte !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={`${RESPONSIVE_SHEET_DIALOG_WIDE_CLASS} sm:w-full`}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              {reporte
                ? `Reporte diario · ${formatFechaReporte(reporte)} · ${TURNO_LABEL[reporte.turno] ?? reporte.turno}`
                : 'Reporte diario'}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {reporte ? (
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-x-7 sm:grid-cols-2 [&>*:first-child]:border-t-0 sm:[&>*:nth-child(2)]:border-t-0">
                  <Dato label="Supervisor" value={reporte.supervisorNombre} />
                  <Dato label="Turno" value={TURNO_LABEL[reporte.turno] ?? reporte.turno} />
                  <Dato label="Vueltas totales" value={NUM_CL.format(vueltasTotales(reporte))} />
                  <Dato
                    label="Empresas externas"
                    value={
                      reporte.empresas.length > 0
                        ? reporte.empresas.map((e) => e.empresa.nombre).join(', ')
                        : '—'
                    }
                  />
                </div>

                <Bloque titulo="Producción por sección">
                  {reporte.produccion.map((p) => (
                    <div
                      className="flex flex-wrap items-center gap-2 border-t border-border py-2 first:border-t-0"
                      data-testid={`detalle-seccion-${p.seccion}`}
                      key={p.seccion}
                    >
                      <span className="text-sm text-foreground">{SECCION_LABEL[p.seccion] ?? p.seccion}</span>
                      <span className="ms-auto font-mono text-sm text-muted-foreground">
                        {NUM_CL.format(p.camiones)} {p.camiones === 1 ? 'camión' : 'camiones'} ×{' '}
                        {NUM_CL.format(p.vueltasPorCamion)} vueltas
                      </span>
                      <span className="w-24 text-end font-mono text-sm font-semibold text-foreground">
                        {NUM_CL.format(p.camiones * p.vueltasPorCamion)}
                      </span>
                    </div>
                  ))}
                </Bloque>

                {reporte.tolvas.length > 0 ? (
                  <Bloque titulo="Cargas por tolva">
                    <div className="flex flex-wrap gap-2">
                      {reporte.tolvas.map((t) => (
                        <Chip color="default" key={t.tolva} size="sm" variant="soft">
                          Tolva {t.tolva}: {NUM_CL.format(t.cargas)}
                        </Chip>
                      ))}
                    </div>
                  </Bloque>
                ) : null}

                {reporte.plantas.length > 0 ? (
                  <Bloque titulo="Plantas">
                    {reporte.plantas.map((p) => (
                      <div
                        className="flex items-center justify-between gap-3 border-t border-border py-2 first:border-t-0"
                        key={p.plantaId}
                      >
                        <span className="text-sm text-foreground">{p.planta.nombre}</span>
                        <span className="text-sm text-muted-foreground">{p.producto}</span>
                      </div>
                    ))}
                  </Bloque>
                ) : null}

                {reporte.traspasos.length > 0 ? (
                  <Bloque titulo="Traspasos">
                    {reporte.traspasos.map((t) => (
                      <div
                        className="flex items-center justify-between gap-3 border-t border-border py-2 first:border-t-0"
                        key={t.tipo}
                      >
                        <span className="text-sm text-foreground">{TRASPASO_LABEL[t.tipo] ?? t.tipo}</span>
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {NUM_CL.format(t.cantidad)}
                        </span>
                      </div>
                    ))}
                  </Bloque>
                ) : null}

                {personal.length > 0 ? (
                  <Bloque titulo="Personal del turno">
                    {personal.map((p) => (
                      <div
                        className="flex items-center justify-between gap-3 border-t border-border py-2 first:border-t-0"
                        key={`${p.rol}-${p.orden}`}
                      >
                        <span className="text-sm text-muted-foreground">{p.rol}</span>
                        <span className="text-sm text-foreground">{p.nombre}</span>
                      </div>
                    ))}
                  </Bloque>
                ) : null}

                {reporte.observaciones ? (
                  <Bloque titulo="Observaciones">
                    <p className="text-sm text-foreground">{reporte.observaciones}</p>
                  </Bloque>
                ) : null}
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
 * Vista de reportes diarios del ADMINISTRADOR (`/reportes-diarios`, ruta solo
 * ADMIN): todos los reportes que los supervisores envían desde Terreno, con
 * filtros por día y por supervisor; cada fila abre el detalle completo en un
 * popup. Solo lectura — las correcciones siguen saliendo de Terreno, con su
 * historial de cambios.
 */
export function ReportesDiariosAdminView() {
  const { data, isPending, isError, error } = useReportesDiarios();
  const [dia, setDia] = useState('');
  const [supervisorFiltro, setSupervisorFiltro] = useState('TODOS');
  const [detalle, setDetalle] = useState<ReporteDiario | null>(null);

  // El backend ya entrega fecha desc, turno asc — se respeta tal cual.
  const reportes = data ?? [];

  const supervisores = useMemo(() => {
    const porId = new Map<string, string>();
    for (const r of reportes) porId.set(r.supervisorId, r.supervisorNombre);
    return [...porId.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [reportes]);

  const lista = useMemo(
    () =>
      reportes.filter((r) => {
        if (supervisorFiltro !== 'TODOS' && r.supervisorId !== supervisorFiltro) return false;
        if (dia && diaDe(r) !== dia) return false;
        return true;
      }),
    [reportes, supervisorFiltro, dia],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
            SMI · Reportes diarios
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            Reportes diarios
          </h1>
          <p className="text-sm text-muted-foreground">
            Los reportes de producción que envían los supervisores desde terreno. Abre uno para ver su detalle.
          </p>
        </div>
        <Chip color="accent" data-testid="total-reportes" size="md" variant="soft">
          {NUM_CL.format(lista.length)} {lista.length === 1 ? 'reporte' : 'reportes'}
        </Chip>
      </div>

      <Card>
        <Card.Header>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Card.Title>Listado</Card.Title>
              <Card.Description>Del más reciente al más antiguo.</Card.Description>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Supervisor
                <select
                  className={SELECT_FILTRO}
                  onChange={(event) => setSupervisorFiltro(event.target.value)}
                  value={supervisorFiltro}
                >
                  <option value="TODOS">Todos</option>
                  {supervisores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Día
                <input
                  className={SELECT_FILTRO}
                  onChange={(event) => setDia(event.target.value)}
                  type="date"
                  value={dia}
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
              {error instanceof Error ? error.message : 'No se pudo cargar los reportes diarios.'}
            </p>
          ) : null}

          {!isPending && !isError && lista.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              {reportes.length === 0 ? 'No hay reportes diarios registrados.' : 'Ningún reporte calza con el filtro.'}
            </p>
          ) : null}

          {!isPending && !isError && lista.length > 0 ? (
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Reportes diarios" className="min-w-full">
                  <Table.Header>
                    <Table.Column isRowHeader>Fecha</Table.Column>
                    <Table.Column>Turno</Table.Column>
                    <Table.Column>Supervisor</Table.Column>
                    <Table.Column className="text-right">Vueltas</Table.Column>
                    <Table.Column className="w-full">Observaciones</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {lista.map((r) => (
                      <Table.Row
                        className="cursor-pointer"
                        data-testid={`reporte-fila-${r.id}`}
                        key={r.id}
                        onAction={() => setDetalle(r)}
                      >
                        <Table.Cell className="text-sm whitespace-nowrap text-muted-foreground">
                          {formatFechaReporte(r)}
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap">
                          {TURNO_LABEL[r.turno] ?? r.turno}
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap">{r.supervisorNombre}</Table.Cell>
                        <Table.Cell className="text-right font-mono text-sm font-semibold whitespace-nowrap">
                          {NUM_CL.format(vueltasTotales(r))}
                        </Table.Cell>
                        <Table.Cell className="max-w-0 truncate text-sm text-muted-foreground">
                          {r.observaciones ?? '—'}
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

      <DetalleReporteModal reporte={detalle} onClose={() => setDetalle(null)} />
    </div>
  );
}
