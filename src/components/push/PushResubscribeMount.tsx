import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import { useCurrentUser } from '../../hooks/useCurrentUser';
import { resubscribeIfOptedIn } from '../../lib/push-device';
import { PushInvitationBanner } from './PushInvitationBanner';

/**
 * Montaje sin UI a nivel de SESIÓN (bajo `SyncEngineMount` en `routes.tsx`,
 * mismo criterio): al confirmar sesión, resuscribe en silencio el push de
 * este dispositivo si el usuario ya lo había activado acá
 * (`lib/push-device.ts#resubscribeIfOptedIn`). Es la otra mitad del logout,
 * que desuscribe la tablet compartida: sin esto, cada turno partiría con las
 * notificaciones apagadas hasta tocar el toggle de nuevo.
 *
 * Solo con sesión CONFIRMADA online (`!isOfflineSnapshot`): sin señal no hay
 * backend al que postear, y la cookie podría estar revocada.
 */
export function PushResubscribeMount() {
  const { user, isAuthenticated, isOfflineSnapshot } = useCurrentUser();
  const userId = isAuthenticated && !isOfflineSnapshot ? (user?.id ?? null) : null;

  useEffect(() => {
    if (!userId) return;
    void resubscribeIfOptedIn(userId);
  }, [userId]);

  // El banner de invitación vive acá por la misma razón que la resuscripción:
  // un solo punto que cubre AppLayout y Terreno. Él mismo decide si mostrarse.
  return (
    <>
      <PushInvitationBanner />
      <Outlet />
    </>
  );
}
