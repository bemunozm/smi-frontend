import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { EquipoDetalleView } from './EquipoDetalleView';
import type { EquipmentDetail } from '../types/equipment';

// Rol controlable por test — decide si se monta `AsignacionForm` (acción
// asignar/liberar, gateada a ADMIN/SUPERVISOR igual que `updateStatus` en
// `EquiposView`) y las nuevas acciones de cabecera (Cambiar estado/Editar
// equipo/Eliminar equipo, §1 de la auditoría de fidelidad).
let currentUserResult: {
  user: { id: string; name: string; email: string; role: string };
  role: string;
  isPending: boolean;
  isAuthenticated: boolean;
};

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => currentUserResult,
}));

// Se mockea la capa de API (no el hook) para que las mutaciones corran de
// verdad — mismo criterio que `EquiposView.interactions.test.tsx`: el
// `mutate` real termina llamando a estas funciones, así que verificar sus
// argumentos prueba el flujo completo vista → hook → API.
const { assignMock, updateMock, updateStatusMock, removeMock } = vi.hoisted(() => ({
  assignMock: vi.fn(),
  updateMock: vi.fn(),
  updateStatusMock: vi.fn(),
  removeMock: vi.fn(),
}));

vi.mock('../api/EquipmentAPI', () => ({
  EquipmentAPI: {
    list: vi.fn(),
    resumen: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: updateMock,
    updateStatus: updateStatusMock,
    remove: removeMock,
    assign: assignMock,
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Documentos sin dato — el fixture base representa el caso más común (equipo
// sin R1/R2 cargado todavía); los tests de vigencia
// (`EquipoDetalleView — Vencimientos`) sobrescriben con otros estados.
const SIN_DATO_DOCS = {
  technicalInspection: { expiry: null, status: 'SIN_DATO' as const, daysToExpiry: null },
  insurance: { expiry: null, status: 'SIN_DATO' as const, daysToExpiry: null },
};

const EQUIPO_DETALLE: EquipmentDetail = {
  id: 'eq_1',
  internalCode: 'EX-001',
  licensePlate: null,
  equipmentClass: 'HEAVY' as const,
  type: 'Excavadora',
  brand: 'Caterpillar',
  model: '336',
  year: 2019,
  controlUnit: 'HOURS' as const,
  currentHourmeter: 1200,
  currentMileage: null,
  status: 'OPERATIONAL' as const,
  homeBranchId: null,
  homeBranch: null,
  photoUrl: null,
  technicalInspectionExpiry: null,
  insuranceExpiry: null,
  operator: { id: 'u_op', name: 'Pedro Soto' },
  supervisor: { id: 'u_sup', name: 'Luis Vega' },
  inUse: true,
  currentFuelLevel: 72,
  openShift: null,
  documents: SIN_DATO_DOCS,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  _count: { combustibles: 2, horometros: 3, trabajosExtra: 1, hallazgos: 4, stockMovements: 2 },
  // Shape real de `equipment.service.ts#findOne` (Prisma `stockMovements`,
  // `item: {select: {sku,name,unit}}` — SIN `item.id` ni relaciones extra:
  // eso es justo lo que trae ESTE endpoint, no lo que trae
  // `/api/inventory/movements`. Confirmado contra el backend en vivo
  // 2026-09-14 (ver `EquipmentStockMovement` en `types/equipment.ts`), no
  // es un shape inventado — evita repetir el bug de contrato silencioso.
  stockMovements: [
    {
      id: 'mov_1',
      itemId: 'item_neu',
      branchId: 'br_1',
      direction: 'OUT' as const,
      reason: 'INTERVENTION' as const,
      quantity: 4,
      resultingBalance: 2,
      reference: null,
      documentNumber: null,
      sourceBranchId: null,
      destinationBranchId: null,
      performedById: 'u1',
      equipmentId: 'eq_1',
      notes: 'Consumo en mantención de EX-001',
      occurredAt: '2026-08-01T12:00:00.000Z',
      item: { sku: 'NEU-001', name: 'Neumático 29.5R25', unit: 'UNIT' as const },
    },
    {
      id: 'mov_2',
      itemId: 'item_fil',
      branchId: 'br_1',
      direction: 'OUT' as const,
      reason: 'INTERVENTION' as const,
      quantity: 4,
      resultingBalance: 20,
      reference: null,
      documentNumber: null,
      sourceBranchId: null,
      destinationBranchId: null,
      performedById: 'u1',
      equipmentId: 'eq_1',
      notes: 'Consumo en mantención de EX-001',
      occurredAt: '2026-08-01T11:00:00.000Z',
      item: { sku: 'FIL-002', name: 'Filtro de aire primario', unit: 'UNIT' as const },
    },
  ],
};

const HOROMETROS = [
  // Equipo distinto y más reciente: debe quedar afuera del "último nivel".
  {
    id: 'h_otro',
    equipoId: 'eq_9',
    operador: 'Pedro',
    turno: 'NOCTURNO',
    valorInicial: 10,
    valorFinal: 20,
    nivelCombustible: 10,
    fecha: '2026-08-10T08:00:00.000Z',
    fechaSalida: '2026-08-10T16:00:00.000Z',
    fotoUrlSalida: null,
  },
  {
    id: 'h_viejo',
    equipoId: 'eq_1',
    operador: 'Juan',
    turno: 'DIURNO',
    valorInicial: 1150,
    valorFinal: 1160,
    nivelCombustible: 50,
    fecha: '2026-08-01T08:00:00.000Z',
    fechaSalida: '2026-08-01T16:00:00.000Z',
    fotoUrlSalida: null,
  },
  {
    id: 'h_nuevo',
    equipoId: 'eq_1',
    operador: 'Ana',
    turno: 'DIURNO',
    valorInicial: 1180,
    valorFinal: 1195,
    nivelCombustible: 72,
    fecha: '2026-08-05T08:00:00.000Z',
    // 8h15min de duración real — usado por el test de historial de
    // horómetro (uso 15h vs. duración de reloj distinta).
    fechaSalida: '2026-08-05T16:15:00.000Z',
    fotoUrlSalida: null,
  },
];

const COMBUSTIBLES = [
  {
    id: 'c_1',
    equipoId: 'eq_1',
    litros: 80,
    tipo: 'PETROLEO',
    fotoUrl: null,
    fecha: '2026-08-04T09:00:00.000Z',
  },
];

const FICHA = {
  equipo: {
    id: 'eq_1',
    internalCode: 'EX-001',
    type: 'Excavadora',
    brand: 'Caterpillar',
    model: '336',
    year: 2019,
    status: 'OPERATIONAL',
    currentHourmeter: 1200,
    currentMileage: null,
  },
  resumen: {
    combustibles: 2,
    horometros: 3,
    trabajosExtra: 1,
    hallazgos: 4,
    hallazgosAbiertos: 1,
    ordenes: 0,
    ordenesAbiertas: 0,
    actividades: 0,
  },
  timeline: [
    {
      id: 'ev_1',
      tipo: 'HOROMETRO',
      fecha: '2026-08-05T08:00:00.000Z',
      titulo: 'Lectura de horómetro',
      detalle: 'Turno diurno, registrado por Ana',
      meta: { turno: 'DIURNO', valorInicial: 1180, valorFinal: 1195 },
    },
    {
      id: 'ev_2',
      tipo: 'HALLAZGO',
      fecha: '2026-08-02T10:00:00.000Z',
      titulo: 'Fuga de aceite detectada',
      detalle: 'Reportado por el operador durante el turno',
      meta: { prioridad: 'ALTA', estado: 'ABIERTO' },
    },
  ],
};

// Sin `staleTime: Infinity`, el `QueryClient` por defecto trataría los datos
// sembrados como stale de entrada y dispararía un refetch real contra
// `HorometroAPI`/`CombustibleAPI`/`FichaAPI` (no mockeadas acá) apenas monta
// — mismo motivo documentado en `EquiposView.test.tsx`.
function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
}

function renderFicha(
  seedExtra: (qc: QueryClient) => void = () => {},
  equipo: typeof EQUIPO_DETALLE = EQUIPO_DETALLE,
) {
  const qc = crearQueryClient();
  qc.setQueryData(['equipment', 'eq_1'], equipo);
  qc.setQueryData(['horometro'], HOROMETROS);
  qc.setQueryData(['combustible'], COMBUSTIBLES);
  qc.setQueryData(['ficha', 'eq_1'], FICHA);
  seedExtra(qc);

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/equipos/eq_1']}>
        <Routes>
          <Route element={<EquipoDetalleView />} path="/equipos/:id" />
          {/* Marcador para probar el redirect post-borrado (`onDeleted`) —
             sin ficha real que renderizar, solo confirma que la navegación
             llegó al listado. */}
          <Route element={<p>Listado de equipos</p>} path="/equipos" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EquipoDetalleView', () => {
  it('muestra la cabecera, los KPIs, los datos de la unidad y los consumos', () => {
    currentUserResult = {
      user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
      role: 'ADMIN',
      isPending: false,
      isAuthenticated: true,
    };

    renderFicha();

    // El código aparece en el título mono y en la fila "Código interno".
    expect(screen.getAllByText('EX-001').length).toBe(2);
    // El estado aparece en el chip de la cabecera y en la fila "Estado" de
    // Datos de la unidad — mismo criterio que "EX-001" arriba.
    expect(screen.getAllByText('Operativo').length).toBe(2);

    // KPI hero: uso acumulado. Aparece DOS veces a propósito — también en la
    // fila "Uso acumulado" de "Datos de la unidad" (calca `datosRaw` de
    // `FichaEquipoClientePC.dc.html`, que repite `this.uso(e)` en ambos
    // lugares).
    expect(screen.getAllByText('1.200 h').length).toBe(2);
    // KPI nuevo de Fase 2: combustible actual, ya no solo en la sección de abajo.
    expect(screen.getAllByText('72%').length).toBeGreaterThan(0);
    // Los 4 contadores por dominio que ya traía la ficha se conservan.
    expect(screen.getByText('Hallazgos')).toBeTruthy();
    expect(screen.getByText('Lecturas horómetro')).toBeTruthy();
    expect(screen.getByText('Trabajos extra')).toBeTruthy();
    expect(screen.getByText('Cargas combustible')).toBeTruthy();

    // Datos de la unidad.
    expect(screen.getByText('Caterpillar')).toBeTruthy();
    expect(screen.getByText('336')).toBeTruthy();

    // Combustible: historial de cargas.
    expect(screen.getByText('Petróleo')).toBeTruthy();
    expect(screen.getByText('80 L')).toBeTruthy();

    // Consumos de inventario — lee `stockMovements`/`item` (shape real del
    // backend, Inventario en inglés), no el `movimientos`/`insumo` inventado.
    expect(screen.getByText('Neumático 29.5R25')).toBeTruthy();
    expect(screen.getAllByText('−4').length).toBe(2);

    // Repuestos compatibles: sin API todavía (dominio Compatibilidad) — queda
    // como estado vacío en su lugar del layout, no se inventa data.
    expect(screen.getByText('Repuestos compatibles')).toBeTruthy();
    expect(screen.getByText(/Todavía no hay una API de Compatibilidad/)).toBeTruthy();

    // Actividad reciente: adelanto de la bitácora consolidada de Núcleo
    // (`useFicha`), con link a la ficha completa (`/equipos/:id/ficha`).
    expect(screen.getByText('Lectura de horómetro')).toBeTruthy();
    expect(screen.getByText('Fuga de aceite detectada')).toBeTruthy();
    const linkBitacora = screen.getByRole('link', { name: /Ver bitácora completa/ });
    expect(linkBitacora.getAttribute('href')).toBe('/equipos/eq_1/ficha');

    // Los botones de registro abren el flujo foto→OCR→EXIF (Fase B) — la
    // interacción completa se prueba en los tests dedicados de
    // `RegistrarEntradaModal`/`RegistrarSalidaModal`/`RegistrarCargaCombustibleModal`.
    // Sin `openShift`, el botón de horómetro ofrece "Registrar entrada"
    // (ver la sección "flujo de horómetro" más abajo para "Registrar salida").
    const botonLectura = screen.getByRole('button', { name: 'Registrar entrada' });
    const botonCarga = screen.getByRole('button', { name: 'Registrar carga' });
    expect(botonLectura.hasAttribute('disabled')).toBe(false);
    expect(botonCarga.hasAttribute('disabled')).toBe(false);
  });

  it('muestra operador y supervisor cuando el equipo está en uso', () => {
    currentUserResult = {
      user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
      role: 'ADMIN',
      isPending: false,
      isAuthenticated: true,
    };

    renderFicha();

    expect(screen.getByText('En uso')).toBeTruthy();
    expect(screen.getByText('Pedro Soto')).toBeTruthy();
    expect(screen.getByText('Luis Vega')).toBeTruthy();
  });

  it('muestra "Disponible" cuando el equipo no tiene operador ni supervisor asignado', () => {
    currentUserResult = {
      user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
      role: 'ADMIN',
      isPending: false,
      isAuthenticated: true,
    };

    renderFicha(() => {}, { ...EQUIPO_DETALLE, inUse: false, operator: null, supervisor: null });

    // "Disponible" aparece como título del estado y como chip — calca el
    // artefacto (`usoTitle` + el chip `noEnUso`), ambos con el mismo texto.
    expect(screen.getAllByText('Disponible').length).toBeGreaterThan(0);
    expect(screen.queryByText('Pedro Soto')).toBeNull();
  });

  // Antes "Estado de uso" mostraba SIEMPRE "Disponible" cuando no había
  // asignación, ignorando `equipo.status` — contradecía el listado
  // (`AsignacionCell` en `EquiposView`), que ya distinguía "Disponible" de
  // "Detenido" contra ese mismo status: un equipo fuera de servicio sin
  // asignación decía "Disponible" en la ficha y "Detenido" en el listado
  // (Fix F-ALTA, review adversarial — ver `equipoEstadoUsoLabel` en
  // `flota-colors.ts`, fuente única para ambos lugares).
  it('muestra "Detenido" (no "Disponible") cuando no hay asignación y el equipo no está operativo', () => {
    currentUserResult = {
      user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
      role: 'ADMIN',
      isPending: false,
      isAuthenticated: true,
    };

    renderFicha(() => {}, {
      ...EQUIPO_DETALLE,
      inUse: false,
      operator: null,
      supervisor: null,
      status: 'OUT_OF_SERVICE',
    });

    // "Detenido" aparece como título del estado y como chip — mismo criterio
    // que el test de "Disponible" de arriba (ambos con el mismo texto).
    expect(screen.getAllByText('Detenido').length).toBeGreaterThan(0);
    expect(screen.queryByText('Disponible')).toBeNull();
  });

  it('oculta la acción de asignar/liberar para roles sin permiso (MANTENEDOR)', () => {
    currentUserResult = {
      user: { id: 'u2', name: 'Mantenedor SMI', email: 'mantenedor@smi.local', role: 'MANTENEDOR' },
      role: 'MANTENEDOR',
      isPending: false,
      isAuthenticated: true,
    };

    renderFicha();

    // El backend gatilla `PATCH /equipment/:id/assignment` a ADMIN/SUPERVISOR
    // — MANTENEDOR ve la asignación actual (lectura) pero no el formulario.
    expect(screen.getByText('Pedro Soto')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Liberar' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Guardar asignación/ })).toBeNull();
  });

  it('libera la asignación (operador y supervisor a null) para un rol con permiso', async () => {
    currentUserResult = {
      user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
      role: 'ADMIN',
      isPending: false,
      isAuthenticated: true,
    };
    assignMock.mockResolvedValue({ ...EQUIPO_DETALLE, inUse: false, operator: null, supervisor: null });

    renderFicha((qc) => {
      // Pickers de operador/supervisor — mismas keys que `useUsers({ role })`.
      qc.setQueryData(['users', { role: 'OPERADOR' }], [{ id: 'u_op', name: 'Pedro Soto' }]);
      qc.setQueryData(['users', { role: 'SUPERVISOR' }], [{ id: 'u_sup', name: 'Luis Vega' }]);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Liberar' }));

    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith('eq_1', { operatorId: null, supervisorId: null }),
    );
  });

  // Antes "Liberar" limpiaba los pickers a "Sin asignar" ANTES de que la
  // mutación resolviera; si fallaba, `onError` de `useAssignEquipment` solo
  // toastea (no invalida), así que los pickers quedaban mostrando "Sin
  // asignar" aunque el server mantuviera la asignación (Fix 3, review QA).
  it('si "Liberar" falla, los pickers siguen mostrando la asignación real (no se limpian de forma optimista)', async () => {
    currentUserResult = {
      user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
      role: 'ADMIN',
      isPending: false,
      isAuthenticated: true,
    };
    assignMock.mockRejectedValue(new Error('No se pudo liberar la asignación.'));

    renderFicha((qc) => {
      qc.setQueryData(['users', { role: 'OPERADOR' }], [{ id: 'u_op', name: 'Pedro Soto' }]);
      qc.setQueryData(['users', { role: 'SUPERVISOR' }], [{ id: 'u_sup', name: 'Luis Vega' }]);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Liberar' }));

    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith('eq_1', { operatorId: null, supervisorId: null }),
    );

    // El botón del Select acumula valor + label en su nombre accesible
    // (mismo criterio que `EquiposView.interactions.test.tsx`).
    expect(screen.getByRole('button', { name: /Pedro Soto/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Luis Vega/ })).toBeTruthy();
  });

  // Antes esto se decidía leyendo `inUse` (que el backend deriva de
  // `!!operator`): un equipo con supervisor asignado pero SIN operador
  // mostraba "Disponible" y el supervisor desaparecía de la ficha, aunque el
  // picker de editar lo mostraba preseleccionado (Fix 4, review QA).
  it('muestra al supervisor aunque no haya operador asignado (no depende solo de "inUse")', () => {
    currentUserResult = {
      user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
      role: 'ADMIN',
      isPending: false,
      isAuthenticated: true,
    };

    renderFicha(() => {}, { ...EQUIPO_DETALLE, inUse: false, operator: null });

    expect(screen.getByText('Supervisado')).toBeTruthy();
    expect(screen.getByText('Luis Vega')).toBeTruthy();
    expect(screen.queryByText('Disponible')).toBeNull();
  });
});

// Acciones nuevas de la cabecera (auditoría de fidelidad Flota/Equipos §1):
// Cambiar estado, Editar equipo, Eliminar equipo — antes solo existía
// "Registrar lectura". Reusan los mismos hooks/mutaciones que `EquiposView`
// (`useUpdateEquipmentStatus`, `EditEquipoModal`, `DeleteEquipoAlertDialog`
// importados de `components/flota/EquipoEditDelete`).
describe('EquipoDetalleView — acciones de cabecera', () => {
  it('cambia el estado desde el dropdown "Cambiar estado" (rol con permiso)', async () => {
    currentUserResult = {
      user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
      role: 'ADMIN',
      isPending: false,
      isAuthenticated: true,
    };
    updateStatusMock.mockResolvedValue({ ...EQUIPO_DETALLE, status: 'IN_WORKSHOP' });

    renderFicha();

    fireEvent.click(screen.getByRole('button', { name: /Cambiar estado/ }));
    fireEvent.click(await screen.findByText('En taller'));

    await waitFor(() => expect(updateStatusMock).toHaveBeenCalledWith('eq_1', 'IN_WORKSHOP'));
  });

  it('deshabilita el estado actual (Operativo) en vez de ocultarlo', async () => {
    currentUserResult = {
      user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
      role: 'ADMIN',
      isPending: false,
      isAuthenticated: true,
    };

    renderFicha();
    fireEvent.click(screen.getByRole('button', { name: /Cambiar estado/ }));

    const opcionActual = await screen.findByRole('menuitem', { name: 'Operativo' });
    expect(opcionActual.getAttribute('aria-disabled')).toBe('true');
  });

  it('oculta "Cambiar estado", "Editar equipo" y "Eliminar equipo" para MANTENEDOR', () => {
    currentUserResult = {
      user: { id: 'u2', name: 'Mantenedor SMI', email: 'mantenedor@smi.local', role: 'MANTENEDOR' },
      role: 'MANTENEDOR',
      isPending: false,
      isAuthenticated: true,
    };

    renderFicha();

    expect(screen.queryByRole('button', { name: /Cambiar estado/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar equipo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Eliminar equipo' })).toBeNull();
    // El botón de horómetro sigue disponible para todos los roles.
    expect(screen.getByRole('button', { name: 'Registrar entrada' })).toBeTruthy();
  });

  it('abre el modal de editar con los datos del equipo precargados', async () => {
    currentUserResult = {
      user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
      role: 'ADMIN',
      isPending: false,
      isAuthenticated: true,
    };

    renderFicha();

    fireEvent.click(screen.getByRole('button', { name: 'Editar equipo' }));

    await screen.findByText('Editar EX-001');
    expect((screen.getByLabelText('Marca') as HTMLInputElement).value).toBe('Caterpillar');
    expect((screen.getByLabelText('Modelo') as HTMLInputElement).value).toBe('336');
  });

  it('elimina el equipo al confirmar el AlertDialog y vuelve al listado', async () => {
    currentUserResult = {
      user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
      role: 'ADMIN',
      isPending: false,
      isAuthenticated: true,
    };
    removeMock.mockResolvedValue({ id: 'eq_1' });

    renderFicha();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar equipo' }));

    const dialogo = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('eq_1'));
    // Tras borrar, `onDeleted` navega de vuelta a `/equipos` — la unidad que
    // se estaba viendo ya no existe, así que la ficha no puede quedarse
    // montada (`useEquipmentDetail` refetchearía un 404).
    await screen.findByText('Listado de equipos');
  });
});

// Flujo de horómetro en dos pasos (ENTRADA/SALIDA): la acción del header y el
// modal que se monta dependen de `equipo.openShift` — `null` ofrece
// "Registrar entrada" (`RegistrarEntradaModal`), un turno abierto ofrece
// "Registrar salida" (`RegistrarSalidaModal`, con el contexto de la entrada).
describe('EquipoDetalleView — flujo de horómetro (entrada/salida)', () => {
  const OPEN_SHIFT = {
    id: 'h_abierto',
    valorInicial: 1200,
    operador: 'Carlos Núñez',
    turno: 'NOCTURNO',
    fecha: '2026-08-06T20:00:00.000Z',
  };

  it('sin turno abierto: ofrece "Registrar entrada" y no muestra el banner de turno en curso', () => {
    currentUserResult = {
      user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
      role: 'ADMIN',
      isPending: false,
      isAuthenticated: true,
    };

    renderFicha();

    expect(screen.getByRole('button', { name: 'Registrar entrada' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Registrar salida' })).toBeNull();
    expect(screen.queryByText('Turno en curso · Nocturno')).toBeNull();
  });

  it('con turno abierto: ofrece "Registrar salida" y muestra el banner con operador, lectura inicial y desde cuándo', () => {
    currentUserResult = {
      user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
      role: 'ADMIN',
      isPending: false,
      isAuthenticated: true,
    };

    renderFicha(() => {}, { ...EQUIPO_DETALLE, openShift: OPEN_SHIFT });

    expect(screen.getByRole('button', { name: 'Registrar salida' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Registrar entrada' })).toBeNull();
    expect(screen.getByText('Turno en curso · Nocturno')).toBeTruthy();
    expect(screen.getByText('Carlos Núñez')).toBeTruthy();
    // La lectura inicial del banner aparece formateada con separador de
    // miles — `getAllByText` porque "1.200 h" (el mismo valor de
    // `currentHourmeter`) también aparece en el KPI hero y en "Datos de la
    // unidad" (ver el primer test del describe de arriba).
    expect(screen.getAllByText(/1\.200 h/).length).toBeGreaterThan(0);
  });

  it('abre RegistrarSalidaModal (no RegistrarEntradaModal) al hacer clic en "Registrar salida"', async () => {
    currentUserResult = {
      user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
      role: 'ADMIN',
      isPending: false,
      isAuthenticated: true,
    };

    renderFicha(() => {}, { ...EQUIPO_DETALLE, openShift: OPEN_SHIFT });

    fireEvent.click(screen.getByRole('button', { name: 'Registrar salida' }));

    // El modal de salida titula "Registrar salida" y muestra el contexto de
    // la entrada ("Turno abierto", dentro del modal — distinto del banner
    // "Turno en curso" de la ficha, que sigue de fondo) — confirma que se
    // montó `RegistrarSalidaModal`, no `RegistrarEntradaModal`.
    await screen.findByText('Registrar salida · EX-001');
    expect(screen.getByText('Turno abierto')).toBeTruthy();
  });

  it('el historial de horómetro muestra el uso (valorFinal − valorInicial) y la duración real de un turno cerrado', () => {
    currentUserResult = {
      user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
      role: 'ADMIN',
      isPending: false,
      isAuthenticated: true,
    };

    renderFicha();

    // `h_nuevo`: valorInicial 1180, valorFinal 1195 → uso 15h. Entrada
    // 08:00, salida 16:15 → duración real 8h 15min (distinta del uso en
    // horas-máquina a propósito, para no confundir ambas medidas).
    expect(screen.getByText('15 h')).toBeTruthy();
    expect(screen.getByText('8 h 15 min')).toBeTruthy();
  });

  it('el historial de horómetro muestra "En curso" para el turno todavía abierto', () => {
    currentUserResult = {
      user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
      role: 'ADMIN',
      isPending: false,
      isAuthenticated: true,
    };

    renderFicha((qc) => {
      qc.setQueryData(
        ['horometro'],
        [
          ...HOROMETROS,
          {
            id: 'h_abierto',
            equipoId: 'eq_1',
            operador: 'Carlos Núñez',
            turno: 'NOCTURNO',
            valorInicial: 1200,
            valorFinal: null,
            nivelCombustible: null,
            fecha: '2026-08-06T20:00:00.000Z',
            fechaSalida: null,
            fotoUrlSalida: null,
          },
        ],
      );
    }, { ...EQUIPO_DETALLE, openShift: OPEN_SHIFT });

    expect(screen.getAllByText('En curso').length).toBeGreaterThan(0);
  });
});

// R1/R2 — bloque "Vencimientos": chip de vigencia con el tono/label correcto
// por cada `status` que puede devolver el backend, y la caption con
// `daysToExpiry`.
describe('EquipoDetalleView — Vencimientos (R1/R2)', () => {
  // `beforeEach` (no una asignación directa en el cuerpo del `describe`,
  // que corre en la fase de COLECCIÓN de Vitest, antes de que cualquier test
  // se ejecute): así cada `it` de este bloque arranca con el rol correcto
  // sin importar el orden en que Vitest recolecte los `describe` del archivo.
  beforeEach(() => {
    currentUserResult = {
      user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
      role: 'ADMIN',
      isPending: false,
      isAuthenticated: true,
    };
  });

  it('VIGENTE: chip verde con "Vigente" y la caption "Vence en N días"', () => {
    renderFicha(() => {}, {
      ...EQUIPO_DETALLE,
      documents: {
        ...SIN_DATO_DOCS,
        technicalInspection: {
          expiry: '2026-12-01T00:00:00.000Z',
          status: 'VIGENTE' as const,
          daysToExpiry: 71,
        },
      },
    });

    expect(screen.getByText('Vigente')).toBeTruthy();
    expect(screen.getByText('Vence en 71 días')).toBeTruthy();
  });

  it('POR_VENCER: chip ámbar con "Por vencer"', () => {
    renderFicha(() => {}, {
      ...EQUIPO_DETALLE,
      documents: {
        ...SIN_DATO_DOCS,
        insurance: { expiry: '2026-10-05T00:00:00.000Z', status: 'POR_VENCER' as const, daysToExpiry: 12 },
      },
    });

    expect(screen.getByText('Por vencer')).toBeTruthy();
    expect(screen.getByText('Vence en 12 días')).toBeTruthy();
  });

  it('VENCIDO: chip rojo con "Vencido" y la caption "Vencido hace N días"', () => {
    renderFicha(() => {}, {
      ...EQUIPO_DETALLE,
      documents: {
        ...SIN_DATO_DOCS,
        technicalInspection: { expiry: '2026-08-01T00:00:00.000Z', status: 'VENCIDO' as const, daysToExpiry: -5 },
      },
    });

    expect(screen.getByText('Vencido')).toBeTruthy();
    expect(screen.getByText('Vencido hace 5 días')).toBeTruthy();
  });

  it('SIN_DATO: chip neutro con "Sin dato" y "Sin registro" en vez de una fecha', () => {
    renderFicha();

    // El fixture base (`EQUIPO_DETALLE`) ya trae ambos documentos SIN_DATO.
    // "Sin registro" aparece una sola vez por documento (en el lugar de la
    // fecha) — sin caption redundante debajo cuando no hay dato cargado.
    expect(screen.getAllByText('Sin dato').length).toBe(2);
    expect(screen.getAllByText('Sin registro').length).toBe(2);
  });

  it('muestra las dos filas con sus labels ("Revisión técnica" y "Seguro")', () => {
    renderFicha();

    expect(screen.getByText('Revisión técnica')).toBeTruthy();
    expect(screen.getByText('Seguro')).toBeTruthy();
    expect(screen.getByText('Vencimientos')).toBeTruthy();
  });
});

// R3 — vista diferenciada por clase: la ficha (header) también consume el
// helper central `equipoIdentidad` (mismo criterio que el listado).
describe('EquipoDetalleView — R3 identidad por clase', () => {
  beforeEach(() => {
    currentUserResult = {
      user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
      role: 'ADMIN',
      isPending: false,
      isAuthenticated: true,
    };
  });

  it('equipo PESADO con patente: la muestra destacada en el header', () => {
    renderFicha(() => {}, { ...EQUIPO_DETALLE, equipmentClass: 'HEAVY', licensePlate: 'AB-CD-12' });

    // Aparece dos veces a propósito: el badge destacado del header (R3) y la
    // fila "Patente" de "Datos de la unidad" (ya existía antes de R3).
    expect(screen.getAllByText('AB-CD-12').length).toBe(2);
    // Marca/modelo se sigue mostrando en el subtítulo, aparte de la patente.
    expect(screen.getByText(/Caterpillar 336/)).toBeTruthy();
  });

  it('equipo LIVIANO con patente: el subtítulo muestra patente + marca + modelo juntos', () => {
    renderFicha(() => {}, { ...EQUIPO_DETALLE, equipmentClass: 'LIGHT', licensePlate: 'XY-12-34' });

    expect(screen.getByText(/XY-12-34 · Caterpillar 336/)).toBeTruthy();
  });

  it('equipo PESADO sin patente: no deja un hueco vacío — el código interno del título sigue siendo el identificador', () => {
    renderFicha(() => {}, { ...EQUIPO_DETALLE, equipmentClass: 'HEAVY', licensePlate: null });

    expect(screen.getAllByText('EX-001').length).toBeGreaterThan(0);
    expect(screen.getByText(/Caterpillar 336/)).toBeTruthy();
  });
});

// R1/R2 — el form de editar (`EditEquipoModal` → `CamposEquipo`) precarga y
// envía los 2 vencimientos, y permite limpiarlos.
describe('EquipoDetalleView — form de documentos (R1/R2)', () => {
  beforeEach(() => {
    currentUserResult = {
      user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
      role: 'ADMIN',
      isPending: false,
      isAuthenticated: true,
    };
  });

  it('precarga los 2 vencimientos en el form de editar, convertidos a `YYYY-MM-DD`', async () => {
    renderFicha(() => {}, {
      ...EQUIPO_DETALLE,
      technicalInspectionExpiry: '2026-12-01T00:00:00.000Z',
      insuranceExpiry: '2027-01-15T00:00:00.000Z',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Editar equipo' }));
    await screen.findByText('Editar EX-001');

    expect((screen.getByLabelText('Vencimiento revisión técnica (opcional)') as HTMLInputElement).value).toBe(
      '2026-12-01',
    );
    expect((screen.getByLabelText('Vencimiento seguro (opcional)') as HTMLInputElement).value).toBe('2027-01-15');
  });

  it('precarga el form vacío cuando el equipo no tiene vencimientos cargados', async () => {
    renderFicha();

    fireEvent.click(screen.getByRole('button', { name: 'Editar equipo' }));
    await screen.findByText('Editar EX-001');

    expect((screen.getByLabelText('Vencimiento revisión técnica (opcional)') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Vencimiento seguro (opcional)') as HTMLInputElement).value).toBe('');
  });

  it('al cargar una fecha y guardar, el PATCH manda el vencimiento informado', async () => {
    updateMock.mockResolvedValue(EQUIPO_DETALLE);

    renderFicha();

    fireEvent.click(screen.getByRole('button', { name: 'Editar equipo' }));
    await screen.findByText('Editar EX-001');

    fireEvent.change(screen.getByLabelText('Vencimiento revisión técnica (opcional)'), {
      target: { value: '2026-12-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith(
        'eq_1',
        expect.objectContaining({ technicalInspectionExpiry: '2026-12-01' }),
      ),
    );
  });

  it('al limpiar una fecha ya cargada y guardar, el PATCH manda `null` explícito (no omite la clave)', async () => {
    updateMock.mockResolvedValue(EQUIPO_DETALLE);

    renderFicha(() => {}, { ...EQUIPO_DETALLE, insuranceExpiry: '2027-01-15T00:00:00.000Z' });

    fireEvent.click(screen.getByRole('button', { name: 'Editar equipo' }));
    await screen.findByText('Editar EX-001');

    expect((screen.getByLabelText('Vencimiento seguro (opcional)') as HTMLInputElement).value).toBe('2027-01-15');

    fireEvent.change(screen.getByLabelText('Vencimiento seguro (opcional)'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith('eq_1', expect.objectContaining({ insuranceExpiry: null })),
    );
  });
});
