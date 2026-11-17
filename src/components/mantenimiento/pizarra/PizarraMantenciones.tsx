import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, Spinner, Table, ToggleButton, ToggleButtonGroup, Tooltip } from '@heroui/react';
import { CalendarDays, CircleAlert, ClipboardList, Clock, History, SquareKanban, TriangleAlert } from 'lucide-react';

import { useMaintenanceBoard, useMaintenanceForecastByEquipment } from '../../../hooks/useMaintenancePlans';
import { DESKTOP_QUERY, useMediaQuery } from '../../../hooks/useMediaQuery';
import { usePermissions } from '../../../hooks/usePermissions';
import { diaCorto, lineaPronostico } from '../../../lib/pronostico';
import type { MaintenanceBoardRow } from '../../../types/maintenance-board';
import type { MaintenanceForecastRow } from '../../../types/maintenance-forecast';
import { MantencionAnteriorModal } from '../MantencionAnteriorModal';
import { PautaMantencionModal } from '../PautaMantencionModal';
import { Chip } from '../../ui/Chip';
import { MantencionARealizarModal } from './MantencionARealizarModal';
import { etiquetas, fechaCorta, lectura, separarSinPauta, textoPendientes, tono } from './pizarra';

type Panel = 'pesados' | 'livianos';

const TONO_CLASE = {
  atrasado: 'font-bold text-danger',
  alerta: 'font-semibold text-warning-soft-foreground',
  normal: 'text-foreground',
} as const;

/** Lo que dice el «Horómetro actual» cuando el equipo no tiene lectura. */
const SIN_LECTURA = 'Sin lectura';

// Columnas alternadas (gris desde la primera) por índice lógico de columna, no por `nth-child`, para no depender de
// cuántas celdas trae cada fila. Las celdas de HeroUI traen fondo propio con más especificidad, por eso el gris va
// con `!` y solo si la fila no está en hover; el hover verde (tinte del token success) va sobre todas las celdas de
// la fila y le gana al gris. El relieve (luz arriba, sombra fina abajo y a la derecha) separa cada celda sin rayar.
const CEBRA_COLUMNAS =
  '[&_td]:border-b-0! [&_td]:shadow-pizarra-celda [&:not(:hover)_td[data-gris]]:bg-default/70! hover:[&_td]:bg-success/15!';

/** Columnas pares (0, 2, 4…) en gris. */
const fondoColumna = (indice: number) => (indice % 2 === 0 ? { 'data-gris': '' } : {});

// Cabecera tipo tabla de precios: cada columna es un bloque propio (degradado de azul oscuro a azul claro,
// texto blanco en negrita, esquinas de arriba redondeadas y relieve). El borde blanco a los lados hace de separación
// entre bloques; `z-1` deja la sombra por encima de la primera fila del cuerpo. El `::after` es la rayita separadora
// de HeroUI, que acá sobra.
const BLOQUE_CABECERA =
  'z-1 border-x-2 border-surface rounded-t-lg! rounded-b-none! py-3! text-xs font-bold! text-white! shadow-pizarra-cabecera after:hidden';

/** Los nueve pasos del degradado (tokens de `index.css`), escritos enteros para que Tailwind los encuentre. */
const COLOR_CABECERA = [
  'bg-pizarra-1!',
  'bg-pizarra-2!',
  'bg-pizarra-3!',
  'bg-pizarra-4!',
  'bg-pizarra-5!',
  'bg-pizarra-6!',
  'bg-pizarra-7!',
  'bg-pizarra-8!',
  'bg-pizarra-9!',
] as const;

/** Clases del bloque de cabecera en el paso `paso` (0 a 8) del degradado. */
const cabecera = (paso: number) => `${BLOQUE_CABECERA} ${COLOR_CABECERA[paso]}`;

/** La tabla de sin pauta tiene cuatro columnas: toma pasos repartidos para recorrer igual todo el degradado. */
const PASOS_SIN_PAUTA = [0, 3, 6, 8] as const;

/** Ícono chico, atenuado y decorativo antes del valor (reloj para horas/km, calendario para fechas). */
function ConIcono({ icono, children }: { icono: 'reloj' | 'fecha'; children: ReactNode }) {
  const Icono = icono === 'reloj' ? Clock : CalendarDays;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icono aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      {children}
    </span>
  );
}

// Burbujas de estado de los pendientes: solo el ícono, para que la columna se lea como números; el estado en
// palabras va en el tooltip y en el aria-label (el disparador del Tooltip de HeroUI es enfocable con teclado).
// Como el ícono es la única señal, va oscuro sobre su fondo (≥ 3:1): rojo sobre rojo suave (≈ 5,5:1) y café sobre
// amarillo (≈ 4,5:1), con un amarillo de verdad para que la burbuja se lea amarilla.
const BURBUJA = {
  atrasado: { texto: 'Atrasado', fondo: 'bg-danger-soft', Icono: TriangleAlert, color: 'text-danger' },
  alerta: {
    texto: 'Próxima mantención',
    fondo: 'bg-alert-yellow-soft',
    Icono: CircleAlert,
    color: 'text-warning-soft-foreground',
  },
} as const;

function BurbujaEstado({ estado }: { estado: keyof typeof BURBUJA }) {
  const { texto, fondo, Icono, color } = BURBUJA[estado];
  return (
    <Tooltip delay={200}>
      <Tooltip.Trigger
        aria-label={texto}
        className={`inline-flex shrink-0 items-center justify-center rounded-full px-2 py-1 ${fondo}`}
      >
        <Icono aria-hidden="true" className={`size-3.5 ${color}`} />
      </Tooltip.Trigger>
      <Tooltip.Content>{texto}</Tooltip.Content>
    </Tooltip>
  );
}

/**
 * `conEtiqueta` (tarjetas del teléfono): en táctil el tooltip no se abre con un toque, así que el estado se escribe
 * al lado de la burbuja. En la tabla de escritorio queda solo el ícono con su tooltip.
 */
function Pendientes({ fila, conEtiqueta = false }: { fila: MaintenanceBoardRow; conEtiqueta?: boolean }) {
  if (fila.source === 'SIN_PAUTA') return <span className="text-muted-foreground">—</span>;
  const texto = textoPendientes(fila);
  if (texto == null) return <span className="text-muted-foreground">{SIN_LECTURA}</span>;
  const estado = tono(fila);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Atrasado: burbuja roja con triángulo; alerta (dentro del aviso): burbuja amarilla con exclamación; normal:
          solo el número. */}
      {estado !== 'normal' ? <BurbujaEstado estado={estado} /> : null}
      {/* aria-hidden: el lector de pantalla ya lo oye en el aria-label de la burbuja. */}
      {estado !== 'normal' && conEtiqueta ? (
        <span aria-hidden="true" className={`text-xs ${TONO_CLASE[estado]}`}>
          {BURBUJA[estado].texto}
        </span>
      ) : null}
      <span className={`tabular-nums ${TONO_CLASE[estado]}`}>{texto}</span>
      {/* Sin último cambio el número sale de los hitos absolutos: se avisa
          para que nadie lo tome por exacto. */}
      {fila.estimated ? <span className="text-xs text-muted-foreground italic">estimado</span> : null}
    </div>
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

function ChipInoperativo() {
  return (
    <Chip color="danger" size="sm" variant="soft">
      Inoperativo
    </Chip>
  );
}

/**
 * Código y qué equipo es; los fuera de servicio llevan además el chip
 * «Inoperativo» (salvo con `sinEstado`: la tabla de sin pauta lo muestra en su
 * propia columna).
 */
function Equipo({ fila, sinEstado = false }: { fila: MaintenanceBoardRow; sinEstado?: boolean }) {
  const detalle = [fila.type, [fila.brand, fila.model].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  return (
    <span className="flex flex-col">
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-mono font-semibold whitespace-nowrap text-foreground">{fila.internalCode}</span>
        {fila.status === 'OUT_OF_SERVICE' && !sinEstado ? <ChipInoperativo /> : null}
      </span>
      {detalle ? <span className="text-xs text-muted-foreground">{detalle}</span> : null}
    </span>
  );
}

/**
 * La pizarra de mantenciones: la versión en el sistema de la pizarra blanca de
 * faena (horas cambio, último cambio, próximo cambio, horómetro actual y horas
 * pendientes en rojo). Es la vista principal de Mantenciones del admin; el
 * registro de órdenes queda detrás de «Ver registro de mantención» y, para el
 * ADMIN, el tablero del mantenedor detrás de «Vista tablero mantenedor».
 *
 * Todos los números vienen del backend (`/maintenance-plans/board`), que usa
 * la misma regla que dispara las órdenes preventivas: la pizarra no puede
 * mostrar un próximo cambio distinto al del aviso.
 */
export function PizarraMantenciones({
  onVerRegistro,
  onVerTablero,
}: {
  onVerRegistro: () => void;
  /** Lleva al tablero del mantenedor (`?vista=tablero`); sin él no hay atajo. */
  onVerTablero?: () => void;
}) {
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

  // Los sin pauta van a su propia sección debajo: no tienen números que comparar con el resto.
  const { conPauta: filas, sinPauta: filasSinPauta } = useMemo(
    () =>
      separarSinPauta(
        (data ?? []).filter((f) =>
          panel === 'livianos' ? f.equipmentClass === 'LIGHT' : f.equipmentClass === 'HEAVY',
        ),
      ),
    [data, panel],
  );
  const cargada = !isPending && !isError;

  const cambiarPanel = (siguiente: Panel) => {
    const nuevos = new URLSearchParams(params);
    if (siguiente === 'pesados') nuevos.delete('panel');
    else nuevos.set('panel', siguiente);
    setParams(nuevos, { replace: true });
  };

  // Sin último cambio, cada columna («Fecha último cambio» y la lectura) trae su propio botón con texto corto que
  // cabe en la celda. Los dos abren el mismo modal, que pide fecha y lectura juntas: al guardar se llenan ambas.
  const botonRegistrar = (fila: MaintenanceBoardRow, que: 'fecha' | 'lectura'): ReactNode =>
    esAdmin ? (
      <Button onPress={() => setAnterior(fila)} size="sm" variant="secondary">
        {que === 'fecha' ? <CalendarDays className="size-4" /> : <Clock className="size-4" />}
        {que === 'fecha' ? 'Registrar fecha' : fila.unit === 'km' ? 'Registrar km' : 'Registrar horómetro'}
      </Button>
    ) : (
      <span className="text-muted-foreground">—</span>
    );

  // «Asignar pauta» es solo para pesados: los livianos tienen su servicio fijo de 10.000 km.
  const botonAsignarPauta = (fila: MaintenanceBoardRow, className?: string): ReactNode =>
    esAdmin && fila.equipmentClass === 'HEAVY' ? (
      <Button className={className} onPress={() => setPauta(fila)} size="sm" variant="secondary">
        <ClipboardList className="size-4" />
        Asignar pauta
      </Button>
    ) : (
      <span className="text-muted-foreground">—</span>
    );

  const botonVer = (fila: MaintenanceBoardRow, className?: string) => (
    <Button className={className} onPress={() => setVerItems(fila)} size="sm" variant="tertiary">
      <ClipboardList className="size-4" />
      Ver mantención a realizar
    </Button>
  );

  const actual = (fila: MaintenanceBoardRow) => lectura(fila.counter, fila.unit) ?? SIN_LECTURA;

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
        {/* Los dos accesos juntos y con su propio wrap: en el teléfono bajan en bloque bajo el selector de panel. */}
        <div className="flex flex-wrap gap-2">
          <Button onPress={onVerRegistro} size="sm" variant="secondary">
            <History className="size-4" />
            Ver registro de mantención
          </Button>
          {/* El tablero es del ADMIN, igual que el botón de vista del registro: la SECRETARIA no lo ve. */}
          {esAdmin && onVerTablero ? (
            <Button onPress={onVerTablero} size="sm" variant="secondary">
              <SquareKanban className="size-4" />
              Vista tablero mantenedor
            </Button>
          ) : null}
        </div>
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

          {cargada && filas.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              {filasSinPauta.length > 0
                ? 'Ningún equipo tiene pauta asignada todavía.'
                : panel === 'livianos'
                  ? 'No hay equipos livianos en la flota.'
                  : 'No hay equipos pesados en la flota.'}
            </p>
          ) : null}

          {cargada && filas.length > 0 && !esEscritorio ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {filas.map((fila) => (
                <li
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
                  data-testid={`pizarra-fila-${fila.equipmentId}`}
                  key={fila.equipmentId}
                >
                  <Equipo fila={fila} />
                  {/* Lo que se mira en la pizarra: dónde está, cuándo toca y cuánto falta. */}
                  <dl className="m-0 grid grid-cols-3 gap-2 rounded-xl bg-surface-secondary px-3 py-2.5 text-sm">
                    <Dato titulo={textos.actual}>
                      <ConIcono icono="reloj">
                        <span className="font-semibold tabular-nums">{actual(fila)}</span>
                      </ConIcono>
                    </Dato>
                    <Dato titulo="Próximo cambio">
                      <ConIcono icono="reloj">
                        <span className="font-semibold tabular-nums">{lectura(fila.dueAt, fila.unit) ?? '—'}</span>
                      </ConIcono>
                    </Dato>
                    <Dato titulo={textos.pendientes}>
                      <Pendientes conEtiqueta fila={fila} />
                    </Dato>
                  </dl>
                  <dl className="m-0 grid grid-cols-2 gap-2 text-sm">
                    <Dato titulo={textos.cambio}>
                      <ConIcono icono="reloj">
                        <span className="tabular-nums">{lectura(fila.interval, fila.unit) ?? '—'}</span>
                      </ConIcono>
                    </Dato>
                    <Dato titulo="Fecha estimada">
                      <ConIcono icono="fecha">
                        <FechaEstimadaCelda fila={fila} pronostico={pronosticos?.get(fila.equipmentId)} />
                      </ConIcono>
                    </Dato>
                    <Dato className="col-span-2" titulo="Último cambio">
                      {fila.lastChange ? (
                        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 tabular-nums">
                          <ConIcono icono="fecha">{fechaCorta(fila.lastChange.doneAt)}</ConIcono>
                          <span aria-hidden="true">·</span>
                          <ConIcono icono="reloj">{lectura(fila.lastChange.counterAt, fila.unit)}</ConIcono>
                        </span>
                      ) : esAdmin ? (
                        <span className="flex flex-wrap gap-2">
                          {botonRegistrar(fila, 'fecha')}
                          {botonRegistrar(fila, 'lectura')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Dato>
                  </dl>
                  {botonVer(fila, 'w-full')}
                </li>
              ))}
            </ul>
          ) : null}

          {cargada && filas.length > 0 && esEscritorio ? (
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content
                  aria-label={panel === 'livianos' ? 'Pizarra de equipos livianos' : 'Pizarra de equipos pesados'}
                  className="min-w-full"
                >
                  <Table.Header>
                    <Table.Column className={cabecera(0)} isRowHeader>
                      Equipo
                    </Table.Column>
                    <Table.Column className={cabecera(1)}>{textos.cambio}</Table.Column>
                    <Table.Column className={cabecera(2)}>Fecha último cambio</Table.Column>
                    <Table.Column className={cabecera(3)}>{textos.ultimo}</Table.Column>
                    <Table.Column className={cabecera(4)}>{textos.proximo}</Table.Column>
                    <Table.Column className={cabecera(5)}>{textos.actual}</Table.Column>
                    <Table.Column className={cabecera(6)}>{textos.pendientes}</Table.Column>
                    <Table.Column className={cabecera(7)}>Fecha estimada de mantención</Table.Column>
                    <Table.Column className={cabecera(8)}>Detalle de mantención</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {filas.map((fila) => (
                      <Table.Row
                        className={CEBRA_COLUMNAS}
                        data-testid={`pizarra-fila-${fila.equipmentId}`}
                        id={fila.equipmentId}
                        key={fila.equipmentId}
                      >
                        <Table.Cell className="text-sm" {...fondoColumna(0)}>
                          <Equipo fila={fila} />
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap tabular-nums" {...fondoColumna(1)}>
                          <ConIcono icono="reloj">{lectura(fila.interval, fila.unit) ?? '—'}</ConIcono>
                        </Table.Cell>
                        {/* Sin último cambio, cada columna lleva su botón (es lo que falta para contar desde ahí). */}
                        <Table.Cell className="text-sm whitespace-nowrap tabular-nums" {...fondoColumna(2)}>
                          {fila.lastChange ? (
                            <ConIcono icono="fecha">{fechaCorta(fila.lastChange.doneAt)}</ConIcono>
                          ) : (
                            botonRegistrar(fila, 'fecha')
                          )}
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap tabular-nums" {...fondoColumna(3)}>
                          {fila.lastChange ? (
                            <ConIcono icono="reloj">{lectura(fila.lastChange.counterAt, fila.unit)}</ConIcono>
                          ) : (
                            botonRegistrar(fila, 'lectura')
                          )}
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap tabular-nums" {...fondoColumna(4)}>
                          <ConIcono icono="reloj">{lectura(fila.dueAt, fila.unit) ?? '—'}</ConIcono>
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap tabular-nums" {...fondoColumna(5)}>
                          <ConIcono icono="reloj">{actual(fila)}</ConIcono>
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap" {...fondoColumna(6)}>
                          <Pendientes fila={fila} />
                        </Table.Cell>
                        <Table.Cell className="text-sm whitespace-nowrap" {...fondoColumna(7)}>
                          <ConIcono icono="fecha">
                            <FechaEstimadaCelda fila={fila} pronostico={pronosticos?.get(fila.equipmentId)} />
                          </ConIcono>
                        </Table.Cell>
                        <Table.Cell className="text-right" {...fondoColumna(8)}>
                          {botonVer(fila)}
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

      {/* Los equipos sin pauta no tienen nada que contar: quedan aparte, debajo, esperando que se les asigne una. */}
      {cargada && filasSinPauta.length > 0 ? (
        <section aria-labelledby="pizarra-sin-pauta-titulo" className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="m-0 text-base font-semibold text-foreground" id="pizarra-sin-pauta-titulo">
              Equipos sin pauta asignada
            </h2>
            <p className="m-0 text-sm text-muted-foreground">
              Todavía no tienen plan de mantención. Asígnales una pauta para empezar a seguirlos en la pizarra.
            </p>
          </div>
          <Card>
            <Card.Content>
              {esEscritorio ? (
                <Table variant="secondary">
                  <Table.ScrollContainer>
                    <Table.Content aria-label="Equipos sin pauta asignada" className="min-w-full">
                      <Table.Header>
                        <Table.Column className={cabecera(PASOS_SIN_PAUTA[0])} isRowHeader>
                          Equipo
                        </Table.Column>
                        <Table.Column className={cabecera(PASOS_SIN_PAUTA[1])}>{textos.actual}</Table.Column>
                        <Table.Column className={cabecera(PASOS_SIN_PAUTA[2])}>Estado</Table.Column>
                        <Table.Column className={cabecera(PASOS_SIN_PAUTA[3])}>
                          <span className="sr-only">Acciones</span>
                        </Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {filasSinPauta.map((fila) => (
                          <Table.Row
                            className={CEBRA_COLUMNAS}
                            data-testid={`pizarra-sin-pauta-${fila.equipmentId}`}
                            id={fila.equipmentId}
                            key={fila.equipmentId}
                          >
                            <Table.Cell className="text-sm" {...fondoColumna(0)}>
                              <Equipo fila={fila} sinEstado />
                            </Table.Cell>
                            <Table.Cell className="text-sm whitespace-nowrap tabular-nums" {...fondoColumna(1)}>
                              <ConIcono icono="reloj">{actual(fila)}</ConIcono>
                            </Table.Cell>
                            <Table.Cell className="text-sm" {...fondoColumna(2)}>
                              {fila.status === 'OUT_OF_SERVICE' ? (
                                <ChipInoperativo />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </Table.Cell>
                            <Table.Cell className="text-right" {...fondoColumna(3)}>
                              {botonAsignarPauta(fila)}
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {filasSinPauta.map((fila) => (
                    <li
                      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
                      data-testid={`pizarra-sin-pauta-${fila.equipmentId}`}
                      key={fila.equipmentId}
                    >
                      <Equipo fila={fila} />
                      <dl className="m-0 grid grid-cols-1 gap-2 rounded-xl bg-surface-secondary px-3 py-2.5 text-sm">
                        <Dato titulo={textos.actual}>
                          <ConIcono icono="reloj">
                            <span className="font-semibold tabular-nums">{actual(fila)}</span>
                          </ConIcono>
                        </Dato>
                      </dl>
                      {esAdmin && fila.equipmentClass === 'HEAVY' ? botonAsignarPauta(fila, 'w-full') : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card.Content>
          </Card>
        </section>
      ) : null}

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
