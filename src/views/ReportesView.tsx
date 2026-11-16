import { useState } from 'react';
import { AlertDialog, Button, Card, Chip, Spinner, Table } from '@heroui/react';
import { Download, Eye, Trash2 } from 'lucide-react';

import { ShiftReportAPI } from '../api/ShiftReportAPI';
import { RegistroTurnoModal } from '../components/reportes/RegistroTurnoModal';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { usePermissions } from '../hooks/usePermissions';
import { useDeleteShiftReport, useShiftReports } from '../hooks/useShiftReports';
import { turnoLabel } from '../config/flota-colors';
import { canDeleteShiftReport } from '../lib/permissions';
import { fromDateOnly } from '../lib/turno';
import type { ShiftReportListItem } from '../types/shift';

/** Estado del correo del envío — mismo vocabulario que
 * `ShiftExitReport.emailStatus` del backend. SKIPPED = sin SMTP configurado:
 * el aviso al administrador quedó solo in-app. */
const CORREO: Record<string, { label: string; color: 'success' | 'danger' | 'warning' | 'default' }> = {
  SENT: { label: 'Correo enviado', color: 'success' },
  FAILED: { label: 'Correo falló', color: 'danger' },
  PENDING: { label: 'Correo pendiente', color: 'warning' },
  SKIPPED: { label: 'Sin correo', color: 'default' },
};

function formatDia(dateOnly: string): string {
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    fromDateOnly(dateOnly),
  );
}

function formatEnviado(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function EstadoCorreo({ reporte }: { reporte: ShiftReportListItem }) {
  const estado = CORREO[reporte.emailStatus] ?? { label: reporte.emailStatus, color: 'default' as const };
  return (
    <Chip color={estado.color} size="sm" variant="soft">
      {estado.label}
    </Chip>
  );
}

/**
 * Tablet y celular: la misma tabla que el Informe de producción diaria, con
 * las columnas esenciales (fecha, turno, supervisor, equipos, enviado). La
 * fila abre el registro, y ahí están el PDF y «Eliminar registro».
 */
function TablaCompacta({
  reportes,
  onVer,
  puedeEliminar,
}: {
  reportes: ShiftReportListItem[];
  onVer: (reporte: ShiftReportListItem) => void;
  puedeEliminar: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-xs text-muted-foreground">
        {puedeEliminar
          ? 'Toca un envío para ver su registro, descargar el PDF o eliminarlo.'
          : 'Toca un envío para ver su registro o descargar el PDF.'}
      </p>
      <Table variant="secondary">
        <Table.ScrollContainer>
          <Table.Content aria-label="Informe diario equipos" className="min-w-full">
            <Table.Header>
              <Table.Column isRowHeader>Fecha</Table.Column>
              <Table.Column>Turno</Table.Column>
              <Table.Column>Supervisor</Table.Column>
              <Table.Column className="text-right">Equipos</Table.Column>
              <Table.Column>Enviado</Table.Column>
            </Table.Header>
            <Table.Body>
              {reportes.map((reporte) => (
                <Table.Row
                  className="cursor-pointer"
                  data-testid={`reporte-fila-${reporte.id}`}
                  key={reporte.id}
                  onAction={() => onVer(reporte)}
                >
                  <Table.Cell className="text-sm whitespace-nowrap text-muted-foreground">
                    {formatDia(reporte.shiftDate)}
                  </Table.Cell>
                  <Table.Cell className="text-sm whitespace-nowrap">{turnoLabel(reporte.shiftType)}</Table.Cell>
                  <Table.Cell className="text-sm whitespace-nowrap">{reporte.supervisor ?? '—'}</Table.Cell>
                  <Table.Cell className="text-right font-mono text-sm font-semibold whitespace-nowrap">
                    {reporte.cardCount}
                  </Table.Cell>
                  <Table.Cell className="text-sm whitespace-nowrap text-muted-foreground">
                    {formatEnviado(reporte.createdAt)}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
  );
}

/**
 * Vista «Informe diario equipos» del panel (`/reportes`, ADMIN y SECRETARIA):
 * el registro de los reportes de salida de turno que envían los supervisores
 * desde Terreno — qué equipos se usaron en el día, con qué operadores y qué
 * supervisor a cargo. «Ver registro» abre las tarjetas del turno
 * (`RegistroTurnoModal`; el administrador puede corregirlas). Cada fila descarga el MISMO PDF que genera el envío
 * (`GET /api/shift-reports/:id/file`, URL firmada; el navegador manda la
 * cookie solo, por eso es un `<a>` y no un fetch). «Eliminar» (solo ADMIN)
 * borra un envío duplicado, previa confirmación y con traza en el Registro de
 * actividad; las tarjetas del turno no se tocan.
 */
export function ReportesView() {
  const { data, isPending, isError, error } = useShiftReports();
  const reportes = data ?? [];
  // En escritorio, la tabla completa con sus acciones; en tablet y celular, la
  // tabla compacta (`TablaCompacta`).
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);
  const [abierto, setAbierto] = useState<ShiftReportListItem | null>(null);
  const [eliminando, setEliminando] = useState<ShiftReportListItem | null>(null);
  const puedeEliminar = canDeleteShiftReport(usePermissions().role);
  const eliminar = useDeleteShiftReport();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
            SMI · Informe diario equipos
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            Informe diario equipos
          </h1>
          <p className="text-sm text-muted-foreground">
            Lo que cada supervisor reportó al cerrar su turno: equipos usados en el día, operadores a cargo y el
            PDF para descargar.
          </p>
        </div>
        <Chip color="accent" data-testid="total-reportes" size="md" variant="soft">
          {reportes.length.toLocaleString('es-CL')} {reportes.length === 1 ? 'reporte' : 'reportes'}
        </Chip>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Registro</Card.Title>
          <Card.Description>Del más reciente al más antiguo. Un turno puede tener más de un envío.</Card.Description>
        </Card.Header>
        <Card.Content>
          {isPending ? (
            <div className="flex justify-center py-10">
              <Spinner color="accent" size="sm" />
            </div>
          ) : null}

          {isError ? (
            <p className="text-sm text-danger-soft-foreground" role="alert">
              {error instanceof Error ? error.message : 'No se pudo cargar los reportes de salida.'}
            </p>
          ) : null}

          {!isPending && !isError && reportes.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Todavía no hay reportes de salida: aparecen acá cuando un supervisor toca «Enviar reporte de salida»
              en Terreno.
            </p>
          ) : null}

          {!isPending && !isError && reportes.length > 0 && !esEscritorio ? (
            <TablaCompacta onVer={setAbierto} puedeEliminar={puedeEliminar} reportes={reportes} />
          ) : null}

          {!isPending && !isError && reportes.length > 0 && esEscritorio ? (
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Informe diario equipos" className="min-w-full">
                  <Table.Header>
                    <Table.Column isRowHeader>Turno reportado</Table.Column>
                    <Table.Column>Turno</Table.Column>
                    <Table.Column className="w-full">Supervisor</Table.Column>
                    <Table.Column className="text-right">Equipos</Table.Column>
                    <Table.Column>Enviado</Table.Column>
                    <Table.Column>Correo</Table.Column>
                    <Table.Column>Registro</Table.Column>
                    <Table.Column>PDF</Table.Column>
                    {puedeEliminar ? <Table.Column>Eliminar</Table.Column> : null}
                  </Table.Header>
                  <Table.Body>
                    {reportes.map((reporte) => (
                      <Table.Row data-testid={`reporte-fila-${reporte.id}`} key={reporte.id}>
                        <Table.Cell className="text-sm whitespace-nowrap text-muted-foreground">
                          {formatDia(reporte.shiftDate)}
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap">{turnoLabel(reporte.shiftType)}</Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap">{reporte.supervisor ?? '—'}</Table.Cell>
                        <Table.Cell className="text-right font-mono text-sm whitespace-nowrap">
                          {reporte.cardCount}
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap text-muted-foreground">
                          {formatEnviado(reporte.createdAt)}
                        </Table.Cell>
                        <Table.Cell className="whitespace-nowrap">
                          <EstadoCorreo reporte={reporte} />
                        </Table.Cell>
                        <Table.Cell className="whitespace-nowrap">
                          <Button onPress={() => setAbierto(reporte)} size="sm" variant="secondary">
                            <Eye aria-hidden size={15} />
                            Ver registro
                          </Button>
                        </Table.Cell>
                        <Table.Cell className="whitespace-nowrap">
                          <a
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-(--accent) hover:underline"
                            href={ShiftReportAPI.fileUrl(reporte.id)}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <Download aria-hidden size={15} />
                            Descargar PDF
                          </a>
                        </Table.Cell>
                        {puedeEliminar ? (
                          <Table.Cell className="whitespace-nowrap">
                            <Button
                              aria-label={`Eliminar el envío de ${reporte.supervisor ?? 'este supervisor'}`}
                              isIconOnly
                              onPress={() => setEliminando(reporte)}
                              size="sm"
                              variant="danger-soft"
                            >
                              <Trash2 aria-hidden size={15} />
                            </Button>
                          </Table.Cell>
                        ) : null}
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          ) : null}
        </Card.Content>
      </Card>

      <RegistroTurnoModal
        reporte={abierto}
        onClose={() => setAbierto(null)}
        onEliminar={
          puedeEliminar && abierto
            ? () => {
                setEliminando(abierto);
                setAbierto(null);
              }
            : undefined
        }
      />

      <AlertDialog.Backdrop
        isOpen={eliminando !== null}
        onOpenChange={(open) => {
          if (!open) setEliminando(null);
        }}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-105">
            {({ close }) => (
              <>
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status="danger" />
                  <AlertDialog.Heading>¿Eliminar este envío?</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>
                    El envío del {eliminando ? formatDia(eliminando.shiftDate) : ''} (
                    {eliminando ? turnoLabel(eliminando.shiftType) : ''}) de{' '}
                    {eliminando?.supervisor ?? 'este supervisor'}, enviado el{' '}
                    {eliminando ? formatEnviado(eliminando.createdAt) : ''}, se eliminará definitivamente junto con su
                    PDF. Las tarjetas del turno no se tocan y el borrado quedará anotado en el Registro de actividad.
                    Esta acción no se puede deshacer.
                  </p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button onPress={close} variant="tertiary">
                    Cancelar
                  </Button>
                  <Button
                    isPending={eliminar.isPending}
                    onPress={() => {
                      if (!eliminando) return;
                      eliminar.mutate(eliminando.id, {
                        onSuccess: () => {
                          close();
                          setEliminando(null);
                        },
                      });
                    }}
                    variant="danger"
                  >
                    {eliminar.isPending ? <Spinner color="current" size="sm" /> : 'Eliminar'}
                  </Button>
                </AlertDialog.Footer>
              </>
            )}
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}
