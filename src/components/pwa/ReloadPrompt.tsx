import { useEffect, useRef, useState } from 'react';
import { toast } from '@heroui/react';
import { useRegisterSW } from 'virtual:pwa-register/react';

import {
  REPROMPT_AFTER_MS,
  UPDATE_CHECK_INTERVAL_MS,
  checkForUpdate,
  shouldAutoUpdateOnNavigation,
} from '../../pwa/update-policy';

/**
 * De dónde sale la ruta actual. `ReloadPrompt` vive fuera del router (en
 * `AppProviders`), así que `main.tsx` le pasa el `router` adaptado a esto.
 */
export interface NavigationSource {
  pathname: () => string;
  /** Avisa cada cambio de estado del router; devuelve la función para desuscribirse. */
  subscribe: (listener: (pathname: string) => void) => () => void;
}

/**
 * Registra el service worker generado por `vite-plugin-pwa` y traduce su
 * ciclo de vida a la UX de la app: toasts HeroUI (reusa el `Toast.Provider`
 * ya montado en `AppProviders`, no monta uno propio). No renderiza nada
 * visible por sí mismo — es puro efecto secundario.
 *
 * `registerType: 'prompt'` (ver `vite.config.ts`): una versión nueva no se
 * activa sola mientras se puede estar llenando un formulario. Las reglas de
 * cuándo revisar, cuándo volver a avisar y cuándo actualizar sin preguntar
 * están en `pwa/update-policy.ts`.
 */
export function ReloadPrompt({ navigation }: { navigation?: NavigationSource }) {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const revisar = () => void checkForUpdate(registration, navigator.onLine);
      window.setInterval(revisar, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') revisar();
      });
    },
  });

  const updateToastIdRef = useRef<string | null>(null);
  // Aviso cerrado por el usuario: vuelve a salir pasado REPROMPT_AFTER_MS. La
  // versión nueva sigue en espera (needRefresh no se apaga al cerrar).
  const [silenciado, setSilenciado] = useState(false);

  useEffect(() => {
    if (!silenciado) return;
    const id = window.setTimeout(() => setSilenciado(false), REPROMPT_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [silenciado]);

  useEffect(() => {
    if (!needRefresh || silenciado) return;

    updateToastIdRef.current = toast('Nueva versión disponible', {
      description: 'Hay cambios listos para instalar.',
      timeout: 0,
      onClose: () => {
        updateToastIdRef.current = null;
        setSilenciado(true);
      },
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
  }, [needRefresh, silenciado, updateServiceWorker]);

  // Panel de administración: con una versión en espera, cambiar de pantalla
  // dentro del panel la instala sin preguntar (no hay formulario a medio llenar).
  useEffect(() => {
    if (!needRefresh || !navigation) return;
    let anterior = navigation.pathname();
    return navigation.subscribe((actual) => {
      if (shouldAutoUpdateOnNavigation(anterior, actual)) {
        void updateServiceWorker(true);
      }
      anterior = actual;
    });
  }, [needRefresh, navigation, updateServiceWorker]);

  useEffect(() => {
    if (!offlineReady) return;

    toast.success('Listo para usar sin conexión', {
      description: 'La app quedó instalada y funciona sin internet.',
      onClose: () => setOfflineReady(false),
    });
  }, [offlineReady, setOfflineReady]);

  return null;
}
