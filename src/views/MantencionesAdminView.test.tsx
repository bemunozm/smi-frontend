import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { OrdenTrabajo } from '../types/mantenimiento';

const { ordenesHook, intervencionesHook } = vi.hoisted(() => ({
  ordenesHook: vi.fn(),
  intervencionesHook: vi.fn(),
}));

vi.mock('../hooks/useOrdenes', () => ({ useOrdenes: () => ordenesHook() }));
vi.mock('../hooks/useIntervenciones', () => ({ useIntervenciones: (id: string | undefined) => intervencionesHook(id) }));
vi.mock('../hooks/useEquipment', () => ({
  useEquipment: () => ({ data: [{ id: 'e1', internalCode: 'SEM 02' }, { id: 'e2', internalCode: 'WA470' }] }),
}));
vi.mock('../hooks/useInventory', () => ({
  useItems: () => ({ data: [{ id: 'item_1', name: 'Filtro de aceite' }] }),
}));

import { MantencionesAdminView } from './MantencionesAdminView';

const tarea = (over: Record<string, unknown>) => ({
  id: 't1',
  texto: 'Cambio de aceite',
  hecha: true,
  posicion: 0,
  notas: 'Se cambió el aceite 15W-40',
  fotoUrl: null,
  hechaPorNombre: 'Marco Díaz',
  hechaAt: '2026-10-15T14:00:00.000Z',
  ...over,
});

const orden = (over: Partial<OrdenTrabajo> & Pick<OrdenTrabajo, 'id'>): OrdenTrabajo => ({
  equipoId: 'e1',
  hallazgoId: null,
  titulo: 'Mantención 500 h',
  estado: 'COMPLETADA',
  prioridad: 'MEDIA',
  tipo: 'PREVENTIVA',
  origen: 'MANUAL',
  origenDetalle: null,
  pautaMilestone: null,
  pautaCycle: null,
  asignadoA: null,
  tareas: [tarea({})],
  createdAt: '2026-10-14T09:00:00.000Z',
  updatedAt: '2026-10-15T14:00:00.000Z',
  ...over,
});

const LISTA: OrdenTrabajo[] = [
  orden({ id: 'ot1' }),
  orden({
    id: 'ot2',
    equipoId: 'e2',
    titulo: 'Reparación de frenos',
    tipo: 'CORRECTIVA',
    tareas: [
      tarea({ id: 't2', texto: 'Cambiar pastillas', hechaPorNombre: 'Pedro Pérez', hechaAt: '2026-10-18T10:00:00.000Z' }),
    ],
    updatedAt: '2026-10-18T10:00:00.000Z',
  }),
  // En proceso: NO es una mantención hecha todavía.
  orden({ id: 'ot3', titulo: 'En curso', estado: 'EN_PROCESO' }),
];

const ok = (data: OrdenTrabajo[]) => ({ data, isPending: false, isError: false, error: null });

beforeEach(() => {
  ordenesHook.mockReturnValue(ok(LISTA));
  intervencionesHook.mockReturnValue({ data: [], isPending: false });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderView(entrada = '/mantenciones') {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <MantencionesAdminView />
    </MemoryRouter>,
  );
}

describe('MantencionesAdminView', () => {
  it('lista SOLO las órdenes completadas, con equipo, tipo y quién la hizo', () => {
    renderView();

    const filas = screen.getAllByTestId(/mantencion-fila-/);
    expect(filas.map((f) => f.getAttribute('data-testid'))).toEqual([
      'mantencion-fila-ot2',
      'mantencion-fila-ot1',
    ]);
    expect(screen.queryByText('En curso')).toBeNull();
    expect(within(screen.getByTestId('mantencion-fila-ot1')).getByText('SEM 02')).toBeTruthy();
    expect(within(screen.getByTestId('mantencion-fila-ot1')).getByText('Preventiva')).toBeTruthy();
    expect(within(screen.getByTestId('mantencion-fila-ot1')).getByText('Marco Díaz')).toBeTruthy();
    expect(within(screen.getByTestId('mantencion-fila-ot2')).getByText('Correctiva')).toBeTruthy();
  });

  it('filtra por tipo, por mantenedor y por rango de fechas', () => {
    renderView();

    fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: 'CORRECTIVA' } });
    expect(screen.getAllByTestId(/mantencion-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('mantencion-fila-ot2')).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: 'TODOS' } });
    fireEvent.change(screen.getByLabelText(/mantenedor/i), { target: { value: 'Marco Díaz' } });
    expect(screen.getAllByTestId(/mantencion-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('mantencion-fila-ot1')).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/mantenedor/i), { target: { value: 'TODOS' } });
    // ot1 se hizo el 15-oct; ot2 el 18-oct (hora local de los mocks).
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '2026-10-17' } });
    expect(screen.getAllByTestId(/mantencion-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('mantencion-fila-ot2')).toBeTruthy();
  });

  it('el detalle muestra qué se hizo, quién, cuándo y los insumos usados con su nombre', () => {
    intervencionesHook.mockReturnValue({
      data: [
        {
          id: 'int1',
          ordenId: 'ot1',
          tipo: 'PREVENTIVA',
          detalle: 'Cierre de la pauta de 500 h',
          horasHombre: 2.5,
          horometro: 512,
          fotoUrl: null,
          soloLectura: false,
          realizadaPor: 'Marco Díaz',
          insumos: [{ id: 'ii1', insumoId: 'item_1', cantidad: 2 }],
          fecha: '2026-10-15T14:30:00.000Z',
        },
      ],
      isPending: false,
    });
    renderView();

    fireEvent.click(screen.getByTestId('mantencion-fila-ot1'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Mantención 500 h')).toBeTruthy();
    expect(within(dialog).getByText('Cambio de aceite')).toBeTruthy();
    expect(within(dialog).getByText('Se cambió el aceite 15W-40')).toBeTruthy();
    expect(within(dialog).getAllByText(/Marco Díaz/).length).toBeGreaterThanOrEqual(1);
    expect(within(dialog).getByText('Cierre de la pauta de 500 h')).toBeTruthy();
    // El insumo sale con su nombre del inventario y la cantidad.
    expect(within(dialog).getByText(/Filtro de aceite/)).toBeTruthy();
    expect(within(dialog).getByText(/× 2/)).toBeTruthy();
  });

  it('abre el detalle directo con ?id= (el destino de la notificación de mantención)', () => {
    renderView('/mantenciones?id=ot2');

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Reparación de frenos')).toBeTruthy();
  });

  it('muestra el error del listado', () => {
    ordenesHook.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('Falló Mantención') });
    renderView();
    expect(screen.getByText('Falló Mantención')).toBeTruthy();
  });
});
