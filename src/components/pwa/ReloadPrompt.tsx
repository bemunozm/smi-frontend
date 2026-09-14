import { useEffect, useRef } from 'react';
import { toast } from '@heroui/react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Registra el service worker generado por `vite-plugin-pwa` y traduce su
 * ciclo de vida a la UX de la app: toasts HeroUI (reusa el `Toast.Provider`
 * ya montado en `AppProviders`, no monta uno propio). No renderiza nada
 * visible por sí mismo — es puro efecto secundario.
 *
 * `registerType: 'prompt'` (ver `vite.config.ts`) implica que una nueva
 * versión NUNCA se activa sola: el usuario decide cuándo con el botón
 * "Actualizar", evitando perder un formulario a medio llenar en terreno.
 */
export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  const updateToastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!needRefresh) return;

    updateToastIdRef.current = toast('Nueva versión disponible', {
      description: 'Hay cambios listos para instalar.',
      timeout: 0,
      onClose: () => setNeedRefresh(false),
      actionProps: {
        children: 'Actualizar',
        onPress: () => {
          void updateServiceWorker(true);
        },
      },
    });

    return () => {
      if (updateToastIdRef.current) {
        toast.close(updateToastIdRef.current);
        updateToastIdRef.current = null;
      }
    };
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  useEffect(() => {
    if (!offlineReady) return;

    toast.success('Listo para usar sin conexión', {
      description: 'La app quedó instalada y funciona sin internet.',
      onClose: () => setOfflineReady(false),
    });
  }, [offlineReady, setOfflineReady]);

  return null;
}
