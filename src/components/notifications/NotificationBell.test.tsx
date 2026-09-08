import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { NotificationBell } from './NotificationBell';
import type { Notificacion } from '../../types/notificacion';

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
    tipo: 'orden.completed',
    titulo: 'Orden de trabajo #45 cerrada',
    cuerpo: 'La orden de trabajo #45 fue cerrada',
    data: null,
    leida: true,
    createdAt: '2026-08-01T10:00:00.000Z',
  },
];

const markReadMock = vi.fn();
const markAllReadMock = vi.fn();

// `let` (no `const`) a propósito: cada test reasigna estos objetos para
// simular otro estado del servidor. El componente vuelve a renderizar más de
// una vez por test (p. ej. al abrir el dropdown cambia `isOpen`), así que un
// `mockReturnValueOnce` se agotaría en el primer render y el resto vería el
// valor por defecto — por eso el mock lee siempre la variable actual.
let notificacionesResult: { data: Notificacion[]; isPending: boolean; isError: boolean } = {
  data: NOTIFICACIONES,
  isPending: false,
  isError: false,
};
let unreadCountResult: { data: number } = { data: 1 };

vi.mock('../../hooks/useNotificaciones', () => ({
  useNotificaciones: () => notificacionesResult,
  useUnreadCount: () => unreadCountResult,
  useMarkRead: () => ({ mutate: markReadMock, isPending: false }),
  useMarkAllRead: () => ({ mutate: markAllReadMock, isPending: false }),
}));

afterEach(() => {
  cleanup();
  notificacionesResult = { data: NOTIFICACIONES, isPending: false, isError: false };
  unreadCountResult = { data: 1 };
  markReadMock.mockClear();
  markAllReadMock.mockClear();
});

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>,
  );
}

describe('NotificationBell', () => {
  it('muestra el badge con el conteo de no leídas', () => {
    renderBell();

    expect(screen.getByText('1')).toBeTruthy();
  });

  it('no muestra badge cuando el conteo de no leídas es 0', () => {
    unreadCountResult = { data: 0 };

    renderBell();

    expect(screen.queryByText('0')).toBeNull();
  });

  it('al abrir, lista las notificaciones', () => {
    renderBell();

    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));

    expect(screen.getByText('Nuevo hallazgo')).toBeTruthy();
    expect(screen.getByText('Orden de trabajo #45 cerrada')).toBeTruthy();
  });

  it('el empty state se muestra cuando no hay notificaciones', () => {
    notificacionesResult = { data: [], isPending: false, isError: false };

    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));

    expect(screen.getByText('No tienes notificaciones todavía.')).toBeTruthy();
  });

  it('"marcar todas como leídas" dispara la mutación', () => {
    renderBell();

    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }));

    expect(markAllReadMock).toHaveBeenCalledTimes(1);
  });

  it('al hacer click en un item, marca la notificación como leída', () => {
    renderBell();

    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));
    fireEvent.click(screen.getByText('Nuevo hallazgo'));

    expect(markReadMock).toHaveBeenCalledWith('n1');
  });
});
