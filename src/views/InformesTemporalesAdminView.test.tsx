import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';

import type { InformeTemporal } from '../types/informe-temporal';

const { listaHook, eliminarMock, excelMock, actualizarMock } = vi.hoisted(() => ({
  listaHook: vi.fn(),
  eliminarMock: vi.fn(),
  excelMock: vi.fn(),
  actualizarMock: vi.fn(),
}));
const { rol } = vi.hoisted(() => ({ rol: { value: 'ADMIN' as 'ADMIN' | 'SECRETARIA' } }));
const { edicionTarjeta, toastDanger } = vi.hoisted(() => ({
  edicionTarjeta: { mutate: vi.fn(), config: null as null | { endpoint: string; build: (v: unknown) => unknown } },
  toastDanger: vi.fn(),
}));

vi.mock('@heroui/react', async (importOriginal) => {
  const real = await importOriginal<typeof import('@heroui/react')>();
  return { ...real, toast: Object.assign(real.toast, { danger: toastDanger }) };
});

// La corrección de una tarjeta (`CorregirTarjetaTemporalModal`) escribe por la cola.
vi.mock('../hooks/useQueuedMutation', () => ({
  useQueuedMutation: (config: { endpoint: string; build: (v: unknown) => unknown }) => {
    edicionTarjeta.config = config;
    return { mutate: edicionTarjeta.mutate, isPending: false };
  },
}));
vi.mock('../hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: 'u1' } }) }));

vi.mock('../hooks/useInformesTemporales', () => ({
  useInformesTemporales: (desde: string, hasta: string) => listaHook(desde, hasta),
  useEliminarInformeTemporal: () => ({ mutate: eliminarMock, isPending: false }),
  useActualizarInformeTemporal: () => ({ mutate: actualizarMock, isPending: false }),
  useCrearInformeAntiguo: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useNumeroInformeOcupado: () => ({ ocupado: null }),
}));

// «Subir informe antiguo»: el catálogo de equipos y los supervisores temporales.
vi.mock('../hooks/useEquipment', () => ({
  useEquipment: () => ({
    data: [{ id: 'e9', internalCode: 'COMPRESOR', type: 'Compresor', brand: 'Kaeser', model: 'M50', equipmentClass: 'HEAVY' }],
  }),
}));
vi.mock('../hooks/useUsers', () => ({
  useUsers: () => ({ data: [{ id: 'st1', name: 'Juan Torres', email: 'jt@smi.local' }] }),
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

vi.mock('../lib/informe-temporal-excel', () => ({
  construirExcelInformesTemporales: (...args: unknown[]) => excelMock(...args),
}));

vi.mock('../hooks/useOperators', () => ({ useOperators: () => ({ data: [] }) }));

import { InformesTemporalesAdminView } from './InformesTemporalesAdminView';

const informe = (over: Partial<InformeTemporal> & Pick<InformeTemporal, 'id' | 'numero'>): InformeTemporal => ({
  antiguo: false,
  equiposRegistrados: [],
  fecha: '2026-11-20',
  turno: 'DIURNO',
  actividad1: 'Carga de material',
  actividad2: null,
  personal: [{ actividad: 1, operatorId: null, nombre: 'Luis Vera' }],
  observaciones: 'Sin novedades',
  supervisorResponsable1: 'Ana Soto',
  supervisorResponsable2: null,
  supervisorId: 's1',
  supervisorNombre: 'Ana Soto',
  inicio: '2026-11-20T10:00:00.000Z',
  fin: '2026-11-20T20:00:00.000Z',
  createdAt: '2026-11-20T20:00:00.000Z',
  updatedAt: '2026-11-20T20:00:00.000Z',
  tarjetas: [
    {
      id: 'c1',
      equipo: { id: 'e1', internalCode: 'EX-1', name: 'Excavadora' },
      operador: 'Juan',
      valorInicial: 100,
      valorFinal: 108,
      fuelLiters: 40,
      adBlueLiters: null,
      pumpPhotoUrl: 'https://fotos.test/bomba.jpg',
      fecha: '2026-11-20T12:00:00.000Z',
      fechaSalida: '2026-11-20T19:00:00.000Z',
    },
  ],
  ...over,
});

const LISTA = [
  informe({ id: 'i1', numero: 7 }),
  informe({ id: 'i2', numero: 8, turno: 'NOCTURNO', supervisorNombre: 'Pedro Rojas', actividad1: 'Despeje de camino' }),
];

beforeEach(() => {
  rol.value = 'ADMIN';
  listaHook.mockReturnValue({ data: LISTA, isPending: false, isError: false, error: null });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('InformesTemporalesAdminView', () => {
  it('lista los informes del rango con su supervisor, actividad y equipos', () => {
    render(<InformesTemporalesAdminView />);
    const filas = screen.getAllByTestId(/informe-fila-/);
    expect(filas).toHaveLength(2);
    expect(screen.getByTestId('informe-fila-i1').textContent).toContain('Ana Soto');
    expect(screen.getByTestId('informe-fila-i1').textContent).toContain('EX-1');
    expect(screen.getByTestId('informe-fila-i2').textContent).toContain('Pedro Rojas');
    expect(screen.getByTestId('informe-fila-i2').textContent).toContain('Despeje de camino');
    // La consulta va con un rango de fechas YYYY-MM-DD.
    const [desde, hasta] = listaHook.mock.calls[0] as [string, string];
    expect(desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(hasta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('el detalle muestra el informe completo y sus tarjetas; ADMIN corrige y elimina', () => {
    render(<InformesTemporalesAdminView />);
    fireEvent.click(screen.getByTestId('informe-fila-i1'));
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByText(/Luis Vera/)).toBeTruthy();
    expect(within(dialogo).getByText(/Sin novedades/)).toBeTruthy();
    expect(within(dialogo).getByText('EX-1')).toBeTruthy();
    expect(within(dialogo).getByRole('button', { name: 'Corregir' })).toBeTruthy();

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));
    const confirmacion = screen.getByRole('alertdialog');
    fireEvent.click(within(confirmacion).getByRole('button', { name: 'Eliminar' }));
    expect(eliminarMock).toHaveBeenCalledWith('i1', expect.anything());
  });

  it('el modal de corrección respeta los largos del backend (200/200/1000)', () => {
    render(<InformesTemporalesAdminView />);
    fireEvent.click(screen.getByTestId('informe-fila-i1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Corregir' }));
    expect(screen.getByDisplayValue('Carga de material').getAttribute('maxlength')).toBe('200');
    expect(screen.getByDisplayValue('Sin novedades').getAttribute('maxlength')).toBe('1000');
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    expect(inputs.filter((i) => i.getAttribute('maxlength') === '200')).toHaveLength(2);
  });

  it('SECRETARIA puede corregir pero no ve «Eliminar»', () => {
    rol.value = 'SECRETARIA';
    render(<InformesTemporalesAdminView />);
    fireEvent.click(screen.getByTestId('informe-fila-i1'));
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByRole('button', { name: 'Corregir' })).toBeTruthy();
    expect(within(dialogo).queryByRole('button', { name: 'Eliminar' })).toBeNull();
  });

  it.each(['ADMIN', 'SECRETARIA'] as const)('%s corrige lecturas y litros de una tarjeta', async (r) => {
    rol.value = r;
    render(<InformesTemporalesAdminView />);
    fireEvent.click(screen.getByTestId('informe-fila-i1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Corregir lecturas de EX-1' }));

    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText('Corregir EX-1')).toBeTruthy();
    fireEvent.change(within(modal).getByLabelText(/Lectura final/), { target: { value: '110' } });
    fireEvent.click(within(modal).getByRole('button', { name: 'Guardar corrección' }));

    expect(edicionTarjeta.mutate).toHaveBeenCalledWith(
      { id: 'c1', nuevo: { valorInicial: 100, valorFinal: 110, fuelLiters: 40 } },
      expect.anything(),
    );
    // Solo viaja lo que cambió, con su precondición, al PATCH de esa tarjeta.
    expect(edicionTarjeta.config?.endpoint).toBe('shiftCard.edit');
    const [vars] = edicionTarjeta.mutate.mock.calls[0] as [unknown];
    expect(await edicionTarjeta.config?.build(vars)).toEqual({
      params: { id: 'c1' },
      body: { valorFinal: 110 },
      expected: { valorFinal: 108 },
    });
  });

  it('la lectura final menor que la inicial no se guarda', () => {
    render(<InformesTemporalesAdminView />);
    fireEvent.click(screen.getByTestId('informe-fila-i1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Corregir lecturas de EX-1' }));
    const modal = screen.getByRole('dialog');
    fireEvent.change(within(modal).getByLabelText(/Lectura final/), { target: { value: '90' } });
    fireEvent.click(within(modal).getByRole('button', { name: 'Guardar corrección' }));
    expect(within(modal).getByText(/no puede ser menor que la inicial/)).toBeTruthy();
    expect(edicionTarjeta.mutate).not.toHaveBeenCalled();
  });

  it('si el Excel no se puede armar, avisa con un toast de error', async () => {
    excelMock.mockRejectedValue(new Error('sin red'));
    render(<InformesTemporalesAdminView />);
    fireEvent.click(screen.getByRole('button', { name: 'Exportar Excel' }));
    await vi.waitFor(() =>
      expect(toastDanger).toHaveBeenCalledWith(expect.stringMatching(/No se pudo generar el Excel/)),
    );
  });

  it('«Exportar Excel» arma la planilla con los informes del rango', async () => {
    excelMock.mockResolvedValue(new ArrayBuffer(8));
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    render(<InformesTemporalesAdminView />);
    fireEvent.click(screen.getByRole('button', { name: 'Exportar Excel' }));
    await vi.waitFor(() => expect(excelMock).toHaveBeenCalledWith([LISTA[1], LISTA[0]]));
  });

  it('sin informes en el rango lo dice y desactiva la exportación', () => {
    listaHook.mockReturnValue({ data: [], isPending: false, isError: false, error: null });
    render(<InformesTemporalesAdminView />);
    expect(screen.getByText(/No hay informes/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Exportar Excel' }) as HTMLButtonElement).disabled).toBe(true);
  });

  describe('informe subido después', () => {
    const ANTIGUO = informe({
      id: 'a1',
      numero: 3,
      antiguo: true,
      tarjetas: [],
      equiposRegistrados: [
        { equipoId: 'e9', codigo: 'COMPRESOR', nombre: 'Compresor Kaeser M50', unidad: 'h', inicial: 484.92, final: 487.1, litros: null },
      ],
    });

    it('la lista lo marca «Subido después» y muestra sus equipos escritos a mano', () => {
      listaHook.mockReturnValue({ data: [ANTIGUO], isPending: false, isError: false, error: null });
      render(<InformesTemporalesAdminView />);
      const fila = screen.getByTestId('informe-fila-a1');
      expect(fila.textContent).toContain('Subido después');
      expect(fila.textContent).toContain('COMPRESOR');
    });

    it('la corrección deja cambiar sus equipos y manda solo los equipos que cambiaron', () => {
      listaHook.mockReturnValue({ data: [ANTIGUO], isPending: false, isError: false, error: null });
      render(<InformesTemporalesAdminView />);
      fireEvent.click(screen.getByTestId('informe-fila-a1'));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Corregir' }));
      fireEvent.change(screen.getByLabelText('Lectura final del equipo 1'), { target: { value: '488' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));
      expect(actualizarMock).toHaveBeenCalledWith(
        { id: 'a1', cambios: { equipos: [{ equipoId: 'e9', inicial: 484.92, final: 488, litros: null }] } },
        expect.anything(),
      );
    });

    it('ADMIN y SECRETARIA ven «Subir informe antiguo» y eligen de qué supervisor temporal es', () => {
      rol.value = 'SECRETARIA';
      render(<InformesTemporalesAdminView />);
      fireEvent.click(screen.getByRole('button', { name: 'Subir informe antiguo' }));
      const hoja = screen.getByRole('dialog', { name: 'Informe de actividad en papel' });
      expect(within(hoja).getByLabelText(/Supervisor temporal/)).toBeTruthy();
      // Sin elegirlo no se puede subir.
      fireEvent.click(within(hoja).getByRole('button', { name: /Subir informe/ }));
      expect(within(hoja).getByText('Elige a qué supervisor temporal pertenece el informe.')).toBeTruthy();
    });
  });
});
