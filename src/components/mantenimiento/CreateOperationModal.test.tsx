import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../hooks/useOrdenes', () => ({
  useOrdenes: () => ({ data: [], isPending: false, isError: false, error: null }),
  useLogOperation: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/useEquipment', () => ({
  useEquipment: () => ({
    data: [{ id: 'eq-1', internalCode: 'EX-014', brand: 'CAT', model: '320' }],
    isPending: false,
  }),
}));

import { CreateOperationModal } from './CreateOperationModal';

afterEach(cleanup);

function openModal() {
  render(<CreateOperationModal />);
  fireEvent.click(screen.getByRole('button', { name: 'Crear orden' }));
}

describe('CreateOperationModal (el sistema de creación de la ex-Bitácora)', () => {
  it('"Crear orden" abre el formulario con el historial del equipo al lado', () => {
    openModal();

    expect(screen.getByText('Nueva operación')).toBeTruthy();
    expect(screen.getByText('Tipo de operación')).toBeTruthy();
    expect(screen.getByText('Operaciones de este equipo')).toBeTruthy();
    // Sin equipo elegido, el historial lo pide — no finge estar vacío.
    expect(screen.getByText('Selecciona un equipo')).toBeTruthy();
  });

  it('el banner promete el descuento de stock al finalizar — y ES verdad en este backend', () => {
    openModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toMatch(/se descuenta el stock/i);
    expect(dialog.textContent).toMatch(/finalizar la tarea/i);
  });
});
