import { useState } from 'react';

import { ActividadesAPI, OrdenesAPI, UmbralesAPI } from '../api/MantenimientoAPI';
import { BranchAPI } from '../api/BranchAPI';
import { CategoryAPI } from '../api/CategoryAPI';
import { EquipmentAPI } from '../api/EquipmentAPI';
import { listHallazgos } from '../api/HallazgosAPI';
import { listHorometro } from '../api/HorometroAPI';
import { InventoryAPI } from '../api/InventoryAPI';
import { OperatorAPI } from '../api/OperatorAPI';
import { ShiftCardAPI } from '../api/ShiftCardAPI';
import { listTrabajosExtra } from '../api/TrabajosExtraAPI';
import { prepKeysFor, type PrepKey } from '../config/offline-prep';
import { queryClient } from '../lib/query-client';
import {
  ACTIVIDADES_KEY,
  BRANCHES_KEY,
  EQUIPMENT_KEY,
  HALLAZGOS_KEY,
  HOROMETRO_KEY,
  INVENTORY_KEY,
  OPERATORS_KEY,
  ORDENES_KEY,
  SHIFT_CARDS_MINE_KEY,
  TRABAJOS_EXTRA_KEY,
  UMBRALES_KEY,
} from '../lib/query-keys';
import type { Role } from '../types/roles';

/** `(display-mode: standalone)` cubre Android/desktop; `navigator.standalone`
 * es la señal equivalente (no estándar) que usa Safari/iOS — ninguna de las
 * dos alcanza sola en todos los casos, así que se combinan. */
function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standaloneMedia || iosStandalone;
}

type PrepItemResult = 'ok' | 'error';

/** `persist`/`installed` siempre; cada lista solo si el rol la usa (`prepKeysFor`). */
export type PrepResult = { persist: PrepItemResult; installed: boolean } & Partial<Record<PrepKey, PrepItemResult>>;

/** `retry: false`: el default del `queryClient` (`retry: 1` con backoff, ver
 * `lib/query-client.ts`) sirve para queries normales de la UI, pero acá el
 * checklist tiene que devolver un resultado rápido — reintentar con espera
 * antes de decirle a la persona "esto no se pudo precargar" es peor que fallar
 * rápido y dejar que vuelva a tocar el botón. */
function precargar<T>(queryKey: readonly unknown[], queryFn: () => Promise<T>): Promise<T> {
  return queryClient.fetchQuery({ queryKey, queryFn, retry: false });
}

/** Cada lista se baja bajo las MISMAS query keys que usan las pantallas (con los
 * filtros con que abren por defecto): así el caché de TanStack queda tibio Y la
 * petición GET real pasa por el Service Worker, que la guarda en el cache
 * `smi-api` (`vite.config.ts`, `NetworkFirst`, 72 h) para el próximo arranque
 * sin señal. Una lista "ok" exige que TODAS sus peticiones lo estén. */
const PRECARGAS: Readonly<Record<PrepKey, () => Promise<unknown>>> = {
  equipment: () => precargar(EQUIPMENT_KEY, () => EquipmentAPI.list({})),
  branches: () => precargar([...BRANCHES_KEY, { isActive: true }], () => BranchAPI.list({ isActive: true })),
  operators: () => precargar([...OPERATORS_KEY, { isActive: true }], () => OperatorAPI.list({ isActive: true })),
  inventory: () =>
    Promise.all([
      ...(['SUPPLY', 'PART'] as const).flatMap((type) => [
        precargar([...INVENTORY_KEY, 'items', { type, isActive: true }], () =>
          InventoryAPI.listItems({ type, isActive: true }),
        ),
        precargar([...INVENTORY_KEY, 'categories', { type }], () => CategoryAPI.list({ type })),
      ]),
      precargar([...INVENTORY_KEY, 'items', { isActive: true }], () => InventoryAPI.listItems({ isActive: true })),
      precargar([...INVENTORY_KEY, 'categories', {}], () => CategoryAPI.list({})),
    ]),
  maintenance: () =>
    Promise.all([
      precargar([...ORDENES_KEY, 'TODAS'], () => OrdenesAPI.list()),
      precargar(ACTIVIDADES_KEY, () => ActividadesAPI.list()),
      precargar(UMBRALES_KEY, () => UmbralesAPI.list()),
    ]),
  shiftCards: () => precargar(SHIFT_CARDS_MINE_KEY, ShiftCardAPI.listMine),
  hallazgos: () => precargar(HALLAZGOS_KEY, listHallazgos),
  trabajosExtra: () => precargar(TRABAJOS_EXTRA_KEY, listTrabajosExtra),
  horometro: () => precargar(HOROMETRO_KEY, listHorometro),
};

/** Descarga en paralelo lo que el arranque en frío sin señal necesita para el
 * rol (`prepKeysFor`). `navigator.storage.persist()` pide que el navegador no
 * evicte ese storage bajo presión — best-effort, algunos navegadores
 * simplemente no lo soportan. */
async function prepararParaUsoSinSenal(role: Role | null | undefined): Promise<PrepResult> {
  const persist =
    'storage' in navigator && typeof navigator.storage.persist === 'function'
      ? await navigator.storage.persist().then(
          (granted) => (granted ? 'ok' : 'error'),
          () => 'error',
        )
      : 'error';

  const keys = prepKeysFor(role);
  const resultados = await Promise.allSettled(keys.map((key) => PRECARGAS[key]()));
  const listas: Partial<Record<PrepKey, PrepItemResult>> = {};
  keys.forEach((key, index) => {
    listas[key] = resultados[index]?.status === 'fulfilled' ? 'ok' : 'error';
  });

  return { ...listas, persist: persist as PrepItemResult, installed: isStandalonePwa() };
}

export interface UsePrepareOfflineResult {
  preparando: boolean;
  resultadoPrep: PrepResult | null;
  handlePreparar: () => Promise<void>;
}

/**
 * Checklist "Preparar para uso sin señal" (la hoja de sincronización de oficina y
 * de Terreno) — extraído a un hook aparte para que la lógica de precarga se
 * pueda testear sin levantar el componente. Precarga las listas del `role`.
 */
export function usePrepareOffline(role?: Role | null): UsePrepareOfflineResult {
  const [preparando, setPreparando] = useState(false);
  const [resultadoPrep, setResultadoPrep] = useState<PrepResult | null>(null);

  const handlePreparar = async (): Promise<void> => {
    setPreparando(true);
    setResultadoPrep(null);
    try {
      const resultado = await prepararParaUsoSinSenal(role);
      setResultadoPrep(resultado);
    } finally {
      setPreparando(false);
    }
  };

  return { preparando, resultadoPrep, handlePreparar };
}
