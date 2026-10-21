import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }));
vi.mock('../../hooks/useNotificaciones', () => ({ useMarkRead: () => ({ mutate: vi.fn() }) }));

// El destino de varios avisos depende del rol (el admin va a SUS vistas de
// gestión; terreno/taller a la ficha del equipo) — se controla desde acá.
const { roleRef } = vi.hoisted(() => ({ roleRef: { value: null as string | null } }));
vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', name: 'Admin SMI' }, role: roleRef.value }),
}));

import { NotificationItem } from './NotificationItem';
import { rutaDeRegistroEditado } from './record-edited-route';
import type { Notificacion } from '../../types/notificacion';

afterEach(() => {
  cleanup();
  navigateMock.mockReset();
  roleRef.value = null;
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
    ['reporte_diario', '/reportes-diarios'],
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

describe('NotificationItem — destinos de gestión por rol', () => {
  const notificacion = (tipo: string, data: Notificacion['data']): Notificacion => ({
    id: 'n1',
    userId: 'u1',
    tipo,
    titulo: 'Aviso',
    cuerpo: 'Detalle del aviso',
    data,
    leida: false,
    createdAt: '2026-10-21T10:00:00.000Z',
  });

  it('ADMIN + hallazgo creado → su vista de gestión /hallazgos, no la ficha del equipo', () => {
    roleRef.value = 'ADMIN';
    render(<NotificationItem notificacion={notificacion('hallazgo.created', { hallazgoId: 'h1', equipoId: 'eq_1' })} />);

    fireEvent.click(screen.getByRole('button'));

    expect(navigateMock).toHaveBeenCalledWith('/hallazgos');
  });

  it('MANTENEDOR + hallazgo creado conserva el destino actual: la ficha del equipo', () => {
    roleRef.value = 'MANTENEDOR';
    render(<NotificationItem notificacion={notificacion('hallazgo.created', { hallazgoId: 'h1', equipoId: 'eq_1' })} />);

    fireEvent.click(screen.getByRole('button'));

    expect(navigateMock).toHaveBeenCalledWith('/equipos/eq_1/ficha');
  });

  it('ADMIN + orden completada → el detalle en /mantenciones', () => {
    roleRef.value = 'ADMIN';
    render(<NotificationItem notificacion={notificacion('orden.completed', { ordenId: 'ot1', equipoId: 'eq_1' })} />);

    fireEvent.click(screen.getByRole('button'));

    expect(navigateMock).toHaveBeenCalledWith('/mantenciones?id=ot1');
  });

  it('ADMIN + stock bajo → /inventario', () => {
    roleRef.value = 'ADMIN';
    render(
      <NotificationItem notificacion={notificacion('item.low-stock', { itemId: 'i1', branchId: 'b1' })} />,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(navigateMock).toHaveBeenCalledWith('/inventario');
  });
});
