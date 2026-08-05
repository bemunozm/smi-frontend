import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toast } from '@heroui/react';

import { queryClient } from '../lib/query-client';

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
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toast.Provider placement="bottom end" />
    </QueryClientProvider>
  );
}
