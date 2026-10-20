import { useState } from 'react';

import { IntervencionesAPI, ActividadesAPI, OrdenesAPI, UmbralesAPI } from '../api/MantenimientoAPI';
import { BranchAPI } from '../api/BranchAPI';
import { CategoryAPI } from '../api/CategoryAPI';
import { listCombustible } from '../api/CombustibleAPI';
import { DailyChecklistAPI } from '../api/DailyChecklistAPI';
import { EquipmentAPI } from '../api/EquipmentAPI';
import { listHallazgos } from '../api/HallazgosAPI';
import { listHorometro } from '../api/HorometroAPI';
import { InventoryAPI } from '../api/InventoryAPI';
import { NotificacionAPI } from '../api/NotificacionAPI';
import { OperatorAPI } from '../api/OperatorAPI';
import { listEmpresasExternas, listPlantas, listReportesDiarios } from '../api/ReporteDiarioAPI';
import { ShiftCardAPI } from '../api/ShiftCardAPI';
import { listTrabajosExtra } from '../api/TrabajosExtraAPI';
import { VencimientosAPI } from '../api/VencimientosAPI';
import { BITACORA_ORDENES_PRECARGADAS, prepKeysFor, type PrepKey } from '../config/offline-prep';
import { queryClient } from '../lib/query-client';
import {
  ACTIVIDADES_KEY,
  BRANCHES_KEY,
  COMBUSTIBLE_KEY,
  DAILY_CHECKLISTS_KEY,
  EMPRESAS_EXTERNAS_KEY,
  EQUIPMENT_DOCUMENTS_KEY,
  EQUIPMENT_KEY,
  HALLAZGOS_KEY,
  HOROMETRO_KEY,
  INTERVENCIONES_KEY,
  INVENTORY_KEY,
  NOTIFICACIONES_KEY,
  NOTIFICACIONES_UNREAD_KEY,
  OPERATORS_KEY,
  ORDENES_KEY,
  PLANTAS_KEY,
  REPORTE_DIARIO_KEY,
  SHIFT_CARDS_MINE_KEY,
  TRABAJOS_EXTRA_KEY,
  UMBRALES_KEY,
} from '../lib/query-keys';
import { toDateOnly } from '../lib/turno';
import { requestPersistentStorage } from '../offline/persist-storage';
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

/** El Service Worker controla esta página: solo entonces las lecturas que hace la
 * precarga pasan por él y quedan en su cache. Tras la primera instalación, o si
 * se recargó con "Recargar de todos modos", la página no está controlada y lo
 * "precargado" no se guarda para el arranque sin señal. */
function serviceWorkerControlsPage(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller != null;
}

type PrepItemResult = 'ok' | 'error';

/** `persist`/`serviceWorker`/`installed` siempre; cada lista solo si el rol la usa (`prepKeysFor`). */
export type PrepResult = {
  persist: PrepItemResult;
  serviceWorker: PrepItemResult;
  installed: boolean;
} & Partial<Record<PrepKey, PrepItemResult>>;

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
 * sin señal. Una lista "ok" exige que TODAS sus peticiones lo estén.
 *
 * Las lecturas por entidad (la ficha y el detalle de un equipo, el kardex de un
 * ítem) NO se precargan: serían una request por cada equipo e ítem. Abren sin señal
 * solo si se visitaron con conexión (la bitácora sí: la de las órdenes recientes). */
const PRECARGAS: Readonly<Record<PrepKey, () => Promise<unknown>>> = {
  dashboard: () => precargar([...EQUIPMENT_KEY, 'resumen'], EquipmentAPI.resumen),
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
  movimientos: () =>
    precargar([...INVENTORY_KEY, 'movements', { limit: 200 }], () => InventoryAPI.listMovements({ limit: 200 })),
  maintenance: () =>
    Promise.all([
      precargar([...ORDENES_KEY, 'TODAS'], () => OrdenesAPI.list()),
      precargar(ACTIVIDADES_KEY, () => ActividadesAPI.list()),
      precargar(UMBRALES_KEY, () => UmbralesAPI.list()),
    ]),
  bitacora: async () => {
    const ordenes = await precargar([...ORDENES_KEY, 'TODAS'], () => OrdenesAPI.list());
    await Promise.all(
      ordenes
        .slice(0, BITACORA_ORDENES_PRECARGADAS)
        .map((orden) => precargar([...INTERVENCIONES_KEY, orden.id], () => IntervencionesAPI.list(orden.id))),
    );
  },
  notificaciones: () =>
    Promise.all([
      precargar(NOTIFICACIONES_KEY, NotificacionAPI.list),
      precargar(NOTIFICACIONES_UNREAD_KEY, NotificacionAPI.unreadCount),
    ]),
  // Módulo 2 y 3: el catálogo de ítems (sin él el mantenedor no puede armar el
  // formulario), los enviados de hoy y los estados que miran las pestañas de
  // ambos shells (por validar → supervisor, rechazados → mantenedor).
  dailyChecklists: () => {
    const hoy = toDateOnly(new Date());
    return Promise.all([
      precargar([...DAILY_CHECKLISTS_KEY, 'items'], DailyChecklistAPI.items),
      precargar([...DAILY_CHECKLISTS_KEY, 'list', hoy], () => DailyChecklistAPI.list({ date: hoy })),
      precargar([...DAILY_CHECKLISTS_KEY, 'status', 'SUBMITTED'], () => DailyChecklistAPI.list({ status: ['SUBMITTED'] })),
      precargar([...DAILY_CHECKLISTS_KEY, 'status', 'REJECTED'], () => DailyChecklistAPI.list({ status: ['REJECTED'] })),
    ]);
  },
  // Módulo 4: el calendario completo, misma key que `useCalendarioVencimientos()`
  // sin filtros (`VencimientosView` abre así).
  vencimientos: () => precargar([...EQUIPMENT_DOCUMENTS_KEY, 'calendario', 'actual', 'todos'], () => VencimientosAPI.calendario()),
  shiftCards: () => precargar(SHIFT_CARDS_MINE_KEY, ShiftCardAPI.listMine),
  hallazgos: () => precargar(HALLAZGOS_KEY, listHallazgos),
  trabajosExtra: () => precargar(TRABAJOS_EXTRA_KEY, listTrabajosExtra),
  // Los reportes de la última semana (la MISMA ventana con que abre
  // `ReporteDiarioView`) y los catálogos de sus selectores. La ventana se calcula
  // con la fecha local, igual que la vista; en un turno nocturno que cruza la
  // medianoche la del contexto puede diferir en un día — el Service Worker igual
  // guarda la respuesta por URL y la ventana de 7 días cubre ambas fechas.
  reporteDiario: () => {
    const ahora = new Date();
    const desde = toDateOnly(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 7));
    const hasta = toDateOnly(ahora);
    return Promise.all([
      precargar([...REPORTE_DIARIO_KEY, { desde, hasta }], () => listReportesDiarios({ desde, hasta })),
      precargar(PLANTAS_KEY, listPlantas),
      precargar(EMPRESAS_EXTERNAS_KEY, listEmpresasExternas),
    ]);
  },
  horometro: () => precargar(HOROMETRO_KEY, listHorometro),
  combustible: () => precargar(COMBUSTIBLE_KEY, listCombustible),
};

/** Descarga en paralelo lo que el arranque en frío sin señal necesita para el
 * rol (`prepKeysFor`). `navigator.storage.persist()` pide que el navegador no
 * evicte ese storage bajo presión — best-effort, algunos navegadores
 * simplemente no lo soportan. */
async function prepararParaUsoSinSenal(role: Role | null | undefined): Promise<PrepResult> {
  const persist: PrepItemResult = (await requestPersistentStorage()) ? 'ok' : 'error';

  const keys = prepKeysFor(role);
  const resultados = await Promise.allSettled(keys.map((key) => PRECARGAS[key]()));
  const listas: Partial<Record<PrepKey, PrepItemResult>> = {};
  keys.forEach((key, index) => {
    listas[key] = resultados[index]?.status === 'fulfilled' ? 'ok' : 'error';
  });

  return {
    ...listas,
    persist,
    serviceWorker: serviceWorkerControlsPage() ? 'ok' : 'error',
    installed: isStandalonePwa(),
  };
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
