import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { EquiposView } from './EquiposView';

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
    role: 'ADMIN',
    isPending: false,
    isAuthenticated: true,
  }),
}));

// El fallo se simula en la capa de API — el mismo lugar donde `toDomainError`
// convierte el error de axios en el `Error` que la vista termina mostrando.
// Va en un archivo aparte porque `vi.mock` es de archivo: mockear la API acá
// dejaría sin efecto el `setQueryData` de los tests del camino feliz.
vi.mock('../api/EquipmentAPI', () => ({
  EquipmentAPI: {
    list: vi.fn(() => Promise.reject(new Error('No se pudo obtener la lista de equipos.'))),
    resumen: vi.fn(() => Promise.reject(new Error('No se pudo obtener el resumen de la flota.'))),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    remove: vi.fn(),
  },
}));

// `EquiposView` también resuelve el nombre de sucursal para la tarjeta mobile
// vía `useBranches()` sin filtro — se mockea para que el test siga sin tocar
// la red aunque la carga de equipos falle (esta query es independiente).
vi.mock('../api/BranchAPI', () => ({
  BranchAPI: {
    list: vi.fn(() => Promise.resolve([])),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

afterEach(cleanup);

describe('EquiposView (error)', () => {
  it('muestra el mensaje de error del dominio cuando la carga falla', async () => {
    const queryClient = new QueryClient({
      // Sin reintentos: en test el fallo debe llegar a la UI de inmediato.
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EquiposView />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toContain('No se pudo obtener la lista de equipos.');
  });
});
