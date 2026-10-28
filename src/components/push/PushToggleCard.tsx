import { useEffect, useState } from 'react';
import { Card, Switch, toast } from '@heroui/react';
import { BellRing } from 'lucide-react';

import { useCurrentUser } from '../../hooks/useCurrentUser';
import {
  disablePush,
  enablePush,
  getPushDeviceStatus,
  type PushDeviceStatus,
} from '../../lib/push-device';

/**
 * Activar/desactivar las notificaciones push de ESTE dispositivo, desde el
 * centro de notificaciones (`NotificacionesView`). La primera activación pide
 * el permiso del sistema (por eso vive detrás de un gesto); apagar acá borra
 * la marca de opt-in, así que es persistente — a diferencia del logout, que
 * desuscribe pero deja que el próximo login resuscriba solo
 * (`PushResubscribeMount`).
 */
export function PushToggleCard() {
  const { user } = useCurrentUser();
  // `null` = todavía resolviendo el estado del navegador (no se pinta nada
  // para no mostrar un switch que salte de posición).
  const [status, setStatus] = useState<PushDeviceStatus | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    let active = true;
    void getPushDeviceStatus().then((current) => {
      if (active) setStatus(current);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!user || status === null) return null;

  const descripcion: Record<PushDeviceStatus, string> = {
    subscribed: 'Este dispositivo recibe los avisos del sistema aunque la app esté cerrada.',
    unsubscribed: 'Actívalas para recibir los avisos en este celular o tablet aunque la app esté cerrada.',
    denied:
      'Las notificaciones están bloqueadas en este navegador. Permítelas en la configuración del sitio y vuelve a intentarlo.',
    unsupported:
      'Este navegador no soporta notificaciones push. En iPhone, instala SMI en la pantalla de inicio y actívalas desde ahí.',
  };

  const handleChange = (next: boolean): void => {
    if (isPending) return;
    setIsPending(true);
    void (async () => {
      try {
        if (next) {
          setStatus(await enablePush(user.id));
        } else {
          await disablePush(user.id);
          setStatus('unsubscribed');
        }
      } catch (error: unknown) {
        toast.danger(
          error instanceof Error
            ? error.message
            : 'No se pudo cambiar el estado de las notificaciones.',
        );
      } finally {
        setIsPending(false);
      }
    })();
  };

  return (
    <Card className="flex flex-row items-center justify-between gap-4 px-4 py-3">
      <div className="flex items-start gap-3">
        <BellRing aria-hidden className="mt-0.5 size-5 shrink-0 text-(--accent)" />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">
            Notificaciones en este dispositivo
          </span>
          <span className="text-sm text-muted-foreground">{descripcion[status]}</span>
        </div>
      </div>
      {status !== 'unsupported' ? (
        <Switch
          isDisabled={isPending || status === 'denied'}
          isSelected={status === 'subscribed'}
          onChange={handleChange}
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      ) : null}
    </Card>
  );
}
