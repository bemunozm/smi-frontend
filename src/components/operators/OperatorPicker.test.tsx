import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { OperatorPicker } from './OperatorPicker';
import type { Operator } from '../../types/operator';

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
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

let mockData: Operator[] | undefined = OPERATORS;
let mockIsPending = false;
const useOperatorsMock = vi.fn();

vi.mock('../../hooks/useOperators', () => ({
  useOperators: (...args: unknown[]) => useOperatorsMock(...args),
}));

afterEach(() => {
  cleanup();
  mockData = OPERATORS;
  mockIsPending = false;
});

useOperatorsMock.mockImplementation(() => ({ data: mockData, isPending: mockIsPending }));

describe('OperatorPicker', () => {
  it('solo pide operadores activos', () => {
    render(<OperatorPicker value={null} onChange={() => {}} />);
    expect(useOperatorsMock).toHaveBeenCalledWith({ isActive: true });
  });

  it('muestra el label y el placeholder por defecto', () => {
    render(<OperatorPicker value={null} onChange={() => {}} />);
    expect(screen.getByText('Operador')).toBeTruthy();
    expect(screen.getByPlaceholderText('Buscar operador…')).toBeTruthy();
  });

  it('acepta un label y placeholder propios', () => {
    render(<OperatorPicker label="Supervisor" placeholder="Elegir…" value={null} onChange={() => {}} />);
    expect(screen.getByText('Supervisor')).toBeTruthy();
    expect(screen.getByPlaceholderText('Elegir…')).toBeTruthy();
  });

  it('al abrir con el botón y elegir un operador de la lista, entrega el objeto completo', async () => {
    const onChange = vi.fn();
    // El nombre accesible del trigger termina resolviendo al `<label>` del
    // campo (`aria-labelledby` gana sobre `aria-label` en el cómputo de
    // nombre accesible) — se busca por clase en vez de por rol/nombre.
    const { container } = render(<OperatorPicker value={null} onChange={onChange} />);
    const trigger = container.querySelector('.combo-box__trigger') as HTMLButtonElement;

    fireEvent.click(trigger);

    const opcion = await waitFor(() => screen.getByRole('option', { name: /Juan Rojas/ }));
    fireEvent.click(opcion);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(OPERATORS[0]));
  });

  it('con `value` ya seleccionado, muestra el nombre del operador en el input', () => {
    render(<OperatorPicker value="op_2" onChange={() => {}} />);
    const input = screen.getByPlaceholderText('Buscar operador…') as HTMLInputElement;
    expect(input.value).toBe('María Pérez');
  });

  it('muestra el mensaje de error cuando se le pasa `errorMessage`', () => {
    render(<OperatorPicker errorMessage="Seleccioná un operador" isInvalid value={null} onChange={() => {}} />);
    expect(screen.getByText('Seleccioná un operador')).toBeTruthy();
  });

  it('se deshabilita mientras `useOperators` está pendiente', () => {
    mockIsPending = true;
    render(<OperatorPicker value={null} onChange={() => {}} />);
    const input = screen.getByPlaceholderText('Buscar operador…');
    expect(input.hasAttribute('disabled')).toBe(true);
  });
});
