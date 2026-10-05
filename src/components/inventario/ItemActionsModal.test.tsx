import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ItemActionsModal } from './ItemActionsModal';
import type { Role } from '../../types/roles';
import type { InventoryItem } from '../../types/inventory';

let rolActual: Role = 'ADMIN';
vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', role: rolActual }, role: rolActual, isPending: false, isAuthenticated: true }),
}));

afterEach(cleanup);

const BRANCHES = [
  { id: 'b1', name: 'Casa Matriz', address: null, isActive: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'b2', name: 'Faena', address: null, isActive: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
];

const ITEM = {
  id: 'it_1',
  sku: 'FIL-001',
  name: 'Filtro de aceite',
  description: null,
  unit: 'UNIT',
  type: 'PART',
  categoryId: null,
  category: null,
  partNumber: null,
  defaultSupplier: null,
  isCritical: false,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  stocks: [{ branchId: 'b1', branchName: 'Casa Matriz', quantity: 10, minimumQuantity: 0 }],
} as unknown as InventoryItem;

function renderModal(rol: Role, initialView: 'actions' | 'movement' = 'movement') {
  rolActual = rol;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ItemActionsModal
          branchId="b1"
          branches={BRANCHES}
          initialView={initialView}
          isOpen
          item={ITEM}
          onEdit={vi.fn()}
          onOpenChange={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const modos = () => screen.getAllByRole('tab').map((tab) => tab.textContent);

describe('ItemActionsModal — qué ofrece cada rol', () => {
  it('el administrador tiene los cuatro modos', () => {
    renderModal('ADMIN');

    expect(modos()).toEqual(['Entrada', 'Salida', 'Traspaso', 'Conteo']);
  });

  it('el mantenedor registra entradas y salidas, pero no traspasa ni cuenta (el backend le respondería 403)', () => {
    renderModal('MANTENEDOR');

    expect(modos()).toEqual(['Entrada', 'Salida']);
  });

  it('el supervisor solo traspasa, y el formulario parte en ese modo', () => {
    renderModal('SUPERVISOR');

    expect(modos()).toEqual(['Traspaso']);
    expect(screen.getByRole('tab', { name: 'Traspaso' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Sucursal de origen')).toBeTruthy();
  });

  it('la hoja de acciones solo ofrece lo que el rol puede hacer', () => {
    renderModal('MANTENEDOR', 'actions');

    expect(screen.getByText('Registrar movimiento')).toBeTruthy();
    expect(screen.getByText('Ver ficha')).toBeTruthy();
    expect(screen.queryByText('Editar ítem')).toBeNull();
    expect(screen.queryByText('Eliminar')).toBeNull();
  });
});

describe('ItemActionsModal — cantidades con decimales', () => {
  it.each(['2.5', '2,5'])('una entrada de %s suma dos y medio: el punto no es separador de miles', (texto) => {
    renderModal('ADMIN');

    fireEvent.change(screen.getByLabelText(/^Cantidad/), { target: { value: texto } });

    expect(screen.getByText('12,5 u')).toBeTruthy();
  });

  it('un texto que no es un número no calcula saldo', () => {
    renderModal('ADMIN');

    fireEvent.change(screen.getByLabelText(/^Cantidad/), { target: { value: 'abc' } });

    expect(screen.getByText('— u')).toBeTruthy();
  });
});
