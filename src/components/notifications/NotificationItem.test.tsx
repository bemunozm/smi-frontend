import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }));
vi.mock('../../hooks/useNotificaciones', () => ({ useMarkRead: () => ({ mutate: vi.fn() }) }));

import { NotificationItem } from './NotificationItem';
import { rutaDeRegistroEditado } from './record-edited-route';
import type { Notificacion } from '../../types/notificacion';

afterEach(() => {
  cleanup();
  navigateMock.mockReset();
});

function editada(data: Notificacion['data']): Notificacion {
  return {
    id: 'n1',
    userId: 'u1',
    tipo: 'record.edited',
    titulo: 'Supervisor SMI modificó el hallazgo de EX-001',
    cuerpo: 'Prioridad: ALTA → CRITICA',
    data,
    leida: false,
    createdAt: '2026-10-05T10:00:00.000Z',
  };
}

describe('NotificationItem — registro corregido', () => {
  it('lleva etiqueta propia, no la genérica', () => {
    render(<NotificationItem notificacion={editada({ entity: 'hallazgo', entityId: 'h1' })} />);

    expect(screen.getByText('Registro corregido')).toBeTruthy();
    expect(screen.queryByText('Notificación')).toBeNull();
  });

  it.each([
    ['shift_card', '/terreno/registro'],
    ['hallazgo', '/terreno/hallazgos'],
    ['trabajo_extra', '/terreno/trabajos-extra'],
  ])('al tocarla, %s lleva a %s', (entity, ruta) => {
    render(<NotificationItem notificacion={editada({ entity, entityId: 'x1' })} />);

    fireEvent.click(screen.getByRole('button'));

    expect(navigateMock).toHaveBeenCalledWith(ruta);
  });

  it('sin entidad conocida solo se marca como leída', () => {
    render(<NotificationItem notificacion={editada({ entity: 'otra', entityId: 'x1' })} />);

    fireEvent.click(screen.getByRole('button'));

    expect(navigateMock).not.toHaveBeenCalled();
  });
});

describe('rutaDeRegistroEditado', () => {
  it('null sin data', () => {
    expect(rutaDeRegistroEditado(null)).toBeNull();
  });
});
