import { queryClient } from '../lib/query-client';
import { EQUIPMENT_KEY, HALLAZGOS_KEY, SHIFT_CARDS_MINE_KEY, TRABAJOS_EXTRA_KEY } from '../lib/query-keys';
import type { Equipment } from '../types/equipment';
import type { Hallazgo } from '../types/hallazgos';
import type { ShiftCardResponse } from '../types/shift';
import type { TrabajoExtraordinario } from '../types/trabajosExtra';

/**
 * Escrituras en el caché de TanStack Query tras sincronizar una operación: el
 * registro recién confirmado aparece sin esperar el refetch. Viven acá (no en
 * `replay.ts`) porque el registro de endpoints (`offline/endpoints.ts`) las
 * necesita también, y `replay.ts` importa de él.
 */

export function applyCardToCache(card: ShiftCardResponse): void {
  queryClient.setQueryData<ShiftCardResponse[]>(SHIFT_CARDS_MINE_KEY, (old) => {
    const list = old ?? [];
    const index = list.findIndex((c) => c.id === card.id);
    if (index === -1) return [...list, card];
    const next = list.slice();
    next[index] = card;
    return next;
  });
}

/** Upsert por `id` al frente de la lista (el servidor las entrega de la más
 * nueva a la más vieja) — el registro recién sincronizado aparece sin esperar
 * el refetch. */
function upsertFirst<T extends { id: string }>(list: T[] | undefined, item: T): T[] {
  const current = list ?? [];
  const index = current.findIndex((x) => x.id === item.id);
  if (index === -1) return [item, ...current];
  const next = current.slice();
  next[index] = item;
  return next;
}

/** Si el servidor no incluyó `equipo` en la respuesta, lo completa desde el
 * catálogo ya cacheado: sin esto la fila recién sincronizada mostraría el
 * `equipoId` crudo hasta que llegue el refetch. */
function withEquipo<T extends { equipoId: string; equipo?: { internalCode: string } }>(record: T): T {
  if (record.equipo) return record;
  const internalCode = queryClient
    .getQueryData<Equipment[]>(EQUIPMENT_KEY)
    ?.find((e) => e.id === record.equipoId)?.internalCode;
  return internalCode ? { ...record, equipo: { internalCode } } : record;
}

export function applyHallazgoToCache(hallazgo: Hallazgo): void {
  const completo = withEquipo(hallazgo);
  queryClient.setQueryData<Hallazgo[]>(HALLAZGOS_KEY, (old) => upsertFirst(old, completo));
}

export function applyTrabajoExtraToCache(trabajo: TrabajoExtraordinario): void {
  const completo = withEquipo(trabajo);
  queryClient.setQueryData<TrabajoExtraordinario[]>(TRABAJOS_EXTRA_KEY, (old) => upsertFirst(old, completo));
}

// --- Lecturas para armar etiquetas ------------------------------------------

/** Código del equipo de una tarjeta, hallazgo o trabajo ya cacheado — para la
 * etiqueta de `SyncStatus` de una operación que se encola sin señal. */
export function cachedEquipoCode(kind: 'shift-card' | 'hallazgo' | 'trabajo-extra', id: string): string | undefined {
  if (kind === 'shift-card') {
    return queryClient.getQueryData<ShiftCardResponse[]>(SHIFT_CARDS_MINE_KEY)?.find((c) => c.id === id)?.equipo
      .internalCode;
  }
  const list =
    kind === 'hallazgo'
      ? queryClient.getQueryData<Hallazgo[]>(HALLAZGOS_KEY)
      : queryClient.getQueryData<TrabajoExtraordinario[]>(TRABAJOS_EXTRA_KEY);
  return list?.find((r) => r.id === id)?.equipo?.internalCode;
}
