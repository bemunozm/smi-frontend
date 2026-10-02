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
