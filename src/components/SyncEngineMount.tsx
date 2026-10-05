import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { toast } from '@heroui/react';

import { useCurrentUser } from '../hooks/useCurrentUser';
import { clearEngineNotice, useSyncEngine, useSyncState } from '../offline/replay';

/**
 * Layout route SIN UI propia — monta `useSyncEngine()` a nivel de SESIÓN.
 *
 * Antes el motor vivía dentro de `components/terreno/SyncStatus.tsx`, que
 * solo se monta dentro de `TerrenoLayout`: un SUPERVISOR que tocaba "Ir al
 * panel" (el link del drawer a `/`) salía de `TerrenoLayout`, desmontaba
 * `SyncStatus` y con él el motor — los disparadores (`online`,
 * `visibilitychange`, el intervalo de 45 s) se cortaban hasta volver a
 * Terreno, dejando la sincronización pausada en silencio.
 *
 * Acá vive como un layout route propio en `routes.tsx`, directo bajo el
 * `ProtectedRoute` de sesión (sin `allowedRoles`) que es ancestro TANTO de
 * `AppLayout` como de `TerrenoLayout` — se monta UNA sola vez por sesión
 * autenticada y sigue vivo al navegar entre ambos árboles. `SyncStatus`
 * queda como consumidor puro de `useSyncState()`.
 *
 * También presenta y limpia el aviso puntual del motor
 * (`EngineState.notice`, ej. "reporte enviado con equipos faltantes") —
 * `offline/` no dispara UI directo (nunca importa `@heroui/react`), así que
 * ese aviso viaja como estado hasta este componente.
 */
export function SyncEngineMount() {
  const { user } = useCurrentUser();
  useSyncEngine(user?.id ?? null);
  const { notice } = useSyncState(user?.id);

  useEffect(() => {
    if (!notice) return;
    toast(notice);
    clearEngineNotice();
  }, [notice]);

  return <Outlet />;
}
