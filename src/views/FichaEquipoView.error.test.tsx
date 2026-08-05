import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { FichaEquipoView } from './FichaEquipoView';

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
    role: 'ADMIN',
    isPending: false,
    isAuthenticated: true,
  }),
}));

// El fallo se simula en la capa de API — mismo patrón que `EquiposViewError.test.tsx`.
// Va en un archivo aparte porque `vi.mock` es de archivo: mockear la API acá
// dejaría sin efecto el `setQueryData` de los tests del camino feliz en
// `FichaEquipoView.test.tsx`.
vi.mock('../api/FichaAPI', () => ({
  FichaAPI: {
    getFicha: vi.fn(() => Promise.reject(new Error('No se pudo obtener la ficha consolidada del equipo.'))),
  },
}));

afterEach(cleanup);

describe('FichaEquipoView (error)', () => {
  it('muestra el mensaje de error del dominio y el link para volver a equipos', async () => {
    const queryClient = new QueryClient({
      // Sin reintentos: en test el fallo debe llegar a la UI de inmediato.
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/equipos/eq_1/ficha']}>
          <Routes>
            <Route element={<FichaEquipoView />} path="/equipos/:id/ficha" />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toContain('No se pudo obtener la ficha consolidada del equipo.');
    expect(screen.getByRole('link', { name: '← Volver a equipos' })).toBeTruthy();
  });
});
