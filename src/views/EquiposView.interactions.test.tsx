import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { EquiposView } from './EquiposView';

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
const { listMock, resumenMock, createMock, updateMock, updateStatusMock, removeMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  resumenMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  updateStatusMock: vi.fn(),
  removeMock: vi.fn(),
}));

vi.mock('../api/EquipmentAPI', () => ({
  EquipmentAPI: {
    list: listMock,
    resumen: resumenMock,
    getById: vi.fn(),
    create: createMock,
    update: updateMock,
    updateStatus: updateStatusMock,
    remove: removeMock,
  },
}));

// Idem para Branch: `CamposEquipo` usa `useBranches`/`useBranch` reales — se
// mockea `BranchAPI` para controlar qué sucursales existen (activas vs. la
// asignada al equipo, que puede estar inactiva — ver Fix 2).
const { branchListMock, branchGetByIdMock } = vi.hoisted(() => ({
  branchListMock: vi.fn(),
  branchGetByIdMock: vi.fn(),
}));

vi.mock('../api/BranchAPI', () => ({
  BranchAPI: {
    list: branchListMock,
    getById: branchGetByIdMock,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

const ADMIN = {
  user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
  role: 'ADMIN',
  isPending: false,
  isAuthenticated: true,
};

beforeEach(() => {
  currentUserResult = ADMIN;
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

describe('EquiposView — menú de acciones', () => {
  it('cambia el estado del equipo al elegir "Marcar como…"', async () => {
    listMock.mockResolvedValue([EQUIPO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);

    renderView();
    await abrirMenuAcciones();

    fireEvent.click(await screen.findByText('Marcar como En taller'));

    await waitFor(() => expect(updateStatusMock).toHaveBeenCalledWith('eq_1', 'IN_WORKSHOP'));
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

  it('elimina el equipo al confirmar el AlertDialog', async () => {
    listMock.mockResolvedValue([EQUIPO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);

    renderView();
    await abrirMenuAcciones();

    fireEvent.click(screen.getByText('Eliminar'));

    const dialogo = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('eq_1'));
  });
});

describe('EquiposView — filtros', () => {
  it('manda el texto de búsqueda como filtro `q` a la API', async () => {
    listMock.mockResolvedValue([EQUIPO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);

    renderView();
    await screen.findByText('EX-001');

    fireEvent.change(screen.getByLabelText('Buscar equipo'), { target: { value: 'EX-001' } });

    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith({ q: 'EX-001' }));
  });

  it('manda la clase elegida como filtro `equipmentClass` a la API', async () => {
    listMock.mockResolvedValue([EQUIPO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);

    renderView();
    await screen.findByText('EX-001');

    fireEvent.click(screen.getByRole('button', { name: /Clase/ }));
    elegirOpcion('Liviano');

    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith({ equipmentClass: 'LIGHT' }));
  });

  it('manda el estado elegido como filtro `status` a la API', async () => {
    listMock.mockResolvedValue([EQUIPO]);
    resumenMock.mockResolvedValue(RESUMEN_VACIO);
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);

    renderView();
    await screen.findByText('EX-001');

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
    updateMock.mockResolvedValue({ ...EQUIPO, licensePlate: null, homeBranchId: null });

    renderView();
    await abrirMenuAcciones();
    fireEvent.click(screen.getByText('Editar ficha'));
    await screen.findByText(`Editar ${EQUIPO.internalCode}`);

    fireEvent.change(screen.getByLabelText('Patente (opcional)'), { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: /Sucursal base/ }));
    elegirOpcion('Sin sucursal');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith(
        'eq_1',
        expect.objectContaining({ licensePlate: null, homeBranchId: null }),
      ),
    );
  });

  it('un submit de creación sin patente no manda la clave (sigue omitiéndola, no manda null)', async () => {
    listMock.mockResolvedValue([]);
    resumenMock.mockResolvedValue({ total: 0, disponibles: 0, porEstado: { OPERATIONAL: 0, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 } });
    branchListMock.mockResolvedValue([SUCURSAL_ACTIVA]);
    createMock.mockResolvedValue(EQUIPO);

    renderView();
    await screen.findByText('No hay equipos que coincidan');

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo equipo' }));

    fireEvent.change(await screen.findByLabelText('Código interno'), { target: { value: 'CM-002' } });
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'Camión' } });
    fireEvent.change(screen.getByLabelText('Marca'), { target: { value: 'Volvo' } });
    fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: 'FMX' } });

    fireEvent.click(screen.getByRole('button', { name: 'Crear equipo' }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    const payloadEnviado = createMock.mock.calls[0][0] as Record<string, unknown>;
    expect('licensePlate' in payloadEnviado).toBe(false);
    expect('homeBranchId' in payloadEnviado).toBe(false);
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
