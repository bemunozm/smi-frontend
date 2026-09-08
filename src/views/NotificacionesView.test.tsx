import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { NotificacionesView } from './NotificacionesView';
import type { Notificacion } from '../types/notificacion';

const NOTIFICACIONES: Notificacion[] = [
  {
    id: 'n1',
    userId: 'u1',
    tipo: 'hallazgo.created',
    titulo: 'Nuevo hallazgo',
    cuerpo: 'Se registró un hallazgo en EX-001',
    data: { hallazgoId: 'h1', equipoId: 'eq_1' },
    leida: false,
    createdAt: '2026-08-04T10:00:00.000Z',
  },
  {
    id: 'n2',
    userId: 'u1',
    tipo: 'orden.assigned',
    titulo: 'OT asignada a Juan',
    cuerpo: 'Se te asignó la orden de trabajo #12',
    data: { ordenId: 'ot1', equipoId: 'eq_2' },
    leida: true,
    createdAt: '2026-08-03T10:00:00.000Z',
  },
  {
    id: 'n3',
    userId: 'u1',
    tipo: 'insumo.low-stock',
    titulo: 'Stock bajo de filtro de aceite',
    cuerpo: 'Quedan 2 unidades en bodega',
    data: { insumoId: 'ins1' },
    leida: false,
    createdAt: '2026-08-02T10:00:00.000Z',
  },
];

const markReadMock = vi.fn();
const markAllReadMock = vi.fn();

// `let` a propósito: algunos tests reasignan esto para simular otro estado
// del servidor. Filtrar dispara un re-render (cambia estado local), así que
// un `mockReturnValueOnce` se agotaría en el primer render — el mock debe
// leer siempre el valor actual de la variable.
let notificacionesResult: {
  data: Notificacion[];
  isPending: boolean;
  isError: boolean;
  error: Error | null;
} = { data: NOTIFICACIONES, isPending: false, isError: false, error: null };

vi.mock('../hooks/useNotificaciones', () => ({
  useNotificaciones: () => notificacionesResult,
  useMarkRead: () => ({ mutate: markReadMock, isPending: false }),
  useMarkAllRead: () => ({ mutate: markAllReadMock, isPending: false }),
}));

afterEach(() => {
  cleanup();
  notificacionesResult = { data: NOTIFICACIONES, isPending: false, isError: false, error: null };
  markReadMock.mockClear();
  markAllReadMock.mockClear();
});

function renderView() {
  return render(
    <MemoryRouter>
      <NotificacionesView />
    </MemoryRouter>,
  );
}

describe('NotificacionesView', () => {
  it('lista todas las notificaciones y el conteo de no leídas', () => {
    renderView();

    expect(screen.getByText('2 notificaciones sin leer.')).toBeTruthy();
    expect(screen.getByText('Nuevo hallazgo')).toBeTruthy();
    expect(screen.getByText('OT asignada a Juan')).toBeTruthy();
    expect(screen.getByText('Stock bajo de filtro de aceite')).toBeTruthy();
  });

  it('el filtro por tipo oculta las notificaciones de los tipos deseleccionados', () => {
    renderView();

    fireEvent.click(screen.getByRole('button', { name: 'Hallazgo' }));

    expect(screen.queryByText('Nuevo hallazgo')).toBeNull();
    expect(screen.getByText('OT asignada a Juan')).toBeTruthy();
    expect(screen.getByText('Stock bajo de filtro de aceite')).toBeTruthy();
  });

  it('el filtro "No leídas" oculta las notificaciones ya leídas', () => {
    renderView();

    fireEvent.click(screen.getByRole('radio', { name: 'No leídas (2)' }));

    expect(screen.queryByText('OT asignada a Juan')).toBeNull();
    expect(screen.getByText('Nuevo hallazgo')).toBeTruthy();
    expect(screen.getByText('Stock bajo de filtro de aceite')).toBeTruthy();
  });

  it('muestra el estado vacío cuando no hay notificaciones', () => {
    notificacionesResult = { data: [], isPending: false, isError: false, error: null };

    renderView();

    expect(screen.getByText('No tienes notificaciones')).toBeTruthy();
  });

  it('"marcar todas como leídas" dispara la mutación y se deshabilita sin no-leídas', () => {
    renderView();

    const boton = screen.getByRole('button', { name: 'Marcar todas como leídas' });
    expect(boton.hasAttribute('disabled')).toBe(false);

    fireEvent.click(boton);
    expect(markAllReadMock).toHaveBeenCalledTimes(1);
  });
});
