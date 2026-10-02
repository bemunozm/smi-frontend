import { useState } from 'react';

import { EquipmentAPI } from '../api/EquipmentAPI';
import { listHallazgos } from '../api/HallazgosAPI';
import { listHorometro } from '../api/HorometroAPI';
import { OperatorAPI } from '../api/OperatorAPI';
import { ShiftCardAPI } from '../api/ShiftCardAPI';
import { listTrabajosExtra } from '../api/TrabajosExtraAPI';
import { EQUIPMENT_KEY } from './useEquipment';
import { OPERATORS_KEY } from './useOperators';
import { queryClient } from '../lib/query-client';
import { HALLAZGOS_KEY, HOROMETRO_KEY, SHIFT_CARDS_MINE_KEY, TRABAJOS_EXTRA_KEY } from '../lib/query-keys';

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

export interface PrepResult {
  persist: PrepItemResult;
  equipment: PrepItemResult;
  operators: PrepItemResult;
  shiftCards: PrepItemResult;
  hallazgos: PrepItemResult;
  trabajosExtra: PrepItemResult;
  /** Lecturas de horómetro: de ahí sale la pista "equipo ocupado" de
   * Trabajos extra. */
  horometro: PrepItemResult;
  installed: boolean;
}

/** Descarga en paralelo lo que el arranque en frío sin señal necesita
 * (equipos, operadores activos, tarjetas propias, hallazgos, trabajos extra y
 * horómetro) bajo las MISMAS query
 * keys que ya usan `useEquipment()`/`useOperators({isActive:true})`/
 * `useShiftCardsMine()` — así el caché de TanStack queda tibio Y, de paso,
 * la petición GET real pasa por el Service Worker, que la guarda en el
 * cache `smi-api` (`vite.config.ts`, `NetworkFirst`, 72 h) para el próximo
 * arranque sin señal. `navigator.storage.persist()` pide que el navegador
 * no evicte ese storage bajo presión — best-effort, algunos navegadores
 * simplemente no lo soportan. */
async function prepararParaUsoSinSenal(): Promise<PrepResult> {
  const persist =
    'storage' in navigator && typeof navigator.storage.persist === 'function'
      ? await navigator.storage.persist().then(
          (granted) => (granted ? 'ok' : 'error'),
          () => 'error',
        )
      : 'error';

  // `retry: false`: el default del `queryClient` (`retry: 1` con backoff, ver
  // `lib/query-client.ts`) sirve para queries normales de la UI, pero acá el
  // checklist tiene que devolver un resultado rápido — reintentar con espera
  // antes de decirle al supervisor "esto no se pudo precargar" es peor que
  // fallar rápido y dejar que vuelva a tocar el botón.
  const [equipment, operators, shiftCards, hallazgos, trabajosExtra, horometro] = await Promise.allSettled([
    queryClient.fetchQuery({ queryKey: EQUIPMENT_KEY, queryFn: () => EquipmentAPI.list({}), retry: false }),
    queryClient.fetchQuery({
      queryKey: [...OPERATORS_KEY, { isActive: true }],
      queryFn: () => OperatorAPI.list({ isActive: true }),
      retry: false,
    }),
    queryClient.fetchQuery({ queryKey: SHIFT_CARDS_MINE_KEY, queryFn: ShiftCardAPI.listMine, retry: false }),
    queryClient.fetchQuery({ queryKey: HALLAZGOS_KEY, queryFn: listHallazgos, retry: false }),
    queryClient.fetchQuery({ queryKey: TRABAJOS_EXTRA_KEY, queryFn: listTrabajosExtra, retry: false }),
    queryClient.fetchQuery({ queryKey: HOROMETRO_KEY, queryFn: listHorometro, retry: false }),
  ]);

  return {
    persist: persist as PrepItemResult,
    equipment: equipment.status === 'fulfilled' ? 'ok' : 'error',
    operators: operators.status === 'fulfilled' ? 'ok' : 'error',
    shiftCards: shiftCards.status === 'fulfilled' ? 'ok' : 'error',
    hallazgos: hallazgos.status === 'fulfilled' ? 'ok' : 'error',
    trabajosExtra: trabajosExtra.status === 'fulfilled' ? 'ok' : 'error',
    horometro: horometro.status === 'fulfilled' ? 'ok' : 'error',
    installed: isStandalonePwa(),
  };
}

export interface UsePrepareOfflineResult {
  preparando: boolean;
  resultadoPrep: PrepResult | null;
  handlePreparar: () => Promise<void>;
}

/**
 * Checklist "Preparar para uso sin señal" de `components/terreno/SyncStatus.tsx`
 * — extraído a un hook aparte para que la lógica de
 * precarga se pueda testear sin levantar el componente completo.
 */
export function usePrepareOffline(): UsePrepareOfflineResult {
  const [preparando, setPreparando] = useState(false);
  const [resultadoPrep, setResultadoPrep] = useState<PrepResult | null>(null);

  const handlePreparar = async (): Promise<void> => {
    setPreparando(true);
    setResultadoPrep(null);
    try {
      const resultado = await prepararParaUsoSinSenal();
      setResultadoPrep(resultado);
    } finally {
      setPreparando(false);
    }
  };

  return { preparando, resultadoPrep, handlePreparar };
}
