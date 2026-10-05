import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { toast } from '@heroui/react';

import { OfflineDbError } from './sync/OfflineDbError';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { isCacheOwnerMismatch } from '../lib/cache-owner';
import { plural } from '../lib/format';
import { reconcileCacheOwner } from '../lib/session-data';
import { requestPersistentStorage } from '../offline/persist-storage';
import { clearEngineNotice, useSyncEngine, useSyncState } from '../offline/replay';
import { useOfflineDb } from '../offline/useOfflineDb';

/**
 * Layout route SIN UI propia que se monta a nivel de SESIÓN autenticada y hace
 * cuatro cosas:
 * - monta `useSyncEngine()`: directo bajo el `ProtectedRoute` de sesión (sin
 *   `allowedRoles`), que es ancestro TANTO de `AppLayout` como de `TerrenoLayout`,
 *   así que vive una sola vez por sesión y sigue vivo al navegar entre ambos
 *   árboles (si viviera en una pantalla, salir de ella cortaría los disparadores
 *   `online`, `visibilitychange` y el intervalo de 45 s);
 * - presenta y limpia los avisos del motor (`EngineState.notice`, ej. "reporte
 *   enviado con equipos faltantes"): `offline/` no dispara UI directo (nunca
 *   importa `@heroui/react`), así que el aviso viaja como estado hasta acá;
 * - al confirmarse una sesión, purga las cachés del equipo si son de otra sesión
 *   (otro usuario, o la misma que venció) y pide que el navegador no borre el
 *   almacenamiento donde vive la cola de registros;
 * - si la base local no abre, muestra qué hacer en vez de dejar la app rota.
 */
export function SyncEngineMount() {
  const { user, isOfflineSnapshot } = useCurrentUser();
  const userId = user?.id ?? null;
  const confirmedUserId = userId && !isOfflineSnapshot ? userId : null;
  const { status: dbStatus, retry: retryDb } = useOfflineDb();

  useSyncEngine(dbStatus === 'failed' ? null : userId);
  const { notice, otherAccountCount } = useSyncState(user?.id);
  const [reconciledFor, setReconciledFor] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    toast(notice);
    clearEngineNotice();
  }, [notice]);

  // Con una sesión CONFIRMADA por el servidor (no la guardada de un arranque sin
  // señal, que no debe borrar lo que se preparó para usar sin conexión).
  useEffect(() => {
    if (!confirmedUserId) return;
    // Con la purga hecha vuelve a pintar, aunque no haya podido anotar el dueño
    // (almacenamiento lleno): la pantalla nunca queda en blanco.
    if (reconcileCacheOwner(confirmedUserId)) setReconciledFor(confirmedUserId);
    void requestPersistentStorage();
  }, [confirmedUserId]);

  // Avisa una vez por sesión que hay registros de otra cuenta en este equipo.
  const avisadoPara = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || otherAccountCount <= 0 || avisadoPara.current === userId) return;
    avisadoPara.current = userId;
    toast(
      `Este equipo guarda ${plural(otherAccountCount, 'registro', 'registros')} sin enviar de otra cuenta: se enviarán cuando esa persona vuelva a iniciar sesión.`,
    );
  }, [userId, otherAccountCount]);

  if (dbStatus === 'failed') return <OfflineDbError onRetry={retryDb} />;
  // Hasta que se purguen las cachés de la sesión anterior no se pinta nada de lo
  // que cuelga de ellas (el efecto de arriba corre justo después de este render).
  if (confirmedUserId && reconciledFor !== confirmedUserId && isCacheOwnerMismatch(confirmedUserId)) return null;
  return <Outlet />;
}
