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

/** Raíz de todo lo de tarjetas de turno (`mine` + el historial de cambios de
 * cada una): invalidarla refresca los dos. */
export const SHIFT_CARDS_KEY = ['shift-cards'] as const;

/** Historial de cambios (`GET /shift-cards/:id/changes`). Cuelga de
 * `SHIFT_CARDS_KEY`, así una edición lo refresca invalidando solo la raíz. */
export const shiftCardCambiosKey = (id: string) => [...SHIFT_CARDS_KEY, id, 'cambios'] as const;

/** Raíz de Inventario: ítems, kardex, movimientos y categorías (`['inventory',
 * 'categories']`) cuelgan de acá, así que un movimiento o una edición de
 * categoría refresca todo lo que muestra una existencia o un nombre de categoría. */
export const INVENTORY_KEY = ['inventory'] as const;
export const BRANCHES_KEY = ['branches'] as const;
export const OPERATORS_KEY = ['operators'] as const;
/** Documentos por equipo: `[...EQUIPMENT_DOCUMENTS_KEY, equipmentId]`. */
export const EQUIPMENT_DOCUMENTS_KEY = ['equipment-documents'] as const;
export const COMBUSTIBLE_KEY = ['combustible'] as const;
export const ORDENES_KEY = ['ordenes'] as const;
/** Bitácora por orden: `[...INTERVENCIONES_KEY, ordenId]`. */
export const INTERVENCIONES_KEY = ['intervenciones'] as const;
export const ACTIVIDADES_KEY = ['actividades'] as const;
export const UMBRALES_KEY = ['umbrales'] as const;

/**
 * Nombres de las keys que una operación del outbox puede invalidar al
 * terminar. La operación persiste el NOMBRE, no el arreglo: así una key que se
 * reorganice más adelante no deja operaciones viejas apuntando a una que ya no
 * existe (ver `offline/endpoints.ts` y `offline/replay.ts`).
 */
export const QUERY_KEYS = {
  shiftCards: SHIFT_CARDS_KEY,
  shiftCardsMine: SHIFT_CARDS_MINE_KEY,
  hallazgos: HALLAZGOS_KEY,
  trabajosExtra: TRABAJOS_EXTRA_KEY,
  horometro: HOROMETRO_KEY,
  equipment: EQUIPMENT_KEY,
  equipmentDocuments: EQUIPMENT_DOCUMENTS_KEY,
  combustible: COMBUSTIBLE_KEY,
  inventory: INVENTORY_KEY,
  branches: BRANCHES_KEY,
  operators: OPERATORS_KEY,
  ordenes: ORDENES_KEY,
  intervenciones: INTERVENCIONES_KEY,
  actividades: ACTIVIDADES_KEY,
  umbrales: UMBRALES_KEY,
} as const;

export type QueryKeyName = keyof typeof QUERY_KEYS;
