import { useState } from 'react';
import { Button } from '@heroui/react';
import { Share, Smartphone, SquarePlus } from 'lucide-react';

import { useInstalarApp } from '../../pwa/install-prompt';

/**
 * Aviso para instalar la app (montado a nivel de sesión en
 * `PushResubscribeMount`, junto al de notificaciones, que espera a que este
 * se resuelva). Con diálogo del sistema (Android/Chrome/Edge) el botón
 * «Instalar» lo abre; en iPhone/iPad solo puede explicar los pasos.
 * La lógica vive en `pwa/install-prompt.ts`.
 */
export function InstallAppBanner() {
  const { modo, invitar, instalar, descartar } = useInstalarApp();
  const [isPending, setIsPending] = useState(false);

  if (!invitar || !modo) return null;

  const handleInstalar = (): void => {
    if (isPending) return;
    setIsPending(true);
    // Si lo cancela en el diálogo, el aviso se va igual: el evento ya se usó.
    void instalar().finally(() => setIsPending(false));
  };

  return (
    <div
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-xl border border-border bg-card p-4 shadow-lg"
      role="region"
      aria-label="Instalar la app"
    >
      <div className="flex items-start gap-3">
        <Smartphone aria-hidden className="mt-0.5 size-5 shrink-0 text-(--accent)" />
        <div className="flex flex-col gap-3">
          {modo === 'nativo' ? (
            <>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">Instala SMI en este dispositivo</span>
                <span className="text-sm text-muted-foreground">
                  Se abre desde su ícono como cualquier app, a pantalla completa, y funciona sin señal.
                </span>
              </div>
              <div className="flex gap-2">
                <Button isPending={isPending} size="sm" onPress={handleInstalar}>
                  Instalar
                </Button>
                <Button isDisabled={isPending} size="sm" variant="tertiary" onPress={descartar}>
                  Ahora no
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-foreground">Agrega SMI a tu pantalla de inicio</span>
                <span className="text-sm text-muted-foreground">
                  Así se abre como app, funciona sin señal y te llegan las notificaciones.
                </span>
                <ol className="mt-1 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-foreground marker:text-muted-foreground">
                  <li>
                    Toca <Share aria-hidden className="inline size-4 align-text-bottom text-(--accent)" />{' '}
                    <span className="font-medium">Compartir</span> en la barra del navegador.
                  </li>
                  <li>
                    Elige <SquarePlus aria-hidden className="inline size-4 align-text-bottom text-(--accent)" />{' '}
                    <span className="font-medium">Agregar a pantalla de inicio</span>.
                  </li>
                </ol>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="tertiary" onPress={descartar}>
                  Entendido
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
