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

const { listHook, crearMock, editarMock, eliminarMock } = vi.hoisted(() => ({
  listHook: vi.fn(),
  crearMock: vi.fn(),
  editarMock: vi.fn(),
  eliminarMock: vi.fn(),
}));
const { rol } = vi.hoisted(() => ({ rol: { value: 'ADMIN' as 'ADMIN' | 'SECRETARIA' | 'MANTENEDOR' } }));

vi.mock('../hooks/useCombustible', () => ({
  useCombustibleList: () => listHook(),
  useCrearCargaCombustible: () => ({ mutate: crearMock, isPending: false }),
  useEditarCargaCombustible: () => ({ mutate: editarMock, isPending: false }),
  useEliminarCargaCombustible: () => ({ mutate: eliminarMock, isPending: false }),
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

import { assetUrl } from '../api/UploadsAPI';
import { toDateTimeLocal } from '../lib/format';
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
  equipo: { internalCode: 'EX-001', type: 'Excavadora', equipmentClass: 'HEAVY', controlUnit: 'HOURS' },
  realizadoPor: 'Juan Pérez',
  origen: 'TARJETA',
  lectura: 1534.5,
  ...over,
});

const LISTA: RegistroCombustible[] = [
  carga({ id: 'c1' }),
  // Camioneta a las 23:30 LOCAL del 05-11: el filtro por día tiene que verla
  // en SU día. Su equipo no está en el catálogo (clase desde el backend).
  carga({
    id: 'c2',
    equipoId: 'e9',
    equipo: { internalCode: 'CM-01', type: 'Camioneta', equipmentClass: 'LIGHT', controlUnit: 'KM' },
    litros: 35.5,
    tipo: 'BENCINA',
    fecha: local(2026, 11, 5, 23, 30),
    registroHorometroId: 'h2',
    realizadoPor: 'Pedro Soto',
    fotoUrl: 'https://minio.local/signed/surtidor.jpg',
    lectura: 45210,
  }),
  // Fila vieja: sin tarjeta, sin creador ni lectura — la clase sale del
  // catálogo (e1).
  carga({
    id: 'c4',
    litros: 50,
    fecha: local(2026, 11, 2, 9, 0),
    registroHorometroId: null,
    equipo: { internalCode: 'EX-001', type: 'Excavadora' },
    realizadoPor: null,
    origen: 'MANUAL',
    lectura: null,
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

/** La barra de filtros: las cards móviles también dicen «Clase», así que los
 * triggers de los selects se buscan dentro de la barra, no en toda la vista. */
const filtros = () => within(screen.getByTestId('filtros-cargas'));

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

  it('filtra por equipo, por clase y por supervisor, y el total sigue al filtro', async () => {
    render(<CargasCombustibleAdminView />);

    fireEvent.click(filtros().getByRole('button', { name: /Equipo/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'CM-01' }));
    expect(screen.getAllByTestId(/carga-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('carga-fila-c2')).toBeTruthy();
    expect(screen.getByTestId('total-filtrado').textContent).toBe('35,5 L en 1 carga');

    fireEvent.click(filtros().getByRole('button', { name: /Equipo/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Todos' }));
    fireEvent.click(filtros().getByRole('button', { name: /Clase/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Pesado' }));
    expect(screen.getAllByTestId(/carga-fila-/).map((f) => f.getAttribute('data-testid'))).toEqual([
      'carga-fila-c1',
      'carga-fila-c4',
      'carga-fila-c3',
    ]);

    fireEvent.click(filtros().getByRole('button', { name: /Clase/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Todos' }));
    fireEvent.click(filtros().getByRole('button', { name: /Supervisor/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Pedro Soto' }));
    expect(screen.getAllByTestId(/carga-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('carga-fila-c2')).toBeTruthy();
  });

  it('una carga cuyo equipo no está en el catálogo usa la clase que trae el backend', async () => {
    render(<CargasCombustibleAdminView />);
    fireEvent.click(filtros().getByRole('button', { name: /Clase/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Liviano' }));
    expect(screen.getAllByTestId(/carga-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('carga-fila-c2')).toBeTruthy();
  });

  it('«Filtrar por fecha» abre el calendario de rango y la carga de las 23:30 cae en su día local', async () => {
    render(<CargasCombustibleAdminView />);

    // Un BOTÓN, no un campo con segmentos dd/mm/aaaa (pedido del administrador).
    expect(screen.queryByText('dd/mm/aaaa')).toBeNull();
    expect(screen.queryByText('Desde')).toBeNull();
    expect(screen.queryByText('Hasta')).toBeNull();

    // Elegir 5-nov → 5-nov en el calendario: solo c2 (las 23:30 LOCALES del
    // 05-11 son su día, aunque en UTC ya sea 06-11).
    fireEvent.click(filtros().getByRole('button', { name: 'Filtrar por fecha' }));
    const celda = await screen.findAllByRole('button', { name: /November 5, 2026/ });
    fireEvent.click(celda[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /November 5, 2026/ })[0]);

    expect(screen.getAllByTestId(/carga-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('carga-fila-c2')).toBeTruthy();
    // El botón ahora dice el rango elegido.
    expect(filtros().getByRole('button', { name: /05\/11\/2026/ })).toBeTruthy();

    // «Limpiar período» vuelve a mostrar todo y el botón recupera su nombre.
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar período' }));
    expect(screen.getAllByTestId(/carga-fila-/)).toHaveLength(4);
    expect(filtros().getByRole('button', { name: 'Filtrar por fecha' })).toBeTruthy();
  });

  it('una fila vieja sin realizadoPor muestra «—» y el filtro de supervisor no la pierde en «Todos»', async () => {
    render(<CargasCombustibleAdminView />);
    const fila = screen.getByTestId('carga-fila-c4');
    expect(within(fila).getByText('Realizó')).toBeTruthy();
    expect(within(fila).getAllByText('—').length).toBeGreaterThan(0);
    // Las opciones del select salen de los datos: sin opción vacía para null.
    fireEvent.click(filtros().getByRole('button', { name: /Supervisor/ }));
    const opciones = await screen.findAllByRole('option');
    expect(opciones.map((o) => o.textContent)).toEqual(['Todos', 'Admin SMI', 'Juan Pérez', 'Pedro Soto']);
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
    // La lectura del contador al cargar, rotulada según el equipo (pesado → h).
    expect(within(dialog).getByText('Horómetro al cargar')).toBeTruthy();
    expect(within(dialog).getByText('1.534,5 h')).toBeTruthy();
  });

  it('la lectura se muestra con su unidad: km en livianos, — si la carga vieja no la tiene', () => {
    render(<CargasCombustibleAdminView />);

    const camioneta = screen.getByTestId('carga-fila-c2');
    expect(within(camioneta).getByText('Kilometraje')).toBeTruthy();
    expect(within(camioneta).getByText('45.210 km')).toBeTruthy();

    const vieja = screen.getByTestId('carga-fila-c4');
    expect(within(vieja).getByText('Horómetro')).toBeTruthy();
    expect(within(vieja).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('una foto legacy (/uploads/...) se sirve vía assetUrl, nunca con la ruta cruda', () => {
    listHook.mockReturnValue(ok([carga({ id: 'c9', fotoUrl: '/uploads/carga-vieja.jpg' })]));
    render(<CargasCombustibleAdminView />);
    fireEvent.click(screen.getByTestId('carga-fila-c9'));
    const dialog = screen.getByRole('dialog');
    const img = within(dialog).getByRole('img');
    expect(img.getAttribute('src')).toBe(assetUrl('/uploads/carga-vieja.jpg'));
    expect(img.getAttribute('src')).not.toBe('/uploads/carga-vieja.jpg');
    expect(img.closest('a')?.getAttribute('href')).toBe(assetUrl('/uploads/carga-vieja.jpg'));
  });

  it('el detalle de una carga con foto la muestra con enlace al tamaño completo', () => {
    render(<CargasCombustibleAdminView />);
    fireEvent.click(screen.getByTestId('carga-fila-c2'));
    const dialog = screen.getByRole('dialog');
    const img = within(dialog).getByRole('img') as HTMLImageElement;
    expect(img.src).toBe('https://minio.local/signed/surtidor.jpg');
    expect(within(dialog).queryByText('Sin foto adjunta.')).toBeNull();
  });

  it('ningún calce con el filtro muestra el vacío sin romper', async () => {
    render(<CargasCombustibleAdminView />);
    // Pedro Soto solo tiene una carga de camioneta: cruzado con Pesado, nada.
    fireEvent.click(filtros().getByRole('button', { name: /Supervisor/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Pedro Soto' }));
    fireEvent.click(filtros().getByRole('button', { name: /Clase/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Pesado' }));
    expect(screen.queryAllByTestId(/carga-fila-/)).toHaveLength(0);
    expect(screen.getByText('Ninguna carga calza con el filtro.')).toBeTruthy();
    expect(screen.getByTestId('total-filtrado').textContent).toBe('0 L en 0 cargas');
  });

  it('sin cargas registradas lo dice; el error del listado sale con role=alert', () => {
    listHook.mockReturnValue(ok([]));
    render(<CargasCombustibleAdminView />);
    expect(screen.getByText('No hay cargas de combustible registradas.')).toBeTruthy();
    cleanup();

    listHook.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Falló el listado'),
    });
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

    // Parte en Pesado: la camioneta no está entre las opciones del equipo y
    // la lectura pide el horómetro.
    expect(within(dialog).getByLabelText('Horómetro al cargar (h)')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: /Equipo/ }));
    expect(await screen.findByRole('option', { name: /EX-001/ })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /CM-02/ })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: /EX-001/ }));

    // Cambiar a Liviano abre la camioneta (resetea el equipo elegido) y la
    // lectura pasa a pedir kilometraje.
    fireEvent.click(within(dialog).getByRole('button', { name: /Clase/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Liviano' }));
    expect(within(dialog).getByLabelText('Kilometraje al cargar (km)')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: /Equipo/ }));
    fireEvent.click(await screen.findByRole('option', { name: /CM-02/ }));

    fireEvent.change(within(dialog).getByLabelText('Kilometraje al cargar (km)'), { target: { value: '45600' } });
    fireEvent.change(within(dialog).getByLabelText('Litros'), { target: { value: '40' } });
    fireEvent.change(within(dialog).getByLabelText('Fecha de carga'), { target: { value: '2026-11-04T10:30' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar carga' }));

    await waitFor(() => expect(crearMock).toHaveBeenCalledTimes(1));
    expect(crearMock).toHaveBeenCalledWith(
      {
        values: {
          equipoId: 'e2',
          litros: 40,
          tipo: 'PETROLEO',
          fecha: new Date('2026-11-04T10:30').toISOString(),
          lectura: 45600,
        },
        foto: null,
      },
      expect.anything(),
    );
  });

  it('una fecha futura tipeada a mano deja «Registrar carga» deshabilitado', async () => {
    render(<CargasCombustibleAdminView />);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva carga' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Equipo/ }));
    fireEvent.click(await screen.findByRole('option', { name: /EX-001/ }));
    fireEvent.change(within(dialog).getByLabelText('Horómetro al cargar (h)'), { target: { value: '1600' } });
    fireEvent.change(within(dialog).getByLabelText('Litros'), { target: { value: '40' } });

    const guardar = within(dialog).getByRole('button', { name: 'Registrar carga' });
    // Con la fecha por defecto (ahora) alcanza para guardar…
    expect(guardar.hasAttribute('disabled')).toBe(false);

    // …pero una fecha futura (el backend las rechazaría y esta vista no
    // tiene edición para corregirla) bloquea el guardado.
    const futura = toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000));
    fireEvent.change(within(dialog).getByLabelText('Fecha de carga'), { target: { value: futura } });
    expect(guardar.hasAttribute('disabled')).toBe(true);
    expect(crearMock).not.toHaveBeenCalled();
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

    // Con litros pero sin la lectura del contador, tampoco (pedido del
    // cliente: pesado → horómetro, liviano → km, al momento de cargar).
    fireEvent.change(within(dialog).getByLabelText('Litros'), { target: { value: '40' } });
    expect(guardar.hasAttribute('disabled')).toBe(true);

    // Con lectura pero la fecha borrada, tampoco.
    fireEvent.change(within(dialog).getByLabelText('Horómetro al cargar (h)'), { target: { value: '1600' } });
    fireEvent.change(within(dialog).getByLabelText('Fecha de carga'), { target: { value: '' } });
    expect(guardar.hasAttribute('disabled')).toBe(true);
    expect(crearMock).not.toHaveBeenCalled();
  });
});

describe('edición de una carga (solo ADMIN)', () => {
  it('ADMIN ve «Editar carga» en el detalle; SECRETARIA no', () => {
    render(<CargasCombustibleAdminView />);
    fireEvent.click(screen.getByTestId('carga-fila-c1'));
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Editar carga' })).toBeTruthy();
    cleanup();

    rol.value = 'SECRETARIA';
    render(<CargasCombustibleAdminView />);
    fireEvent.click(screen.getByTestId('carga-fila-c1'));
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Editar carga' })).toBeNull();
  });

  it('ADMIN ve «Eliminar carga»; SECRETARIA no; y eliminar pide confirmación antes de llamar al backend', () => {
    render(<CargasCombustibleAdminView />);
    fireEvent.click(screen.getByTestId('carga-fila-c1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar carga' }));

    const confirmacion = screen.getByRole('alertdialog');
    expect(within(confirmacion).getByText(/se eliminará definitivamente/)).toBeTruthy();
    // c1 nació de una tarjeta: la confirmación lo advierte.
    expect(within(confirmacion).getByText(/esa tarjeta quedará sin litros declarados/)).toBeTruthy();
    expect(eliminarMock).not.toHaveBeenCalled();

    fireEvent.click(within(confirmacion).getByRole('button', { name: 'Eliminar' }));
    expect(eliminarMock).toHaveBeenCalledWith('c1', expect.anything());
    cleanup();

    rol.value = 'SECRETARIA';
    render(<CargasCombustibleAdminView />);
    fireEvent.click(screen.getByTestId('carga-fila-c1'));
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Eliminar carga' })).toBeNull();
  });

  it('una carga MANUAL edita litros/tipo/fecha/lectura y guarda los cambios (coma decimal incluida)', async () => {
    const manual = carga({
      id: 'm1',
      registroHorometroId: null,
      origen: 'MANUAL',
      litros: 100000,
      lectura: 1000,
      fecha: local(2026, 11, 10, 10, 0),
    });
    listHook.mockReturnValue(ok([manual]));
    render(<CargasCombustibleAdminView />);
    fireEvent.click(screen.getByTestId('carga-fila-m1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Editar carga' }));

    const dialog = screen.getByRole('dialog');
    const litros = within(dialog).getByLabelText('Litros') as HTMLInputElement;
    expect(litros.value).toBe('100000');
    fireEvent.change(litros, { target: { value: '100,4' } });
    fireEvent.change(within(dialog).getByLabelText('Horómetro al cargar (h)'), { target: { value: '1200' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(editarMock).toHaveBeenCalledTimes(1));
    const [vars] = editarMock.mock.calls[0]!;
    expect(vars.carga.id).toBe('m1');
    expect(vars.cambios).toMatchObject({ litros: 100.4, lectura: 1200 });
  });

  it('una carga de TARJETA solo permite corregir los litros, con la nota de la tarjeta', async () => {
    render(<CargasCombustibleAdminView />);
    fireEvent.click(screen.getByTestId('carga-fila-c1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Editar carga' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Litros')).toBeTruthy();
    expect(within(dialog).queryByText('Tipo de combustible')).toBeNull();
    expect(within(dialog).queryByLabelText('Fecha de carga')).toBeNull();
    expect(within(dialog).getByText(/cierre de una tarjeta/i)).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText('Litros'), { target: { value: '164,5' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(editarMock).toHaveBeenCalledTimes(1));
    const [vars] = editarMock.mock.calls[0]!;
    expect(vars.carga.id).toBe('c1');
    expect(vars.cambios).toEqual({ litros: 164.5 });
  });
});
