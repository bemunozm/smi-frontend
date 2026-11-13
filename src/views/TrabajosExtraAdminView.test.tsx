import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within, waitFor } from '@testing-library/react';

import type { TrabajoExtraordinario } from '../types/trabajosExtra';

const { listHook, crearMock, guardarMock, eliminarMock } = vi.hoisted(() => ({
  listHook: vi.fn(),
  crearMock: vi.fn(),
  guardarMock: vi.fn(),
  eliminarMock: vi.fn(),
}));
const { rol } = vi.hoisted(() => ({ rol: { value: 'ADMIN' as 'ADMIN' | 'SECRETARIA' | 'MANTENEDOR' } }));

vi.mock('../hooks/useTrabajosExtra', () => ({
  useTrabajosExtraList: () => listHook(),
  useCrearTrabajoExtra: () => ({ mutate: crearMock, isPending: false }),
  useEditarTrabajoExtra: () => ({ guardar: guardarMock, isGuardando: false }),
  useEliminarTrabajoExtra: () => ({ mutate: eliminarMock, isPending: false }),
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
  useEquipment: () => ({ data: [{ id: 'e1', internalCode: 'CG-002' }, { id: 'e2', internalCode: 'EX-001' }] }),
}));

vi.mock('../hooks/useOperators', () => ({
  useOperators: () => ({ data: [{ id: 'op_1', name: 'Juan Rojas', isActive: true }] }),
}));

// Catálogo de plantas del reporte diario: el selector «¿En qué planta?» del
// modal de alta lo consume cuando el destino es PLANTA.
vi.mock('../hooks/useReporteDiario', () => ({
  usePlantas: () => ({ data: [{ id: 'p1', nombre: 'Planta 1' }, { id: 'p4', nombre: 'Planta 4' }] }),
}));

import { TrabajosExtraAdminView } from './TrabajosExtraAdminView';

const trabajo = (over: Partial<TrabajoExtraordinario> & Pick<TrabajoExtraordinario, 'id'>): TrabajoExtraordinario => ({
  equipoId: 'e1',
  operatorId: null,
  operador: 'P. Rojas',
  faena: 'Mina Caleta',
  turno: 'DIURNO',
  horometroInicial: 100,
  horometroFinal: 103,
  totalHoras: 3,
  actividades: ['LIMPIEZA_CANCHA'],
  otraActividad: null,
  descripcion: 'Limpieza de la cancha norte',
  observaciones: null,
  fecha: '2026-10-14T15:00:00.000Z',
  equipo: { internalCode: 'CG-002' },
  ...over,
});

const LISTA: TrabajoExtraordinario[] = [
  trabajo({ id: 't1', registradoPor: 'Ana Soto' }),
  trabajo({
    id: 't2',
    numero: 12,
    equipoId: 'e2',
    equipo: { internalCode: 'EX-001' },
    turno: 'NOCTURNO',
    totalHoras: 2.5,
    fecha: '2026-10-16T22:00:00.000Z',
    actividades: ['OTRO'],
    otraActividad: 'Rescate de camión',
    observaciones: 'Con apoyo del cargador',
    registradoPor: 'Pedro Pérez',
  }),
  trabajo({ id: 't3', totalHoras: 4, fecha: '2026-10-10T09:00:00.000Z', registradoPor: null }),
];

const ok = (data: TrabajoExtraordinario[]) => ({ data, isPending: false, isError: false, error: null });

beforeEach(() => {
  rol.value = 'ADMIN';
  listHook.mockReturnValue(ok(LISTA));
  guardarMock.mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TrabajosExtraAdminView', () => {
  it('lista todos los trabajos (más reciente primero) y el total filtrado suma sus HM', () => {
    render(<TrabajosExtraAdminView />);
    const filas = screen.getAllByTestId(/trabajo-fila-/);
    expect(filas.map((f) => f.getAttribute('data-testid'))).toEqual([
      'trabajo-fila-t2',
      'trabajo-fila-t1',
      'trabajo-fila-t3',
    ]);
    expect(screen.getByTestId('total-filtrado').textContent).toBe('9,5 h en 3 trabajos');
    // «Otro» muestra el texto libre en vez del valor crudo.
    expect(screen.getByText('Otro: Rescate de camión')).toBeTruthy();
    // El N° de Report encabeza cada fila; uno sin número todavía lo dice.
    expect(screen.getByTestId('trabajo-fila-t2').textContent).toContain('#12');
    expect(screen.getByTestId('trabajo-fila-t1').textContent).toContain('Sin correlativo aún');
  });

  it('filtra por equipo, por turno y por rango de fechas, y el total sigue al filtro', () => {
    render(<TrabajosExtraAdminView />);

    fireEvent.change(screen.getByLabelText(/equipo/i), { target: { value: 'e2' } });
    expect(screen.getAllByTestId(/trabajo-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('trabajo-fila-t2')).toBeTruthy();
    expect(screen.getByTestId('total-filtrado').textContent).toBe('2,5 h en 1 trabajo');

    fireEvent.change(screen.getByLabelText(/equipo/i), { target: { value: 'TODOS' } });
    fireEvent.change(screen.getByLabelText(/turno/i), { target: { value: 'NOCTURNO' } });
    expect(screen.getAllByTestId(/trabajo-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('trabajo-fila-t2')).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/turno/i), { target: { value: 'TODOS' } });
    // t3 es del 10-oct; t1 del 14-oct; t2 del 16-oct (hora local de los mocks).
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '2026-10-13' } });
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: '2026-10-15' } });
    expect(screen.getAllByTestId(/trabajo-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('trabajo-fila-t1')).toBeTruthy();
  });

  it('ningún calce con el filtro muestra el vacío sin romper', () => {
    render(<TrabajosExtraAdminView />);
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '2030-01-01' } });
    expect(screen.queryAllByTestId(/trabajo-fila-/)).toHaveLength(0);
    expect(screen.getByText('Ningún trabajo calza con el filtro.')).toBeTruthy();
    expect(screen.getByTestId('total-filtrado').textContent).toBe('0 h en 0 trabajos');
  });

  it('clic en una fila abre el detalle completo en un popup', () => {
    render(<TrabajosExtraAdminView />);
    fireEvent.click(screen.getByTestId('trabajo-fila-t2'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Report #12 · EX-001')).toBeTruthy();
    expect(within(dialog).getByText('P. Rojas')).toBeTruthy();
    expect(within(dialog).getByText('Nocturno')).toBeTruthy();
    expect(within(dialog).getByText('Otro: Rescate de camión')).toBeTruthy();
    expect(within(dialog).getByText('Con apoyo del cargador')).toBeTruthy();
    expect(within(dialog).getByText('2,5 h')).toBeTruthy();
  });

  it('«Editar» abre el formulario con los datos del trabajo y guarda la corrección', async () => {
    rol.value = 'SECRETARIA';
    const original = trabajo({ id: 't9', numero: 9, operatorId: 'op_1', operador: 'Juan Rojas' });
    listHook.mockReturnValue(ok([original]));
    render(<TrabajosExtraAdminView />);
    fireEvent.click(screen.getByTestId('trabajo-fila-t9'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Editar' }));

    const editor = screen.getByRole('dialog');
    expect(within(editor).getByText('Editar Report #9 · CG-002')).toBeTruthy();
    expect((within(editor).getByLabelText('Faena') as HTMLInputElement).value).toBe('Mina Caleta');
    fireEvent.change(within(editor).getByLabelText('Horómetro final'), { target: { value: '104' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(guardarMock).toHaveBeenCalledWith(original, expect.objectContaining({ horometroFinal: 104, faena: 'Mina Caleta' })),
    );
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('sin permiso de corrección el detalle no ofrece «Editar»', () => {
    rol.value = 'MANTENEDOR';
    render(<TrabajosExtraAdminView />);
    fireEvent.click(screen.getByTestId('trabajo-fila-t1'));
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Editar' })).toBeNull();
  });

  it('eliminar pide confirmación y recién ahí llama al DELETE', () => {
    render(<TrabajosExtraAdminView />);
    fireEvent.click(screen.getByTestId('trabajo-fila-t2'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    const confirmacion = screen.getByRole('alertdialog');
    expect(within(confirmacion).getByText(/se eliminará definitivamente/)).toBeTruthy();
    expect(eliminarMock).not.toHaveBeenCalled();

    fireEvent.click(within(confirmacion).getByRole('button', { name: 'Eliminar' }));
    expect(eliminarMock).toHaveBeenCalledWith('t2', expect.anything());
  });

  it('SECRETARIA corrige pero no elimina', () => {
    rol.value = 'SECRETARIA';
    render(<TrabajosExtraAdminView />);
    fireEvent.click(screen.getByTestId('trabajo-fila-t1'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Editar' })).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: 'Eliminar' })).toBeNull();
  });

  it('muestra el error del listado', () => {
    listHook.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('Falló Terreno') });
    render(<TrabajosExtraAdminView />);
    expect(screen.getByText('Falló Terreno')).toBeTruthy();
  });

  it('la tabla y el detalle muestran quién registró cada trabajo', () => {
    render(<TrabajosExtraAdminView />);

    expect(within(screen.getByTestId('trabajo-fila-t1')).getByText('Ana Soto')).toBeTruthy();

    fireEvent.click(screen.getByTestId('trabajo-fila-t2'));
    expect(within(screen.getByRole('dialog')).getByText('Pedro Pérez')).toBeTruthy();
  });

  it('«N° del report» muestra el último registrado y avisa uno repetido', () => {
    listHook.mockReturnValue(ok([trabajo({ id: 'f1', reportNumero: '4508' }), trabajo({ id: 'f2', reportNumero: '4507' })]));
    render(<TrabajosExtraAdminView />);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva actividad' }));
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText(/Último report registrado: 4508 · el siguiente sería 4509./)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('N° del report (boleta)'), { target: { value: '4508' } });
    expect(within(dialog).getByText(/El N° 4508 ya está registrado en otro Report/)).toBeTruthy();
  });

  it('«Nueva actividad» registra con operador del catálogo, horómetros, actividades, report y foto', async () => {
    render(<TrabajosExtraAdminView />);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva actividad' }));

    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Equipo/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'EX-001' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /Operador/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Juan Rojas' }));
    fireEvent.change(within(dialog).getByLabelText('Faena'), { target: { value: 'Rajo Norte' } });
    fireEvent.change(within(dialog).getByLabelText('Horómetro inicial'), { target: { value: '1200' } });
    fireEvent.change(within(dialog).getByLabelText('Horómetro final'), { target: { value: '1212' } });
    // El desglose: la fila dice qué se hizo, dónde y sus horas máquina.
    fireEvent.click(within(dialog).getByRole('button', { name: /Actividad/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Regulación y carga' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /Tipo/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Transporte' }));
    fireEvent.change(within(dialog).getByLabelText('HM'), { target: { value: '12' } });
    fireEvent.change(within(dialog).getByLabelText('Descripción de la actividad'), { target: { value: 'Romana 2' } });
    fireEvent.change(within(dialog).getByLabelText('Descripción'), { target: { value: 'Carga de material' } });
    fireEvent.change(within(dialog).getByLabelText('Fecha y hora del trabajo'), {
      target: { value: '2026-10-05T21:15' },
    });
    // Los campos del report: folio y la foto obligatoria.
    fireEvent.change(within(dialog).getByLabelText('N° del report (boleta)'), { target: { value: '4509' } });
    const foto = new File(['report'], 'report.jpg', { type: 'image/jpeg' });
    fireEvent.change(within(dialog).getByLabelText('Foto del report'), { target: { files: [foto] } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar trabajo' }));

    expect(crearMock).toHaveBeenCalledWith(
      {
        values: expect.objectContaining({
          fecha: new Date('2026-10-05T21:15').toISOString(),
          equipoId: 'e2',
          operatorId: 'op_1',
          faena: 'Rajo Norte',
          turno: 'DIURNO',
          horometroInicial: 1200,
          horometroFinal: 1212,
          detalle: [{ actividad: 'REGULACION_CARGA', lugar: 'TRANSPORTE', horas: 12, descripcion: 'Romana 2' }],
          descripcion: 'Carga de material',
          reportNumero: '4509',
        }),
        foto,
      },
      expect.anything(),
    );
  });

  it('«Exportar Excel» pide el período en UN calendario de rango y sin rango no descarga', () => {
    // jsdom no implementa los object URL con los que se descarga el archivo.
    const createObjectURL = vi.fn(() => 'blob:report');
    URL.createObjectURL = createObjectURL as never;
    URL.revokeObjectURL = vi.fn() as never;

    render(<TrabajosExtraAdminView />);
    fireEvent.click(screen.getByRole('button', { name: 'Exportar Excel' }));

    const dialog = screen.getByRole('dialog');
    // UN solo selector de rango (mismo patrón que Movimientos), no dos campos.
    expect(within(dialog).getByText('Período')).toBeTruthy();
    expect(within(dialog).queryByText('Desde')).toBeNull();
    expect(within(dialog).queryByText('Hasta')).toBeNull();
    // El popover del calendario tiene su ancla (regresión de Movimientos).
    expect(dialog.querySelector('[data-slot="date-range-picker-trigger"]')).not.toBeNull();

    // Sin período elegido no hay descarga: el botón queda deshabilitado.
    expect(within(dialog).getByTestId('export-conteo').textContent).toContain('Elegí el período');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Exportar' }));
    expect(createObjectURL).not.toHaveBeenCalled();
    // El armado y contenido del archivo se prueba en `lib/report-excel.test.ts`,
    // releyendo el Excel generado.
  });

  it('sin foto del report, «Registrar trabajo» queda deshabilitado', async () => {
    render(<TrabajosExtraAdminView />);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva actividad' }));

    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Equipo/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'EX-001' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /Operador/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Juan Rojas' }));
    fireEvent.change(within(dialog).getByLabelText('Faena'), { target: { value: 'Rajo Norte' } });
    fireEvent.change(within(dialog).getByLabelText('Horómetro inicial'), { target: { value: '1200' } });
    fireEvent.change(within(dialog).getByLabelText('Horómetro final'), { target: { value: '1212' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Actividad/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Regulación y carga' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /Tipo/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Transporte' }));
    fireEvent.change(within(dialog).getByLabelText('HM'), { target: { value: '12' } });
    fireEvent.change(within(dialog).getByLabelText('Descripción de la actividad'), { target: { value: 'Romana 2' } });
    fireEvent.change(within(dialog).getByLabelText('Descripción'), { target: { value: 'Carga de material' } });
    fireEvent.change(within(dialog).getByLabelText('N° del report (boleta)'), { target: { value: '4509' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar trabajo' }));
    expect(crearMock).not.toHaveBeenCalled();
  });
});
