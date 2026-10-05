import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';

import type { SyncState } from '../../offline/replay';

/**
 * Badge de la barra superior de oficina: cuántos cambios esperan sincronizarse.
 * Se oculta cuando no hay nada pendiente ni nada que atender — no es un
 * indicador de "todo bien" que ocupe lugar siempre. Al tocarlo se abre la hoja de
 * sincronización (`SyncSheet`), la misma que la barra de Terreno.
 */
export function SyncBadge({ sync, onPress }: { sync: SyncState; onPress: () => void }) {
  const total = sync.pendingCount + sync.attentionCount;
  if (total === 0 && !sync.authRequired) return null;

  const requiereAtencion = sync.attentionCount > 0 || sync.authRequired;
  const Icono = requiereAtencion ? AlertTriangle : sync.syncing ? RefreshCw : Clock;
  const tono = requiereAtencion
    ? 'bg-danger-soft text-danger-soft-foreground'
    : 'bg-warning-soft text-warning-soft-foreground';
  const etiqueta = sync.authRequired
    ? 'Sesión vencida: la sincronización está detenida'
    : requiereAtencion
      ? `Sincronización: ${total} cambios sin sincronizar, ${sync.attentionCount} requieren atención`
      : `Sincronización: ${total} cambios sin sincronizar`;

  return (
    <button
      type="button"
      aria-label={etiqueta}
      onClick={onPress}
      className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${tono}`}
    >
      <Icono aria-hidden className={`h-4 w-4 ${sync.syncing && !requiereAtencion ? 'animate-spin' : ''}`} />
      <span className="tabular">{total}</span>
      <span className="hidden sm:inline">sin sincronizar</span>
    </button>
  );
}
