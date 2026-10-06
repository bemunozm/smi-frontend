import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { OrdenTrabajo } from '../types/mantenimiento';

function orden(overrides: Partial<OrdenTrabajo>): OrdenTrabajo {
  return {
    id: 'ot-x',
    equipoId: 'EX-014',
    hallazgoId: null,
    titulo: 'Sin título',
    estado: 'PENDIENTE',
    prioridad: 'MEDIA',
    tipo: 'CORRECTIVA',
    origen: 'HALLAZGO',
    origenDetalle: null,
    asignadoA: null,
    tareas: [],
    createdAt: '2026-10-05T07:50:00.000Z',
    updatedAt: '2026-10-05T07:50:00.000Z',
    ...overrides,
  };
}

const ORDENES: OrdenTrabajo[] = [
  orden({
    id: 'ot-1',
    titulo: 'Fuga de aceite hidráulico en pluma',
    estado: 'PENDIENTE',
    prioridad: 'CRITICA',
    origenDetalle: 'J. Soto · Operador',
  }),
  orden({
    id: 'ot-2',
    equipoId: 'CM-007',
    hallazgoId: null,
    titulo: 'Cambio de aceite motor y filtro',
    estado: 'EN_PROCESO',
    tipo: 'PREVENTIVA',
    origen: 'MANUAL',
  }),
  orden({
    id: 'ot-3',
    equipoId: 'RE-003',
    hallazgoId: null,
    titulo: 'Engrase general y cambio de pernos',
    estado: 'COMPLETADA',
    tipo: 'PREVENTIVA',
    origen: 'PREVENTIVO',
  }),
  // Preventiva asignada por el administrador, esperando en la bandeja.
  orden({
    id: 'ot-4',
    titulo: 'Mantención 500 h — filtros y aceite',
    estado: 'PENDIENTE',
    tipo: 'PREVENTIVA',
    origen: 'PREVENTIVO',
    origenDetalle: null,
  }),
];

const EQUIPMENT = [
  { id: 'eq-1', internalCode: 'EX-014', brand: 'CAT', model: '320' },
  { id: 'eq-2', internalCode: 'CM-007', brand: 'Volvo', model: 'FMX' },
  { id: 'eq-3', internalCode: 'RE-003', brand: 'CAT', model: '416' },
];

// Hallazgo REAL de Terreno (del supervisor), todavía sin operación.
const HALLAZGOS = [
  {
    id: 'h-1',
    equipoId: 'eq-2',
    descripcion: 'Ruido anormal en la transmisión',
    prioridad: 'ALTA',
    estado: 'ABIERTO',
    fotoUrl: null,
    fecha: '2026-10-06T07:50:00.000Z',
    equipo: { internalCode: 'CM-007' },
  },
  // CERRADO: no debe aparecer en la bandeja.
  {
    id: 'h-2',
    equipoId: 'eq-1',
    descripcion: 'Vidrio trizado',
    prioridad: 'BAJA',
    estado: 'CERRADO',
    fotoUrl: null,
    fecha: '2026-10-01T07:50:00.000Z',
    equipo: { internalCode: 'EX-014' },
  },
  // ABIERTO pero SIN equipo asociado: al mantenedor solo le llegan hallazgos
  // de un equipo concreto — este no entra a la bandeja.
  {
    id: 'h-3',
    equipoId: '',
    descripcion: 'Observación general sin equipo',
    prioridad: 'MEDIA',
    estado: 'ABIERTO',
    fotoUrl: null,
    fecha: '2026-10-06T08:00:00.000Z',
  },
];

// Permisos como los resuelve `lib/permissions` para cada rol (espejo del
// backend): el MANTENEDOR también crea órdenes (inicia operaciones desde los
// hallazgos de su bandeja); el POST de intervenciones sigue siendo solo suyo.
const CAN_MANTENEDOR = new Set([
  'orden.create',
  'orden.update',
  'orden.toggleTarea',
  'intervencion.create',
]);
const CAN_ADMIN = new Set([
  'orden.create',
  'orden.update',
  'orden.toggleTarea',
  'intervencion.create',
]);
// Un rol hipotético sin el POST de intervenciones (hoy ninguno con acceso a la
// ruta, pero el gating debe seguir espejando `WRITE_ROLES`).
const CAN_SOLO_LECTOR = new Set(['orden.update']);
let allowed: ReadonlySet<string> = CAN_MANTENEDOR;

vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({
    role: null,
    can: (action: string) => allowed.has(action),
    canAny: (actions: readonly string[]) => actions.some((action) => allowed.has(action)),
    canCloseShiftCardFromFleet: false,
  }),
}));

let marcaDeMock: (entity: string, id: string) => 'pendiente' | 'atencion' | null = () => null;

vi.mock('../hooks/usePendingWrites', () => ({
  usePendingWrites: () => ({
    ops: [],
    pendientes: 0,
    atencion: 0,
    marcaDe: (entity: string, id: string) => marcaDeMock(entity, id),
  }),
}));

vi.mock('../components/sync/PendientesStrip', () => ({
  PendientesStrip: () => null,
}));

vi.mock('../hooks/useOrdenes', () => ({
  useOrdenes: () => ({ data: ORDENES, isPending: false, isError: false, error: null }),
  useCrearOrden: () => ({ mutate: vi.fn(), isPending: false }),
  useActualizarOrden: () => ({ mutate: vi.fn(), isPending: false }),
  useLogOperation: () => ({ mutate: vi.fn(), isPending: false }),
  useToggleTarea: () => ({ mutate: vi.fn(), isPending: false }),
  useOrden: () => ({ data: undefined }),
}));

vi.mock('../hooks/useEquipment', () => ({
  useEquipment: () => ({ data: EQUIPMENT, isPending: false }),
}));

let hallazgosResult: { data: typeof HALLAZGOS | undefined; isPending: boolean; isError: boolean } = {
  data: HALLAZGOS,
  isPending: false,
  isError: false,
};

vi.mock('../hooks/useHallazgos', () => ({
  useHallazgosList: () => hallazgosResult,
}));

vi.mock('../hooks/useBranches', () => ({
  useBranches: () => ({ data: [{ id: 'br-1', name: 'Casa Matriz' }], isPending: false }),
}));

vi.mock('../hooks/useInventory', () => ({
  useItems: () => ({ data: [], isPending: false }),
}));

vi.mock('../hooks/useIntervenciones', () => ({
  useIntervenciones: () => ({ data: [], isPending: false, isError: false }),
  useFinishTask: () => ({ mutate: vi.fn(), isPending: false }),
  useCrearIntervencion: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { OrdenesTrabajoView } from './OrdenesTrabajoView';

afterEach(() => {
  cleanup();
  allowed = CAN_MANTENEDOR;
  marcaDeMock = () => null;
  hallazgosResult = { data: HALLAZGOS, isPending: false, isError: false };
});

function renderView() {
  return render(
    <MemoryRouter>
      <OrdenesTrabajoView />
    </MemoryRouter>,
  );
}

describe('OrdenesTrabajoView (tablero del taller)', () => {
  it('en tablet las TRES columnas siguen en pantalla (grid desde md)', () => {
    renderView();
    const board = screen.getByRole('region', { name: 'Órdenes' }).parentElement;
    expect(board?.className).toContain('md:grid-cols-3');
    // Y los KPI pasan a fila de 4 desde tablet, como el artboard.
    const kpis = screen.getByText('Hallazgos pendientes').closest('.grid');
    expect(kpis?.className).toContain('md:grid-cols-4');
  });

  it('reparte las órdenes en las tres columnas del tablero', () => {
    renderView();

    const backlog = screen.getByRole('region', { name: 'Órdenes' });
    const inProgress = screen.getByRole('region', { name: 'Operaciones en proceso' });
    const finished = screen.getByRole('region', { name: 'Finalizadas' });

    expect(within(backlog).getByText('Fuga de aceite hidráulico en pluma')).toBeTruthy();
    expect(within(inProgress).getByText('Cambio de aceite motor y filtro')).toBeTruthy();
    expect(within(finished).getByText('Engrase general y cambio de pernos')).toBeTruthy();
  });

  it('los hallazgos REALES abiertos llegan a la bandeja, diferenciados; los cerrados no', () => {
    renderView();

    const backlog = screen.getByRole('region', { name: 'Órdenes' });
    // El hallazgo real del supervisor, con su chip diferenciador.
    expect(within(backlog).getByText('Ruido anormal en la transmisión')).toBeTruthy();
    expect(within(backlog).getAllByText('Hallazgo').length).toBeGreaterThan(0);
    // El cerrado no vuelve a la bandeja.
    expect(screen.queryByText('Vidrio trizado')).toBeNull();
    // Y uno sin equipo asociado tampoco llega al mantenedor.
    expect(screen.queryByText('Observación general sin equipo')).toBeNull();
  });

  it('una preventiva pendiente se distingue con su propio chip', () => {
    renderView();
    const backlog = screen.getByRole('region', { name: 'Órdenes' });
    expect(within(backlog).getByText('Preventiva')).toBeTruthy();
  });

  it('cada chip lleva SU color real como clase (mitigación del bug de Chip de HeroUI v3.2.3)', () => {
    // El Chip de HeroUI comparte estado entre instancias (ver StatusChip.tsx):
    // todos pueden terminar del color del último calculado. Acá se fija que
    // cada chip del tablero lleve su token directo, inmune a ese bug.
    renderView();

    expect(screen.getAllByText('Hallazgo')[0].closest('span')?.className).toContain(
      'bg-danger-soft',
    );
    expect(screen.getByText('Crítica').closest('span')?.className).toContain('bg-danger-soft');
    expect(screen.getByText('Alta').closest('span')?.className).toContain('bg-warning-soft');
    expect(screen.getByText('Media').closest('span')?.className).toContain('bg-accent-soft');
    // 'Preventiva' también existe como chip de TIPO en otras columnas — acá
    // se verifica el de la bandeja.
    const backlog = screen.getByRole('region', { name: 'Órdenes' });
    expect(within(backlog).getByText('Preventiva').closest('span')?.className).toContain(
      'bg-accent-soft',
    );
  });

  it('resuelve el nombre del equipo desde Flota', () => {
    renderView();
    expect(screen.getAllByText('EX-014 · CAT 320').length).toBeGreaterThan(0);
  });

  it('como MANTENEDOR: puede iniciar (hallazgos y órdenes) y finalizar', () => {
    renderView();

    // Un "Iniciar operación" por cada hallazgo abierto y por cada OT pendiente.
    expect(screen.getAllByRole('button', { name: /Iniciar operación/ }).length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('button', { name: /Finalizar tarea/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Ver operación/ })).toBeTruthy();
  });

  it('con una escritura pendiente sobre la OT, "Finalizar tarea" se retira — un doble cierre ahora duplica stock', () => {
    marcaDeMock = (_entity, id) => (id === 'ot-2' ? 'pendiente' : null);
    renderView();

    expect(screen.queryByRole('button', { name: /Finalizar tarea/ })).toBeNull();
    expect(screen.getByText(/Sincronizando cambios/)).toBeTruthy();
  });

  it('si los hallazgos fallan al cargar, la bandeja LO DICE en vez de mostrarse vacía', () => {
    hallazgosResult = { data: undefined, isPending: false, isError: true };
    renderView();

    expect(screen.getByText(/No se pudieron cargar los hallazgos/)).toBeTruthy();
    // Las órdenes siguen visibles: solo falta la mitad de la bandeja.
    expect(screen.getByText('Fuga de aceite hidráulico en pluma')).toBeTruthy();
  });

  it('como ADMIN: puede crear órdenes Y finalizar tareas (espejo del backend ampliado)', () => {
    allowed = CAN_ADMIN;
    renderView();

    expect(screen.getByRole('button', { name: /Crear orden/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Finalizar tarea/ })).toBeTruthy();
  });

  it('un rol sin intervencion.create no ve "Finalizar tarea"', () => {
    allowed = CAN_SOLO_LECTOR;
    renderView();

    expect(screen.queryByRole('button', { name: /Finalizar tarea/ })).toBeNull();
  });
});
