import type { CSSProperties } from 'react';
import { Card, Chip, Spinner, Table } from '@heroui/react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useCurrentUser } from '../hooks/useCurrentUser';
import {
  useDashboardSummary,
  useFlotaComposicion,
  useHallazgosAbiertosResumen,
  useHallazgosRecientes,
  useHallazgosTendencia,
  useHorasFacturables,
  useInsumosBajoStock,
  useMantencionesProximas,
  useTrabajosExtraordinariosMensual,
} from '../hooks/useDashboard';
import {
  CHART_NEUTRAL,
  HALLAZGOS_TENDENCIA_COLOR,
  TRABAJOS_EXTRAORDINARIOS_COLOR,
  criticidadChipColor,
  equipoEstadoChartColor,
  equipoEstadoLabel,
  hallazgoEstadoChipColor,
  hallazgoEstadoLabel,
  hallazgosCriticidadHint,
} from '../config/dashboard-colors';

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
  fontFamily: '"Geist Variable", ui-sans-serif, system-ui, sans-serif',
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
  return `${Number.isInteger(horas) ? horas : horas.toFixed(1)} h`;
}

interface KpiCardProps {
  label: string;
  value: string;
  hint: string;
  hintTone?: 'muted' | 'warning';
  /** Marca discreta de que ESTA card puntual ya consume datos reales
   * (Terreno), a diferencia del resto del dashboard. Ver `RealDataChip`. */
  isReal?: boolean;
}

/** Indicador discreto de dato real — reemplaza, a nivel de sección, al
 * chip único "Datos de ejemplo" del header (que dejó de ser cierto para
 * el 100% del dashboard desde que Terreno se integró). */
function RealDataChip() {
  return (
    <Chip className="shrink-0" color="success" size="sm" variant="soft">
      Real
    </Chip>
  );
}

function KpiCard({ label, value, hint, hintTone = 'muted', isReal = false }: KpiCardProps) {
  return (
    <Card>
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

/**
 * KPIs de Flota/Inventario (Amin) y Mantenimiento (Joaquín) — únicos que
 * siguen en mock, ver `api/DashboardAPI.ts#getSummary`. Consulta propia
 * (`useDashboardSummary()`): si falla, no afecta al KPI real de al lado
 * (`HallazgosAbiertosKpiCard`), que usa su propia query.
 */
function MockKpiCards() {
  const { data: summary, isPending, isError, error } = useDashboardSummary();

  if (isPending) {
    return (
      <>
        {Array.from({ length: 4 }, (_, index) => (
          <KpiCardSkeleton key={index} />
        ))}
      </>
    );
  }

  if (isError) {
    return (
      <div
        className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground sm:col-span-2 lg:col-span-3"
        role="alert"
      >
        {error instanceof Error ? error.message : 'No se pudo cargar el resumen.'}
      </div>
    );
  }

  const disponibilidadPct = Math.round(
    (summary.equiposDisponibles.disponibles / summary.equiposDisponibles.total) * 100,
  );

  return (
    <>
      <KpiCard
        hint={`${disponibilidadPct}% de la flota operativa`}
        label="Equipos disponibles"
        value={`${summary.equiposDisponibles.disponibles} / ${summary.equiposDisponibles.total}`}
      />
      <KpiCard
        hint="Según umbral de horómetro"
        label="Próximas mantenciones"
        value={String(summary.proximasMantenciones)}
      />
      <KpiCard
        hint="Mantenciones preventivas ejecutadas a tiempo"
        hintTone={summary.cumplimientoPreventivoPct < 80 ? 'warning' : 'muted'}
        label="Cumplimiento preventivo"
        value={`${Math.round(summary.cumplimientoPreventivoPct)}%`}
      />
      <KpiCard
        hint={summary.insumosBajoMinimo > 0 ? 'Requieren reposición' : 'Stock dentro de rango'}
        hintTone={summary.insumosBajoMinimo > 0 ? 'warning' : 'muted'}
        label="Insumos bajo mínimo"
        value={String(summary.insumosBajoMinimo)}
      />
    </>
  );
}

/** ← Terreno (real): `useHallazgosAbiertosResumen()` cuenta sobre
 * `GET /api/hallazgos` y desglosa por `prioridad`. Query independiente de
 * `MockKpiCards` — si Terreno cae, el resto de los KPIs sigue mostrando su
 * mock con normalidad. */
function HallazgosAbiertosKpiCard() {
  const { data, isPending, isError, error } = useHallazgosAbiertosResumen();

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

  return (
    <KpiCard
      hint={hallazgosCriticidadHint(data.porPrioridad)}
      hintTone={data.porPrioridad.critica > 0 ? 'warning' : 'muted'}
      isReal
      label="Hallazgos abiertos"
      value={String(data.abiertos)}
    />
  );
}

/** ← Terreno (real): `useHorasFacturables()` reutiliza la MISMA query y los
 * MISMOS buckets mensuales que ya consume el gráfico "Horas extraordinarias
 * por mes" (`useTrabajosExtraordinariosMensual`) — no dispara una query
 * nueva ni recorre `trabajos-extra` de nuevo, solo suma la serie que el
 * gráfico ya calculó. Reemplaza al KPI "Ingresos trabajos extra" del mock
 * original (el campo `monto` no existe en el modelo real de
 * `TrabajoExtraordinario`, solo `totalHoras`). */
function HorasFacturablesKpiCard() {
  const { data, isPending, isError, error } = useHorasFacturables();

  if (isPending) return <KpiCardSkeleton />;

  if (isError) {
    return (
      <Card>
        <Card.Content className="py-6">
          <p className="text-sm text-danger-soft-foreground" role="alert">
            {error instanceof Error ? error.message : 'No se pudo cargar las horas extraordinarias.'}
          </p>
        </Card.Content>
      </Card>
    );
  }

  if (data === undefined) return null;

  return (
    <KpiCard hint="Últimos 6 meses" isReal label="Horas facturables" value={formatHoras(data)} />
  );
}

function SummaryCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MockKpiCards />
      <HallazgosAbiertosKpiCard />
      <HorasFacturablesKpiCard />
    </div>
  );
}

/** Dona — composición de estados de la flota (DISPONIBLE/EN_RUTA/
 * EN_MANTENCION/DE_BAJA). Aporta la MEZCLA de estados que la card "Equipos
 * disponibles" no muestra — esa card solo da disponibles/total, no qué pasa
 * con el resto. Datos ← Flota/Amin, mock. */
function FlotaComposicionSection() {
  const { data, isPending, isError, error } = useFlotaComposicion();

  const chartData = data?.map((item) => ({
    ...item,
    label: equipoEstadoLabel(item.estado),
    fill: equipoEstadoChartColor(item.estado),
  }));

  return (
    <Card>
      <Card.Header>
        <Card.Title>Composición de la flota</Card.Title>
        <Card.Description>Distribución de los equipos por estado operativo.</Card.Description>
      </Card.Header>
      <Card.Content>
        {isPending ? <ChartSkeleton /> : null}

        {isError ? (
          <p className="text-sm text-danger-soft-foreground" role="alert">
            {error instanceof Error ? error.message : 'No se pudo cargar la composición de la flota.'}
          </p>
        ) : null}

        {!isPending && !isError && chartData ? (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer height="100%" width="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                    formatter={(value, name) => [`${value} equipos`, name]}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                  />
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={chartData}
                    dataKey="cantidad"
                    innerRadius="58%"
                    isAnimationActive={false}
                    nameKey="label"
                    outerRadius="85%"
                    paddingAngle={3}
                    stroke={CHART_NEUTRAL.surface}
                    strokeWidth={2}
                  >
                    {chartData.map((entry) => (
                      <Cell fill={entry.fill} key={entry.estado} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ChartLegendRow
              items={chartData.map((item) => ({
                key: item.estado,
                label: item.label,
                value: String(item.cantidad),
                color: item.fill,
              }))}
            />
          </>
        ) : null}
      </Card.Content>
    </Card>
  );
}

/** Área — tendencia semanal de hallazgos, abiertos vs cerrados (~8 semanas).
 * Aporta la dimensión TEMPORAL (¿se acumulan o se resuelven?) que ninguna
 * card muestra. Datos ← Terreno, REAL (agrupación en cliente, ver
 * `config/dashboard-aggregations.ts#hallazgosTendenciaSemanal`). */
function HallazgosTendenciaSection() {
  const { data, isPending, isError, error } = useHallazgosTendencia();

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center justify-between gap-2">
          <Card.Title>Tendencia de hallazgos</Card.Title>
          <RealDataChip />
        </div>
        <Card.Description>
          Abiertos/en proceso vs. cerrados, agrupados por semana de reporte (últimas 8).
        </Card.Description>
      </Card.Header>
      <Card.Content>
        {isPending ? <ChartSkeleton /> : null}

        {isError ? (
          <p className="text-sm text-danger-soft-foreground" role="alert">
            {error instanceof Error ? error.message : 'No se pudo cargar la tendencia de hallazgos.'}
          </p>
        ) : null}

        {!isPending && !isError && data ? (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer height="100%" width="100%">
                <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_NEUTRAL.border} vertical={false} />
                  <XAxis axisLine={false} dataKey="semana" tick={AXIS_TICK_STYLE} tickLine={false} />
                  <YAxis allowDecimals={false} axisLine={false} tick={AXIS_TICK_STYLE} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                    cursor={{ stroke: CHART_NEUTRAL.border, strokeWidth: 1 }}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                  />
                  <Area
                    dataKey="abiertos"
                    fill={HALLAZGOS_TENDENCIA_COLOR.abiertos}
                    fillOpacity={0.12}
                    isAnimationActive={false}
                    name="Abiertos"
                    stroke={HALLAZGOS_TENDENCIA_COLOR.abiertos}
                    strokeWidth={2}
                    type="monotone"
                  />
                  <Area
                    dataKey="cerrados"
                    fill={HALLAZGOS_TENDENCIA_COLOR.cerrados}
                    fillOpacity={0.12}
                    isAnimationActive={false}
                    name="Cerrados"
                    stroke={HALLAZGOS_TENDENCIA_COLOR.cerrados}
                    strokeWidth={2}
                    type="monotone"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <ChartLegendRow
              items={[
                { key: 'abiertos', label: 'Abiertos', color: HALLAZGOS_TENDENCIA_COLOR.abiertos },
                { key: 'cerrados', label: 'Cerrados', color: HALLAZGOS_TENDENCIA_COLOR.cerrados },
              ]}
            />
          </>
        ) : null}
      </Card.Content>
    </Card>
  );
}

/** Barras — horas máquina de trabajos extraordinarios por mes (~6 meses).
 * Usa HORAS, no ingresos: el campo `monto` no existe en el modelo real de
 * `TrabajoExtraordinario` (solo `totalHoras`), así que el KPI de ingresos
 * que tenía el mock se eliminó en vez de dejarlo roto. Serie única: sin
 * leyenda, el título de la card ya dice qué se mide. Datos ← Terreno, REAL
 * (agrupación en cliente, ver `config/dashboard-aggregations.ts#trabajosExtraPorMes`). */
function TrabajosExtraordinariosSection() {
  const { data, isPending, isError, error } = useTrabajosExtraordinariosMensual();

  return (
    <Card className="lg:col-span-2">
      <Card.Header>
        <div className="flex items-center justify-between gap-2">
          <Card.Title>Horas extraordinarias por mes</Card.Title>
          <RealDataChip />
        </div>
        <Card.Description>Horas máquina en trabajos extraordinarios, últimos 6 meses.</Card.Description>
      </Card.Header>
      <Card.Content>
        {isPending ? <ChartSkeleton /> : null}

        {isError ? (
          <p className="text-sm text-danger-soft-foreground" role="alert">
            {error instanceof Error ? error.message : 'No se pudo cargar las horas extraordinarias.'}
          </p>
        ) : null}

        {!isPending && !isError && data ? (
          <div className="h-64 w-full">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={CHART_NEUTRAL.border} vertical={false} />
                <XAxis axisLine={false} dataKey="mes" tick={AXIS_TICK_STYLE} tickLine={false} />
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
        ) : null}
      </Card.Content>
    </Card>
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
          ? hallazgos.map((hallazgo) => (
              <div
                className="flex flex-col gap-1.5 border-t border-border py-3 first:border-t-0 first:pt-0"
                key={hallazgo.id}
              >
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
            ))
          : null}

        {!isPending && !isError && hallazgos && hallazgos.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No hay hallazgos recientes.</p>
        ) : null}
      </Card.Content>
    </Card>
  );
}

/** Próximas mantenciones — `Table variant="secondary"`, mismo patrón que
 * `UsersView` (un solo contenedor, sin card anidada). */
function MantencionesProximasSection() {
  const { data: mantenciones, isPending, isError, error } = useMantencionesProximas();

  return (
    <Card className="flex flex-col gap-3">
      <Card.Header>
        <Card.Title>Próximas mantenciones</Card.Title>
        <Card.Description>Equipos cerca de su umbral de horómetro.</Card.Description>
      </Card.Header>

      {isPending ? (
        <div className="flex justify-center py-8">
          <Spinner color="accent" size="sm" />
        </div>
      ) : null}

      {isError ? (
        <p className="px-1 text-sm text-danger-soft-foreground" role="alert">
          {error instanceof Error ? error.message : 'No se pudo cargar las mantenciones.'}
        </p>
      ) : null}

      {!isPending && !isError && mantenciones.length > 0 ? (
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="Próximas mantenciones" className="min-w-full">
              <Table.Header>
                <Table.Column isRowHeader>Equipo</Table.Column>
                <Table.Column>Tipo</Table.Column>
                <Table.Column>Horómetro restante</Table.Column>
              </Table.Header>
              <Table.Body>
                <Table.Collection items={mantenciones}>
                  {(mantencion) => (
                    <Table.Row>
                      <Table.Cell className="font-mono text-sm">{mantencion.equipo}</Table.Cell>
                      <Table.Cell>{mantencion.tipo === 'PREVENTIVA' ? 'Preventiva' : 'Correctiva'}</Table.Cell>
                      <Table.Cell>
                        {mantencion.horometroRestante > 0 ? (
                          `${mantencion.horometroRestante} h`
                        ) : (
                          <Chip color="danger" size="sm" variant="soft">
                            Umbral alcanzado
                          </Chip>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Collection>
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      ) : null}

      {!isPending && !isError && mantenciones.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">No hay mantenciones próximas.</p>
      ) : null}
    </Card>
  );
}

/** Insumos con stock por debajo del mínimo — mismo patrón de `Table` que
 * `MantencionesProximasSection`. Datos ← Inventario/Amin, mock. */
function InsumosBajoStockSection() {
  const { data: insumos, isPending, isError, error } = useInsumosBajoStock();

  return (
    <Card className="flex flex-col gap-3">
      <Card.Header>
        <Card.Title>Insumos bajo stock mínimo</Card.Title>
        <Card.Description>Repuestos e insumos que requieren reposición.</Card.Description>
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

      {!isPending && !isError && insumos && insumos.length > 0 ? (
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="Insumos bajo stock mínimo" className="min-w-full">
              <Table.Header>
                <Table.Column isRowHeader>Insumo</Table.Column>
                <Table.Column>Stock actual</Table.Column>
                <Table.Column>Stock mínimo</Table.Column>
                <Table.Column>Estado</Table.Column>
              </Table.Header>
              <Table.Body>
                <Table.Collection items={insumos}>
                  {(insumo) => (
                    <Table.Row>
                      <Table.Cell>{insumo.insumo}</Table.Cell>
                      <Table.Cell className="font-mono text-sm">{insumo.stockActual}</Table.Cell>
                      <Table.Cell className="font-mono text-sm">{insumo.stockMinimo}</Table.Cell>
                      <Table.Cell>
                        <Chip color={insumo.stockActual === 0 ? 'danger' : 'warning'} size="sm" variant="soft">
                          {insumo.stockActual === 0 ? 'Sin stock' : 'Bajo mínimo'}
                        </Chip>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Collection>
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      ) : null}

      {!isPending && !isError && insumos && insumos.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">No hay insumos bajo su stock mínimo.</p>
      ) : null}
    </Card>
  );
}

export function DashboardView() {
  const { user } = useCurrentUser();

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
        <Chip color="warning" size="sm" variant="soft">
          Datos parcialmente de ejemplo
        </Chip>
      </div>

      <SummaryCards />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FlotaComposicionSection />
        <HallazgosTendenciaSection />
        <TrabajosExtraordinariosSection />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HallazgosRecientesSection />
        <MantencionesProximasSection />
      </div>

      <InsumosBajoStockSection />
    </div>
  );
}
