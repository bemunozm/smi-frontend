import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { NewItemModal } from './ItemFormModal';

vi.mock('../../api/CategoryAPI', () => ({ CategoryAPI: { list: vi.fn().mockResolvedValue([]) } }));

afterEach(cleanup);

function renderModal(branchId: string, branchName: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NewItemModal
        branchId={branchId}
        branchName={branchName}
        defaultType="SUPPLY"
        isOpen
        onOpenChange={() => {}}
      />
    </QueryClientProvider>,
  );
}

function escribirExistencia(valor: string) {
  fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: valor } });
}

describe('NewItemModal sin bodega activa', () => {
  it('con existencia > 0 avisa y no deja crear (antes el servidor respondía «branchId must be…»)', () => {
    renderModal('', '');
    escribirExistencia('20');

    expect(screen.getByText(/No hay ninguna bodega activa/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Crear' }).hasAttribute('disabled') ||
      screen.getByRole('button', { name: 'Crear' }).getAttribute('aria-disabled') === 'true').toBe(true);
    // El rótulo no queda con un «en » colgando.
    expect(screen.getByText(/^Existencia inicial \(/)).toBeTruthy();
  });

  it('con existencia 0 se puede crear igual', () => {
    renderModal('', '');
    escribirExistencia('0');

    expect(screen.queryByText(/No hay ninguna bodega activa/)).toBeNull();
  });

  it('con bodega no avisa y nombra la bodega', () => {
    renderModal('b1', 'Casa Matriz');
    escribirExistencia('20');

    expect(screen.queryByText(/No hay ninguna bodega activa/)).toBeNull();
    expect(screen.getByText(/Existencia inicial en Casa Matriz/)).toBeTruthy();
  });
});
