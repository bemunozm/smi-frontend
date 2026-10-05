import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, WifiOff } from 'lucide-react';

import type { SyncState } from './replay';
import { plural } from '../lib/format';

export type SyncStatusTono = 'danger' | 'warning' | 'success' | 'neutral';

export interface SyncStatusPresentation {
  tono: SyncStatusTono;
  icono: ReactNode;
  texto: ReactNode;
}

/**
 * Deriva tono/ícono/texto de la barra de `components/terreno/SyncStatus.tsx`
 * a partir del estado de sync — función PURA (sin hooks, sin efectos) para
 * poder testear las prioridades directamente, sin renderizar el
 * componente completo. La prioridad del `if/else` es la regla de negocio:
 * sesión expirada > snapshot sin señal > requiere atención > sincronizando >
 * pendientes > sin señal (nada pendiente todavía) > sincronizado > inicial.
 *
 * "Sin señal · sesión guardada" (arranque en frío con la sesión del snapshot)
 * no esconde la cola: sigue contando lo que espera y lo que requiere atención,
 * porque es justo cuando una tablet reiniciada en faena necesita saberlo.
 */
export function syncStatusPresentation(
  sync: SyncState,
  isOfflineSnapshot: boolean,
  enLinea: boolean,
): SyncStatusPresentation {
  if (sync.authRequired) {
    return {
      tono: 'danger',
      icono: <AlertTriangle className="mt-0.5 h-[18px] w-[18px] shrink-0" />,
      texto: (
        <>
          <b>Tu sesión expiró.</b> Iniciá sesión para sincronizar.
        </>
      ),
    };
  }

  if (isOfflineSnapshot) {
    return {
      tono: sync.attentionCount > 0 ? 'danger' : 'warning',
      icono: <WifiOff className="mt-0.5 h-[18px] w-[18px] shrink-0" />,
      texto: (
        <>
          <b>Sin señal</b> · sesión guardada.
          {sync.pendingCount > 0 && <> {plural(sync.pendingCount, 'registro', 'registros')} por sincronizar.</>}
          {sync.attentionCount > 0 && (
            <>
              {' '}
              {plural(sync.attentionCount, 'registro', 'registros')}{' '}
              {sync.attentionCount === 1 ? 'requiere' : 'requieren'} atención.
            </>
          )}
        </>
      ),
    };
  }

  if (sync.attentionCount > 0) {
    return {
      tono: 'danger',
      icono: <AlertTriangle className="mt-0.5 h-[18px] w-[18px] shrink-0" />,
      texto: (
        <>
          <b>{plural(sync.attentionCount, 'registro', 'registros')}</b>{' '}
          {sync.attentionCount === 1 ? 'requiere' : 'requieren'} atención.
        </>
      ),
    };
  }

  if (sync.syncing) {
    return {
      tono: 'neutral',
      icono: <RefreshCw className="mt-0.5 h-[18px] w-[18px] shrink-0 animate-spin" />,
      texto: 'Sincronizando…',
    };
  }

  if (sync.pendingCount > 0) {
    return {
      tono: 'warning',
      icono: <Clock className="mt-0.5 h-[18px] w-[18px] shrink-0" />,
      texto: (
        <>
          <b>{plural(sync.pendingCount, 'registro', 'registros')}</b> por sincronizar.
        </>
      ),
    };
  }

  if (!enLinea) {
    return {
      tono: 'warning',
      icono: <WifiOff className="mt-0.5 h-[18px] w-[18px] shrink-0" />,
      texto: 'Sin señal. Lo que registres queda guardado en el equipo y se envía solo al volver la conexión.',
    };
  }

  if (sync.lastSyncAt != null) {
    return {
      tono: 'success',
      icono: <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0" />,
      texto: (
        <>
          Todo sincronizado ·{' '}
          <span className="tabular">
            {new Date(sync.lastSyncAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </>
      ),
    };
  }

  return {
    tono: 'neutral',
    icono: <Clock className="mt-0.5 h-[18px] w-[18px] shrink-0" />,
    texto: 'Preparado para registrar sin señal.',
  };
}
