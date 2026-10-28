import { useState } from 'react';
import { Button, toast } from '@heroui/react';
import { BellRing } from 'lucide-react';

import { useCurrentUser } from '../../hooks/useCurrentUser';
import { enablePush, isPushSupported } from '../../lib/push-device';
import {
  readPushBannerDismissed,
  readPushOptIn,
  savePushBannerDismissed,
} from '../../lib/push-optin';

/**
 * Invitación a activar el push al entrar a la app (montada a nivel de sesión
 * en `PushResubscribeMount`). El diálogo de permiso del sistema NO puede
 * dispararse solo (iOS lo exige detrás de un gesto y Chrome penaliza pedirlo
 * de entrada), así que la invitación es nuestra y el botón «Activar» es el
 * gesto que abre el diálogo real.
 *
 * Aparece una sola vez por usuario+dispositivo: solo con el permiso aún sin
 * resolver (`default`), sin opt-in previo y sin un «Ahora no» anterior
 * (`push-optin.ts`). Para todo lo demás está el interruptor del centro de
 * notificaciones (`PushToggleCard`).
 */
export function PushInvitationBanner() {
  const { user, isAuthenticated, isOfflineSnapshot } = useCurrentUser();
  const [hidden, setHidden] = useState(false);
  const [isPending, setIsPending] = useState(false);

  // Sin sesión confirmada online no hay backend al que suscribirse; sin
  // soporte o con el permiso ya resuelto (granted/denied) no hay nada que
  // invitar — granted sin suscripción es alguien que apagó a propósito.
  const userId = isAuthenticated && !isOfflineSnapshot ? (user?.id ?? null) : null;
  const shouldShow =
    !hidden &&
    userId !== null &&
    isPushSupported() &&
    Notification.permission === 'default' &&
    !readPushOptIn(userId) &&
    !readPushBannerDismissed(userId);

  if (!shouldShow) return null;

  const handleActivate = (): void => {
    if (isPending) return;
    setIsPending(true);
    void (async () => {
      try {
        // 'subscribed' oculta por logrado; 'denied' también — el estado
        // bloqueado queda explicado en el card de Notificaciones.
        await enablePush(userId);
        setHidden(true);
      } catch (error: unknown) {
        toast.danger(
          error instanceof Error
            ? error.message
            : 'No se pudo activar las notificaciones.',
        );
      } finally {
        setIsPending(false);
      }
    })();
  };

  const handleDismiss = (): void => {
    savePushBannerDismissed(userId);
    setHidden(true);
  };

  return (
    <div
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-xl border border-border bg-card p-4 shadow-lg"
      role="region"
      aria-label="Activar notificaciones"
    >
      <div className="flex items-start gap-3">
        <BellRing aria-hidden className="mt-0.5 size-5 shrink-0 text-(--accent)" />
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">
              ¿Quieres recibir las notificaciones en este celular?
            </span>
            <span className="text-sm text-muted-foreground">
              Los avisos del sistema te llegarán aunque la app esté cerrada.
              Puedes cambiarlo cuando quieras en Notificaciones.
            </span>
          </div>
          <div className="flex gap-2">
            <Button isPending={isPending} size="sm" onPress={handleActivate}>
              Activar
            </Button>
            <Button isDisabled={isPending} size="sm" variant="tertiary" onPress={handleDismiss}>
              Ahora no
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
