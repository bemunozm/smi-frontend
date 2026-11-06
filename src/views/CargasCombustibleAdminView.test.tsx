import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor, within } from '@testing-library/react';

import type { RegistroCombustible } from '../types/combustible';

// El flujo foto→OCR→EXIF del modal de alta: dobles para no tocar la red. En
// estos tests nunca se elige foto, pero el módulo igual se importa.
vi.mock('../lib/photo-reading', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/photo-reading')>()),
  readCaptureDate: vi.fn().mockResolvedValue(null),
}));
vi.mock('../api/OcrAPI', () => ({
  fuelReadingOcr: vi.fn().mockResolvedValue({ value: null, status: 'UNREADABLE', confidence: 0 }),
}));

const { listHook, crearMock } = vi.hoisted(() => ({
  listHook: vi.fn(),
  crearMock: vi.fn(),
}));
const { rol } = vi.hoisted(() => ({ rol: { value: 'ADMIN' as 'ADMIN' | 'SECRETARIA' | 'MANTENEDOR' } }));

vi.mock('../hooks/useCombustible', () => ({
  useCombustibleList: () => listHook(),
  useCrearCargaCombustible: () => ({ mutate: crearMock, isPending: false }),
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

// Catálogo corto a propósito: `e9` (la camioneta de c2) NO está — su clase
// tiene que salir de lo que trae el backend en la carga, no del catálogo.
vi.mock('../hooks/useEquipment', () => ({
  useEquipment: () => ({
    data: [
      { id: 'e1', internalCode: 'EX-001', type: 'Excavadora', equipmentClass: 'HEAVY', controlUnit: 'HOURS' },
      { id: 'e2', internalCode: 'CM-02', type: 'Camioneta', equipmentClass: 'LIGHT', controlUnit: 'KM' },
    ],
  }),
}));

import { CargasCombustibleAdminView } from './CargasCombustibleAdminView';

/** Fechas construidas en hora LOCAL (TZ-safe): el filtro compara días locales. */
const local = (y: number, mes1a12: number, d: number, h: number, min: number) =>
  new Date(y, mes1a12 - 1, d, h, min).toISOString();

const carga = (over: Partial<RegistroCombustible> & Pick<RegistroCombustible, 'id'>): RegistroCombustible => ({
  equipoId: 'e1',
  litros: 120,
  tipo: 'PETROLEO',
  fotoUrl: null,
  fecha: local(2026, 11, 3, 12, 0),
  registroHorometroId: 'h1',
  equipo: { internalCode: 'EX-001', type: 'Excavadora', equipmentClass: 'HEAVY' },
  realizadoPor: 'Juan Pérez',
  origen: 'TARJETA',
  ...over,
});

const LISTA: RegistroCombustible[] = [
  carga({ id: 'c1' }),
  // Camioneta a las 23:30 LOCAL del 05-11: el filtro por día tiene que verla
  // en SU día. Su equipo no está en el catálogo (clase desde el backend).
  carga({
    id: 'c2',
    equipoId: 'e9',
    equipo: { internalCode: 'CM-01', type: 'Camioneta', equipmentClass: 'LIGHT' },
    litros: 35.5,
    tipo: 'BENCINA',
    fecha: local(2026, 11, 5, 23, 30),
    registroHorometroId: 'h2',
    realizadoPor: 'Pedro Soto',
    fotoUrl: 'https://minio.local/signed/surtidor.jpg',
  }),
  // Fila vieja: sin tarjeta, sin creador — la clase sale del catálogo (e1).
  carga({
    id: 'c4',
    litros: 50,
    fecha: local(2026, 11, 2, 9, 0),
    registroHorometroId: null,
    equipo: { internalCode: 'EX-001', type: 'Excavadora' },
    realizadoPor: null,
    origen: 'MANUAL',
  }),
  carga({
    id: 'c3',
    litros: 80,
    fecha: local(2026, 11, 1, 10, 0),
    registroHorometroId: null,
    realizadoPor: 'Admin SMI',
    origen: 'MANUAL',
  }),
];

const ok = (data: RegistroCombustible[]) => ({ data, isPending: false, isError: false, error: null });

beforeEach(() => {
  rol.value = 'ADMIN';
  listHook.mockReturnValue(ok(LISTA));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CargasCombustibleAdminView', () => {
  it('lista todas las cargas (última primero) y el total filtrado suma sus litros', () => {
    render(<CargasCombustibleAdminView />);
    const filas = screen.getAllByTestId(/carga-fila-/);
    expect(filas.map((f) => f.getAttribute('data-testid'))).toEqual([
      'carga-fila-c2',
      'carga-fila-c1',
      'carga-fila-c4',
      'carga-fila-c3',
    ]);
    expect(screen.getByTestId('total-filtrado').textContent).toBe('285,5 L en 4 cargas');
  });

  it('filtra por equipo, por clase y por supervisor, y el total sigue al filtro', () => {
    render(<CargasCombustibleAdminView />);

    fireEvent.change(screen.getByLabelText(/equipo/i), { target: { value: 'e9' } });
    expect(screen.getAllByTestId(/carga-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('carga-fila-c2')).toBeTruthy();
    expect(screen.getByTestId('total-filtrado').textContent).toBe('35,5 L en 1 carga');

    fireEvent.change(screen.getByLabelText(/equipo/i), { target: { value: 'TODOS' } });
    fireEvent.change(screen.getByLabelText(/clase/i), { target: { value: 'HEAVY' } });
    expect(screen.getAllByTestId(/carga-fila-/).map((f) => f.getAttribute('data-testid'))).toEqual([
      'carga-fila-c1',
      'carga-fila-c4',
      'carga-fila-c3',
    ]);

    fireEvent.change(screen.getByLabelText(/clase/i), { target: { value: 'TODOS' } });
    fireEvent.change(screen.getByLabelText(/supervisor/i), { target: { value: 'Pedro Soto' } });
    expect(screen.getAllByTestId(/carga-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('carga-fila-c2')).toBeTruthy();
  });

  it('una carga cuyo equipo no está en el catálogo usa la clase que trae el backend', () => {
    render(<CargasCombustibleAdminView />);
    fireEvent.change(screen.getByLabelText(/clase/i), { target: { value: 'LIGHT' } });
    expect(screen.getAllByTestId(/carga-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('carga-fila-c2')).toBeTruthy();
  });

  it('filtra por rango de fechas con el día LOCAL: la carga de las 23:30 cae en su día', () => {
    render(<CargasCombustibleAdminView />);
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '2026-11-05' } });
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: '2026-11-05' } });
    expect(screen.getAllByTestId(/carga-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('carga-fila-c2')).toBeTruthy();
  });

  it('una fila vieja sin realizadoPor muestra «—» y el filtro de supervisor no la pierde en «Todos»', () => {
    render(<CargasCombustibleAdminView />);
    const fila = screen.getByTestId('carga-fila-c4');
    expect(within(fila).getByText('Realizó')).toBeTruthy();
    expect(within(fila).getAllByText('—').length).toBeGreaterThan(0);
    // Las opciones del select salen de los datos: sin opción vacía para null.
    const supervisor = screen.getByLabelText(/supervisor/i) as HTMLSelectElement;
    expect([...supervisor.options].map((o) => o.textContent)).toEqual([
      'Todos',
      'Admin SMI',
      'Juan Pérez',
      'Pedro Soto',
    ]);
  });

  it('clic en una fila abre el detalle; sin foto dice «Sin foto adjunta.»', () => {
    render(<CargasCombustibleAdminView />);
    fireEvent.click(screen.getByTestId('carga-fila-c1'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Carga de combustible · EX-001')).toBeTruthy();
    expect(within(dialog).getByText('Juan Pérez')).toBeTruthy();
    expect(within(dialog).getByText('120 L')).toBeTruthy();
    expect(within(dialog).getByText('Petróleo')).toBeTruthy();
    expect(within(dialog).getByText('Tarjeta de turno')).toBeTruthy();
    expect(within(dialog).getByText('Sin foto adjunta.')).toBeTruthy();
  });

  it('el detalle de una carga con foto la muestra con enlace al tamaño completo', () => {
    render(<CargasCombustibleAdminView />);
    fireEvent.click(screen.getByTestId('carga-fila-c2'));
    const dialog = screen.getByRole('dialog');
    const img = within(dialog).getByRole('img') as HTMLImageElement;
    expect(img.src).toBe('https://minio.local/signed/surtidor.jpg');
    expect(within(dialog).queryByText('Sin foto adjunta.')).toBeNull();
  });

  it('ningún calce con el filtro muestra el vacío sin romper', () => {
    render(<CargasCombustibleAdminView />);
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '2030-01-01' } });
    expect(screen.queryAllByTestId(/carga-fila-/)).toHaveLength(0);
    expect(screen.getByText('Ninguna carga calza con el filtro.')).toBeTruthy();
    expect(screen.getByTestId('total-filtrado').textContent).toBe('0 L en 0 cargas');
  });

  it('sin cargas registradas lo dice; el error del listado sale con role=alert', () => {
    listHook.mockReturnValue(ok([]));
    render(<CargasCombustibleAdminView />);
    expect(screen.getByText('No hay cargas de combustible registradas.')).toBeTruthy();
    cleanup();

    listHook.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('Falló el listado') });
    render(<CargasCombustibleAdminView />);
    expect(screen.getByRole('alert').textContent).toBe('Falló el listado');
  });

  it('mientras carga no muestra filas, vacío ni error', () => {
    listHook.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null });
    render(<CargasCombustibleAdminView />);
    expect(screen.queryAllByTestId(/carga-fila-/)).toHaveLength(0);
    expect(screen.queryByText('No hay cargas de combustible registradas.')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('«Nueva carga» aparece para quien puede crear y no para el resto', () => {
    render(<CargasCombustibleAdminView />);
    expect(screen.getByRole('button', { name: 'Nueva carga' })).toBeTruthy();
    cleanup();

    rol.value = 'MANTENEDOR';
    render(<CargasCombustibleAdminView />);
    expect(screen.queryByRole('button', { name: 'Nueva carga' })).toBeNull();
  });
});

describe('alta manual («Nueva carga»)', () => {
  it('elegir la clase filtra los equipos y guarda con los valores del formulario; sin foto va foto: null', async () => {
    render(<CargasCombustibleAdminView />);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva carga' }));
    const dialog = screen.getByRole('dialog');

    // Parte en Pesado: la camioneta no está entre las opciones del equipo.
    fireEvent.click(within(dialog).getByRole('button', { name: /Equipo/ }));
    expect(await screen.findByRole('option', { name: /EX-001/ })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /CM-02/ })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: /EX-001/ }));

    // Cambiar a Liviano abre la camioneta (y resetea el equipo elegido).
    fireEvent.click(within(dialog).getByRole('button', { name: /Clase/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Liviano' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /Equipo/ }));
    fireEvent.click(await screen.findByRole('option', { name: /CM-02/ }));

    fireEvent.change(within(dialog).getByLabelText('Litros'), { target: { value: '40' } });
    fireEvent.change(within(dialog).getByLabelText('Fecha de carga'), {
      target: { value: '2026-11-04T10:30' },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar carga' }));

    await waitFor(() => expect(crearMock).toHaveBeenCalledTimes(1));
    expect(crearMock).toHaveBeenCalledWith(
      {
        values: {
          equipoId: 'e2',
          litros: 40,
          tipo: 'PETROLEO',
          fecha: new Date('2026-11-04T10:30').toISOString(),
        },
        foto: null,
      },
      expect.anything(),
    );
  });

  it('no guarda sin equipo, con litros vacíos o con la fecha borrada', async () => {
    render(<CargasCombustibleAdminView />);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva carga' }));
    const dialog = screen.getByRole('dialog');
    const guardar = within(dialog).getByRole('button', { name: 'Registrar carga' });

    // Sin equipo ni litros: deshabilitado.
    expect(guardar.hasAttribute('disabled')).toBe(true);

    // Con equipo pero litros en 0, sigue deshabilitado.
    fireEvent.click(within(dialog).getByRole('button', { name: /Equipo/ }));
    fireEvent.click(await screen.findByRole('option', { name: /EX-001/ }));
    expect(guardar.hasAttribute('disabled')).toBe(true);

    // Con litros pero la fecha borrada, tampoco.
    fireEvent.change(within(dialog).getByLabelText('Litros'), { target: { value: '40' } });
    fireEvent.change(within(dialog).getByLabelText('Fecha de carga'), { target: { value: '' } });
    expect(guardar.hasAttribute('disabled')).toBe(true);
    expect(crearMock).not.toHaveBeenCalled();
  });
});
