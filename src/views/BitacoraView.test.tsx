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
  it('el banner NO promete un descuento de stock que el backend no hace', () => {
    // Constraint de honestidad del plan: el backend no descuenta stock al
    // registrar la intervención; prometerlo desvía el inventario real.
    const { container } = renderView();
    expect(container.textContent).not.toMatch(/se descuenta el stock/i);
    expect(container.textContent).toMatch(/finalizar la tarea/i);
  });

  it('como MANTENEDOR el formulario queda deshabilitado con aviso (espejo del backend)', () => {
    canCreateOrden = false;
    renderView();
    expect(screen.getByText(/las órdenes las crea un Administrador o Supervisor/)).toBeTruthy();
    const submit = screen.getByRole('button', { name: /Iniciar operación/ });
    expect(submit.hasAttribute('disabled')).toBe(true);
  });
});
