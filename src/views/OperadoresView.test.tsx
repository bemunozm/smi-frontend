import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { OperadoresView } from './OperadoresView';
import { ROLES, type Role } from '../types/roles';
import type { Operator } from '../types/operator';

const OPERATORS: Operator[] = [
  {
    id: 'op_1',
    name: 'Juan Rojas',
    rut: '12345678-5',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'op_2',
    name: 'María Pérez',
    rut: null,
    isActive: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

let mockOperators: Operator[] = OPERATORS;
let mockRole: Role | null = ROLES.ADMIN;
const createMock = vi.fn();
const deleteMock = vi.fn();
const toggleMock = vi.fn();

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ role: mockRole }),
}));

vi.mock('../hooks/useOperators', () => ({
  useOperators: () => ({ data: mockOperators, isPending: false, isError: false, error: null }),
  useCreateOperator: () => ({ mutate: createMock, isPending: false }),
  useUpdateOperator: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteOperator: () => ({ mutate: deleteMock, isPending: false }),
  useToggleOperatorActive: () => ({ mutate: toggleMock, isPending: false }),
}));

function renderView() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <OperadoresView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockOperators = OPERATORS;
  mockRole = ROLES.ADMIN;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('OperadoresView', () => {
  it('renderiza la lista de operadores sin lanzar', () => {
    renderView();

    expect(screen.getByText('Operadores')).toBeTruthy();
    expect(screen.getAllByText('Juan Rojas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('María Pérez').length).toBeGreaterThan(0);
  });

  it('muestra el estado activo/inactivo de cada operador', () => {
    renderView();

    expect(screen.getAllByText('Activo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inactivo').length).toBeGreaterThan(0);
  });

  it('muestra el estado vacío cuando no hay operadores', () => {
    mockOperators = [];
    renderView();

    expect(screen.getByText('Todavía no hay operadores')).toBeTruthy();
  });

  it('el botón "Nuevo operador" abre el modal de creación', () => {
    renderView();

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo operador' }));

    expect(screen.getByText('Crear operador')).toBeTruthy();
  });

  it('crear un operador llama a la mutación con el payload normalizado', async () => {
    renderView();

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo operador' }));
    fireEvent.change(screen.getByPlaceholderText('Nombre y apellido'), {
      target: { value: 'Pedro Soto' },
    });
    fireEvent.change(screen.getByPlaceholderText('12.345.678-9'), {
      target: { value: '12.345.678-5' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Crear operador' }));

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith(
        { name: 'Pedro Soto', rut: '12345678-5' },
        expect.anything(),
      ),
    );
  });

  it('ADMIN ve la acción "Eliminar"; SUPERVISOR no (el backend la restringe a ADMIN)', () => {
    mockRole = ROLES.ADMIN;
    const { unmount } = renderView();
    fireEvent.click(screen.getAllByRole('button', { name: 'Acciones para Juan Rojas' })[0]);
    expect(screen.getAllByText('Eliminar').length).toBeGreaterThan(0);
    unmount();
    cleanup();

    mockRole = ROLES.SUPERVISOR;
    renderView();
    fireEvent.click(screen.getAllByRole('button', { name: 'Acciones para Juan Rojas' })[0]);
    expect(screen.queryByText('Eliminar')).toBeNull();
  });

  it('el toggle activar/desactivar llama a la mutación sin abrir un modal', () => {
    renderView();

    fireEvent.click(screen.getAllByRole('button', { name: 'Acciones para Juan Rojas' })[0]);
    fireEvent.click(screen.getAllByText('Desactivar')[0]);

    expect(toggleMock).toHaveBeenCalledWith({ id: 'op_1', isActive: false });
  });
});
