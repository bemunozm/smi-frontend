import { useState } from 'react';

import { useEquipment } from '../../hooks/useEquipment';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { CONTAINER } from '../../layout/TerrenoLayout';
import { useOutboxOps } from '../../offline/useOutboxOps';
import { useSyncState } from '../../offline/replay';
import { isRole } from '../../types/roles';
import { syncStatusPresentation, type SyncStatusTono } from '../../offline/sync-status-presentation';
import { PrepChecklist } from '../sync/PrepChecklist';
import { SyncOpsList } from '../sync/SyncOpsList';
import { SyncSheet } from '../sync/SyncSheet';

/**
 * Barra + hoja de estado de sincronización — reemplaza a `BarraSinSenal`
 * (`layout/TerrenoLayout.tsx`), que prometía "se envía solo al volver la
 * conexión" sin ningún código detrás (RFC "Supervisión en Terreno" §Diseño
 * → Offline). Acá el contador es REAL: sale del outbox de Dexie
 * (`offline/replay.ts#useSyncState`), en vivo.
 *
 * Consumidor puro de `useSyncState()` — el motor (`useSyncEngine()`) vive a
 * nivel de sesión en `components/SyncEngineMount.tsx`, no acá: si viviera
 * en este componente (montado solo dentro de `TerrenoLayout`), navegar a
 * `/` lo desmontaría y la sincronización se detendría hasta volver a
 * Terreno. La hoja (lista de atención, "Preparar para uso sin señal") se arma
 * con las piezas de `components/sync/`, las mismas que usa oficina.
 */
export function SyncStatus() {
  const { user, isOfflineSnapshot } = useCurrentUser();
  const enLinea = useOnlineStatus();
  const sync = useSyncState(user?.id);
  const ops = useOutboxOps(user?.id);
  const { data: equipos } = useEquipment();

  const [abierto, setAbierto] = useState(false);

  const { tono, icono, texto } = syncStatusPresentation(sync, isOfflineSnapshot, enLinea);

  const estilos: Record<SyncStatusTono, string> = {
    danger: 'bg-[var(--danger-soft)] text-[var(--danger)] border-[#f3c9c9]',
    warning: 'bg-[var(--warning-soft)] text-[var(--warning-soft-foreground)] border-[#f1d9a2]',
    success: 'bg-[var(--success-soft)] text-[var(--success-soft-foreground)] border-[#bfe3cd]',
    neutral: 'bg-white/10 text-white border-transparent',
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={`flex-none border-b text-[13px] leading-snug ${estilos[tono]}`}
      >
        <div className={`${CONTAINER} flex items-start gap-2.5 py-2.5 text-left`}>
          {icono}
          <span className="flex-1">{texto}</span>
        </div>
      </button>

      {abierto && (
        <SyncSheet sync={sync} onClose={() => setAbierto(false)}>
          <SyncOpsList ops={ops} userId={user?.id} equipos={equipos} />
          <PrepChecklist
            role={isRole(user?.role) ? user.role : null}
            titulo="Antes de ir a terreno"
            descripcion="Precarga los equipos, operadores, tarjetas activas, hallazgos y trabajos para que la pantalla abra igual sin señal."
          />
        </SyncSheet>
      )}
    </>
  );
}
