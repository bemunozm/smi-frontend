import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';

import type { OrdenTrabajo } from '../types/mantenimiento';

const { ordenesHook, intervencionesHook, finalizarMock, actualizarMock, rol } = vi.hoisted(() => ({
  ordenesHook: vi.fn(),
  intervencionesHook: vi.fn(),
  finalizarMock: vi.fn(),
  actualizarMock: vi.fn(),
  rol: { value: 'ADMIN' as 'ADMIN' | 'SECRETARIA' | 'SUPERVISOR' },
}));

vi.mock('../hooks/useOrdenes', () => ({
  useOrdenes: () => ordenesHook(),
  useActualizarOrden: () => ({ mutate: actualizarMock, isPending: false }),
}));
vi.mock('../hooks/useIntervenciones', () => ({
  useIntervenciones: (id: string | undefined) => intervencionesHook(id),
  useFinishTask: () => ({ mutate: finalizarMock, isPending: false }),
}));
vi.mock('../hooks/usePermissions', async () => {
  const { canWrite } = await import('../lib/permissions');
  return {
    usePermissions: () => ({
      role: rol.value,
      can: (action: Parameters<typeof canWrite>[1]) => canWrite(rol.value, action),
    }),
  };
});
vi.mock('../hooks/useEquipment', () => ({
  useEquipment: () => ({
    data: [
      { id: 'e1', internalCode: 'SEM 02', controlUnit: 'HOURS', currentHourmeter: 512, currentMileage: null },
      { id: 'e2', internalCode: 'WA470', controlUnit: 'HOURS', currentHourmeter: null, currentMileage: null },
      { id: 'e3', internalCode: 'TLJD77', controlUnit: 'KM', currentHourmeter: null, currentMileage: 268617 },
    ],
  }),
}));
vi.mock('../hooks/useInventory', () => ({ useItems: () => ({ data: [{ id: 'item_1', name: 'Filtro de aceite' }] }) }));
// El tablero del taller tiene sus propios tests (`OrdenesTrabajoView.test.tsx`);
// acá solo importa QUE se monte y con qué contexto.
vi.mock('./OrdenesTrabajoView', () => ({
  OrdenesTrabajoView: ({ contexto }: { contexto?: string }) => (
    <div data-contexto={contexto} data-testid="tablero-taller" />
  ),
}));

// La pizarra tiene sus propios tests (`PizarraMantenciones.test.tsx`); acá
// solo importa que sea la vista por defecto y que sus botones lleven al registro y al tablero.
vi.mock('../components/mantenimiento/pizarra/PizarraMantenciones', () => ({
  PizarraMantenciones: ({ onVerRegistro, onVerTablero }: { onVerRegistro: () => void; onVerTablero?: () => void }) => (
    <div data-testid="pizarra">
      <button onClick={onVerRegistro} type="button">
        Ver registro de mantención
      </button>
      {onVerTablero ? (
        <button onClick={onVerTablero} type="button">
          Vista tablero mantenedor
        </button>
      ) : null}
    </div>
  ),
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
      tarea({
        id: 't2',
        texto: 'Cambiar pastillas',
        hechaPorNombre: 'Pedro Pérez',
        hechaAt: '2026-10-18T10:00:00.000Z',
      }),
    ],
    updatedAt: '2026-10-18T10:00:00.000Z',
  }),
  // En proceso: NO es una mantención hecha todavía.
  orden({ id: 'ot3', titulo: 'En curso', estado: 'EN_PROCESO' }),
];

const ok = (data: OrdenTrabajo[]) => ({ data, isPending: false, isError: false, error: null });

beforeEach(() => {
  rol.value = 'ADMIN';
  ordenesHook.mockReturnValue(ok(LISTA));
  intervencionesHook.mockReturnValue({ data: [], isPending: false });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** El «atrás» del navegador (MemoryRouter no usa `window.history`). */
function Atras() {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(-1)} type="button">
      atras
    </button>
  );
}

/** El registro quedó detrás de `?vista=registro`: la pizarra es la vista por defecto. */
const REGISTRO = '/mantenciones?vista=registro';

function renderView(entrada = REGISTRO) {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <MantencionesAdminView />
    </MemoryRouter>,
  );
}

describe('MantencionesAdminView', () => {
  it('por defecto muestra la pizarra, y «Ver registro de mantención» lleva al registro y vuelve', () => {
    renderView('/mantenciones');

    expect(screen.getByTestId('pizarra')).toBeTruthy();
    expect(screen.queryByText('Registro')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Ver registro de mantención' }));
    expect(screen.queryByTestId('pizarra')).toBeNull();
    expect(screen.getByText('Registro')).toBeTruthy();
    expect(screen.getAllByTestId(/mantencion-fila-/)).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Volver a la pizarra' }));
    expect(screen.getByTestId('pizarra')).toBeTruthy();
    expect(screen.queryByText('Registro')).toBeNull();
  });

  it('el detalle de una mantención (?id=, destino de la notificación) abre también sobre la pizarra', () => {
    renderView('/mantenciones?id=ot2');

    expect(screen.getByTestId('pizarra')).toBeTruthy();
    expect(within(screen.getByRole('dialog')).getByText('Reparación de frenos')).toBeTruthy();
  });

  it('lista SOLO las órdenes completadas, con equipo, tipo y quién la hizo', () => {
    renderView();

    const filas = screen.getAllByTestId(/mantencion-fila-/);
    expect(filas.map((f) => f.getAttribute('data-testid'))).toEqual(['mantencion-fila-ot2', 'mantencion-fila-ot1']);
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
    renderView(`${REGISTRO}&id=ot2`);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Reparación de frenos')).toBeTruthy();
  });

  it('«Sin terminar» lista las órdenes que el taller dejó abiertas', () => {
    renderView(`${REGISTRO}&estado=sin-terminar`);
    const filas = screen.getAllByTestId(/mantencion-fila-/);
    expect(filas.map((f) => f.getAttribute('data-testid'))).toEqual(['mantencion-fila-ot3']);
    expect(within(filas[0]).getByText('En proceso')).toBeTruthy();
  });

  it('SECRETARIA cierra una orden sin terminar: qué se hizo y cómo queda el equipo, sin insumos', () => {
    rol.value = 'SECRETARIA';
    renderView(`${REGISTRO}&estado=sin-terminar&id=ot3`);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Marcar como finalizada' }));

    const dialog = screen.getByRole('dialog');
    const finalizar = within(dialog).getByRole('button', { name: 'Finalizar mantención' });
    expect(finalizar.hasAttribute('disabled') || finalizar.getAttribute('aria-disabled') === 'true').toBe(true);

    fireEvent.change(within(dialog).getByLabelText('Qué se hizo'), { target: { value: 'Cambio de filtros' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Inoperativo' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Finalizar mantención' }));

    expect(finalizarMock).toHaveBeenCalledWith(
      {
        orden: expect.objectContaining({ id: 'ot3' }),
        intervencion: { tipo: 'PREVENTIVA', detalle: 'Cambio de filtros' },
        equipmentStatus: 'OUT_OF_SERVICE',
        // Preventiva: la lectura de la mantención, prellenada con el horómetro actual.
        lecturaMantencion: 512,
      },
      expect.anything(),
    );
  });

  it('finalizar una PREVENTIVA exige la lectura de la mantención (acepta coma decimal)', () => {
    renderView(`${REGISTRO}&estado=sin-terminar&id=ot3`);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Marcar como finalizada' }));

    const dialog = screen.getByRole('dialog');
    const lectura = within(dialog).getByLabelText('Horómetro al momento de la mantención (h)') as HTMLInputElement;
    expect(lectura.value).toBe('512');
    fireEvent.change(within(dialog).getByLabelText('Qué se hizo'), { target: { value: 'Cambio de filtros' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Operativo' }));

    fireEvent.change(lectura, { target: { value: '' } });
    const finalizar = within(dialog).getByRole('button', { name: 'Finalizar mantención' });
    expect(finalizar.hasAttribute('disabled') || finalizar.getAttribute('aria-disabled') === 'true').toBe(true);

    fireEvent.change(lectura, { target: { value: '510,5' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Finalizar mantención' }));
    expect(finalizarMock).toHaveBeenCalledWith(
      expect.objectContaining({ lecturaMantencion: 510.5, equipmentStatus: 'OPERATIONAL' }),
      expect.anything(),
    );
  });

  it('en un liviano la lectura es en km enteros: «264.582» viaja como 264582 (caso TLJD77)', () => {
    ordenesHook.mockReturnValue(
      ok([orden({ id: 'ot6', equipoId: 'e3', titulo: 'Mantención 264.582 km', estado: 'EN_PROCESO' })]),
    );
    renderView(`${REGISTRO}&estado=sin-terminar&id=ot6`);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Marcar como finalizada' }));

    const dialog = screen.getByRole('dialog');
    const lectura = within(dialog).getByLabelText('Kilometraje al momento de la mantención (km)') as HTMLInputElement;
    expect(lectura.value).toBe('268617');
    fireEvent.change(within(dialog).getByLabelText('Qué se hizo'), { target: { value: 'Cambio de aceite' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Operativo' }));

    // Mayor que la lectura actual: no se puede finalizar.
    fireEvent.change(lectura, { target: { value: '268.700' } });
    expect(within(dialog).getByText(/no puede ser mayor que la lectura actual del equipo/)).toBeTruthy();
    const finalizar = within(dialog).getByRole('button', { name: 'Finalizar mantención' });
    expect(finalizar.hasAttribute('disabled') || finalizar.getAttribute('aria-disabled') === 'true').toBe(true);

    fireEvent.change(lectura, { target: { value: '264.582' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Finalizar mantención' }));
    expect(finalizarMock).toHaveBeenCalledWith(
      expect.objectContaining({ lecturaMantencion: 264582, equipmentStatus: 'OPERATIONAL' }),
      expect.anything(),
    );
  });

  it('finalizar una CORRECTIVA no pide ni envía la lectura de la mantención', () => {
    ordenesHook.mockReturnValue(
      ok([orden({ id: 'ot5', equipoId: 'e2', titulo: 'Frenos', tipo: 'CORRECTIVA', estado: 'EN_PROCESO' })]),
    );
    renderView(`${REGISTRO}&estado=sin-terminar&id=ot5`);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Marcar como finalizada' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByLabelText(/al momento de la mantención/)).toBeNull();
    fireEvent.change(within(dialog).getByLabelText('Qué se hizo'), { target: { value: 'Pastillas nuevas' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Operativo' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Finalizar mantención' }));

    expect(finalizarMock).toHaveBeenCalledTimes(1);
    expect(finalizarMock.mock.calls[0]![0]).not.toHaveProperty('lecturaMantencion');
  });

  it('una orden completada se edita (título, prioridad) pero no se vuelve a finalizar', () => {
    rol.value = 'SECRETARIA';
    renderView(`${REGISTRO}&id=ot1`);
    const detalle = screen.getByRole('dialog');
    expect(within(detalle).queryByRole('button', { name: 'Marcar como finalizada' })).toBeNull();
    fireEvent.click(within(detalle).getByRole('button', { name: 'Editar' }));

    const editor = screen.getByRole('dialog');
    fireEvent.change(within(editor).getByLabelText('Título'), { target: { value: 'Mantención 500 h motor' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'Guardar cambios' }));
    expect(actualizarMock).toHaveBeenCalledWith(
      {
        orden: expect.objectContaining({ id: 'ot1' }),
        input: { titulo: 'Mantención 500 h motor', prioridad: 'MEDIA' },
      },
      expect.anything(),
    );
  });

  it('el ADMIN alterna al tablero del taller con el botón de vista, y puede volver al registro', () => {
    renderView();

    expect(screen.queryByTestId('tablero-taller')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Vista tablero' }));

    // El tablero se monta tal como lo ve el mantenedor (contexto del panel),
    // y la tabla Registro se retira.
    expect(screen.getByTestId('tablero-taller').getAttribute('data-contexto')).toBe('panel');
    expect(screen.queryByText('Registro')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Vista registro' }));
    expect(screen.queryByTestId('tablero-taller')).toBeNull();
    expect(screen.getByText('Registro')).toBeTruthy();
  });

  it('cambiar de vista agrega una entrada al historial: «atrás» vuelve a la pizarra', () => {
    render(
      <MemoryRouter initialEntries={['/mantenciones']}>
        <MantencionesAdminView />
        <Atras />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ver registro de mantención' }));
    expect(screen.getByText('Registro')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'atras' }));
    expect(screen.queryByText('Registro')).toBeNull();
  });

  it('desde la pizarra, «Vista tablero mantenedor» abre el tablero y «atrás» vuelve a la pizarra', () => {
    render(
      <MemoryRouter initialEntries={['/mantenciones']}>
        <MantencionesAdminView />
        <Atras />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Vista tablero mantenedor' }));
    expect(screen.queryByTestId('pizarra')).toBeNull();
    expect(screen.getByTestId('tablero-taller')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'atras' }));
    expect(screen.getByTestId('pizarra')).toBeTruthy();
    expect(screen.queryByTestId('tablero-taller')).toBeNull();
  });

  it('a la SECRETARIA la pizarra no le ofrece el atajo al tablero', () => {
    rol.value = 'SECRETARIA';
    renderView('/mantenciones');

    expect(screen.getByTestId('pizarra')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Vista tablero mantenedor' })).toBeNull();
  });

  it('?vista=tablero abre directo en el tablero (la vista queda en la URL)', () => {
    renderView('/mantenciones?vista=tablero');

    expect(screen.getByTestId('tablero-taller')).toBeTruthy();
    expect(screen.queryByText('Registro')).toBeNull();
  });

  it('SECRETARIA no ve el botón de vista y ?vista=tablero no le cambia la pantalla', () => {
    rol.value = 'SECRETARIA';
    renderView('/mantenciones?vista=tablero');

    expect(screen.queryByRole('button', { name: 'Vista tablero' })).toBeNull();
    expect(screen.queryByTestId('tablero-taller')).toBeNull();
    expect(screen.getByText('Registro')).toBeTruthy();
  });

  it('muestra el error del listado', () => {
    ordenesHook.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Falló Mantención'),
    });
    renderView();
    expect(screen.getByText('Falló Mantención')).toBeTruthy();
  });
});
