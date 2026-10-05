import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { EquiposView } from './EquiposView';
import { DomainError } from '../lib/api-error';
import { enviado, submitWriteMock } from '../test/office-write';

// Rol controlable por test — `let` (no `const`) porque el componente puede
// re-renderizar más de una vez por test; mismo patrón que
// `NotificationBell.test.tsx`.
let currentUserResult: {
  user: { id: string; name: string; email: string; role: string };
  role: string;
  isPending: boolean;
  isAuthenticated: boolean;
};

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => currentUserResult,
}));

// Se mockea la capa de API (no los hooks) para que `useEquipment` y sus
// mutaciones corran de verdad — mismo criterio que `EquiposViewError.test.tsx`
// y `useEquipment.test.tsx`: el `mutate` real termina llamando a estas
// funciones, así que verificar sus argumentos prueba el flujo completo
// vista → hook → API.
const { listMock, resumenMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  resumenMock: vi.fn(),
}));

vi.mock('../api/EquipmentAPI', () => ({
  EquipmentAPI: { list: listMock, resumen: resumenMock, getById: vi.fn() },
}));

// Las escrituras van por la cola (`submitWrite`): lo que se verifica es lo que se
// encola — endpoint, params, body, precondición y archivos —, no una llamada HTTP.
vi.mock('../offline/submit-write', async (importOriginal) =>
  (await import('../test/office-write')).conSubmitWriteFalso(await importOriginal()),
);

// Idem para Branch: `CamposEquipo` usa `useBranches`/`useBranch` reales — se
// mockea `BranchAPI` para controlar qué sucursales existen (activas vs. la
// asignada al equipo, que puede estar inactiva — ver Fix 2).
const { branchListMock, branchGetByIdMock } = vi.hoisted(() => ({
  branchListMock: vi.fn(),
  branchGetByIdMock: vi.fn(),
}));

vi.mock('../api/BranchAPI', () => ({
  BranchAPI: { list: branchListMock, getById: branchGetByIdMock },
}));

// `CamposEquipo` puebla el picker de supervisor (`useUsers({ role:
// 'SUPERVISOR' })`) — se mockea `UserAPI` para no pegarle a axios.
const { userListMock } = vi.hoisted(() => ({
  userListMock: vi.fn(),
}));

vi.mock('../api/UserAPI', () => ({
  UserAPI: {
    list: userListMock,
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

// El picker de operador (`OperatorPicker`, dentro de `CamposEquipo`) sale
// del catálogo propio, NO de `UserAPI` — se mockea `OperatorAPI` aparte.
const { operatorListMock } = vi.hoisted(() => ({
  operatorListMock: vi.fn(),
}));

vi.mock('../api/OperatorAPI', () => ({
  OperatorAPI: { list: operatorListMock },
}));

const ADMIN = {
  user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
  role: 'ADMIN',
  isPending: false,
  isAuthenticated: true,
};

/** Lo encolado para un endpoint, en orden. */
function escrituras(endpoint: string): Array<Record<string, unknown>> {
  return submitWriteMock.mock.calls.filter(([clave]) => clave === endpoint).map(([, input]) => input);
}

beforeEach(() => {
  // jsdom no implementa los object URL con los que el banner previsualiza la foto elegida.
  URL.createObjectURL = vi.fn(() => 'blob:foto-nueva');
  URL.revokeObjectURL = vi.fn();
  submitWriteMock.mockReset();
  submitWriteMock.mockImplementation(async () => enviado(null));
  currentUserResult = ADMIN;
  // Default sin operadores/supervisores — los tests que abren el picker de
  // asignación lo sobrescriben con `userListMock`/`operatorListMock`.
  userListMock.mockResolvedValue([]);
  operatorListMock.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const EQUIPO = {
  id: 'eq_1',
  internalCode: 'EX-001',
  licensePlate: 'AB-CD-12',
  equipmentClass: 'HEAVY' as const,
  type: 'Excavadora',
  brand: 'Caterpillar',
  model: '336',
  year: 2019,
  controlUnit: 'HOURS' as const,
  currentHourmeter: 1200,
  currentMileage: null,
  status: 'OPERATIONAL' as const,
  homeBranchId: 'br_1',
  photoUrl: null,
  operator: null,
  supervisor: null,
  inUse: false,
  currentFuelLevel: null,
  openShift: null,
  documentsAlert: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SUCURSAL_ACTIVA = {
  id: 'br_1',
  name: 'Sucursal Centro',
  address: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const RESUMEN_VACIO = {
  total: 1,
  disponibles: 1,
  porEstado: { OPERATIONAL: 1, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 },
};

function renderView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EquiposView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function abrirMenuAcciones() {
  const boton = await screen.findByRole('button', { name: `Acciones para ${EQUIPO.internalCode}` });
  fireEvent.click(boton);
}

/**
 * Elige una opción de un `Select` (HeroUI/React Aria) ya abierto. No se
 * puede usar `getByText`/`findByText` acá: React Aria mantiene montada una
 * copia oculta de la colección de items (la usa para resolver el label del
 * valor seleccionado con el popover cerrado), así que el texto aparece
 * duplicado en el DOM y esas queries revientan por "multiple elements
 * found". `getAllByRole('option')` sí filtra solo los items accesibles
 * (visibles) del popover abierto.
 */
function elegirOpcion(texto: string): void {
  const opcion = screen.getAllByRole('option').find((item) => item.textContent === texto);
  if (!opcion) {
    throw new Error(`No se encontró la opción "${texto}" entre las visibles del Select abierto.`);
  }
  fireEvent.click(opcion);
}

/**
 * Abre el picker de operador (`OperatorPicker`, un `ComboBox`) — a
 * diferencia del `<Select>` de sucursal/estado/supervisor (todo el botón es
 * el trigger, con nombre accesible propio), acá el trigger es un botón
 * chico aparte del input de búsqueda, sin nombre accesible predecible
 * ("aria-labelledby" apunta al `<label>` del campo) — mismo criterio que
 * `OperatorPicker.test.tsx`, que por eso ubica el trigger por clase.
 * Busca en `document.body` (no en el `container` de `render()`): el modal
 * de editar/crear equipo porta su contenido fuera del árbol montado por RTL,
 * así que `container.querySelector` nunca lo encuentra. Espera a que
 * `useOperators({isActive:true})` deje de estar pendiente (el `ComboBox` se
 * deshabilita mientras carga) antes de hacer click.
 */
async function abrirPickerOperador(): Promise<void> {
  const trigger = await waitFor(() => {
    const el = document.body.querySelector('.combo-box__trigger');
    if (!el || el.hasAttribute('disabled')) throw new Error('Trigger del picker de operador no listo todavía.');
    return el as HTMLButtonElement;
  });
  fireEvent.click(trigger);
}

describe('EquiposView — menú de acciones', () => {
  it('cambia el estado del equipo al elegir "Marcar como…"', async () => {
    listMock.mockResolvedValue([EQUIPO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);

    renderView();
    await abrirMenuAcciones();

    fireEvent.click(await screen.findByText('Marcar como En taller'));

    await waitFor(() => expect(escrituras('equipment.status')).toHaveLength(1));
    expect(escrituras('equipment.status')[0]).toMatchObject({
      params: { id: 'eq_1' },
      body: { status: 'IN_WORKSHOP' },
      expected: { status: 'OPERATIONAL' },
    });
  });

  it('no ofrece "Marcar como…" a un rol sin permiso de cambiar estado (MANTENEDOR)', async () => {
    currentUserResult = {
      user: { id: 'u2', name: 'Mantenedor', email: 'mant@smi.local', role: 'MANTENEDOR' },
      role: 'MANTENEDOR',
      isPending: false,
      isAuthenticated: true,
    };
    listMock.mockResolvedValue([EQUIPO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);

    renderView();
    await abrirMenuAcciones();

    // El kebab sigue existiendo (MANTENEDOR ve la flota), pero ninguna opción
    // de estado se renderiza — el backend le devolvería 403 en `/status`.
    expect(await screen.findByText('Eliminar')).toBeTruthy();
    expect(screen.queryByText('Marcar como En taller')).toBeNull();
  });

  it.each([
    ['MANTENEDOR', false],
    ['SUPERVISOR', true],
  ])('en la hoja de acciones móvil, %s %s ve los registros de horómetro y combustible', async (rol, ve) => {
    currentUserResult = {
      user: { id: 'u2', name: 'Usuario', email: 'u@smi.local', role: rol },
      role: rol,
      isPending: false,
      isAuthenticated: true,
    };
    listMock.mockResolvedValue([EQUIPO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);

    const { container } = renderView();
    await screen.findByRole('button', { name: `Acciones para ${EQUIPO.internalCode}` });
    fireEvent.click(container.querySelector('button.block.w-full') as HTMLButtonElement);

    expect(await screen.findByRole('button', { name: 'Ver ficha completa' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Registrar entrada' }) !== null).toBe(ve);
    expect(screen.queryByRole('button', { name: 'Registrar combustible' }) !== null).toBe(ve);
  });

  it('elimina el equipo al confirmar el AlertDialog', async () => {
    listMock.mockResolvedValue([EQUIPO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);

    renderView();
    await abrirMenuAcciones();

    fireEvent.click(screen.getByText('Eliminar'));

    const dialogo = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(escrituras('equipment.delete')).toHaveLength(1));
    expect(escrituras('equipment.delete')[0]).toMatchObject({ params: { id: 'eq_1' } });
  });
});

describe('EquiposView — filtros', () => {
  it('manda el texto de búsqueda como filtro `q` a la API', async () => {
    listMock.mockResolvedValue([EQUIPO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);

    renderView();
    // "EX-001" aparece en la tabla (PC) y en la tarjeta equivalente
    // (tablet/celular) — ambas vistas conviven en el DOM en jsdom.
    await screen.findAllByText('EX-001');

    fireEvent.change(screen.getByLabelText('Buscar equipo'), { target: { value: 'EX-001' } });

    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith({ q: 'EX-001' }));
  });

  it('manda la clase elegida como filtro `equipmentClass` a la API', async () => {
    listMock.mockResolvedValue([EQUIPO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);

    renderView();
    // "EX-001" aparece en la tabla (PC) y en la tarjeta equivalente
    // (tablet/celular) — ambas vistas conviven en el DOM en jsdom.
    await screen.findAllByText('EX-001');

    fireEvent.click(screen.getByRole('button', { name: /Clase/ }));
    elegirOpcion('Liviano');

    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith({ equipmentClass: 'LIGHT' }));
  });

  it('manda el estado elegido como filtro `status` a la API', async () => {
    listMock.mockResolvedValue([EQUIPO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);

    renderView();
    // "EX-001" aparece en la tabla (PC) y en la tarjeta equivalente
    // (tablet/celular) — ambas vistas conviven en el DOM en jsdom.
    await screen.findAllByText('EX-001');

    fireEvent.click(screen.getByRole('button', { name: /Estado/ }));
    elegirOpcion('En taller');

    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith({ status: 'IN_WORKSHOP' }));
  });
});

describe('EquiposView — editar equipo', () => {
  it('al limpiar patente y sucursal, el PATCH manda `null` explícito en vez de omitir la clave', async () => {
    // Este es el test que faltaba y dejó pasar el bug original: uno a nivel
    // de tipo (`toEquipmentPayload`) no lo habría detectado, porque el bug
    // estaba en que `EditEquipoModal` reutilizaba el builder de CREAR.
    listMock.mockResolvedValue([EQUIPO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);
    // El equipo ya está homed a `br_1` (activa) — `CamposEquipo` igual la pide
    // por id (ver Fix 2), así que hay que mockear la respuesta.
    branchGetByIdMock.mockResolvedValue(SUCURSAL_ACTIVA);

    renderView();
    await abrirMenuAcciones();
    fireEvent.click(screen.getByText('Editar ficha'));
    await screen.findByText(`Editar ${EQUIPO.internalCode}`);

    fireEvent.change(screen.getByLabelText('Patente (opcional)'), { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: /Sucursal base/ }));
    elegirOpcion('Sin sucursal');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    // Solo viajan los campos tocados, con su valor anterior como precondición.
    await waitFor(() => expect(escrituras('equipment.update')).toHaveLength(1));
    const [edicion] = escrituras('equipment.update');
    expect(edicion).toMatchObject({
      params: { id: 'eq_1' },
      body: { licensePlate: null, homeBranchId: null },
      expected: { licensePlate: 'AB-CD-12', homeBranchId: 'br_1' },
    });
    expect(Object.keys(edicion!.body as object).sort()).toEqual(['homeBranchId', 'licensePlate']);
  });

  it('al elegir un operador y guardar, llama a EquipmentAPI.assign con su id (catálogo, no UserAPI) SIN supervisorId (no cambió)', async () => {
    const OPERADOR = { id: 'op_1', name: 'Pedro Soto' };
    listMock.mockResolvedValue([EQUIPO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);
    operatorListMock.mockResolvedValue([OPERADOR]);

    renderView();
    await abrirMenuAcciones();
    fireEvent.click(screen.getByText('Editar ficha'));
    await screen.findByText(`Editar ${EQUIPO.internalCode}`);

    await abrirPickerOperador();
    // `useOperators({ isActive: true })` resuelve async — la opción recién
    // aparece cuando esa query settlea, así que hay que esperarla.
    await screen.findByRole('option', { name: 'Pedro Soto' });
    elegirOpcion('Pedro Soto');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    // `EQUIPO.supervisor` ya era `null` y el usuario no tocó ese picker — el
    // body PARCIAL (`buildAssignmentDiff`) omite `supervisorId` por completo
    // (no manda `null` de relleno): antes, mandar siempre las dos claves
    // revalidaba de más un campo intacto (ver el fix de "operador inactivo
    // bloquea guardar solo-supervisor" más abajo).
    await waitFor(() => expect(escrituras('equipment.assign')).toHaveLength(1));
    expect(escrituras('equipment.assign')[0]).toMatchObject({
      params: { id: 'eq_1' },
      body: { operatorId: 'op_1' },
      expected: { operatorId: null },
    });
    expect(escrituras('equipment.assign')[0]!.body).toEqual({ operatorId: 'op_1' });
    // El picker de operador sale del catálogo propio (`OperatorAPI.list`,
    // solo activos) — ya no filtra `UserAPI` por `role: 'OPERADOR'` (ese rol
    // no existe más).
    expect(operatorListMock).toHaveBeenCalledWith({ isActive: true });
    expect(userListMock).not.toHaveBeenCalledWith(expect.objectContaining({ role: 'OPERADOR' }));
  });

  // El operador ya asignado se desactivó
  // (no aparece en el catálogo de activos, igual que el test de arriba "el
  // operador asignado hoy sigue visible..."), y el usuario cambia SOLO el
  // supervisor. Antes esto mandaba `operatorId` de todos modos (aunque no
  // cambió) y el backend lo revalidaba con `assertActive`, tirando 409
  // `OPERATOR_INACTIVE` sobre un campo que nadie tocó.
  it('al cambiar SOLO el supervisor con un operador YA inactivo asignado, EquipmentAPI.assign recibe supervisorId SIN operatorId', async () => {
    const EQUIPO_ASIGNADO = {
      ...EQUIPO,
      operator: { id: 'op_inactivo', name: 'Ana Ruiz' },
      supervisor: { id: 'u_sup1', name: 'Luis Vega' },
    };
    listMock.mockResolvedValue([EQUIPO_ASIGNADO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);
    // El catálogo de operadores ACTIVOS ya no trae a Ana Ruiz — se desactivó.
    operatorListMock.mockResolvedValue([]);
    userListMock.mockImplementation((filtros?: { role?: string }) =>
      Promise.resolve(
        filtros?.role === 'SUPERVISOR'
          ? [
              { id: 'u_sup1', name: 'Luis Vega' },
              { id: 'u_sup2', name: 'Marta Ríos' },
            ]
          : [],
      ),
    );

    renderView();
    await abrirMenuAcciones();
    fireEvent.click(screen.getByText('Editar ficha'));
    await screen.findByText(`Editar ${EQUIPO.internalCode}`);

    // No se toca el picker de operador — sigue mostrando "Ana Ruiz" gracias a
    // `currentAssignee` aunque ya no esté en el catálogo de activos.
    const inputOperador = await screen.findByPlaceholderText('Buscar operador…');
    await waitFor(() => expect((inputOperador as HTMLInputElement).value).toBe('Ana Ruiz'));

    fireEvent.click(screen.getByRole('button', { name: /Luis Vega/ }));
    await screen.findByRole('option', { name: 'Marta Ríos' });
    elegirOpcion('Marta Ríos');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(escrituras('equipment.assign')).toHaveLength(1));
    expect(escrituras('equipment.assign')[0]).toMatchObject({
      body: { supervisorId: 'u_sup2' },
      expected: { supervisorId: 'u_sup1' },
    });
    expect(escrituras('equipment.assign')[0]!.body).toEqual({ supervisorId: 'u_sup2' });
  });

  it('el picker de supervisor sigue usando UserAPI (rol SUPERVISOR)', async () => {
    const SUPERVISOR = { id: 'u_sup', name: 'Luis Vega' };
    listMock.mockResolvedValue([EQUIPO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);
    userListMock.mockImplementation((filtros?: { role?: string }) =>
      Promise.resolve(filtros?.role === 'SUPERVISOR' ? [SUPERVISOR] : []),
    );

    renderView();
    await abrirMenuAcciones();
    fireEvent.click(screen.getByText('Editar ficha'));
    await screen.findByText(`Editar ${EQUIPO.internalCode}`);

    // El botón del `<Select>` de supervisor acumula valor + label en su
    // nombre accesible ("Sin supervisor asignado Supervisor a cargo").
    fireEvent.click(screen.getByRole('button', { name: /Supervisor a cargo/ }));
    await screen.findByRole('option', { name: 'Luis Vega' });

    expect(userListMock).toHaveBeenCalledWith({ role: 'SUPERVISOR' });
  });

  it('el operador asignado hoy sigue visible aunque ya esté inactivo, y guardar sin tocarlo no lo desasigna', async () => {
    const EQUIPO_CON_OPERADOR_INACTIVO = { ...EQUIPO, operator: { id: 'op_inactivo', name: 'Ana Ruiz' } };
    listMock.mockResolvedValue([EQUIPO_CON_OPERADOR_INACTIVO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);
    // El catálogo de ACTIVOS ya no trae a Ana Ruiz — se desactivó.
    operatorListMock.mockResolvedValue([]);

    renderView();
    await abrirMenuAcciones();
    fireEvent.click(screen.getByText('Editar ficha'));
    await screen.findByText(`Editar ${EQUIPO.internalCode}`);

    // Sin esto, abrir el form de un equipo cuyo operador pasó a inactivo lo
    // mostraría "sin seleccionar" — y guardar así lo desasignaría en
    // silencio (ver `OperatorPicker#currentAssignee`).
    const input = screen.getByPlaceholderText('Buscar operador…') as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('Ana Ruiz'));

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    // Nada cambió: no se encola ninguna escritura y el operador sigue asignado.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull());
    expect(escrituras('equipment.assign')).toHaveLength(0);
    expect(escrituras('equipment.update')).toHaveLength(0);
  });

  it('al elegir "Sin operador asignado" y guardar, EquipmentAPI.assign recibe operatorId: null', async () => {
    const EQUIPO_CON_OPERADOR = { ...EQUIPO, operator: { id: 'op_1', name: 'Pedro Soto' } };
    listMock.mockResolvedValue([EQUIPO_CON_OPERADOR]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);
    operatorListMock.mockResolvedValue([{ id: 'op_1', name: 'Pedro Soto' }]);

    renderView();
    await abrirMenuAcciones();
    fireEvent.click(screen.getByText('Editar ficha'));
    await screen.findByText(`Editar ${EQUIPO.internalCode}`);

    await abrirPickerOperador();
    elegirOpcion('Sin operador asignado');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    // El supervisor de `EQUIPO_CON_OPERADOR` ya era `null` y no se tocó — el
    // `null` explícito de "liberar operador" viaja igual (sí cambió respecto
    // de `op_1`), pero `supervisorId` se omite (sin cambios).
    await waitFor(() => expect(escrituras('equipment.assign')).toHaveLength(1));
    expect(escrituras('equipment.assign')[0]).toMatchObject({
      body: { operatorId: null },
      expected: { operatorId: 'op_1' },
    });
    expect(escrituras('equipment.assign')[0]!.body).toEqual({ operatorId: null });
  });

  it('sin cambiar nada, guardar la edición no encola ni la edición ni la asignación', async () => {
    listMock.mockResolvedValue([EQUIPO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);

    renderView();
    await abrirMenuAcciones();
    fireEvent.click(screen.getByText('Editar ficha'));
    await screen.findByText(`Editar ${EQUIPO.internalCode}`);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull());
    expect(submitWriteMock).not.toHaveBeenCalled();
  });

  it('un submit de creación sin patente no manda la clave (sigue omitiéndola, no manda null)', async () => {
    listMock.mockResolvedValue([]);
    resumenMock.mockResolvedValue({ total: 0, disponibles: 0, porEstado: { OPERATIONAL: 0, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 } });
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);

    renderView();
    await screen.findByText('No hay equipos que coincidan');

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo equipo' }));

    fireEvent.change(await screen.findByLabelText('Código interno'), { target: { value: 'CM-002' } });
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'Camión' } });
    fireEvent.change(screen.getByLabelText('Marca'), { target: { value: 'Volvo' } });
    fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: 'FMX' } });

    fireEvent.click(screen.getByRole('button', { name: 'Crear equipo' }));

    await waitFor(() => expect(escrituras('equipment.create')).toHaveLength(1));
    const [creacion] = escrituras('equipment.create');
    const payloadEnviado = creacion!.body as Record<string, unknown>;
    expect('licensePlate' in payloadEnviado).toBe(false);
    expect('homeBranchId' in payloadEnviado).toBe(false);
    // El id lo genera el cliente: con él un reenvío no duplica el equipo.
    expect(payloadEnviado.id).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
    // Sin foto elegida, no hay archivo ni `photoKey`.
    expect('photoKey' in payloadEnviado).toBe(false);
    expect(creacion!.files).toBeUndefined();
  });

  // `EquipoPhotoBanner` NO sube la foto al elegirla (sin señal sería imposible): la
  // deja como `File` y viaja como archivo de la escritura, que se sube al sincronizar.
  it('un submit de creación con foto elegida la manda como archivo (no photoKey ni photoUrl en el body)', async () => {
    listMock.mockResolvedValue([]);
    resumenMock.mockResolvedValue({
      total: 0,
      disponibles: 0,
      porEstado: { OPERATIONAL: 0, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 },
    });
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);

    renderView();
    await screen.findByText('No hay equipos que coincidan');

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo equipo' }));

    fireEvent.change(await screen.findByLabelText('Código interno'), { target: { value: 'CM-005' } });
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'Camión' } });
    fireEvent.change(screen.getByLabelText('Marca'), { target: { value: 'Volvo' } });
    fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: 'FMX' } });

    const archivo = new File(['foto'], 'equipo.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"][accept="image/jpeg,image/png,image/webp"]');
    fireEvent.change(input as HTMLInputElement, { target: { files: [archivo] } });

    await screen.findByRole('button', { name: 'Quitar foto' });

    fireEvent.click(screen.getByRole('button', { name: 'Crear equipo' }));

    await waitFor(() => expect(escrituras('equipment.create')).toHaveLength(1));
    const [creacion] = escrituras('equipment.create');
    expect(creacion!.files).toEqual([{ field: 'photoKey', file: archivo }]);
    const payloadEnviado = creacion!.body as Record<string, unknown>;
    expect('photoKey' in payloadEnviado).toBe(false);
    expect('photoUrl' in payloadEnviado).toBe(false);
  });

  // El modal de editar es controlado y queda montado en la fila (no se
  // desmonta al cerrar) — antes, cancelar sin guardar no descartaba los
  // cambios de texto: `values` del `useForm` solo re-sincroniza cuando el
  // `equipo` en sí cambia, no cuando el usuario descarta su propia edición
  // (mismo criterio que `CreateEquipoModal`).
  it('EditEquipoModal descarta los cambios de texto no guardados al cancelar y reabrir', async () => {
    listMock.mockResolvedValue([EQUIPO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);

    renderView();
    await abrirMenuAcciones();
    fireEvent.click(screen.getByText('Editar ficha'));
    await screen.findByText(`Editar ${EQUIPO.internalCode}`);

    fireEvent.change(screen.getByLabelText('Marca'), { target: { value: 'Marca temporal sin guardar' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await abrirMenuAcciones();
    fireEvent.click(screen.getByText('Editar ficha'));
    await screen.findByText(`Editar ${EQUIPO.internalCode}`);

    expect((screen.getByLabelText('Marca') as HTMLInputElement).value).toBe(EQUIPO.brand);
  });

  // Antes la asignación se disparaba con `assignEquipment.mutate(...)` SIN
  // esperar su resultado, y el modal cerraba de inmediato (con el toast de
  // éxito de `updateEquipment` ya mostrado) — si la asignación fallaba (p.
  // ej. el operador perdió el rol → 400 de `assertUserWithRole`), el modal
  // ya había cerrado y el cambio se perdía en silencio.
  it('si la asignación falla al guardar la edición, el modal permanece abierto (no enmascara el error)', async () => {
    const OPERADOR = { id: 'op_1', name: 'Pedro Soto' };
    listMock.mockResolvedValue([EQUIPO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);
    submitWriteMock.mockImplementation(async (endpoint: string) => {
      if (endpoint === 'equipment.assign') throw new DomainError('Ese operador ya no está activo.', { status: 409 });
      return enviado(null);
    });
    operatorListMock.mockResolvedValue([OPERADOR]);

    renderView();
    await abrirMenuAcciones();
    fireEvent.click(screen.getByText('Editar ficha'));
    await screen.findByText(`Editar ${EQUIPO.internalCode}`);

    await abrirPickerOperador();
    await screen.findByRole('option', { name: 'Pedro Soto' });
    elegirOpcion('Pedro Soto');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(escrituras('equipment.assign')).toHaveLength(1));

    // El update sí se guardó, pero el modal no debe cerrarse: si se cerrara
    // acá, el cambio de asignación fallido quedaría enmascarado detrás del
    // toast de éxito del update.
    expect(screen.getByText(`Editar ${EQUIPO.internalCode}`)).toBeTruthy();
  });

  // El modal de crear es controlado y queda montado (no se desmonta al
  // cerrar) — antes, el `reset()` del form y de los pickers vivía SOLO en el
  // `onSuccess` de crear: cancelar sin crear dejaba código/marca/modelo y el
  // operador elegido, y reaparecían "viejos" la próxima vez que se abría.
  it('CreateEquipoModal se resetea al cancelar y reabrir (no arrastra datos de un intento anterior)', async () => {
    listMock.mockResolvedValue([]);
    resumenMock.mockResolvedValue({
      total: 0,
      disponibles: 0,
      porEstado: { OPERATIONAL: 0, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 },
    });
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);

    renderView();
    await screen.findByText('No hay equipos que coincidan');

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo equipo' }));
    fireEvent.change(await screen.findByLabelText('Código interno'), { target: { value: 'TEMP-001' } });
    fireEvent.change(screen.getByLabelText('Marca'), { target: { value: 'Marca temporal' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo equipo' }));

    expect((await screen.findByLabelText('Código interno') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Marca') as HTMLInputElement).value).toBe('');
  });

  it('en edición, si la sucursal asignada quedó inactiva, igual aparece en el selector (marcada)', async () => {
    const SUCURSAL_INACTIVA = {
      id: 'br_inactiva',
      name: 'Sucursal Vieja',
      address: null,
      isActive: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const equipoConSucursalInactiva = { ...EQUIPO, homeBranchId: 'br_inactiva' };

    listMock.mockResolvedValue([equipoConSucursalInactiva]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    // `isActive: true` ya no trae la sucursal del equipo — es justo el caso
    // borde del Fix 2 (pasó a inactiva después de asignarse).
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);
    branchGetByIdMock.mockResolvedValue(SUCURSAL_INACTIVA);

    renderView();
    await abrirMenuAcciones();
    fireEvent.click(screen.getByText('Editar ficha'));
    await screen.findByText(`Editar ${EQUIPO.internalCode}`);

    await waitFor(() => expect(branchGetByIdMock).toHaveBeenCalledWith('br_inactiva'));

    fireEvent.click(screen.getByRole('button', { name: /Sucursal base/ }));

    await waitFor(() => {
      const opciones = screen.getAllByRole('option');
      const inactiva = opciones.find((opcion) => opcion.textContent?.includes('Sucursal Vieja'));
      expect(inactiva?.textContent).toContain('(inactiva)');
    });
  });
});
