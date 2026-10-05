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

const { usePrepareMock } = vi.hoisted(() => ({ usePrepareMock: vi.fn() }));
vi.mock('../../hooks/usePrepareOffline', () => ({ usePrepareOffline: usePrepareMock }));

import { usePendingWrites } from '../../hooks/usePendingWrites';
import { queryClient } from '../../lib/query-client';
import { EQUIPMENT_KEY } from '../../lib/query-keys';
import { MarcaPendiente } from './MarcaPendiente';
import { PendientesStrip } from './PendientesStrip';
import { PREP_DETAIL_LIMITATION, PrepChecklist } from './PrepChecklist';
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
    otherAccountCount: 0,
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

    expect(marcaDe('equipment', 'eq_1')).toBe('pendiente');
    expect(marcaDe('equipment', 'eq_2')).toBe('atencion');
    expect(marcaDe('equipment', 'eq_3')).toBeNull();
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

    expect(screen.getByRole('button', { name: 'Sincronización: 3 cambios sin sincronizar, 1 requiere atención' })).toBeTruthy();
  });

  it('en singular: "1 cambio sin sincronizar"', () => {
    render(<SyncBadge sync={sync({ pendingCount: 1 })} onPress={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Sincronización: 1 cambio sin sincronizar' })).toBeTruthy();
  });

  it('una sesión vencida se ve aunque no haya nada pendiente', () => {
    render(<SyncBadge sync={sync({ authRequired: true })} onPress={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Sesión vencida: la sincronización está detenida' })).toBeTruthy();
  });
});

describe('PrepChecklist', () => {
  const preparar = vi.fn();

  function conResultado(resultadoPrep: Record<string, unknown> | null) {
    usePrepareMock.mockReturnValue({ preparando: false, resultadoPrep, handlePreparar: preparar });
    return render(<PrepChecklist role="ADMIN" titulo="Antes de trabajar sin señal" descripcion={PREP_DETAIL_LIMITATION} />);
  }

  it('dice en la descripción lo que NO se precarga (la ficha y el detalle de cada equipo, el kardex)', () => {
    conResultado(null);

    expect(screen.getByText(/ficha y el detalle de cada equipo, y el kardex de cada ítem, no se precargan/)).toBeTruthy();
  });

  it('muestra las pantallas nuevas y el modo sin señal', () => {
    conResultado({
      persist: 'ok',
      serviceWorker: 'ok',
      installed: true,
      dashboard: 'ok',
      notificaciones: 'ok',
      movimientos: 'error',
      bitacora: 'ok',
    });

    expect(screen.getByText('Modo sin señal activo en esta pantalla')).toBeTruthy();
    expect(screen.getByText('Panel (resumen de flota) precargado')).toBeTruthy();
    expect(screen.getByText('Notificaciones precargadas')).toBeTruthy();
    expect(screen.getByText('Movimientos de inventario precargados')).toBeTruthy();
    expect(screen.getByText('Bitácora de las órdenes recientes precargada')).toBeTruthy();
    expect(screen.queryByText(/recargá la app una vez/)).toBeNull();
  });

  it('si el service worker no controla la página, el resultado lo dice y qué hacer', () => {
    conResultado({ persist: 'ok', serviceWorker: 'error', installed: true, equipment: 'ok' });

    expect(screen.getByText(/Todavía no se guardó nada para usar sin señal: recargá la app una vez/)).toBeTruthy();
  });

  it('el almacenamiento no reservado es un aviso (instalá la app), no un error', () => {
    const { container } = conResultado({ persist: 'error', serviceWorker: 'ok', installed: false });

    expect(screen.getByText('Almacenamiento reservado')).toBeTruthy();
    expect(screen.getByText(/Instalá la app en la pantalla de inicio/)).toBeTruthy();
    // Solo las filas en error llevan el ícono rojo; esta lleva el de aviso.
    expect(container.querySelector('.text-danger')).toBeNull();
    expect(container.querySelector('.text-warning')).toBeTruthy();
  });
});

describe('SyncSheet + SyncOpsList (lo genérico, sin TerrenoLayout)', () => {
  const onClose = vi.fn();

  function renderHoja(estado: SyncState, ops: OutboxOp[]) {
    mockOps = ops;
    return render(
      <MemoryRouter>
        <SyncSheet sync={estado} isOpen onClose={onClose}>
          <SyncOpsList ops={ops} userId="u1" />
        </SyncSheet>
      </MemoryRouter>,
    );
  }

  it('muestra el contador de pendientes y que nada requiere atención', () => {
    renderHoja(sync({ pendingCount: 2 }), [write(), write()]);

    expect(screen.getByRole('dialog', { name: 'Registros sin señal' })).toBeTruthy();
    expect(screen.getByText('Sin sincronizar')).toBeTruthy();
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getByText('2 esperando señal')).toBeTruthy();
    expect(screen.getByText('Ningún registro requiere atención.')).toBeTruthy();
  });

  it('con algo en atención, la hoja cuenta lo mismo que el badge y separa los dos tipos', () => {
    renderHoja(sync({ pendingCount: 0, attentionCount: 1 }), [write({ status: 'needs_attention' })]);

    expect(screen.getByText('1 requiere atención')).toBeTruthy();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('el nombre de una apertura incluye el código del equipo (del catálogo cacheado)', () => {
    const op = {
      id: 'a1', type: 'openCard', v: 1, userId: 'u1', status: 'pending', attempts: 0, seq: 1, createdAt: 1, updatedAt: 1,
      payload: { id: 'a1', equipoId: 'eq-9' },
    } as unknown as OutboxOp;
    queryClient.setQueryData(EQUIPMENT_KEY, [{ id: 'eq-9', internalCode: 'EX-009' }]);
    renderHoja(sync({ pendingCount: 1 }), [op]);

    expect(screen.getByText('Apertura de tarjeta · EX-009')).toBeTruthy();
    queryClient.clear();
  });

  it('tras "Preparar para uso sin señal" el foco sigue dentro de la hoja y Escape la cierra', () => {
    usePrepareMock.mockReturnValue({ preparando: true, resultadoPrep: null, handlePreparar: vi.fn() });
    mockOps = [];
    render(
      <MemoryRouter>
        <SyncSheet sync={sync()} isOpen onClose={onClose}>
          <PrepChecklist role="ADMIN" titulo="t" descripcion="d" />
        </SyncSheet>
      </MemoryRouter>,
    );

    const boton = screen.getByRole('button', { name: 'Preparando…' });
    expect(boton.hasAttribute('disabled')).toBe(false);
    boton.focus();
    fireEvent.keyDown(boton, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('es un diálogo accesible: Escape y el botón Cerrar la cierran', () => {
    renderHoja(sync(), []);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('avisa, sin datos, cuántos registros de otra cuenta guarda el equipo', () => {
    renderHoja(sync({ otherAccountCount: 3 }), []);

    expect(screen.getByText(/3 registros sin enviar de otra cuenta/)).toBeTruthy();
  });

  it('lista TODO lo que espera, con su estado y su último error — no solo lo que requiere atención', () => {
    const esperando = write({ id: 'e', label: 'Nuevo ítem · Aceite' });
    const reintentando = write({
      id: 'r',
      label: 'Edición de equipo · EX-001',
      attempts: 3,
      lastError: { message: 'Sin señal: se reintentará automáticamente.' },
    });
    const enVuelo = write({ id: 'v', label: 'Movimiento de stock · Filtro', status: 'syncing' });
    renderHoja(sync({ pendingCount: 3 }), [esperando, reintentando, enVuelo]);

    expect(screen.getByText('En cola')).toBeTruthy();
    expect(screen.getByText('Esperando señal')).toBeTruthy();
    expect(screen.getByText('Reintentando solo · 3 intentos')).toBeTruthy();
    expect(screen.getByText('Sin señal: se reintentará automáticamente.')).toBeTruthy();
    expect(screen.getByText('Enviando…')).toBeTruthy();
  });

  it('permite descartar cualquier operación que no esté en vuelo (con confirmación), y no la que sí lo está', () => {
    const atascada = write({ id: 'atascada', label: 'Nuevo equipo · EX-009', attempts: 7 });
    const enVuelo = write({ id: 'v', label: 'Movimiento de stock', status: 'syncing' });
    renderHoja(sync({ pendingCount: 2 }), [atascada, enVuelo]);

    // Una sola operación se puede descartar: la que no está en vuelo.
    const botones = screen.getAllByRole('button', { name: 'Descartar' });
    expect(botones).toHaveLength(1);

    fireEvent.click(botones[0]!);
    expect(discardOpMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, descartar' }));
    expect(discardOpMock).toHaveBeenCalledWith('atascada', 'u1');
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

  it('un 403 (el rol no puede) dice por qué y ofrece solo Descartar, sin Reintentar', () => {
    const op = write({
      id: 'w-403',
      status: 'needs_attention',
      lastError: { message: 'Insufficient permissions', code: 'FORBIDDEN', status: 403 },
    });
    renderHoja(sync({ attentionCount: 1 }), [op]);

    expect(screen.getByText('Tu rol no puede hacer esta acción.')).toBeTruthy();
    expect(screen.queryByText('Insufficient permissions')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sobrescribir' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, descartar' }));
    expect(discardOpMock).toHaveBeenCalledWith('w-403', 'u1');
  });

  it.each([
    ['FILE_TOO_LARGE', 413, 'El archivo supera el máximo de 8 MB.'],
    ['FILE_TYPE_NOT_ALLOWED', 415, 'Formato no permitido. Solo se aceptan JPG, PNG, WebP o PDF.'],
    ['FILE_TYPE_NOT_ALLOWED', undefined, 'Formato no permitido. Solo se aceptan JPG, PNG, WebP o PDF.'],
  ])('un archivo inválido (%s, %s): su mensaje claro y solo Descartar', (code, status, message) => {
    const op = write({ id: 'w-f', status: 'needs_attention', lastError: { message, code, status } });
    renderHoja(sync({ attentionCount: 1 }), [op]);

    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeTruthy();
  });

  it('tras Sobrescribir el foco queda dentro de la hoja, no en <body>', () => {
    const op = write({
      id: 'w-y',
      status: 'needs_attention',
      lastError: { message: 'Otra persona cambió', code: 'STALE_UPDATE', status: 409 },
    });
    renderHoja(sync({ attentionCount: 1 }), [op]);

    fireEvent.click(screen.getByRole('button', { name: 'Sobrescribir' }));

    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Descartar' })[0]!);
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
