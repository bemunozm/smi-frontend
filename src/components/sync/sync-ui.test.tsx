import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { HttpWriteOp, OutboxOp } from '../../offline/db';
import type { SyncState } from '../../offline/replay';

let mockOps: OutboxOp[] = [];
vi.mock('../../offline/useOutboxOps', () => ({ useOutboxOps: () => mockOps }));
vi.mock('../../hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: 'u1' } }) }));

const { retryOpMock, discardOpMock, overwriteOpMock } = vi.hoisted(() => ({
  retryOpMock: vi.fn(),
  discardOpMock: vi.fn(),
  overwriteOpMock: vi.fn(),
}));
vi.mock('../../offline/outbox', () => ({ retryOp: retryOpMock, discardOp: discardOpMock, overwriteOp: overwriteOpMock }));

import { usePendingWrites } from '../../hooks/usePendingWrites';
import { MarcaPendiente } from './MarcaPendiente';
import { PendientesStrip } from './PendientesStrip';
import { SyncBadge } from './SyncBadge';
import { SyncOpsList } from './SyncOpsList';
import { SyncSheet } from './SyncSheet';

let seq = 0;

function write(overrides: Partial<HttpWriteOp> = {}): HttpWriteOp {
  seq += 1;
  return {
    id: `w-${seq}`,
    type: 'httpWrite',
    v: 1,
    userId: 'u1',
    endpoint: 'equipment.update',
    params: { id: 'eq_1' },
    body: { type: 'Retro' },
    label: 'Edición de equipo · EX-001',
    status: 'pending',
    attempts: 0,
    seq,
    entityKey: 'equipment:eq_1',
    createdAt: seq,
    updatedAt: seq,
    ...overrides,
  };
}

function sync(overrides: Partial<SyncState> = {}): SyncState {
  return {
    pendingCount: 0,
    attentionCount: 0,
    syncing: false,
    authRequired: false,
    lastSyncAt: null,
    lastError: null,
    notice: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockOps = [];
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('usePendingWrites', () => {
  it('filtra por recurso (la parte de la clave antes del punto) y deja fuera lo que no es una escritura de oficina', () => {
    mockOps = [
      write({ id: 'a' }),
      write({ id: 'b', endpoint: 'item.update', entityKey: 'item:it_1' }),
      { id: 'c', type: 'openCard', v: 1, userId: 'u1', status: 'pending', attempts: 0, seq: 99, createdAt: 1, updatedAt: 1, payload: {} } as unknown as OutboxOp,
    ];

    const { result } = renderHook(() => usePendingWrites(['equipment']));

    expect(result.current.ops.map((op) => op.id)).toEqual(['a']);
    expect(result.current.pendientes).toBe(1);
    expect(result.current.atencion).toBe(0);
  });

  it('sin filtro, todas las escrituras', () => {
    mockOps = [write({ id: 'a' }), write({ id: 'b', endpoint: 'item.update', entityKey: 'item:it_1' })];

    expect(renderHook(() => usePendingWrites()).result.current.ops).toHaveLength(2);
  });

  it('marcaDe: pendiente, atención (gana la atención) o nada', () => {
    mockOps = [
      write({ id: 'a', entityKey: 'equipment:eq_1' }),
      write({ id: 'b', entityKey: 'equipment:eq_2', status: 'needs_attention' }),
      write({ id: 'c', entityKey: 'equipment:eq_2' }),
    ];

    const { marcaDe, atencion, pendientes } = renderHook(() => usePendingWrites(['equipment'])).result.current;

    expect(marcaDe('equipment:eq_1')).toBe('pendiente');
    expect(marcaDe('equipment:eq_2')).toBe('atencion');
    expect(marcaDe('equipment:eq_3')).toBeNull();
    expect(atencion).toBe(1);
    expect(pendientes).toBe(2);
  });
});

describe('PendientesStrip', () => {
  it('no dibuja nada cuando no hay nada esperando', () => {
    const { container } = render(<PendientesStrip recursos={['equipment']} />);

    expect(container.firstChild).toBeNull();
  });

  it('cuenta los cambios y los nombra con su etiqueta', () => {
    mockOps = [
      write({ label: 'Nuevo equipo · EX-009', creates: true }),
      write({ label: 'Cambio de estado · EX-001' }),
    ];

    render(<PendientesStrip recursos={['equipment']} />);

    expect(screen.getByText('2 cambios sin sincronizar')).toBeTruthy();
    expect(screen.getByText('Nuevo equipo · EX-009')).toBeTruthy();
    expect(screen.getByText('Cambio de estado · EX-001')).toBeTruthy();
    expect(screen.getByText('Se enviarán solos cuando haya señal.')).toBeTruthy();
  });

  it('un solo cambio, en singular', () => {
    mockOps = [write()];

    render(<PendientesStrip recursos={['equipment']} />);

    expect(screen.getByText('1 cambio sin sincronizar')).toBeTruthy();
  });

  it('lo que requiere atención lo dice y manda a Sincronización', () => {
    mockOps = [write({ status: 'needs_attention' }), write()];

    render(<PendientesStrip recursos={['equipment']} />);

    expect(screen.getByText(/1 cambio requiere atención · ver Sincronización \(1 esperando señal\)/)).toBeTruthy();
  });

  it('solo muestra lo de SU vista', () => {
    mockOps = [write({ endpoint: 'item.update', label: 'Edición de ítem' })];

    const { container } = render(<PendientesStrip recursos={['equipment']} />);

    expect(container.firstChild).toBeNull();
  });
});

describe('MarcaPendiente', () => {
  it('sin marca no dibuja nada', () => {
    const { container } = render(<MarcaPendiente marca={null} />);

    expect(container.firstChild).toBeNull();
  });

  it('pendiente: "Edición sin sincronizar"; atención: manda a Sincronización', () => {
    const { rerender } = render(<MarcaPendiente marca="pendiente" />);
    expect(screen.getByText('Edición sin sincronizar')).toBeTruthy();

    rerender(<MarcaPendiente marca="atencion" />);
    expect(screen.getByText('Requiere atención · ver Sincronización')).toBeTruthy();
  });
});

describe('SyncBadge', () => {
  it('se oculta cuando no hay nada pendiente ni nada que atender', () => {
    const { container } = render(<SyncBadge sync={sync()} onPress={vi.fn()} />);

    expect(container.firstChild).toBeNull();
  });

  it('muestra el total de lo que espera y abre la hoja al tocarlo', () => {
    const onPress = vi.fn();
    render(<SyncBadge sync={sync({ pendingCount: 3 })} onPress={onPress} />);

    const boton = screen.getByRole('button', { name: 'Sincronización: 3 cambios sin sincronizar' });
    expect(boton.textContent).toContain('3');
    fireEvent.click(boton);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('lo que requiere atención se cuenta aparte en el nombre accesible', () => {
    render(<SyncBadge sync={sync({ pendingCount: 2, attentionCount: 1 })} onPress={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Sincronización: 3 cambios sin sincronizar, 1 requieren atención' })).toBeTruthy();
  });

  it('una sesión vencida se ve aunque no haya nada pendiente', () => {
    render(<SyncBadge sync={sync({ authRequired: true })} onPress={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Sesión vencida: la sincronización está detenida' })).toBeTruthy();
  });
});

describe('SyncSheet + SyncOpsList (lo genérico, sin TerrenoLayout)', () => {
  function renderHoja(estado: SyncState, ops: OutboxOp[]) {
    mockOps = ops;
    return render(
      <MemoryRouter>
        <SyncSheet sync={estado} onClose={vi.fn()}>
          <SyncOpsList ops={ops} userId="u1" />
        </SyncSheet>
      </MemoryRouter>,
    );
  }

  it('muestra el contador de pendientes y que nada requiere atención', () => {
    renderHoja(sync({ pendingCount: 2 }), [write(), write()]);

    expect(screen.getByRole('dialog', { name: 'Sincronización' })).toBeTruthy();
    expect(screen.getByText('Pendientes por sincronizar')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Ningún registro requiere atención.')).toBeTruthy();
  });

  it('un rechazo de oficina muestra su etiqueta y el mensaje, con Reintentar y Descartar', () => {
    const op = write({
      id: 'w-x',
      status: 'needs_attention',
      label: 'Nuevo equipo · EX-009',
      lastError: { message: 'Ya existe un equipo con ese código', status: 409 },
    });
    renderHoja(sync({ attentionCount: 1 }), [op]);

    expect(screen.getByText('Nuevo equipo · EX-009')).toBeTruthy();
    expect(screen.getByText('Ya existe un equipo con ese código')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(retryOpMock).toHaveBeenCalledWith('w-x', 'u1');
  });

  it('un STALE_UPDATE ofrece Sobrescribir en vez de Reintentar', () => {
    const op = write({
      id: 'w-y',
      status: 'needs_attention',
      lastError: { message: 'Otra persona cambió estos datos', code: 'STALE_UPDATE', status: 409 },
    });
    renderHoja(sync({ attentionCount: 1 }), [op]);

    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sobrescribir' }));
    expect(overwriteOpMock).toHaveBeenCalledWith('w-y', 'u1');
  });

  it('avisa lo que depende de una creación rechazada y lo arrastra al descartar (con confirmación)', () => {
    const creacion = write({ id: 'crear', endpoint: 'equipment.create', creates: true, status: 'needs_attention', label: 'Nuevo equipo' });
    const asignar = write({ id: 'asignar', endpoint: 'equipment.assign', dependsOn: ['crear'], label: 'Asignación de equipo' });
    renderHoja(sync({ attentionCount: 1, pendingCount: 1 }), [creacion, asignar]);

    expect(screen.getByText(/1 cambio guardado que dependen de este/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(screen.getByText(/Se descarta este registro y los cambios guardados que dependen de él/)).toBeTruthy();
    expect(discardOpMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sí, descartar' }));
    expect(discardOpMock).toHaveBeenCalledWith('crear', 'u1');
  });

  it('una sesión vencida avisa con el enlace para volver a entrar', () => {
    renderHoja(sync({ authRequired: true }), []);

    expect(screen.getByText('Tu sesión expiró.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' }).getAttribute('href')).toBe('/login');
  });
});
