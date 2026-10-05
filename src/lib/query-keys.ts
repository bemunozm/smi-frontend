/**
 * Query keys compartidas entre `hooks/` y `offline/` — viven acá (no en el
 * hook dueño del dominio, ej. `hooks/useShiftCards.ts`) porque
 * `offline/replay.ts` necesita leer/escribir el caché de TanStack Query sin
 * importar "hacia arriba" desde `offline/` (infraestructura de más bajo
 * nivel) a `hooks/` (ver `CLAUDE.md`).
 */

/**
 * Tarjetas propias del Módulo A — la misma URL estable (`GET
 * /api/shift-cards/mine`) que expone el backend, cacheada offline (Workbox
 * `smi-api`, ver `vite.config.ts`) para el arranque en frío sin señal (RFC
 * "Supervisión en Terreno" §Diseño → Offline). La usan `hooks/useShiftCards.ts`
 * (la query), `hooks/usePrepareOffline.ts` (precarga) y `offline/replay.ts`
 * (upsert en caché tras cada operación sincronizada).
 */
export const SHIFT_CARDS_MINE_KEY = ['shift-cards', 'mine'] as const;

/**
 * Listas de Hallazgos y Trabajos extra — las lee `hooks/useHallazgos.ts` /
 * `hooks/useTrabajosExtra.ts` y las escribe `offline/replay.ts` (upsert del
 * registro recién sincronizado + invalidación al terminar el run).
 */
export const HALLAZGOS_KEY = ['hallazgos'] as const;
export const TRABAJOS_EXTRA_KEY = ['trabajos-extra'] as const;

/** Lecturas de horómetro (`hooks/useHorometro.ts`), que `hooks/usePrepareOffline.ts`
 * precarga para el arranque en frío sin señal. */
export const HOROMETRO_KEY = ['horometro'] as const;

/** Raíz del árbol de equipos; la lista sin filtros (catálogo completo) vive
 * exactamente en esta key. `offline/replay.ts` la lee para completar el
 * código de equipo de un registro sincronizado sin importar `hooks/`. */
export const EQUIPMENT_KEY = ['equipment'] as const;
