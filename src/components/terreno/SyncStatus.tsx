import { useState } from 'react';

import { useEquipment } from '../../hooks/useEquipment';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { CONTAINER } from '../../layout/terreno-container';
import { useOutboxOps } from '../../offline/useOutboxOps';
import { useSyncState } from '../../offline/replay';
import { isRole } from '../../types/roles';
import { syncStatusPresentation, type SyncStatusTono } from '../../offline/sync-status-presentation';
import { PrepChecklist, PREP_DETAIL_LIMITATION } from '../sync/PrepChecklist';
import { SyncOpsList } from '../sync/SyncOpsList';
import { SyncSheet } from '../sync/SyncSheet';

const ESTILOS: Record<SyncStatusTono, string> = {
  danger: 'bg-danger-soft text-danger-soft-foreground border-danger/25',
  warning: 'bg-warning-soft text-warning-soft-foreground border-warning/30',
  success: 'bg-success-soft text-success-soft-foreground border-success/25',
  neutral: 'bg-white/10 text-white border-transparent',
};

/**
 * Barra + hoja de estado de sincronización de Terreno. El contador es REAL: sale
 * del outbox de Dexie (`offline/replay.ts#useSyncState`), en vivo, y sigue
 * contando también cuando la sesión es la guardada de un arranque sin señal.
 *
 * Consumidor puro de `useSyncState()` — el motor (`useSyncEngine()`) vive a
 * nivel de sesión en `components/SyncEngineMount.tsx`, no acá: si viviera
 * en este componente (montado solo dentro de `TerrenoLayout`), navegar a
 * `/` lo desmontaría y la sincronización se detendría hasta volver a
 * Terreno. La hoja (la cola con su estado, "Preparar para uso sin señal") se
 * arma con las piezas de `components/sync/`, las mismas que usa oficina.
 */
export function SyncStatus() {
  const { user, isOfflineSnapshot } = useCurrentUser();
  const enLinea = useOnlineStatus();
  const sync = useSyncState(user?.id);
  const ops = useOutboxOps(user?.id);
  const { data: equipos } = useEquipment();

  const [abierto, setAbierto] = useState(false);

  const { tono, icono, texto } = syncStatusPresentation(sync, isOfflineSnapshot, enLinea);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={`flex-none border-b text-[13px] leading-snug ${ESTILOS[tono]}`}
      >
        <div className={`${CONTAINER} flex items-start gap-2.5 py-2.5 text-left`}>
          {icono}
          <span className="flex-1">{texto}</span>
        </div>
      </button>

      <SyncSheet sync={sync} isOpen={abierto} onClose={() => setAbierto(false)}>
        <SyncOpsList ops={ops} userId={user?.id} equipos={equipos} />
        <PrepChecklist
          role={isRole(user?.role) ? user.role : null}
          titulo="Antes de ir a terreno"
          descripcion={`Precarga los equipos, operadores, tarjetas activas, hallazgos y trabajos para que la pantalla abra igual sin señal. ${PREP_DETAIL_LIMITATION}`}
        />
      </SyncSheet>
    </>
  );
}
