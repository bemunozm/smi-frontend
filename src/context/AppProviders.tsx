import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toast } from '@heroui/react';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { queryClient } from '../lib/query-client';
import { ReloadPrompt } from '../components/pwa/ReloadPrompt';

export interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Composición de providers globales de la app. `main.tsx` queda limpio,
 * envolviendo el router con `<AppProviders>`. Si en el futuro se agregan
 * más providers transversales (theming, i18n, etc.), se anidan acá.
 *
 * `Toast.Provider` se monta una única vez acá (patrón HeroUI: "Render the
 * provider in the root of your app") — cualquier componente puede disparar
 * un toast después con `toast.success(...)`/`toast.danger(...)` sin volver
 * a montar el provider.
 *
 * `ReloadPrompt` registra el service worker (PWA) y usa ese mismo
 * `Toast.Provider` para avisar de actualizaciones/modo offline — va acá
 * porque, igual que el toast, es transversal a toda la app.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Envuelve al router entero: un error de render en cualquier pantalla
          deja el mensaje a la vista en vez de una página en blanco. */}
      <ErrorBoundary>{children}</ErrorBoundary>
      <Toast.Provider placement="bottom end" />
      <ReloadPrompt />
    </QueryClientProvider>
  );
}
