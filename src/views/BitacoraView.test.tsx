import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// `can('orden.create')` según el rol: ADMIN sí, MANTENEDOR no (espejo del
// backend vía `lib/permissions`).
let canCreateOrden = true;

vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({
    role: null,
    can: (action: string) => action === 'orden.create' && canCreateOrden,
    canAny: () => canCreateOrden,
    canCloseShiftCardFromFleet: false,
  }),
}));

vi.mock('../components/sync/PendientesStrip', () => ({
  PendientesStrip: () => null,
}));

vi.mock('../hooks/useOrdenes', () => ({
  useOrdenes: () => ({ data: [], isPending: false, isError: false, error: null }),
  useLogOperation: () => ({ mutate: vi.fn(), isPending: false }),
  useCrearOrden: () => ({ mutate: vi.fn(), isPending: false }),
  useActualizarOrden: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../hooks/useEquipment', () => ({
  useEquipment: () => ({
    data: [{ id: 'eq-1', internalCode: 'EX-014', brand: 'CAT', model: '320' }],
    isPending: false,
  }),
}));

import { BitacoraView } from './BitacoraView';

afterEach(() => {
  cleanup();
  canCreateOrden = true;
});

function renderView() {
  return render(
    <MemoryRouter>
      <BitacoraView />
    </MemoryRouter>,
  );
}

describe('BitacoraView', () => {
  it('el banner promete el descuento de stock — y desde este backend ES verdad', () => {
    // La constraint de honestidad se mantiene, pero invertida: ahora el
    // backend SÍ descuenta stock al registrar la intervención de cierre
    // (StockService.issue en la misma transacción), así que el banner lo dice.
    const { container } = renderView();
    expect(container.textContent).toMatch(/se descuenta el stock/i);
    expect(container.textContent).toMatch(/finalizar la tarea/i);
  });

  it('un rol sin orden.create ve el formulario deshabilitado con aviso (espejo del backend)', () => {
    canCreateOrden = false;
    renderView();
    expect(screen.getByText(/Tu rol no puede registrar operaciones/)).toBeTruthy();
    const submit = screen.getByRole('button', { name: /Iniciar operación/ });
    expect(submit.hasAttribute('disabled')).toBe(true);
  });
});
