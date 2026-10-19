import type { Hallazgo } from '../types/hallazgos';
import type {
  Criticidad,
  HallazgoEstado,
  HallazgoResumen,
  HallazgosPorCriticidad,
} from '../types/dashboard';

/**
 * Agregaciones en cliente sobre los listado real de hallazgos de Terreno
 * (`hooks/useHallazgos.ts`) para alimentar el
 * dashboard del bloque Núcleo. Terreno no expone endpoints de
 * agregación/filtro todavía — mientras el
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
 * así que solo se recorta y se remapea el shape (`equipo.internalCode` →
 * `equipo`, `prioridad` → `criticidad`) al contrato que ya consume `DashboardView`.
 *
 * En el tipo de Terreno (Alexander) `equipo` es opcional
 * (`equipo?: { internalCode }`) — el backend lo incluye siempre en la
 * práctica, pero el tipo no lo garantiza, así que se usa optional chaining
 * con fallback.
 *
 * `prioridad`/`estado` son `string` en el tipo de Terreno (no union literal —
 * su dominio no valida con Zod), mientras que `HallazgoResumen` sigue
 * tipando `criticidad`/`estado` como union literal para el resto del
 * dashboard: se castean acá, en el único punto que cruza ambos mundos, en
 * vez de relajar el contrato de salida que ya consumen los charts/chips. */
export function hallazgosRecientes(hallazgos: Hallazgo[], limit = 5): HallazgoResumen[] {
  return hallazgos.slice(0, limit).map(aResumen);
}

function aResumen(h: Hallazgo): HallazgoResumen {
  return {
    id: h.id,
    equipo: h.equipo?.internalCode ?? '—',
    descripcion: h.descripcion,
    criticidad: h.prioridad as Criticidad,
    estado: h.estado as HallazgoEstado,
    fecha: h.fecha,
    fotoUrl: h.fotoUrl ?? null,
  };
}

/** Los últimos `limit` hallazgos ABIERTOS, el más reciente primero. Ordena por
 * `fecha` en vez de confiar en el orden del backend: el popup del KPI «Hallazgos
 * abiertos» no debe depender de ese supuesto. */
export function hallazgosAbiertosRecientes(hallazgos: Hallazgo[], limit = 10): HallazgoResumen[] {
  return hallazgos
    .filter((h) => h.estado === 'ABIERTO')
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, limit)
    .map(aResumen);
}

