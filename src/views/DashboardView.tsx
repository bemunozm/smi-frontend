import { useMemo, useState, type CSSProperties } from 'react';
import { Card, Chip, Spinner, Table } from '@heroui/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useCurrentUser } from '../hooks/useCurrentUser';
import { useItems } from '../hooks/useInventory';
import { useMaintenanceStatusByEquipment } from '../hooks/useMaintenancePlans';
import {
  useDashboardEquipos,
  useDashboardMantenedores,
  useDashboardSupervisores,
  useDashboardVueltas,
  useHallazgosAbiertosRecientes,
  useHallazgosAbiertosResumen,
  useHallazgosRecientes,
} from '../hooks/useDashboard';
import {
  CHART_NEUTRAL,
  TRABAJOS_EXTRAORDINARIOS_COLOR,
  criticidadChipColor,
  hallazgoEstadoChipColor,
  hallazgoEstadoLabel,
  hallazgosCriticidadHint,
  seriesColor,
} from '../config/dashboard-colors';
import { UNIT_SYMBOLS } from '../types/inventory';
import { SECCION_LABEL } from '../types/reporte-diario';
import type { HallazgoResumen, MetricasEquipo, RangoDashboard } from '../types/dashboard';
import { mantencionesProximas } from '../lib/mantenciones-proximas';
import { ResumenDia } from '../components/dashboard/ResumenDia';
import { KpiDetailModal } from '../components/dashboard/KpiDetailModal';
import { NUM_CL, NUM_CL_1, formatDia } from '../lib/dashboard-format';
import { mesValue, opcionesMes, rangoDeMes, rangoSemanas } from '../lib/dashboard-rango';
import { horasSemanales } from '../lib/horas-semanales';

/**
 * Specs compartidas por los 3 gráficos (Recharts) — ejes recesivos (hairline,
 * sin línea de eje) y tooltip estilizado con los tokens de `index.css` en vez
 * del look por defecto de Recharts. Un solo lugar para mantener los 3
 * gráficos visualmente consistentes entre sí.
 *
 * Usan hex literales (`CHART_NEUTRAL`), no `var(--token)`: para los props que
 * Recharts pinta como atributo SVG (`fill`/`stroke` de ejes y grid) el custom
 * property podía no resolverse a tiempo para el primer paint — ver la nota
 * larga en `config/dashboard-colors.ts`. `TOOLTIP_*` renderiza en un `<div>`
 * HTML normal (sí soporta `var()`), pero se deja igual en hex por
 * consistencia con el resto del archivo.
 */
/** Recharts espera `SVGProps<SVGTextElement>` para `tick`, no `CSSProperties`
 * (comparten `fontSize`/`fill` pero no todo el resto) — se deja sin anotar
 * para que la inferencia contextual resuelva el tipo correcto en cada uso. */
const AXIS_TICK_STYLE = { fontSize: 11, fill: CHART_NEUTRAL.muted };

const TOOLTIP_CONTENT_STYLE: CSSProperties = {
  background: CHART_NEUTRAL.surface,
  border: `1px solid ${CHART_NEUTRAL.border}`,
  borderRadius: 8,
  boxShadow: CHART_NEUTRAL.overlayShadow,
  fontSize: 12,
  fontFamily: '"IBM Plex Sans Variable", ui-sans-serif, system-ui, sans-serif',
  padding: '8px 12px',
};

const TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: CHART_NEUTRAL.muted,
  fontSize: 11,
  fontWeight: 600,
  marginBottom: 4,
};

const TOOLTIP_ITEM_STYLE: CSSProperties = {
  color: CHART_NEUTRAL.foreground,
  fontSize: 12,
  padding: 0,
};

interface ChartLegendItem {
  key: string;
  label: string;
  color: string;
  value?: string;
}

/**
 * Leyenda propia (no la `<Legend>` de Recharts): un swatch de color por
 * identidad + texto en tono neutro — el texto nunca lleva el color de la
 * serie (regla de accesibilidad de la guía dataviz), la identidad la carga
 * el punto de color.
 */
function ChartLegendRow({ items }: { items: ChartLegendItem[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 pt-2">
      {items.map((item) => (
        <div className="flex items-center gap-1.5" key={item.key}>
          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-xs text-muted-foreground">
            {item.label}
            {item.value !== undefined ? <span className="ms-1 font-mono text-foreground">{item.value}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner color="accent" size="sm" />
    </div>
  );
}

function formatFecha(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    date,
  );
}

function formatHoras(horas: number): string {
  return `${NUM_CL_1.format(horas)} h`;
}

interface KpiCardProps {
  label: string;
  value: string;
  hint: string;
  hintTone?: 'muted' | 'warning';
  /** Marca discreta de que la card consume datos de otro dominio (Terreno,
   * Inventario, Mantención) y no de `/api/dashboard/*`. Ver `RealDataChip`. */
  isReal?: boolean;
  /** Abre el popup de detalle: con `onOpen` la card entera es un botón
   * (requiere `ariaLabel`); sin él es una card informativa estática. */
  onOpen?: () => void;
  ariaLabel?: string;
}

/** Indicador discreto de que la card se alimenta del dominio original (Terreno,
 * Inventario, Mantención) y no del módulo `/api/dashboard/*`. */
function RealDataChip() {
  return (
    <Chip className="shrink-0" color="success" size="sm" variant="soft">
      Real
    </Chip>
  );
}

function KpiCard({ label, value, hint, hintTone = 'muted', isReal = false, onOpen, ariaLabel }: KpiCardProps) {
  const interactiva = Boolean(onOpen);
  const contenido = (
    <Card
      className={`h-full ${interactiva ? 'transition-colors hover:bg-surface-secondary active:bg-surface-secondary' : ''}`}
    >
        <Card.Header>
          <div className="flex items-center justify-between gap-2">
            <Card.Description className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
              {label}
            </Card.Description>
            {isReal ? <RealDataChip /> : null}
          </div>
          <Card.Title className="font-display text-[26px] font-semibold tracking-[-0.02em] text-foreground">
            {value}
          </Card.Title>
        </Card.Header>
        <Card.Content>
          <p className={`text-xs ${hintTone === 'warning' ? 'text-warning-soft-foreground' : 'text-muted-foreground'}`}>
            {hint}
          </p>
        </Card.Content>
      </Card>
  );
  if (!interactiva) return contenido;
  return (
    <button
      aria-label={ariaLabel}
      className="block h-full w-full rounded-(--radius) text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
      onClick={onOpen}
      type="button"
    >
      {contenido}
    </button>
  );
}

/** Fila de hallazgo (equipo, criticidad, estado, fecha, descripción): la usan la
 * card «Hallazgos recientes» y el popup de «Hallazgos abiertos». */
function HallazgoRow({ hallazgo }: { hallazgo: HallazgoResumen }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{hallazgo.equipo}</span>
        <Chip color={criticidadChipColor(hallazgo.criticidad)} size="sm" variant="soft">
          {hallazgo.criticidad}
        </Chip>
        <Chip color={hallazgoEstadoChipColor(hallazgo.estado)} size="sm" variant="secondary">
          {hallazgoEstadoLabel(hallazgo.estado)}
        </Chip>
        <span className="ms-auto font-mono text-xs text-muted-foreground">{formatFecha(hallazgo.fecha)}</span>
      </div>
      <p className="text-sm text-foreground">{hallazgo.descripcion}</p>
    </div>
  );
}

function KpiCardSkeleton() {
  return (
    <Card>
      <Card.Content className="flex items-center justify-center py-6">
        <Spinner color="accent" size="sm" />
      </Card.Content>
    </Card>
  );
}

/** ← Mantenimiento (real): equipos dentro de su ventana de aviso; misma regla
 * del popup de mantenciones. */
function ProximasMantencionesKpiCard({ rango }: { rango: RangoDashboard }) {
  const { data, isPending, isError, error } = useMaintenanceStatusByEquipment();
  // Mismos códigos que `MantencionesProximasCard`: el estado de mantención no trae `internalCode`.
  const { data: equipos } = useDashboardEquipos(rango);
  const [abierto, setAbierto] = useState(false);

  if (isPending) return <KpiCardSkeleton />;

  if (isError) {
    return (
      <Card>
        <Card.Content className="py-6">
          <p className="text-sm text-danger-soft-foreground" role="alert">
            {error instanceof Error ? error.message : 'No se pudo cargar el estado de mantención.'}
          </p>
        </Card.Content>
      </Card>
    );
  }

  const proximas = mantencionesProximas(data?.values() ?? []);
  const cantidad = proximas.length;
  const porHorometro = proximas.filter((p) => p.unit === 'h');
  const codigos = new Map((equipos ?? []).map((e) => [e.equipmentId, e.internalCode]));
  return (
    <>
      <KpiCard
        hint="Dentro de su ventana de aviso"
        hintTone={cantidad > 0 ? 'warning' : 'muted'}
        isReal
        ariaLabel="Ver próximas mantenciones"
        label="Próximas mantenciones"
        onOpen={() => setAbierto(true)}
        value={String(cantidad)}
      />
      <KpiDetailModal
        isOpen={abierto}
        onOpenChange={setAbierto}
        title="Próximas mantenciones"
        verTodoTo="/mantenimiento/preventivo"
      >
        {porHorometro.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin mantenciones próximas por horómetro.</p>
        ) : (
          porHorometro.map((p) => {
            const hito = data?.get(p.equipmentId)?.status.next?.milestone;
            return (
              <div
                className="flex items-center gap-2 border-t border-border py-2.5 first:border-t-0 first:pt-0"
                data-testid={`kpi-mantencion-${p.equipmentId}`}
                key={p.equipmentId}
              >
                <span className="font-mono text-sm text-foreground">{codigos.get(p.equipmentId) ?? '…'}</span>
                {hito !== undefined ? (
                  <span className="text-xs text-muted-foreground">Pauta {NUM_CL.format(hito)} h</span>
                ) : null}
                <Chip className="ms-auto" color={p.remaining <= 0 ? 'danger' : 'warning'} size="sm" variant="soft">
                  {p.remaining <= 0 ? 'Toca ahora' : `Quedan ${NUM_CL_1.format(p.remaining)} h`}
                </Chip>
              </div>
            );
          })
        )}
        {cantidad > porHorometro.length ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Solo se listan las mantenciones por horómetro; las de kilometraje están en «Ver todo».
          </p>
        ) : null}
      </KpiDetailModal>
    </>
  );
}

/**
 * Filas (ítem × bodega) cuya existencia cruzó el mínimo DE ESA BODEGA.
 *
 * Con el modelo multi-sucursal no hay un "bajo mínimo" global: el mismo
 * ítem puede estar sobrado en una bodega y en falta en otra. El KPI cuenta pares
 * ítem-bodega, y la tabla los nombra con su sucursal — un aviso que no dice
 * dónde no le sirve a quien tiene que reponer.
 *
 * `minimumQuantity = 0` es "esa bodega no fijó umbral" y no cuenta.
 */
function useLowStockRows() {
  const { data, isPending, isError, error } = useItems({ isActive: true });

  const rows = (data ?? []).flatMap((item) =>
    item.stocks
      .filter(
        (stock) =>
          stock.minimumQuantity > 0 && stock.quantity <= stock.minimumQuantity,
      )
      .map((stock) => ({ item, stock })),
  );

  return { rows, isPending, isError, error };
}

/** ← Inventario (real): pares ítem-bodega bajo el mínimo de su sucursal. */
function InsumosBajoMinimoKpiCard() {
  const { rows, isPending, isError, error } = useLowStockRows();
  const [abierto, setAbierto] = useState(false);

  if (isPending) return <KpiCardSkeleton />;

  if (isError) {
    return (
      <Card>
        <Card.Content className="py-6">
          <p className="text-sm text-danger-soft-foreground" role="alert">
            {error instanceof Error ? error.message : 'No se pudo cargar el inventario.'}
          </p>
        </Card.Content>
      </Card>
    );
  }

  // Peor primero: menor proporción existencia/mínimo (0 de N = sin stock).
  const peorPrimero = [...rows].sort(
    (a, b) => a.stock.quantity / a.stock.minimumQuantity - b.stock.quantity / b.stock.minimumQuantity,
  );
  return (
    <>
      <KpiCard
        hint={rows.length > 0 ? 'Requieren reposición' : 'Stock dentro de rango'}
        hintTone={rows.length > 0 ? 'warning' : 'muted'}
        isReal
        ariaLabel="Ver ítems bajo mínimo"
        label="Ítems bajo mínimo"
        onOpen={() => setAbierto(true)}
        value={String(rows.length)}
      />
      <KpiDetailModal
        isOpen={abierto}
        onOpenChange={setAbierto}
        title="Ítems bajo mínimo"
        verTodoTo="/inventario?filtro=bajo-minimo"
      >
        {peorPrimero.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ningún ítem está bajo el mínimo.</p>
        ) : (
          peorPrimero.map(({ item, stock }) => (
            <div
              className="flex items-center gap-2 border-t border-border py-2.5 first:border-t-0 first:pt-0"
              key={`${item.id}-${stock.branchId}`}
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-sm text-foreground">{item.name}</span>
                <span className="text-xs text-muted-foreground">{stock.branch.name}</span>
              </div>
              <Chip className="ms-auto shrink-0" color={stock.quantity === 0 ? 'danger' : 'warning'} size="sm" variant="soft">
                {stock.quantity} de {stock.minimumQuantity} {UNIT_SYMBOLS[item.unit]}
              </Chip>
            </div>
          ))
        )}
      </KpiDetailModal>
    </>
  );
}

/** ← Terreno (real): `useHallazgosAbiertosResumen()` cuenta sobre
 * `GET /api/hallazgos` y desglosa por `prioridad`. Query independiente de
 * las demás KPI cards — si Terreno cae, el resto sigue mostrando sus datos
 * con normalidad. */
function HallazgosAbiertosKpiCard() {
  const { data, isPending, isError, error } = useHallazgosAbiertosResumen();
  const { data: recientes } = useHallazgosAbiertosRecientes();
  const [abierto, setAbierto] = useState(false);

  if (isPending) return <KpiCardSkeleton />;

  if (isError) {
    return (
      <Card>
        <Card.Content className="py-6">
          <p className="text-sm text-danger-soft-foreground" role="alert">
            {error instanceof Error ? error.message : 'No se pudo cargar los hallazgos.'}
          </p>
        </Card.Content>
      </Card>
    );
  }

  if (!data) return null;

  const lista = recientes ?? [];
  return (
    <>
      <KpiCard
        hint={hallazgosCriticidadHint(data.porPrioridad)}
        hintTone={data.porPrioridad.critica > 0 ? 'warning' : 'muted'}
        isReal
        ariaLabel="Ver hallazgos abiertos"
        label="Hallazgos abiertos"
        onOpen={() => setAbierto(true)}
        value={String(data.abiertos)}
      />
      <KpiDetailModal
        isOpen={abierto}
        onOpenChange={setAbierto}
        title="Hallazgos abiertos"
        verTodoTo="/terreno/hallazgos"
      >
        {lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay hallazgos abiertos.</p>
        ) : (
          lista.map((hallazgo) => <HallazgoRow hallazgo={hallazgo} key={hallazgo.id} />)
        )}
        {data.abiertos > lista.length ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Mostrando los {lista.length} más recientes de {data.abiertos}.
          </p>
        ) : null}
      </KpiDetailModal>
    </>
  );
}

function SummaryCards({ rango }: { rango: RangoDashboard }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ProximasMantencionesKpiCard rango={rango} />
      <InsumosBajoMinimoKpiCard />
      <HallazgosAbiertosKpiCard />
    </div>
  );
}


/** Lista de hallazgos recientes — filas dentro de una sola card (mismo
 * patrón de filas con separador que `ProfileView`), no una card por ítem.
 * Datos ← Terreno, REAL: top 5 de `GET /api/hallazgos`. */
function HallazgosRecientesSection() {
  const { data: hallazgos, isPending, isError, error } = useHallazgosRecientes();

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center justify-between gap-2">
          <Card.Title>Hallazgos recientes</Card.Title>
          <RealDataChip />
        </div>
        <Card.Description>Últimos reportes de terreno, sin importar su estado.</Card.Description>
      </Card.Header>
      <Card.Content>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Spinner color="accent" size="sm" />
          </div>
        ) : null}

        {isError ? (
          <p className="text-sm text-danger-soft-foreground" role="alert">
            {error instanceof Error ? error.message : 'No se pudo cargar los hallazgos.'}
          </p>
        ) : null}

        {!isPending && !isError && hallazgos
          ? hallazgos.map((hallazgo) => <HallazgoRow hallazgo={hallazgo} key={hallazgo.id} />)
          : null}

        {!isPending && !isError && hallazgos && hallazgos.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No hay hallazgos recientes.</p>
        ) : null}
      </Card.Content>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sección Equipos: KPIs del rango, horas por equipo, drill-down diario,
// próximos a mantenimiento y tendencia de hallazgos.
// ---------------------------------------------------------------------------

/** L/h; null (sin horas) o no finito se muestra «—», nunca NaN/Infinity. */
function formatRendimiento(rendimiento: number | null): string {
  return rendimiento !== null && Number.isFinite(rendimiento) ? `${NUM_CL_1.format(rendimiento)} L/h` : '—';
}

function formatLitros(litros: number): string {
  return `${NUM_CL.format(litros)} L`;
}

/** KPIs del rango con los mismos criterios del backend: L/h = litros totales / horas totales. */
function kpisEquipos(equipos: MetricasEquipo[]) {
  const horas = equipos.reduce((acc, e) => acc + e.horas, 0);
  const litros = equipos.reduce((acc, e) => acc + e.litros, 0);
  return { horas, litros, rendimiento: horas > 0 ? litros / horas : null };
}

function EquiposKpis({ equipos }: { equipos: MetricasEquipo[] }) {
  const { horas, litros, rendimiento } = kpisEquipos(equipos);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div data-testid="kpi-horas">
        <KpiCard hint="Suma de todos los equipos" label="Horas trabajadas" value={formatHoras(horas)} />
      </div>
      <div data-testid="kpi-litros">
        <KpiCard hint="Combustible cargado en el mes" label="Litros" value={formatLitros(litros)} />
      </div>
      <div data-testid="kpi-rendimiento">
        <KpiCard hint="Litros totales / horas totales" label="Rendimiento" value={formatRendimiento(rendimiento)} />
      </div>
    </div>
  );
}

function EquiposHorasChart({ equipos }: { equipos: MetricasEquipo[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={equipos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_NEUTRAL.border} vertical={false} />
          <XAxis axisLine={false} dataKey="internalCode" tick={AXIS_TICK_STYLE} tickLine={false} />
          <YAxis allowDecimals={false} axisLine={false} tick={AXIS_TICK_STYLE} tickLine={false} width={36} />
          <Tooltip
            contentStyle={TOOLTIP_CONTENT_STYLE}
            cursor={{ fill: CHART_NEUTRAL.surfaceSecondary }}
            formatter={(value) => [`${value} h`, 'Horas']}
            itemStyle={TOOLTIP_ITEM_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
          />
          <Bar
            dataKey="horas"
            fill={TRABAJOS_EXTRAORDINARIOS_COLOR}
            isAnimationActive={false}
            maxBarSize={28}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Un equipo por fila (ya ordenados por horas desc). El abierto se identifica
 * por `equipmentId`, nunca por posición: el orden cambia al cambiar de mes. */
function EquiposDrilldown({ equipos }: { equipos: MetricasEquipo[] }) {
  const [equipoAbierto, setEquipoAbierto] = useState<string | null>(null);

  return (
    <div className="flex flex-col">
      {/* Cabecera de columnas: mismos anchos que las filas de abajo. */}
      <div className="flex items-center gap-3 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        <span>Equipo</span>
        <span className="ms-auto">HM</span>
        <span className="w-20 text-end">Combustible</span>
        <span className="w-24 text-end">Rendimiento</span>
      </div>
      {equipos.map((equipo) => {
        const abierto = equipoAbierto === equipo.equipmentId;
        return (
          <div
            className="border-t border-border first:border-t-0"
            data-testid={`fila-${equipo.equipmentId}`}
            key={equipo.equipmentId}
          >
            <button
              aria-expanded={abierto}
              className="flex w-full items-center gap-3 py-2.5 text-start text-sm"
              onClick={() => setEquipoAbierto(abierto ? null : equipo.equipmentId)}
              type="button"
            >
              <span className="font-mono text-foreground">{equipo.internalCode}</span>
              <span className="ms-auto font-mono text-muted-foreground">{formatHoras(equipo.horas)}</span>
              <span className="w-20 text-end font-mono text-muted-foreground">{formatLitros(equipo.litros)}</span>
              <span className="w-24 text-end font-mono text-muted-foreground">
                {formatRendimiento(equipo.rendimiento)}
              </span>
            </button>
            {abierto ? (
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1 pb-3 ps-2 sm:grid-cols-4">
                {equipo.serieDiaria.map((dia) => (
                  <li
                    className={`flex justify-between font-mono text-xs ${dia.opero ? 'text-foreground' : 'text-muted-foreground opacity-50'}`}
                    data-opero={dia.opero}
                    data-testid={`dia-${equipo.equipmentId}-${dia.fecha}`}
                    key={dia.fecha}
                  >
                    <span>{formatDia(dia.fecha)}</span>
                    <span>{dia.opero ? formatHoras(dia.horas) : '0 h'}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}


const OPCIONES_SEMANAS = [4, 8, 12, 26] as const;

/**
 * Línea de horas por semana (lunes a domingo) por equipo, con su propio
 * rango (últimas N semanas), independiente del selector de mes. Leyenda
 * propia (`ChartLegendRow`), igual que el resto de los gráficos.
 */
function HorasSemanalesCard({
  semanas,
  onSemanasChange,
  isPending,
  isError,
  error,
  equipos,
}: {
  semanas: number;
  onSemanasChange: (semanas: number) => void;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  equipos: MetricasEquipo[] | undefined;
}) {
  const { filas, codigos } = useMemo(() => horasSemanales(equipos ?? []), [equipos]);

  return (
    <Card>
      <Card.Header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Card.Title>Horas máquina por semana</Card.Title>
            <Card.Description>Semanas de lunes a domingo; sólo equipos con actividad.</Card.Description>
          </div>
          <select
            aria-label="Rango de semanas"
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
            onChange={(event) => onSemanasChange(Number(event.target.value))}
            value={semanas}
          >
            {OPCIONES_SEMANAS.map((n) => (
              <option key={n} value={n}>
                Últimas {n} semanas
              </option>
            ))}
          </select>
        </div>
      </Card.Header>
      <Card.Content>
        <EstadoSeccion
          error={error}
          fallback="No se pudo cargar las horas semanales."
          isError={isError}
          isPending={isPending}
        />
        {!isPending && !isError ? (
          codigos.length > 0 ? (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart data={filas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_NEUTRAL.border} vertical={false} />
                    <XAxis axisLine={false} dataKey="semana" tick={AXIS_TICK_STYLE} tickLine={false} />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tick={AXIS_TICK_STYLE}
                      tickFormatter={(v: number) => NUM_CL.format(v)}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_CONTENT_STYLE}
                      formatter={(value) => `${NUM_CL_1.format(Number(value))} h`}
                      itemStyle={TOOLTIP_ITEM_STYLE}
                      labelFormatter={(label) => `Semana del ${label}`}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                    />
                    {codigos.map((codigo, i) => (
                      <Line
                        dataKey={codigo}
                        dot={false}
                        isAnimationActive={false}
                        key={codigo}
                        stroke={seriesColor(i)}
                        strokeWidth={2}
                        type="linear"
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div data-testid="leyenda-horas-semanales">
                <ChartLegendRow items={codigos.map((codigo, i) => ({ key: codigo, label: codigo, color: seriesColor(i) }))} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sin actividad en el rango.</p>
          )
        ) : null}
      </Card.Content>
    </Card>
  );
}

function SeccionEquipos({ rango }: { rango: RangoDashboard }) {
  const [semanas, setSemanas] = useState(8);
  const rangoSem = useMemo(() => rangoSemanas(semanas), [semanas]);
  const semanal = useDashboardEquipos(rangoSem);
  const { data, isPending, isError, error } = useDashboardEquipos(rango);

  const equipos = useMemo(() => [...(data ?? [])].sort((a, b) => b.horas - a.horas), [data]);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">Equipos</h2>

      {isPending ? <ChartSkeleton /> : null}

      {isError ? (
        <p className="text-sm text-danger-soft-foreground" role="alert">
          {error instanceof Error ? error.message : 'No se pudo cargar las métricas de equipos.'}
        </p>
      ) : null}

      {!isPending && !isError && data ? (
        <>
          <EquiposKpis equipos={equipos} />
          <HorasSemanalesCard
            equipos={semanal.data}
            error={semanal.error}
            isError={semanal.isError}
            isPending={semanal.isPending}
            onSemanasChange={setSemanas}
            semanas={semanas}
          />
          <Card>
            <Card.Header>
              <Card.Title>Horas por equipo</Card.Title>
              <Card.Description>Ordenado de mayor a menor. Abre un equipo para ver su detalle diario.</Card.Description>
            </Card.Header>
            <Card.Content>
              {equipos.length > 0 ? (
                <>
                  <EquiposHorasChart equipos={equipos} />
                  <EquiposDrilldown equipos={equipos} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No hay equipos registrados.</p>
              )}
            </Card.Content>
          </Card>
        </>
      ) : null}
    </section>
  );
}

/** Error / skeleton comunes de las secciones del rango. */
function EstadoSeccion({
  isPending,
  isError,
  error,
  fallback,
}: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  fallback: string;
}) {
  if (isPending) return <ChartSkeleton />;
  if (isError) {
    return (
      <p className="text-sm text-danger-soft-foreground" role="alert">
        {error instanceof Error ? error.message : fallback}
      </p>
    );
  }
  return null;
}

/** Barras de una sola serie con los ejes/tooltip compartidos del dashboard. */
function BarrasSimples({
  data,
  xKey,
  yKey,
  altura = 'h-64',
  tickFormatter,
}: {
  data: object[];
  xKey: string;
  yKey: string;
  altura?: string;
  tickFormatter?: (value: string) => string;
}) {
  return (
    <div className={`${altura} w-full`}>
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_NEUTRAL.border} vertical={false} />
          <XAxis axisLine={false} dataKey={xKey} tick={AXIS_TICK_STYLE} tickFormatter={tickFormatter} tickLine={false} />
          <YAxis allowDecimals={false} axisLine={false} tick={AXIS_TICK_STYLE} tickLine={false} width={36} />
          <Tooltip
            contentStyle={TOOLTIP_CONTENT_STYLE}
            cursor={{ fill: CHART_NEUTRAL.surfaceSecondary }}
            formatter={(value) => [`${value}`, yKey === 'horas' ? 'Horas' : 'Vueltas']}
            itemStyle={TOOLTIP_ITEM_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
          />
          <Bar
            dataKey={yKey}
            fill={TRABAJOS_EXTRAORDINARIOS_COLOR}
            isAnimationActive={false}
            maxBarSize={28}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SeccionSupervisores({ rango }: { rango: RangoDashboard }) {
  const { data, isPending, isError, error } = useDashboardSupervisores(rango);

  const turnos = (['DIURNO', 'NOCTURNO'] as const).map((turno) => ({
    turno,
    horas: data?.porTurno[turno]?.horas ?? 0,
    equipos: data?.porTurno[turno]?.equipos ?? 0,
  }));

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">Supervisores</h2>
      <EstadoSeccion
        error={error}
        fallback="No se pudo cargar el resumen por supervisor."
        isError={isError}
        isPending={isPending}
      />
      {!isPending && !isError && data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <Card.Header>
              <Card.Title>Horas por turno</Card.Title>
              <Card.Description>Diurno vs. nocturno en el mes.</Card.Description>
            </Card.Header>
            <Card.Content>
              <BarrasSimples altura="h-48" data={turnos} xKey="turno" yKey="horas" />
              <ul className="flex flex-wrap gap-x-6 gap-y-1 pt-2">
                {turnos.map((t) => (
                  <li className="text-sm text-muted-foreground" data-testid={`turno-${t.turno}`} key={t.turno}>
                    {t.turno}: <span className="font-mono text-foreground">{formatHoras(t.horas)}</span> · {t.equipos}{' '}
                    equipos
                  </li>
                ))}
              </ul>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Por supervisor</Card.Title>
            </Card.Header>
            <Card.Content>
              {data.porSupervisor.length > 0 ? (
                <Table variant="secondary">
                  <Table.ScrollContainer>
                    <Table.Content aria-label="Horas por supervisor" className="min-w-full">
                      <Table.Header>
                        <Table.Column isRowHeader>Supervisor</Table.Column>
                        <Table.Column>Horas</Table.Column>
                        <Table.Column>Equipos</Table.Column>
                        <Table.Column>Turnos</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {data.porSupervisor.map((sup) => {
                          // supervisorId puede venir "" (tarjetas sin asignar): solo es clave, nunca un id navegable.
                          const clave = sup.supervisorId || 'sin-asignar';
                          return (
                            <Table.Row data-testid={`supervisor-${clave}`} id={clave} key={clave}>
                              <Table.Cell>{sup.nombre}</Table.Cell>
                              <Table.Cell className="font-mono text-sm">{formatHoras(sup.horas)}</Table.Cell>
                              <Table.Cell className="font-mono text-sm">{sup.equipos}</Table.Cell>
                              <Table.Cell className="font-mono text-sm">{sup.turnos}</Table.Cell>
                            </Table.Row>
                          );
                        })}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">Sin turnos registrados en el mes.</p>
              )}
            </Card.Content>
          </Card>
        </div>
      ) : null}

      <TrabajosExtraCard rango={rango} />

      <VueltasBlock rango={rango} />
    </section>
  );
}

/** Card de trabajos extraordinarios (mantenedores). Vive DENTRO de la sección
 * Supervisores (pedido del administrador: no amerita sección propia) con su
 * propio estado de carga/error, independiente del de supervisores. */
function TrabajosExtraCard({ rango }: { rango: RangoDashboard }) {
  const { data, isPending, isError, error } = useDashboardMantenedores(rango);
  const plural = (n: number) => (n === 1 ? 'trabajo' : 'trabajos');

  return (
    <Card>
      <Card.Header>
        <Card.Title>Horas de trabajos extra por equipo</Card.Title>
        {!isPending && !isError && data ? (
          <Card.Description data-testid="mantenedores-total">
            Total del mes: {formatHoras(data.total.horas)} en {data.total.trabajos} {plural(data.total.trabajos)}.
          </Card.Description>
        ) : null}
      </Card.Header>
      <Card.Content>
        <EstadoSeccion
          error={error}
          fallback="No se pudo cargar el resumen de trabajos extra."
          isError={isError}
          isPending={isPending}
        />
        {!isPending && !isError && data ? (
          data.porEquipo.length > 0 ? (
            <>
              <BarrasSimples data={data.porEquipo} xKey="internalCode" yKey="horas" />
              <ul className="flex flex-col pt-2">
                {data.porEquipo.map((e) => (
                  <li
                    className="flex items-center gap-3 border-t border-border py-2 text-sm first:border-t-0"
                    data-testid={`mantenedor-${e.equipmentId}`}
                    key={e.equipmentId}
                  >
                    <span className="font-mono text-foreground">{e.internalCode}</span>
                    <span className="ms-auto font-mono text-muted-foreground">{formatHoras(e.horas)}</span>
                    <span className="w-24 text-end text-muted-foreground">
                      {e.trabajos} {plural(e.trabajos)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No hay trabajos extra en el mes.</p>
          )
        ) : null}
      </Card.Content>
    </Card>
  );
}

/** Bloque de vueltas de producción. Vive DENTRO de la sección Supervisores
 * (pedido del administrador), con estado propio independiente. */
function VueltasBlock({ rango }: { rango: RangoDashboard }) {
  const { data, isPending, isError, error } = useDashboardVueltas(rango);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-base font-semibold tracking-[-0.02em] text-foreground">Vueltas</h3>
      <EstadoSeccion
        error={error}
        fallback="No se pudieron cargar las vueltas."
        isError={isError}
        isPending={isPending}
      />
      {!isPending && !isError && data ? (
        <>
          <p className="text-sm text-muted-foreground">Las secciones no se suman: cada una tiene tarifa distinta.</p>
          {data.porSeccion.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {data.porSeccion.map((sec) => (
                <Card data-testid={`vueltas-${sec.seccion}`} key={sec.seccion}>
                  <Card.Header>
                    <Card.Description className="text-[11px] font-semibold tracking-wider text-(--eyebrow-color) uppercase">
                      {SECCION_LABEL[sec.seccion] ?? sec.seccion}
                    </Card.Description>
                    <Card.Title className="font-display text-[26px] font-semibold tracking-[-0.02em] text-foreground">
                      {NUM_CL.format(sec.vueltasTotales)}
                    </Card.Title>
                    <Card.Description>
                      vueltas · {sec.camiones} {sec.camiones === 1 ? 'camión' : 'camiones'}
                    </Card.Description>
                  </Card.Header>
                  <Card.Content>
                    <BarrasSimples altura="h-32" data={sec.serieDiaria} tickFormatter={formatDia} xKey="fecha" yKey="vueltas" />
                  </Card.Content>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin vueltas registradas en el mes.</p>
          )}
        </>
      ) : null}
    </div>
  );
}

/** Ítems bajo el mínimo de su bodega — mismo dato que el KPI de arriba. */
function InsumosBajoStockSection() {
  const { rows, isPending, isError, error } = useLowStockRows();

  return (
    <Card className="flex flex-col gap-3">
      <Card.Header>
        <div className="flex items-center justify-between gap-2">
          <Card.Title>Insumos bajo stock mínimo</Card.Title>
          <RealDataChip />
        </div>
        <Card.Description>
          Repuestos e insumos que requieren reposición, con la bodega donde faltan.
        </Card.Description>
      </Card.Header>

      {isPending ? (
        <div className="flex justify-center py-8">
          <Spinner color="accent" size="sm" />
        </div>
      ) : null}

      {isError ? (
        <p className="px-1 text-sm text-danger-soft-foreground" role="alert">
          {error instanceof Error ? error.message : 'No se pudo cargar los insumos bajo stock mínimo.'}
        </p>
      ) : null}

      {!isPending && !isError && rows.length > 0 ? (
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="Ítems bajo stock mínimo" className="min-w-full">
              <Table.Header>
                <Table.Column isRowHeader>Ítem</Table.Column>
                <Table.Column>Bodega</Table.Column>
                <Table.Column>Existencia</Table.Column>
                <Table.Column>Mínimo</Table.Column>
                <Table.Column>Estado</Table.Column>
              </Table.Header>
              <Table.Body>
                {rows.map(({ item, stock }) => (
                  <Table.Row key={`${item.id}-${stock.branchId}`}>
                    <Table.Cell>
                      <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>{' '}
                      {item.name}
                    </Table.Cell>
                    <Table.Cell className="text-sm">{stock.branch.name}</Table.Cell>
                    <Table.Cell className="font-mono text-sm">
                      {stock.quantity} {UNIT_SYMBOLS[item.unit]}
                    </Table.Cell>
                    <Table.Cell className="font-mono text-sm">
                      {stock.minimumQuantity} {UNIT_SYMBOLS[item.unit]}
                    </Table.Cell>
                    <Table.Cell>
                      <Chip color={stock.quantity === 0 ? 'danger' : 'warning'} size="sm" variant="soft">
                        {stock.quantity === 0 ? 'Sin stock' : 'Bajo mínimo'}
                      </Chip>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      ) : null}

      {!isPending && !isError && rows.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          No hay ítems bajo el mínimo de su bodega.
        </p>
      ) : null}
    </Card>
  );
}

export function DashboardView() {
  const { user } = useCurrentUser();
  const [mes, setMes] = useState(() => mesValue(new Date()));
  const meses = useMemo(() => opcionesMes(), []);
  // Rango que consumen las secciones del dashboard.
  const rango = useMemo(() => rangoDeMes(mes), [mes]);
  // Estado de mantencion (compartido con el carrusel de flota del resumen del día para el aviso en cada equipo).
  const { data: mantenciones } = useMaintenanceStatusByEquipment();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
            SMI · Dashboard
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            Hola, {user?.name || user?.email}
          </h1>
          <p className="text-sm text-muted-foreground">Resumen general del sistema.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Mes
            <select
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
              onChange={(event) => setMes(event.target.value)}
              value={mes}
            >
              {meses.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Primero lo accionable: mantenciones próximas, stock bajo y hallazgos
         (pedido del administrador: estas cards abren el dashboard). */}
      <SummaryCards rango={rango} />

      <ResumenDia mantenciones={mantenciones} />

      <SeccionEquipos rango={rango} />

      <SeccionSupervisores rango={rango} />

      <HallazgosRecientesSection />

      <InsumosBajoStockSection />
    </div>
  );
}
