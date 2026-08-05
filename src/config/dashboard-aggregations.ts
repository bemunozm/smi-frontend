import type { Hallazgo } from '../types/hallazgos';
import type { TrabajoExtraordinario } from '../types/trabajosExtra';
import type {
  Criticidad,
  HallazgoEstado,
  HallazgoResumen,
  HallazgoTendenciaSemana,
  HallazgosPorCriticidad,
  TrabajoExtraordinarioMes,
} from '../types/dashboard';

/**
 * Agregaciones en cliente sobre los listados reales de Terreno
 * (`hooks/useHallazgos.ts`, `hooks/useTrabajosExtra.ts`) para alimentar el
 * dashboard del bloque Núcleo. Terreno no expone endpoints de
 * agregación/filtro todavía (ver `DASHBOARD-CONTRACTS.md`) — mientras el
 * volumen sea bajo, se calcula acá en vez de pedirlos.
 *
 * Funciones puras a propósito: no tocan React ni TanStack Query, para que
 * los hooks de `hooks/useDashboard.ts` las envuelvan en `useMemo` sobre el
 * `data` de la query real y las vistas sigan sin lógica de negocio.
 */

/** KPI "Hallazgos abiertos" — cuenta `estado === 'ABIERTO'` sobre la lista completa. */
export function countHallazgosAbiertos(hallazgos: Hallazgo[]): number {
  return hallazgos.filter((h) => h.estado === 'ABIERTO').length;
}

/** Desglose por `prioridad` de los hallazgos abiertos — alimenta el subtítulo
 * de la card "Hallazgos abiertos" (`hallazgosCriticidadHint`). El backend
 * llama `prioridad` a este campo, no `criticidad` — se renombra acá, en el
 * único punto de la capa que conoce ambos nombres. */
export function hallazgosAbiertosPorPrioridad(hallazgos: Hallazgo[]): HallazgosPorCriticidad {
  const abiertos = hallazgos.filter((h) => h.estado === 'ABIERTO');
  return {
    critica: abiertos.filter((h) => h.prioridad === 'CRITICA').length,
    alta: abiertos.filter((h) => h.prioridad === 'ALTA').length,
    media: abiertos.filter((h) => h.prioridad === 'MEDIA').length,
    baja: abiertos.filter((h) => h.prioridad === 'BAJA').length,
  };
}

/** Top N hallazgos recientes — el backend ya devuelve `orderBy fecha desc`,
 * así que solo se recorta y se remapea el shape (`equipo.codigo` → `equipo`,
 * `prioridad` → `criticidad`) al contrato que ya consume `DashboardView`.
 *
 * En el tipo de Terreno (Alexander) `equipo` es opcional (`equipo?: { codigo }`)
 * — el backend lo incluye siempre en la práctica, pero el tipo no lo garantiza,
 * así que se usa optional chaining con fallback.
 *
 * `prioridad`/`estado` son `string` en el tipo de Terreno (no union literal —
 * su dominio no valida con Zod), mientras que `HallazgoResumen` sigue
 * tipando `criticidad`/`estado` como union literal para el resto del
 * dashboard: se castean acá, en el único punto que cruza ambos mundos, en
 * vez de relajar el contrato de salida que ya consumen los charts/chips. */
export function hallazgosRecientes(hallazgos: Hallazgo[], limit = 5): HallazgoResumen[] {
  return hallazgos.slice(0, limit).map((h) => ({
    id: h.id,
    equipo: h.equipo?.codigo ?? '—',
    descripcion: h.descripcion,
    criticidad: h.prioridad as Criticidad,
    estado: h.estado as HallazgoEstado,
    fecha: h.fecha,
  }));
}

/** Lunes de la semana ISO que contiene `date`, en UTC (evita corrimientos de
 * huso horario en el agrupamiento). */
function startOfIsoWeekUtc(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const isoDay = start.getUTCDay() || 7; // domingo (0) → 7, así lunes=1..domingo=7
  if (isoDay !== 1) start.setUTCDate(start.getUTCDate() - (isoDay - 1));
  return start;
}

const WEEK_LABEL_FORMATTER = new Intl.DateTimeFormat('es-CL', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/**
 * Tendencia semanal de hallazgos, abiertos vs. cerrados.
 *
 * Semántica elegida (documentada porque el modelo no da otra opción): el
 * `Hallazgo` solo tiene `fecha` de creación, no una `fecha` de cierre —
 * así que cada hallazgo se agrupa por la SEMANA EN QUE SE REPORTÓ, y dentro
 * de esa semana se cuenta según su ESTADO ACTUAL: `CERRADO` suma a
 * "cerrados", `ABIERTO`/`EN_PROCESO` suma a "abiertos". No es "cuántos se
 * cerraron esa semana" (no hay forma de saberlo con el shape actual), es
 * "de lo reportado esa semana, cuánto sigue pendiente vs. ya se resolvió".
 */
export function hallazgosTendenciaSemanal(hallazgos: Hallazgo[], weeks = 8): HallazgoTendenciaSemana[] {
  const buckets = new Map<string, { start: Date; abiertos: number; cerrados: number }>();

  for (const hallazgo of hallazgos) {
    const fecha = new Date(hallazgo.fecha);
    if (Number.isNaN(fecha.getTime())) continue;

    const weekStart = startOfIsoWeekUtc(fecha);
    const key = weekStart.toISOString();
    const bucket = buckets.get(key) ?? { start: weekStart, abiertos: 0, cerrados: 0 };

    if (hallazgo.estado === 'CERRADO') {
      bucket.cerrados += 1;
    } else {
      bucket.abiertos += 1;
    }
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(-weeks)
    .map((bucket) => ({
      semana: WEEK_LABEL_FORMATTER.format(bucket.start),
      abiertos: bucket.abiertos,
      cerrados: bucket.cerrados,
    }));
}

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('es-CL', { month: 'short', timeZone: 'UTC' });

function capitalize(label: string): string {
  return label.length > 0 ? label.charAt(0).toUpperCase() + label.slice(1) : label;
}

/** Horas extraordinarias por mes — suma `totalHoras` agrupando por mes de
 * `fecha`. Reemplaza el KPI de ingresos que existía en el mock: el campo
 * `monto` fue eliminado del modelo real de `TrabajoExtraordinario` (solo
 * existe `totalHoras`), así que no hay forma de calcular una cifra en CLP. */
export function trabajosExtraPorMes(trabajos: TrabajoExtraordinario[], months = 6): TrabajoExtraordinarioMes[] {
  const buckets = new Map<string, { start: Date; horas: number }>();

  for (const trabajo of trabajos) {
    const fecha = new Date(trabajo.fecha);
    if (Number.isNaN(fecha.getTime())) continue;

    const monthStart = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1));
    const key = monthStart.toISOString();
    const bucket = buckets.get(key) ?? { start: monthStart, horas: 0 };
    bucket.horas += trabajo.totalHoras;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(-months)
    .map((bucket) => ({
      mes: capitalize(MONTH_LABEL_FORMATTER.format(bucket.start)),
      horas: Number(bucket.horas.toFixed(1)),
    }));
}

/** KPI "Horas facturables" — total del mismo período que ya grafica
 * "Horas extraordinarias por mes" (últimos 6 meses). A propósito NO
 * recorre `trabajos` de nuevo: suma los buckets mensuales que
 * `trabajosExtraPorMes` ya calculó, para que la card y el gráfico sean
 * exactamente consistentes (mismo dato, mismo período, una sola pasada de
 * agregación) — reemplaza al KPI de ingresos que tenía el mock (el campo
 * `monto` no existe en el modelo real). */
export function sumHorasExtra(mesesData: TrabajoExtraordinarioMes[]): number {
  return Number(mesesData.reduce((total, mes) => total + mes.horas, 0).toFixed(1));
}
