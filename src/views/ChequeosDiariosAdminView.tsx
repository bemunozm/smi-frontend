import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, Input, Label, Modal, Spinner, Table, TextField } from '@heroui/react';
import { Camera, ChevronRight, Wrench } from 'lucide-react';

import { ContenidoChecklist, ResultadoRevision } from '../components/checklist/ChecklistDetalle';
import { CHECKLIST_ESTADO, contadorChecklist } from '../components/checklist/checklist-estado';
import { RESPONSIVE_SHEET_DIALOG_WIDE_CLASS } from '../components/flota/modal-styles';
import { Segmented } from '../components/inventario/shared';
import { Chip } from '../components/ui/Chip';
import { SortControl } from '../components/ui/SortControl';
import { sortableHeader } from '../components/ui/SortableHeader';
import { TABLE_LAYOUT_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { useChecklistDetalle, useChecklistsDelPeriodo } from '../hooks/useDailyChecklists';
import { fmtTime } from '../lib/format';
import { describeSort, type SortMeta } from '../lib/sort-description';
import { sortRows, toTimestamp, type SortColumn, type TableSort } from '../lib/table-sort';
import { fechaCorta, fromDateOnly, toDateOnly } from '../lib/turno';
import { CHECKLIST_STATUSES, type ChecklistStatus, type DailyChecklistSummary } from '../types/daily-checklist';

/** Lo máximo que acepta el backend para un rango (días, ambos extremos incluidos). */
const MAX_DIAS = 92;

type FiltroEstado = 'TODOS' | ChecklistStatus;

/** `?estado=` lo manda la tarjeta del dashboard para abrir la vista ya filtrada. */
function estadoInicial(valor: string | null): FiltroEstado {
  return CHECKLIST_STATUSES.find((e) => e === valor) ?? 'TODOS';
}

const SELECTOR_FECHA = 'rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground';
const BOTON_FECHA = 'rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground disabled:opacity-40';

const DIA_LARGO = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

/** `YYYY-MM-DD` corrido `delta` días (con partes locales, nunca `new Date(string)`). */
function sumarDias(dia: string, delta: number): string {
  const [y, m, d] = dia.split('-').map(Number);
  return toDateOnly(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + delta));
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((fromDateOnly(hasta).getTime() - fromDateOnly(desde).getTime()) / 86_400_000) + 1;
}

/** Vacío o año parcial (Chrome emite 0002-10-10 al tipear): no se toma como fecha. */
function esFechaValida(dia: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia >= '1900-01-01';
}

function etiquetaPeriodo(desde: string, hasta: string, hoy: string): string {
  if (desde === hasta) {
    return desde === hoy ? 'hoy' : `del ${DIA_LARGO.format(fromDateOnly(desde))}`;
  }
  const corta = (d: string) => fromDateOnly(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  return `del ${corta(desde)} al ${corta(hasta)}`;
}

/** Quién validó: solo si ya se decidió (un chequeo corregido y reenviado vuelve a «por validar»). */
function quienValido(c: DailyChecklistSummary): string {
  return c.status !== 'SUBMITTED' && c.lastReview ? c.lastReview.reviewerName : '—';
}

/** Severidad del estado: lo que pide atención primero (por validar, rechazado, aceptado). */
const ESTADO_ORDEN: Record<ChecklistStatus, number> = { SUBMITTED: 0, REJECTED: 1, ACCEPTED: 2 };

/** Desempate: el envío más antiguo primero (en ascendente). */
const porEnvio = (a: DailyChecklistSummary, b: DailyChecklistSummary): number =>
  (toTimestamp(a.submittedAt) ?? 0) - (toTimestamp(b.submittedAt) ?? 0);

/** Columnas ordenables (el `id` es el de `Table.Column`). */
const COLUMNAS_ORDEN: Record<string, SortColumn<DailyChecklistSummary>> = {
  fecha: { kind: 'date', value: (c) => c.date, tiebreak: porEnvio },
  equipo: { kind: 'text', value: (c) => c.equipment.internalCode, tiebreak: porEnvio },
  mantenedor: { kind: 'text', value: (c) => c.mechanicName, tiebreak: porEnvio },
  hora: { kind: 'date', value: (c) => c.submittedAt },
  contador: { kind: 'number', value: (c) => c.counter, tiebreak: porEnvio },
  mantencion: { kind: 'number', value: (c) => c.maintained, tiebreak: porEnvio },
  fotos: { kind: 'number', value: (c) => c.photos, tiebreak: porEnvio },
  valido: { kind: 'text', value: (c) => (quienValido(c) === '—' ? null : quienValido(c)), tiebreak: porEnvio },
  estado: { kind: 'number', value: (c) => ESTADO_ORDEN[c.status], tiebreak: porEnvio },
};

/** Por defecto: el envío más reciente primero. */
const ORDEN_INICIAL: TableSort = { column: 'hora', direction: 'descending' };

function opcionesOrden(conFecha: boolean): SortMeta[] {
  const opciones: SortMeta[] = [
    ...(conFecha ? [{ id: 'fecha', label: 'Fecha', reading: 'date' as const }] : []),
    { id: 'equipo', label: 'Equipo', reading: 'text' },
    { id: 'mantenedor', label: 'Mantenedor', reading: 'text' },
    { id: 'hora', label: 'Hora', reading: 'date' },
    { id: 'contador', label: 'Horómetro / km', reading: 'number' },
    { id: 'mantencion', label: 'Con mantención', reading: 'number' },
    { id: 'fotos', label: 'Fotos', reading: 'number' },
    { id: 'valido', label: 'Validó', reading: 'text' },
    { id: 'estado', label: 'Estado', reading: ['primero por validar', 'primero aceptado'] as const },
  ];
  return opciones;
}

function EstadoChip({ checklist: c }: { checklist: DailyChecklistSummary }) {
  const estado = CHECKLIST_ESTADO[c.status];
  return (
    <span className="inline-flex shrink-0 flex-wrap items-center gap-1.5 whitespace-nowrap">
      <Chip color={estado.tono} size="sm" variant="soft">
        {estado.label}
      </Chip>
      {c.submissionCount > 1 && c.status === 'SUBMITTED' ? (
        <Chip color="accent" size="sm" variant="soft">
          Corregido
        </Chip>
      ) : null}
    </span>
  );
}

/**
 * Chequeos diarios del panel (`/chequeos-diarios`, ADMIN y SECRETARIA, solo
 * lectura): lo que el mantenedor declara cada día (Módulo 2) y cómo lo dejó el
 * supervisor al validarlo (Módulo 3). Por defecto, el día de hoy; con el rango
 * se ven varios días o la historia de un equipo (buscándolo por código).
 * Aceptar o rechazar sigue siendo solo del supervisor, en Terreno.
 */
export function ChequeosDiariosAdminView() {
  const hoy = toDateOnly(new Date());
  const [modo, setModo] = useState<'dia' | 'rango'>('dia');
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [searchParams] = useSearchParams();
  const [estado, setEstado] = useState<FiltroEstado>(() => estadoInicial(searchParams.get('estado')));
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const esTabla = useMediaQuery(TABLE_LAYOUT_QUERY);

  const to = modo === 'dia' ? desde : hasta;
  const { data, isPending, isError, error, refetch } = useChecklistsDelPeriodo(desde, to);
  const chequeos = useMemo(() => data ?? [], [data]);

  const totales = useMemo(
    () => ({
      enviados: chequeos.length,
      SUBMITTED: chequeos.filter((c) => c.status === 'SUBMITTED').length,
      ACCEPTED: chequeos.filter((c) => c.status === 'ACCEPTED').length,
      REJECTED: chequeos.filter((c) => c.status === 'REJECTED').length,
    }),
    [chequeos],
  );

  const texto = busqueda.trim().toLowerCase();
  const visibles = useMemo(
    () =>
      chequeos.filter(
        (c) =>
          (estado === 'TODOS' || c.status === estado) &&
          (texto === '' || c.equipment.internalCode.toLowerCase().includes(texto)),
      ),
    [chequeos, estado, texto],
  );

  // El orden se aplica DESPUÉS de los filtros. Sin rango no hay columna «Fecha»: se vuelve a la hora.
  const [orden, setOrden] = useState<TableSort>(ORDEN_INICIAL);
  const conFecha = desde !== to;
  const ordenVigente = useMemo<TableSort>(
    () => (!conFecha && orden.column === 'fecha' ? { ...orden, column: 'hora' } : orden),
    [conFecha, orden],
  );
  const ordenados = useMemo(() => sortRows(visibles, ordenVigente, COLUMNAS_ORDEN), [visibles, ordenVigente]);

  const irADia = (dia: string) => {
    if (!esFechaValida(dia)) return;
    const limitado = dia > hoy ? hoy : dia;
    setDesde(limitado);
    setHasta(limitado);
  };
  // El rango no pasa de `MAX_DIAS` ni queda al revés: se corrige el otro extremo.
  const cambiarDesde = (dia: string) => {
    if (!esFechaValida(dia)) return;
    const nuevo = dia > hoy ? hoy : dia;
    setDesde(nuevo);
    if (hasta < nuevo) setHasta(nuevo);
    else if (diasEntre(nuevo, hasta) > MAX_DIAS) setHasta(sumarDias(nuevo, MAX_DIAS - 1) > hoy ? hoy : sumarDias(nuevo, MAX_DIAS - 1));
  };
  const cambiarHasta = (dia: string) => {
    if (!esFechaValida(dia)) return;
    const nuevo = dia > hoy ? hoy : dia;
    setHasta(nuevo);
    if (desde > nuevo) setDesde(nuevo);
    else if (diasEntre(desde, nuevo) > MAX_DIAS) setDesde(sumarDias(nuevo, -(MAX_DIAS - 1)));
  };
  const cambiarModo = (siguiente: 'dia' | 'rango') => {
    setModo(siguiente);
    // Al volver a un solo día, el que quedó como «desde».
    if (siguiente === 'dia') setHasta(desde);
  };

  const periodo = etiquetaPeriodo(desde, to, hoy);
  const hayFiltros = estado !== 'TODOS' || texto !== '';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
          SMI · Reportes
        </span>
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">Chequeos diarios</h1>
        <p className="text-sm text-muted-foreground">
          Lo que el mantenedor revisó en cada equipo y si el supervisor lo aceptó. Solo lectura: validar es del
          supervisor.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="w-full sm:w-64">
            <Segmented
              label="Período"
              onChange={cambiarModo}
              options={[
                { id: 'dia', label: 'Un día' },
                { id: 'rango', label: 'Rango' },
              ]}
              value={modo}
            />
          </div>

          {modo === 'dia' ? (
            <div className="flex flex-wrap items-center gap-2">
              <button aria-label="Día anterior" className={BOTON_FECHA} onClick={() => irADia(sumarDias(desde, -1))} type="button">
                ◀
              </button>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Fecha
                <input
                  className={SELECTOR_FECHA}
                  max={hoy}
                  onChange={(e) => irADia(e.target.value)}
                  type="date"
                  value={desde}
                />
              </label>
              <button
                aria-label="Día siguiente"
                className={BOTON_FECHA}
                disabled={desde >= hoy}
                onClick={() => irADia(sumarDias(desde, 1))}
                type="button"
              >
                ▶
              </button>
              {desde !== hoy ? (
                <button className={BOTON_FECHA} onClick={() => irADia(hoy)} type="button">
                  Hoy
                </button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Desde
                <input
                  className={SELECTOR_FECHA}
                  max={hoy}
                  onChange={(e) => cambiarDesde(e.target.value)}
                  type="date"
                  value={desde}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Hasta
                <input
                  className={SELECTOR_FECHA}
                  max={hoy}
                  min={desde}
                  onChange={(e) => cambiarHasta(e.target.value)}
                  type="date"
                  value={hasta}
                />
              </label>
              <span className="text-xs text-muted-foreground">Hasta {MAX_DIAS} días.</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard
            activo={estado === 'TODOS'}
            hint="Del período"
            label="Enviados"
            onSelect={() => setEstado('TODOS')}
            valor={totales.enviados}
          />
          <TotalCard
            activo={estado === 'SUBMITTED'}
            hint="Esperan al supervisor"
            label="Por validar"
            onSelect={() => setEstado(estado === 'SUBMITTED' ? 'TODOS' : 'SUBMITTED')}
            valor={totales.SUBMITTED}
          />
          <TotalCard
            activo={estado === 'ACCEPTED'}
            hint="Equipo liberado"
            label="Aceptados"
            onSelect={() => setEstado(estado === 'ACCEPTED' ? 'TODOS' : 'ACCEPTED')}
            valor={totales.ACCEPTED}
          />
          <TotalCard
            activo={estado === 'REJECTED'}
            hint="Vuelven al mantenedor"
            label="Rechazados"
            onSelect={() => setEstado(estado === 'REJECTED' ? 'TODOS' : 'REJECTED')}
            valor={totales.REJECTED}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:items-end">
          <TextField aria-label="Buscar equipo" onChange={setBusqueda} value={busqueda}>
            <Label>Buscar</Label>
            <Input placeholder="Código del equipo" />
          </TextField>
          <div className="overflow-x-auto [&_[role=tab]]:px-2 [&_[role=tab]]:whitespace-nowrap">
            <Segmented<FiltroEstado>
              label="Filtro de estado"
              onChange={setEstado}
              options={[
                { id: 'TODOS', label: 'Todos' },
                { id: 'SUBMITTED', label: 'Por validar' },
                { id: 'ACCEPTED', label: 'Aceptados' },
                { id: 'REJECTED', label: 'Rechazados' },
              ]}
              value={estado}
            />
          </div>
        </div>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Chequeos {periodo === 'hoy' ? 'de hoy' : periodo}</Card.Title>
          <Card.Description>
            {describeSort(ordenVigente, opcionesOrden(conFecha))} Toca el título de una columna para cambiar el orden y un chequeo para ver
            lo que declaró el mantenedor.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          {isPending ? (
            <div className="flex justify-center py-10">
              <Spinner color="accent" size="sm" />
            </div>
          ) : null}

          {isError ? (
            <div
              className="flex items-center justify-between gap-3 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground"
              role="alert"
            >
              <span>{error instanceof Error ? error.message : 'No se pudieron cargar los chequeos.'}</span>
              <button className="font-medium underline" onClick={() => void refetch()} type="button">
                Reintentar
              </button>
            </div>
          ) : null}

          {!isPending && !isError && chequeos.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No hay chequeos enviados {periodo}. Aparecen acá cuando un mantenedor envía el chequeo de un equipo.
            </p>
          ) : null}

          {!isPending && !isError && chequeos.length > 0 && visibles.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Ningún chequeo coincide con {hayFiltros ? 'los filtros elegidos' : 'la búsqueda'}.{' '}
              <button
                className="font-medium text-(--accent) underline"
                onClick={() => {
                  setEstado('TODOS');
                  setBusqueda('');
                }}
                type="button"
              >
                Quitar filtros
              </button>
            </p>
          ) : null}

          {!isPending && !isError && visibles.length > 0 && esTabla ? (
            <TablaChequeos
              chequeos={ordenados}
              conFecha={conFecha}
              onAbrir={setAbierto}
              onOrden={setOrden}
              orden={ordenVigente}
            />
          ) : null}
          {!isPending && !isError && visibles.length > 0 && !esTabla ? (
            <>
              <SortControl onChange={setOrden} options={opcionesOrden(conFecha)} sort={ordenVigente} />
              <TarjetasChequeos chequeos={ordenados} conFecha={conFecha} onAbrir={setAbierto} />
            </>
          ) : null}
        </Card.Content>
      </Card>

      <DetalleChequeo id={abierto} onCerrar={() => setAbierto(null)} />
    </div>
  );
}

/** Un total del período; tocarlo filtra la lista por ese estado. */
function TotalCard({
  label,
  valor,
  hint,
  activo,
  onSelect,
}: {
  label: string;
  valor: number;
  hint: string;
  activo: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={activo}
      className="block h-full w-full rounded-(--radius) text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
      onClick={onSelect}
      type="button"
    >
      <Card
        className={`h-full transition-colors hover:bg-surface-secondary ${activo ? 'ring-2 ring-(--accent)' : ''}`}
      >
        <Card.Header>
          <Card.Description className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
            {label}
          </Card.Description>
          <Card.Title className="font-display text-[26px] font-semibold tracking-[-0.02em] text-foreground">
            {valor.toLocaleString('es-CL')}
          </Card.Title>
        </Card.Header>
        <Card.Content>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </Card.Content>
      </Card>
    </button>
  );
}

interface ListaProps {
  chequeos: DailyChecklistSummary[];
  /** En un rango, cada fila dice de qué día es. */
  conFecha: boolean;
  onAbrir: (id: string) => void;
}

function TablaChequeos({
  chequeos,
  conFecha,
  onAbrir,
  orden,
  onOrden,
}: ListaProps & { orden: TableSort; onOrden: (orden: TableSort) => void }) {
  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content
          aria-label="Chequeos diarios"
          className="min-w-full"
          onSortChange={(d) => onOrden({ column: d.column, direction: d.direction })}
          sortDescriptor={orden}
        >
          <Table.Header>
            {conFecha ? (
              <Table.Column allowsSorting id="fecha" isRowHeader>
                {sortableHeader('Fecha')}
              </Table.Column>
            ) : null}
            <Table.Column allowsSorting id="equipo" isRowHeader={!conFecha}>
              {sortableHeader('Equipo')}
            </Table.Column>
            <Table.Column allowsSorting id="mantenedor">
              {sortableHeader('Mantenedor')}
            </Table.Column>
            <Table.Column allowsSorting id="hora">
              {sortableHeader('Hora')}
            </Table.Column>
            <Table.Column allowsSorting className="text-right" id="contador">
              {sortableHeader('Horómetro / km')}
            </Table.Column>
            <Table.Column allowsSorting className="text-right" id="mantencion">
              {sortableHeader('Con mantención')}
            </Table.Column>
            <Table.Column allowsSorting className="text-right" id="fotos">
              {sortableHeader('Fotos')}
            </Table.Column>
            <Table.Column allowsSorting id="valido">
              {sortableHeader('Validó')}
            </Table.Column>
            <Table.Column allowsSorting id="estado">
              {sortableHeader('Estado')}
            </Table.Column>
          </Table.Header>
          <Table.Body>
            {chequeos.map((c) => (
              <Table.Row
                className="cursor-pointer"
                data-testid={`chequeo-fila-${c.id}`}
                key={c.id}
                onAction={() => onAbrir(c.id)}
              >
                {conFecha ? (
                  <Table.Cell className="text-sm whitespace-nowrap text-muted-foreground">
                    {fechaCorta(fromDateOnly(c.date))}
                  </Table.Cell>
                ) : null}
                <Table.Cell className="font-mono text-sm font-semibold whitespace-nowrap">
                  {c.equipment.internalCode}
                </Table.Cell>
                <Table.Cell className="text-sm whitespace-nowrap">{c.mechanicName}</Table.Cell>
                <Table.Cell className="font-mono text-sm whitespace-nowrap text-muted-foreground">
                  {fmtTime(c.submittedAt)}
                </Table.Cell>
                <Table.Cell className="text-right font-mono text-sm whitespace-nowrap">{contadorChecklist(c)}</Table.Cell>
                <Table.Cell className="text-right font-mono text-sm whitespace-nowrap">{c.maintained}</Table.Cell>
                <Table.Cell className="text-right font-mono text-sm whitespace-nowrap">{c.photos}</Table.Cell>
                <Table.Cell className="text-sm whitespace-nowrap text-muted-foreground">{quienValido(c)}</Table.Cell>
                <Table.Cell className="whitespace-nowrap">
                  <EstadoChip checklist={c} />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

/** Tablet y celular: una tarjeta por chequeo, con lo esencial a la vista. */
function TarjetasChequeos({ chequeos, conFecha, onAbrir }: ListaProps) {
  return (
    <ul aria-label="Chequeos diarios" className="m-0 flex list-none flex-col gap-2.5 p-0">
      {chequeos.map((c) => (
        <li key={c.id}>
          <button
            className="flex w-full cursor-pointer flex-col gap-2 rounded-2xl border border-border bg-card p-3.5 text-left hover:border-foreground"
            data-testid={`chequeo-tarjeta-${c.id}`}
            onClick={() => onAbrir(c.id)}
            type="button"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 flex-col">
                <span className="font-mono text-base font-semibold text-foreground">{c.equipment.internalCode}</span>
                <span className="text-xs text-muted-foreground">
                  {c.mechanicName}
                  {conFecha ? ` · ${fechaCorta(fromDateOnly(c.date))}` : ''} · {fmtTime(c.submittedAt)}
                </span>
              </span>
              <EstadoChip checklist={c} />
            </span>
            <span className="grid grid-cols-[1.5fr_1fr_1fr] gap-2 rounded-xl bg-surface-secondary px-3 py-2 text-sm">
              <span className="flex flex-col">
                <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Contador</span>
                <span className="font-mono font-semibold whitespace-nowrap text-foreground">{contadorChecklist(c)}</span>
              </span>
              <span className="flex flex-col">
                <span className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <Wrench aria-hidden size={11} /> Mantención
                </span>
                <span className="font-mono font-semibold text-foreground">{c.maintained}</span>
              </span>
              <span className="flex flex-col">
                <span className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <Camera aria-hidden size={11} /> Fotos
                </span>
                <span className="font-mono font-semibold text-foreground">{c.photos}</span>
              </span>
            </span>
            <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{quienValido(c) === '—' ? 'Sin validar' : `Validó ${quienValido(c)}`}</span>
              <ChevronRight aria-hidden size={16} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** El detalle en solo lectura: lo mismo que ve el supervisor, sin aceptar ni rechazar. */
function DetalleChequeo({ id, onCerrar }: { id: string | null; onCerrar: () => void }) {
  const { data: c, isPending, isError, error } = useChecklistDetalle(id);
  return (
    <Modal.Backdrop isDismissable isOpen={id !== null} onOpenChange={(open) => !open && onCerrar()}>
      <Modal.Container>
        <Modal.Dialog className={`${RESPONSIVE_SHEET_DIALOG_WIDE_CLASS} sm:w-full`}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              {c ? `Chequeo de ${c.equipment.internalCode}` : 'Chequeo'}
            </Modal.Heading>
            {c ? (
              <p className="pt-1 text-sm text-muted-foreground">
                {c.mechanicName} · {fechaCorta(fromDateOnly(c.date))}
              </p>
            ) : null}
          </Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-3.5">
              {isError ? (
                <p className="text-sm text-danger-soft-foreground" role="alert">
                  {error instanceof Error ? error.message : 'No se pudo cargar el chequeo.'}
                </p>
              ) : isPending || !c ? (
                <div className="flex justify-center py-8">
                  <Spinner color="accent" size="sm" />
                </div>
              ) : (
                <ContenidoChecklist checklist={c}>
                  {c.status === 'SUBMITTED' ? (
                    <p className="rounded-2xl bg-[var(--warning-soft)] px-3.5 py-3 text-[13.5px] font-semibold text-[var(--warning-soft-foreground)]">
                      Por validar: el supervisor lo acepta o lo rechaza desde Terreno.
                    </p>
                  ) : (
                    <ResultadoRevision checklist={c} />
                  )}
                </ContenidoChecklist>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button onPress={onCerrar} variant="secondary">
              Cerrar
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
