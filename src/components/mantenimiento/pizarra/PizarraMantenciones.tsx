import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, Chip, Spinner, Table, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { ClipboardList, History } from 'lucide-react';

import { useMaintenanceBoard, useMaintenanceForecastByEquipment } from '../../../hooks/useMaintenancePlans';
import { DESKTOP_QUERY, useMediaQuery } from '../../../hooks/useMediaQuery';
import { usePermissions } from '../../../hooks/usePermissions';
import { diaCorto, lineaPronostico } from '../../../lib/pronostico';
import type { MaintenanceBoardRow } from '../../../types/maintenance-board';
import type { MaintenanceForecastRow } from '../../../types/maintenance-forecast';
import { MantencionAnteriorModal } from '../MantencionAnteriorModal';
import { PautaMantencionModal } from '../PautaMantencionModal';
import { MantencionARealizarModal } from './MantencionARealizarModal';
import { etiquetas, fechaCorta, lectura, ordenarFilas, textoPendientes, tono } from './pizarra';

type Panel = 'pesados' | 'livianos';

const TONO_CLASE = {
  atrasado: 'font-bold text-danger',
  alerta: 'font-semibold text-danger',
  normal: 'text-foreground',
} as const;

/** Lo que dice el «Horómetro actual» cuando el equipo no tiene lectura. */
const SIN_LECTURA = 'Sin lectura';

// Filas alternadas (gris marcado/blanco) con divisores verticales entre columnas y sin líneas horizontales. Las
// celdas de HeroUI son transparentes, así que el hover se fuerza a un gris más oscuro que la franja.
const CEBRA_FILA =
  'even:bg-default/70 odd:bg-surface [&_td]:border-b-0! [&_td:not(:last-child)]:border-r [&_td:not(:last-child)]:border-r-foreground/20 hover:[&_td]:bg-border!';

function Pendientes({ fila }: { fila: MaintenanceBoardRow }) {
  if (fila.source === 'SIN_PAUTA') return <span className="text-muted-foreground">—</span>;
  const texto = textoPendientes(fila);
  if (texto == null) return <span className="text-muted-foreground">{SIN_LECTURA}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`tabular-nums ${TONO_CLASE[tono(fila)]}`}>{texto}</span>
      {/* Sin último cambio el número sale de los hitos absolutos: se avisa
          para que nadie lo tome por exacto. */}
      {fila.estimated ? <span className="text-xs text-muted-foreground italic">estimado</span> : null}
    </span>
  );
}

/**
 * La fecha estimada sale del pronóstico por uso (ya recalculado en el backend
 * con la regla del último cambio), no de la pizarra: una sola fuente para la
 * fecha que se ve acá, en Equipos y en la ficha.
 */
function FechaEstimadaCelda({ fila, pronostico }: { fila: MaintenanceBoardRow; pronostico?: MaintenanceForecastRow }) {
  if (fila.source === 'SIN_PAUTA') return <span className="text-muted-foreground">—</span>;
  if ((fila.remaining != null && fila.remaining <= 0) || pronostico?.status === 'TOCA_AHORA') {
    return <span className="font-semibold text-danger">Vencida</span>;
  }
  if (!pronostico || pronostico.status === 'FALTAN_DATOS') {
    return <span className="text-muted-foreground">Sin datos de uso</span>;
  }
  if (pronostico.status === 'LEJANA') return <span className="text-muted-foreground">Más de un año</span>;
  if (pronostico.status === 'ESTIMADA' && pronostico.estimatedDate) {
    return (
      <span className="flex flex-col">
        <span className="font-medium tabular-nums">{diaCorto(pronostico.estimatedDate)}</span>
        {pronostico.suggestedDate ? (
          <span className="text-xs text-muted-foreground tabular-nums">mejor {diaCorto(pronostico.suggestedDate)}</span>
        ) : null}
      </span>
    );
  }
  return <span className="text-muted-foreground">{lineaPronostico(pronostico) ?? '—'}</span>;
}

/** Código y qué equipo es; los fuera de servicio lo dicen además de verse atenuados. */
function Equipo({ fila }: { fila: MaintenanceBoardRow }) {
  const detalle = [fila.type, [fila.brand, fila.model].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  return (
    <span className="flex flex-col">
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-mono font-semibold whitespace-nowrap text-foreground">{fila.internalCode}</span>
        {fila.status === 'OUT_OF_SERVICE' ? (
          <Chip color="danger" size="sm" variant="soft">
            Inoperativo
          </Chip>
        ) : null}
      </span>
      {detalle ? <span className="text-xs text-muted-foreground">{detalle}</span> : null}
    </span>
  );
}

/**
 * La pizarra de mantenciones: la versión en el sistema de la pizarra blanca de
 * faena (horas cambio, último cambio, próximo cambio, horómetro actual y horas
 * pendientes en rojo). Es la vista principal de Mantenciones del admin; el
 * registro de órdenes queda detrás de «Ver registro de mantención».
 *
 * Todos los números vienen del backend (`/maintenance-plans/board`), que usa
 * la misma regla que dispara las órdenes preventivas: la pizarra no puede
 * mostrar un próximo cambio distinto al del aviso.
 */
export function PizarraMantenciones({ onVerRegistro }: { onVerRegistro: () => void }) {
  const { data, isPending, isError, error } = useMaintenanceBoard();
  const { data: pronosticos } = useMaintenanceForecastByEquipment();
  const [params, setParams] = useSearchParams();
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);
  const { role, can } = usePermissions();
  // «Registrar mantención anterior» y «Asignar pauta» son del ADMIN (como en la
  // ficha y en Equipos): la SECRETARIA ve la pizarra sin esos botones.
  const esAdmin = role === 'ADMIN';
  const puedeEditarPauta = can('maintenancePlan.save');

  const panel: Panel = params.get('panel') === 'livianos' ? 'livianos' : 'pesados';
  const textos = etiquetas(panel);
  const [verItems, setVerItems] = useState<MaintenanceBoardRow | null>(null);
  const [anterior, setAnterior] = useState<MaintenanceBoardRow | null>(null);
  const [pauta, setPauta] = useState<MaintenanceBoardRow | null>(null);

  const filas = useMemo(
    () =>
      ordenarFilas(
        (data ?? []).filter((f) =>
          panel === 'livianos' ? f.equipmentClass === 'LIGHT' : f.equipmentClass === 'HEAVY',
        ),
      ),
    [data, panel],
  );

  const cambiarPanel = (siguiente: Panel) => {
    const nuevos = new URLSearchParams(params);
    if (siguiente === 'pesados') nuevos.delete('panel');
    else nuevos.set('panel', siguiente);
    setParams(nuevos, { replace: true });
  };

  const botonAnterior = (fila: MaintenanceBoardRow): ReactNode =>
    esAdmin ? (
      <Button onPress={() => setAnterior(fila)} size="sm" variant="secondary">
        <History className="size-4" />
        Registrar mantención anterior
      </Button>
    ) : (
      <span className="text-muted-foreground">—</span>
    );

  const sinPauta = (fila: MaintenanceBoardRow): ReactNode => (
    <span className="flex flex-wrap items-center gap-2">
      <Chip size="sm" variant="soft">
        Sin pauta
      </Chip>
      {esAdmin && fila.equipmentClass === 'HEAVY' ? (
        <Button onPress={() => setPauta(fila)} size="sm" variant="secondary">
          Asignar pauta
        </Button>
      ) : null}
    </span>
  );

  const botonVer = (fila: MaintenanceBoardRow, className?: string) => (
    <Button
      className={className}
      isDisabled={fila.source === 'SIN_PAUTA'}
      onPress={() => setVerItems(fila)}
      size="sm"
      variant="tertiary"
    >
      <ClipboardList className="size-4" />
      Ver mantención a realizar
    </Button>
  );

  const actual = (fila: MaintenanceBoardRow) => lectura(fila.counter, fila.unit) ?? SIN_LECTURA;
  const atenuada = (fila: MaintenanceBoardRow) => (fila.status === 'OUT_OF_SERVICE' ? 'opacity-60' : '');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleButtonGroup
          aria-label="Panel de equipos"
          disallowEmptySelection
          selectedKeys={new Set([panel])}
          selectionMode="single"
          onSelectionChange={(keys) => cambiarPanel(Array.from(keys)[0] === 'livianos' ? 'livianos' : 'pesados')}
        >
          <ToggleButton id="pesados">Equipos pesados</ToggleButton>
          <ToggleButton id="livianos">Equipos livianos</ToggleButton>
        </ToggleButtonGroup>
        <Button onPress={onVerRegistro} size="sm" variant="secondary">
          <History className="size-4" />
          Ver registro de mantención
        </Button>
      </div>

      <Card>
        <Card.Content>
          {isPending ? (
            <div className="flex justify-center py-10">
              <Spinner color="accent" size="sm" />
            </div>
          ) : null}

          {isError ? (
            <p className="text-sm text-danger-soft-foreground" role="alert">
              {error instanceof Error ? error.message : 'No se pudo cargar la pizarra de mantenciones.'}
            </p>
          ) : null}

          {!isPending && !isError && filas.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              {panel === 'livianos' ? 'No hay equipos livianos en la flota.' : 'No hay equipos pesados en la flota.'}
            </p>
          ) : null}

          {!isPending && !isError && filas.length > 0 && !esEscritorio ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {filas.map((fila) => (
                <li
                  className={`flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 ${atenuada(fila)}`}
                  data-testid={`pizarra-fila-${fila.equipmentId}`}
                  key={fila.equipmentId}
                >
                  <div className="flex items-start justify-between gap-3">
                    <Equipo fila={fila} />
                    {fila.source === 'SIN_PAUTA' ? sinPauta(fila) : null}
                  </div>
                  {/* Lo que se mira en la pizarra: dónde está, cuándo toca y cuánto falta. */}
                  <dl className="m-0 grid grid-cols-3 gap-2 rounded-xl bg-surface-secondary px-3 py-2.5 text-sm">
                    <Dato titulo={textos.actual}>
                      <span className="font-semibold tabular-nums">{actual(fila)}</span>
                    </Dato>
                    <Dato titulo="Próximo cambio">
                      <span className="font-semibold tabular-nums">{lectura(fila.dueAt, fila.unit) ?? '—'}</span>
                    </Dato>
                    <Dato titulo={textos.pendientes}>
                      <Pendientes fila={fila} />
                    </Dato>
                  </dl>
                  {fila.source !== 'SIN_PAUTA' ? (
                    <dl className="m-0 grid grid-cols-2 gap-2 text-sm">
                      <Dato titulo={textos.cambio}>
                        <span className="tabular-nums">{lectura(fila.interval, fila.unit) ?? '—'}</span>
                      </Dato>
                      <Dato titulo="Fecha estimada">
                        <FechaEstimadaCelda fila={fila} pronostico={pronosticos?.get(fila.equipmentId)} />
                      </Dato>
                      <Dato className="col-span-2" titulo="Último cambio">
                        {fila.lastChange ? (
                          <span className="tabular-nums">
                            {fechaCorta(fila.lastChange.doneAt)} · {lectura(fila.lastChange.counterAt, fila.unit)}
                          </span>
                        ) : (
                          botonAnterior(fila)
                        )}
                      </Dato>
                    </dl>
                  ) : null}
                  {botonVer(fila, 'w-full')}
                </li>
              ))}
            </ul>
          ) : null}

          {!isPending && !isError && filas.length > 0 && esEscritorio ? (
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content
                  aria-label={panel === 'livianos' ? 'Pizarra de equipos livianos' : 'Pizarra de equipos pesados'}
                  className="min-w-full"
                >
                  {/* Cabecera más oscura que el cuerpo y con línea inferior marcada */}
                  <Table.Header className="[&_th]:border-b-2 [&_th]:border-border [&_th:not(:last-child)]:border-r [&_th:not(:last-child)]:border-r-foreground/20 [&_th]:bg-border!">
                    <Table.Column isRowHeader>Equipo</Table.Column>
                    <Table.Column>{textos.cambio}</Table.Column>
                    <Table.Column>Fecha último cambio</Table.Column>
                    <Table.Column>{textos.ultimo}</Table.Column>
                    <Table.Column>{textos.proximo}</Table.Column>
                    <Table.Column>{textos.actual}</Table.Column>
                    <Table.Column>{textos.pendientes}</Table.Column>
                    <Table.Column>Fecha estimada de mantención</Table.Column>
                    <Table.Column>
                      <span className="sr-only">Acciones</span>
                    </Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {filas.map((fila) => (
                      <Table.Row
                        className={`${CEBRA_FILA} ${atenuada(fila)}`}
                        data-testid={`pizarra-fila-${fila.equipmentId}`}
                        id={fila.equipmentId}
                        key={fila.equipmentId}
                      >
                        <Table.Cell className="text-sm">
                          <Equipo fila={fila} />
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap tabular-nums">
                          {fila.source === 'SIN_PAUTA' ? sinPauta(fila) : (lectura(fila.interval, fila.unit) ?? '—')}
                        </Table.Cell>
                        {fila.lastChange ? (
                          <>
                            <Table.Cell className="text-sm whitespace-nowrap tabular-nums">
                              {fechaCorta(fila.lastChange.doneAt)}
                            </Table.Cell>
                            <Table.Cell className="text-sm whitespace-nowrap tabular-nums">
                              {lectura(fila.lastChange.counterAt, fila.unit)}
                            </Table.Cell>
                          </>
                        ) : (
                          // Sin último cambio las dos columnas se juntan en el botón
                          // para cargarlo: es lo que falta para contar desde ahí.
                          <Table.Cell className="text-sm" colSpan={2}>
                            {fila.source === 'SIN_PAUTA' ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              botonAnterior(fila)
                            )}
                          </Table.Cell>
                        )}
                        <Table.Cell className="text-sm whitespace-nowrap tabular-nums">
                          {lectura(fila.dueAt, fila.unit) ?? '—'}
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap tabular-nums">{actual(fila)}</Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap">
                          <Pendientes fila={fila} />
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap">
                          <FechaEstimadaCelda fila={fila} pronostico={pronosticos?.get(fila.equipmentId)} />
                        </Table.Cell>
                        <Table.Cell className="text-right">{botonVer(fila)}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          ) : null}
        </Card.Content>
      </Card>

      <MantencionARealizarModal fila={verItems} onClose={() => setVerItems(null)} />

      {anterior ? (
        <MantencionAnteriorModal
          equipo={{
            id: anterior.equipmentId,
            internalCode: anterior.internalCode,
            controlUnit: anterior.unit === 'km' ? 'KM' : 'HOURS',
          }}
          isOpen
          // La pizarra siempre pide la lectura; con pauta, además, qué hito fue
          // (de ahí cuenta el próximo cambio). Un liviano no tiene hitos.
          lecturaObligatoria
          onOpenChange={(open) => {
            if (!open) setAnterior(null);
          }}
          pauta={
            anterior.source === 'PAUTA'
              ? { milestones: anterior.milestones, initialMilestone: anterior.initialMilestone }
              : undefined
          }
        />
      ) : null}

      {pauta ? (
        <PautaMantencionModal
          equipo={{
            id: pauta.equipmentId,
            internalCode: pauta.internalCode,
            brand: pauta.brand ?? '',
            model: pauta.model ?? '',
          }}
          isOpen
          onOpenChange={(open) => {
            if (!open) setPauta(null);
          }}
          soloLectura={!puedeEditarPauta}
        />
      ) : null}
    </div>
  );
}

function Dato({ titulo, children, className = '' }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${className}`}>
      <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{titulo}</dt>
      <dd className="m-0 break-words">{children}</dd>
    </div>
  );
}
