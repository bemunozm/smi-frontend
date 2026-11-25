import { useMemo, useState } from 'react';
import { AlertDialog, Button, Card, Modal, RangeCalendar, Spinner, Table, toast } from '@heroui/react';
import { Dialog, DialogTrigger, Popover } from 'react-aria-components';
import type { DateValue } from 'react-aria-components/Calendar';
import { CalendarDays } from 'lucide-react';

import { RecordPhoto } from '../components/RecordPhoto';
import { RESPONSIVE_SHEET_DIALOG_WIDE_CLASS } from '../components/flota/modal-styles';
import { CorregirTarjetaTemporalModal } from '../components/temporal/CorregirTarjetaTemporalModal';
import { EditarInformeTemporalModal } from '../components/temporal/EditarInformeTemporalModal';
import { Chip } from '../components/ui/Chip';
import { turnoLabel } from '../config/flota-colors';
import { useEliminarInformeTemporal, useInformesTemporales } from '../hooks/useInformesTemporales';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { usePermissions } from '../hooks/usePermissions';
import { NUM_CL, NUM_CL_1 } from '../lib/dashboard-format';
import { construirExcelInformesTemporales } from '../lib/informe-temporal-excel';
import { canDeleteInformeTemporal } from '../lib/permissions';
import { toDateOnly } from '../lib/turno';
import type { InformeTemporal } from '../types/informe-temporal';

/** Días que cubre el rango inicial (hoy incluido). */
const DIAS_INICIALES = 30;

const legible = (dia: string) => dia.split('-').reverse().join('-');
const fmtDiaRango = (dia: DateValue) => dia.toString().split('-').reverse().join('/');

const fmtHora = new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' });
const hora = (iso: string | null) => (iso ? fmtHora.format(new Date(iso)) : '—');

/** Rango por defecto: los últimos 30 días. */
function rangoInicial(): { desde: string; hasta: string } {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (DIAS_INICIALES - 1));
  return { desde: toDateOnly(inicio), hasta: toDateOnly(hoy) };
}

const equiposDe = (informe: InformeTemporal) => informe.tarjetas.map((t) => t.equipo.internalCode).join(', ') || '—';

const actividadesDe = (informe: InformeTemporal) =>
  [informe.actividad1, informe.actividad2].filter(Boolean).join(' · ');

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3.5 border-t border-separator py-2.5">
      <span className="shrink-0 text-[11px] font-bold tracking-wider text-(--label-color) uppercase">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

/** Detalle completo del informe: datos, personal por actividad, tarjetas con su
 * foto del surtidor. «Corregir» (ADMIN y SECRETARIA) y «Eliminar» (ADMIN); cada
 * tarjeta cerrada trae su propio «Corregir» para las lecturas y los litros. */
function DetalleInformeModal({
  informe,
  onClose,
  onCorregir,
  onCorregirTarjeta,
  onEliminar,
}: {
  informe: InformeTemporal | null;
  onClose: () => void;
  onCorregir?: () => void;
  onCorregirTarjeta?: (tarjetaId: string) => void;
  onEliminar?: () => void;
}) {
  const personalDe = (actividad: 1 | 2) =>
    (informe?.personal ?? [])
      .filter((p) => p.actividad === actividad)
      .map((p) => p.nombre)
      .join(', ') || '—';
  return (
    <Modal.Backdrop
      isDismissable
      isOpen={informe !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={`${RESPONSIVE_SHEET_DIALOG_WIDE_CLASS} sm:w-full`}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              {informe ? `Informe N° ${informe.numero} · ${legible(informe.fecha)}` : ''}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {informe ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-x-7 sm:grid-cols-2 [&>*:first-child]:border-t-0 sm:[&>*:nth-child(2)]:border-t-0">
                  <Dato label="Fecha" value={legible(informe.fecha)} />
                  <Dato label="Turno" value={turnoLabel(informe.turno)} />
                  <Dato label="Supervisor" value={informe.supervisorNombre} />
                  <Dato
                    label="Responsables"
                    value={[informe.supervisorResponsable1, informe.supervisorResponsable2].filter(Boolean).join(' · ')}
                  />
                  <Dato label="Actividad 1" value={informe.actividad1} />
                  <Dato label="Personal act. 1" value={personalDe(1)} />
                  <Dato label="Actividad 2" value={informe.actividad2 ?? '—'} />
                  <Dato label="Personal act. 2" value={personalDe(2)} />
                  <Dato label="Inicio" value={hora(informe.inicio)} />
                  <Dato label="Envío" value={hora(informe.fin)} />
                </div>
                <div className="flex flex-col gap-1 border-t border-separator pt-2.5">
                  <span className="text-[11px] font-bold tracking-wider text-(--label-color) uppercase">
                    Observaciones
                  </span>
                  <p className="m-0 text-sm whitespace-pre-wrap text-foreground">{informe.observaciones ?? '—'}</p>
                </div>
                <div className="flex flex-col gap-3">
                  <span className="text-[11px] font-bold tracking-wider text-(--label-color) uppercase">
                    Equipos · {informe.tarjetas.length}
                  </span>
                  {informe.tarjetas.map((t) => (
                    <div key={t.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          <span className="font-mono">{t.equipo.internalCode}</span> · {t.equipo.name}
                        </span>
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                          {t.operador}
                          {onCorregirTarjeta && t.valorFinal != null ? (
                            <Button
                              aria-label={`Corregir lecturas de ${t.equipo.internalCode}`}
                              onPress={() => onCorregirTarjeta(t.id)}
                              size="sm"
                              variant="secondary"
                            >
                              Corregir
                            </Button>
                          ) : null}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        <span>Inicial: {NUM_CL_1.format(t.valorInicial)}</span>
                        <span>Final: {t.valorFinal == null ? '—' : NUM_CL_1.format(t.valorFinal)}</span>
                        <span>Combustible: {t.fuelLiters == null ? '—' : `${NUM_CL_1.format(t.fuelLiters)} L`}</span>
                        <span>AdBlue: {t.adBlueLiters == null ? '—' : `${NUM_CL_1.format(t.adBlueLiters)} L`}</span>
                      </div>
                      {t.pumpPhotoUrl ? (
                        <RecordPhoto
                          alt={`Foto del surtidor de ${t.equipo.internalCode}`}
                          src={t.pumpPhotoUrl}
                          maxHeightClassName="max-h-60"
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Modal.Body>
          {onCorregir || onEliminar ? (
            <Modal.Footer>
              {onEliminar ? (
                <Button onPress={onEliminar} variant="danger-soft">
                  Eliminar
                </Button>
              ) : null}
              {onCorregir ? <Button onPress={onCorregir}>Corregir</Button> : null}
            </Modal.Footer>
          ) : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/**
 * «Report supervisor temporal» (ADMIN y SECRETARIA): los informes que envían los
 * supervisores temporales al cerrar sus equipos, por rango de fechas. El detalle
 * trae todo el informe con las fotos de cada tarjeta; ADMIN y SECRETARIA lo
 * corrigen (los datos del informe y, tarjeta por tarjeta, sus lecturas y
 * litros) y solo ADMIN lo elimina, con confirmación. «Exportar Excel» baja el rango filtrado, una fila por tarjeta.
 */
export function InformesTemporalesAdminView() {
  const [range, setRange] = useState<{ start: DateValue; end: DateValue } | null>(null);
  const [periodoAbierto, setPeriodoAbierto] = useState(false);
  const inicial = useMemo(rangoInicial, []);
  const desde = range?.start.toString() ?? inicial.desde;
  const hasta = range?.end.toString() ?? inicial.hasta;
  const { data, isPending, isError, error } = useInformesTemporales(desde, hasta);

  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [corrigiendoId, setCorrigiendoId] = useState<string | null>(null);
  // Tarjeta en corrección y el informe al que se vuelve al cerrarla.
  const [corrigiendoTarjeta, setCorrigiendoTarjeta] = useState<{ informeId: string; tarjetaId: string } | null>(null);
  const [eliminando, setEliminando] = useState<InformeTemporal | null>(null);
  const permisos = usePermissions();
  const puedeCorregir = permisos.can('informeTemporal.update');
  // Lecturas y litros de cada tarjeta: `PATCH /shift-cards/:id`, que la
  // SECRETARIA solo puede sobre tarjetas temporales (todas las de un informe).
  const puedeCorregirTarjetas = permisos.can('shiftCard.edit');
  const puedeEliminar = canDeleteInformeTemporal(permisos.role);
  const eliminar = useEliminarInformeTemporal();
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);

  const informes = useMemo(
    () => [...(data ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero - a.numero),
    [data],
  );
  // El detalle y la corrección se leen de la lista: tras corregir, se refresca sola.
  const detalle = informes.find((i) => i.id === detalleId) ?? null;
  const corrigiendo = informes.find((i) => i.id === corrigiendoId) ?? null;
  const tarjetaEnCorreccion =
    informes
      .find((i) => i.id === corrigiendoTarjeta?.informeId)
      ?.tarjetas.find((t) => t.id === corrigiendoTarjeta?.tarjetaId) ?? null;

  const exportarExcel = async () => {
    try {
      const buffer = await construirExcelInformesTemporales(informes);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `Report_supervisor_temporal_${desde}_a_${hasta}.xlsx`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch {
      // Típico: sin señal no baja el módulo del Excel (import dinámico).
      toast.danger('No se pudo generar el Excel. Revisa la conexión e inténtalo de nuevo.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
            SMI · Report supervisor temporal
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            Report supervisor temporal
          </h1>
          <p className="text-sm text-muted-foreground">
            Informes de los supervisores temporales. Abre uno para ver el detalle, corregirlo o exportarlo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip color="accent" data-testid="total-filtrado" size="md" variant="soft">
            {NUM_CL.format(informes.length)} {informes.length === 1 ? 'informe' : 'informes'}
          </Chip>
          <Button isDisabled={informes.length === 0} onPress={() => void exportarExcel()} variant="secondary">
            Exportar Excel
          </Button>
        </div>
      </div>

      <Card>
        <Card.Header>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Card.Title>Informes</Card.Title>
              <Card.Description>Del más reciente al más antiguo, dentro del período elegido.</Card.Description>
            </div>
            <div className="flex flex-col gap-1">
              <DialogTrigger isOpen={periodoAbierto} onOpenChange={setPeriodoAbierto}>
                <Button className="justify-start" variant="secondary">
                  <CalendarDays aria-hidden className="size-[18px]" />
                  {range ? `${fmtDiaRango(range.start)} → ${fmtDiaRango(range.end)}` : 'Últimos 30 días'}
                </Button>
                <Popover
                  className="rounded-2xl border border-border bg-card p-2 shadow-[0_18px_44px_rgba(20,23,28,.18)] outline-none"
                  offset={6}
                >
                  <Dialog aria-label="Período" className="outline-none">
                    <RangeCalendar
                      onChange={(valor) => {
                        setRange(valor);
                        setPeriodoAbierto(false);
                      }}
                      value={range}
                    >
                      <RangeCalendar.Header>
                        <RangeCalendar.NavButton slot="previous" />
                        <RangeCalendar.Heading />
                        <RangeCalendar.NavButton slot="next" />
                      </RangeCalendar.Header>
                      <RangeCalendar.Grid>
                        <RangeCalendar.GridHeader>
                          {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                        </RangeCalendar.GridHeader>
                        <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
                      </RangeCalendar.Grid>
                    </RangeCalendar>
                  </Dialog>
                </Popover>
              </DialogTrigger>
              {range ? (
                <button
                  className="self-end text-sm font-semibold text-(--accent) hover:underline"
                  onClick={() => setRange(null)}
                  type="button"
                >
                  Volver a los últimos 30 días
                </button>
              ) : null}
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
              {error instanceof Error ? error.message : 'No se pudieron cargar los informes.'}
            </p>
          ) : null}

          {!isPending && !isError && informes.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No hay informes en este período.</p>
          ) : null}

          {!isPending && !isError && informes.length > 0 && !esEscritorio ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {informes.map((i) => (
                <li key={i.id}>
                  <button
                    className="flex w-full cursor-pointer flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-left hover:bg-default"
                    data-testid={`informe-fila-${i.id}`}
                    onClick={() => setDetalleId(i.id)}
                    type="button"
                  >
                    <span className="text-[15px] font-semibold text-foreground">
                      <span className="font-mono">#{i.numero}</span> · {legible(i.fecha)} · {turnoLabel(i.turno)}
                    </span>
                    <span className="text-sm text-foreground">{i.supervisorNombre}</span>
                    <span className="text-sm text-muted-foreground">{actividadesDe(i)}</span>
                    <span className="font-mono text-sm text-foreground">{equiposDe(i)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {!isPending && !isError && informes.length > 0 && esEscritorio ? (
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Informes de supervisores temporales" className="min-w-full">
                  <Table.Header>
                    <Table.Column isRowHeader>#</Table.Column>
                    <Table.Column>Fecha</Table.Column>
                    <Table.Column>Turno</Table.Column>
                    <Table.Column>Supervisor</Table.Column>
                    <Table.Column className="w-full">Actividades</Table.Column>
                    <Table.Column>Equipos</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {informes.map((i) => (
                      <Table.Row
                        className="cursor-pointer"
                        data-testid={`informe-fila-${i.id}`}
                        key={i.id}
                        onAction={() => setDetalleId(i.id)}
                      >
                        <Table.Cell className="font-mono text-sm font-semibold whitespace-nowrap">
                          {i.numero}
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap text-muted-foreground">
                          {legible(i.fecha)}
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap">{turnoLabel(i.turno)}</Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap">{i.supervisorNombre}</Table.Cell>
                        <Table.Cell className="max-w-0 truncate text-sm">{actividadesDe(i)}</Table.Cell>
                        <Table.Cell className="font-mono text-sm whitespace-nowrap">{equiposDe(i)}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          ) : null}
        </Card.Content>
      </Card>

      <DetalleInformeModal
        informe={detalle}
        onClose={() => setDetalleId(null)}
        onCorregir={
          puedeCorregir
            ? () => {
                setCorrigiendoId(detalleId);
                setDetalleId(null);
              }
            : undefined
        }
        onCorregirTarjeta={
          puedeCorregirTarjetas && detalleId
            ? (tarjetaId) => {
                setCorrigiendoTarjeta({ informeId: detalleId, tarjetaId });
                setDetalleId(null);
              }
            : undefined
        }
        onEliminar={
          puedeEliminar
            ? () => {
                setEliminando(detalle);
                setDetalleId(null);
              }
            : undefined
        }
      />

      {corrigiendo ? <EditarInformeTemporalModal informe={corrigiendo} onClose={() => setCorrigiendoId(null)} /> : null}

      {tarjetaEnCorreccion && corrigiendoTarjeta ? (
        <CorregirTarjetaTemporalModal
          tarjeta={tarjetaEnCorreccion}
          onClose={() => {
            // Vuelve al detalle del informe, ya con la lista refrescada.
            setDetalleId(corrigiendoTarjeta.informeId);
            setCorrigiendoTarjeta(null);
          }}
        />
      ) : null}

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
                  <AlertDialog.Heading>¿Eliminar informe?</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>
                    El informe N° {eliminando?.numero} de {eliminando?.supervisorNombre} se eliminará definitivamente,
                    junto con sus tarjetas y fotos. Esta acción no se puede deshacer.
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
