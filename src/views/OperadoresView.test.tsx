import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
const updateMock = vi.fn();
const deleteMock = vi.fn();
const toggleMock = vi.fn();

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ role: mockRole }),
}));

vi.mock('../hooks/useOperators', () => ({
  useOperators: () => ({ data: mockOperators, isPending: false, isError: false, error: null }),
  useCreateOperator: () => ({ mutate: createMock, isPending: false }),
  useUpdateOperator: () => ({ mutate: updateMock, isPending: false }),
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

  // En jsdom no se aplican las clases `hidden xl:block` / `xl:hidden`, así que
  // la tabla (kebab "Acciones para …") y las tarjetas (botón "Acciones de …")
  // están montadas a la vez; cada pieza se ubica por su propio nombre.
  describe('tarjeta (tablet/celular)', () => {
    function openSheet(name: string) {
      fireEvent.click(screen.getByRole('button', { name: `Acciones de ${name}` }));
      return screen.findByRole('dialog');
    }

    it('toda la tarjeta es un botón que abre la hoja de acciones del operador', async () => {
      renderView();

      const dialog = await openSheet('Juan Rojas');

      expect(within(dialog).getByText('Juan Rojas')).toBeTruthy();
      expect(within(dialog).getByRole('button', { name: 'Editar' })).toBeTruthy();
      expect(within(dialog).getByRole('button', { name: 'Desactivar' })).toBeTruthy();
    });

    it('ADMIN ve "Eliminar" en la hoja', async () => {
      mockRole = ROLES.ADMIN;
      renderView();

      const dialog = await openSheet('Juan Rojas');

      expect(within(dialog).getByRole('button', { name: 'Eliminar' })).toBeTruthy();
    });

    it('SUPERVISOR no ve "Eliminar" en la hoja (el backend lo restringe a ADMIN)', async () => {
      mockRole = ROLES.SUPERVISOR;
      renderView();

      const dialog = await openSheet('Juan Rojas');

      expect(within(dialog).getByRole('button', { name: 'Editar' })).toBeTruthy();
      expect(within(dialog).queryByRole('button', { name: 'Eliminar' })).toBeNull();
    });

    it('un operador inactivo ofrece "Activar" y la mutación lo reactiva', async () => {
      renderView();

      const dialog = await openSheet('María Pérez');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Activar' }));

      expect(toggleMock).toHaveBeenCalledWith({ operator: OPERATORS[1], isActive: true });
    });

    it('"Desactivar" llama a la mutación directo, sin abrir un modal', async () => {
      renderView();

      const dialog = await openSheet('Juan Rojas');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }));

      expect(toggleMock).toHaveBeenCalledWith({ operator: OPERATORS[0], isActive: false });
      expect(screen.queryByText('Guardar cambios')).toBeNull();
    });

    it('"Editar" abre el modal de edición y guarda con la mutación de update', async () => {
      renderView();

      const dialog = await openSheet('Juan Rojas');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Editar' }));

      const name = await screen.findByDisplayValue('Juan Rojas');
      fireEvent.change(name, { target: { value: 'Juan Rojas Soto' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      await waitFor(() =>
        expect(updateMock).toHaveBeenCalledWith(
          { operator: OPERATORS[0], input: expect.objectContaining({ name: 'Juan Rojas Soto' }) },
          expect.anything(),
        ),
      );
    });

    it('"Eliminar" pide confirmación antes de llamar a la mutación', async () => {
      renderView();

      const dialog = await openSheet('Juan Rojas');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

      expect(await screen.findByText('¿Eliminar a Juan Rojas?')).toBeTruthy();
      expect(deleteMock).not.toHaveBeenCalled();

      fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));

      expect(deleteMock).toHaveBeenCalledWith('op_1', expect.anything());
    });
  });

  describe('fila de tabla (PC)', () => {
    it('ADMIN ve la acción "Eliminar" en el menú; SUPERVISOR no', () => {
      mockRole = ROLES.ADMIN;
      const { unmount } = renderView();
      fireEvent.click(screen.getByRole('button', { name: 'Acciones para Juan Rojas' }));
      expect(screen.getByRole('menuitem', { name: 'Eliminar' })).toBeTruthy();
      unmount();
      cleanup();

      mockRole = ROLES.SUPERVISOR;
      renderView();
      fireEvent.click(screen.getByRole('button', { name: 'Acciones para Juan Rojas' }));
      expect(screen.queryByRole('menuitem', { name: 'Eliminar' })).toBeNull();
    });

    it('el toggle activar/desactivar llama a la mutación sin abrir un modal', () => {
      renderView();

      fireEvent.click(screen.getByRole('button', { name: 'Acciones para Juan Rojas' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Desactivar' }));

      expect(toggleMock).toHaveBeenCalledWith({ operator: OPERATORS[0], isActive: false });
    });
  });
});
