import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { NotificacionesView } from './NotificacionesView';

// El fallo se simula en la capa de API — mismo patrón que
// `FichaEquipoView.error.test.tsx`/`EquiposViewError.test.tsx`. Va en un
// archivo aparte porque `vi.mock` es de archivo: mockear la API acá dejaría
// sin efecto los mocks de hooks de `NotificacionesView.test.tsx`.
vi.mock('../api/NotificacionAPI', () => ({
  NotificacionAPI: {
    list: vi.fn(() => Promise.reject(new Error('No se pudo obtener la lista de notificaciones.'))),
    unreadCount: vi.fn(() => Promise.resolve(0)),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

afterEach(cleanup);

describe('NotificacionesView (error)', () => {
  it('muestra el mensaje de error del dominio cuando la carga falla', async () => {
    const queryClient = new QueryClient({
      // Sin reintentos: en test el fallo debe llegar a la UI de inmediato.
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NotificacionesView />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toContain('No se pudo obtener la lista de notificaciones.');
  });
});
