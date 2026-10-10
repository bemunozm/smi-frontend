import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CicloMantencionesCard, CicloMantencionesModal } from './CicloMantenciones';
import { MAINTENANCE_PLANS_KEY } from '../../lib/query-keys';
import type { MaintenanceCycleView } from '../../types/maintenance-plan';
import type { Role } from '../../types/roles';

let rolActual: Role | null = 'ADMIN';
const mutate = vi.fn();

vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', role: rolActual }, role: rolActual, isPending: false, isAuthenticated: true }),
}));

vi.mock('../../hooks/useMaintenancePlans', async (original) => ({
  ...(await original<typeof import('../../hooks/useMaintenancePlans')>()),
  useSetMaintenanceRecord: () => ({ mutate, isPending: false }),
}));

afterEach(() => {
  cleanup();
  mutate.mockClear();
});

const item = (id: string, description: string, milestones: number[]) => ({
  id,
  kind: 'FILTRO',
  description,
  quantity: 1,
  unit: null,
  partNumber: null,
  inventoryItemId: null,
  milestones,
});

/** BD-005 con 2.100 h: va en el ciclo 2; el hito 250 está completo y el 500 a medias. */
const VISTA: MaintenanceCycleView = {
  equipment: { id: 'e1', internalCode: 'BD-005', unit: 'h', counter: 2100 },
  hasPlan: true,
  currentCycle: 2,
  cycle: 2,
  cycleLength: 2000,
  cycleStart: 2000,
  cycleEnd: 4000,
  baselineCounter: null,
  items: [item('aceite', 'Filtro aceite motor', [250, 500, 2000]), item('correa', 'Correa ventilador', [500, 2000])],
  columns: [
    { milestone: 250, firstTimeOnly: false, dueAt: 2250, reached: true, total: 1, done: 1, complete: true, preSystem: false, unlocked: true, canUndo: false },
    { milestone: 500, firstTimeOnly: false, dueAt: 2500, reached: false, total: 2, done: 1, complete: false, preSystem: false, unlocked: true, canUndo: true },
    { milestone: 2000, firstTimeOnly: false, dueAt: 4000, reached: false, total: 2, done: 0, complete: false, preSystem: false, unlocked: false, canUndo: true },
  ],
  records: [
    { id: 'r1', planItemId: 'aceite', milestone: 250, description: 'Filtro aceite motor', kind: 'FILTRO', counterAt: 2251, doneByName: 'Admin SMI', doneAt: '2026-10-10T15:00:00.000Z' },
    { id: 'r2', planItemId: 'aceite', milestone: 500, description: 'Filtro aceite motor', kind: 'FILTRO', counterAt: 2490, doneByName: 'Admin SMI', doneAt: '2026-10-10T16:00:00.000Z' },
  ],
};

function renderComo(rol: Role | null, ui: React.ReactElement) {
  rolActual = rol;
  const qc = new QueryClient();
  qc.setQueryData([...MAINTENANCE_PLANS_KEY, 'e1', 'cycle', 'actual'], VISTA);
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const abrir = (rol: Role) => {
  renderComo(rol, <CicloMantencionesModal equipmentId="e1" isOpen onOpenChange={() => {}} />);
  return within(screen.getByRole('dialog'));
};

describe('CicloMantencionesModal', () => {
  it('muestra las operaciones a la izquierda y los hitos en orden hacia la derecha', () => {
    const v = abrir('ADMIN');

    expect(v.getByText('Filtro aceite motor')).toBeTruthy();
    const encabezados = v.getAllByRole('columnheader').map((th) => th.textContent ?? '');
    expect(encabezados[0]).toContain('Operación');
    expect(encabezados.slice(1).map((t) => t.match(/^[\d.]+/)?.[0])).toEqual(['250', '500', '2.000']);
  });

  /** La columna se pinta en verde solo cuando todas sus operaciones están hechas. */
  it('marca en verde la columna completa y deja en blanco la que está a medias', () => {
    const v = abrir('ADMIN');
    const [, h250, h500] = v.getAllByRole('columnheader');

    expect(h250.className).toContain('bg-success-soft');
    expect(h250.textContent).toContain('Completa');
    expect(h500.className).not.toContain('bg-success-soft');
  });

  it('marcar una operación registra el ciclo y el hito', () => {
    const v = abrir('MANTENEDOR');

    fireEvent.click(v.getByRole('checkbox', { name: 'Correa ventilador a las 500 h' }));

    expect(mutate).toHaveBeenCalledWith({ equipmentId: 'e1', planItemId: 'correa', cycle: 2, milestone: 500, done: true });
  });

  it('una operación que no se hace en ese hito no tiene casilla', () => {
    const v = abrir('ADMIN');
    expect(v.queryByRole('checkbox', { name: 'Correa ventilador a las 250 h' })).toBeNull();
  });

  const deshabilitada = (el: HTMLElement) => el.hasAttribute('disabled') || el.closest('[data-disabled]') != null;

  /** Marca solo el mantenedor: administrador y supervisor lo ven en solo lectura. */
  it.each<Role>(['ADMIN', 'SUPERVISOR'])('%s lo ve pero no puede marcar', (rol) => {
    const v = abrir(rol);
    expect(deshabilitada(v.getByRole('checkbox', { name: 'Correa ventilador a las 500 h' }))).toBe(true);
  });

  /** Las mantenciones van en orden: con la de 500 a medias, la de 2000 espera. */
  it('no deja marcar un hito con uno anterior incompleto', () => {
    const v = abrir('MANTENEDOR');

    const de2000 = v.getByRole('checkbox', { name: 'Correa ventilador a las 2000 h' });
    expect(deshabilitada(de2000)).toBe(true);
    expect(de2000.closest('td')?.getAttribute('title')).toMatch(/Primero hay que completar la mantención de 500/);
    expect(v.getAllByRole('columnheader')[3].textContent).toContain('En espera');
  });

  it('no deja desmarcar un hito si uno posterior ya tiene registros', () => {
    const v = abrir('MANTENEDOR');

    // La de 250 está hecha y la de 500 ya tiene un registro.
    const de250 = v.getByRole('checkbox', { name: 'Filtro aceite motor a las 250 h' });
    expect(deshabilitada(de250)).toBe(true);
    expect(de250.closest('td')?.getAttribute('title')).toMatch(/No se puede desmarcar/);
  });
});

/** Un equipo que entró con 2.100 h ya hizo todo el ciclo 1 fuera del sistema. */
describe('mantenciones previas al sistema', () => {
  const CICLO_1: MaintenanceCycleView = {
    ...VISTA,
    cycle: 1,
    cycleStart: 0,
    cycleEnd: 2000,
    baselineCounter: 2100,
    records: [],
    columns: VISTA.columns.map((c) => ({
      ...c,
      dueAt: c.milestone,
      reached: true,
      done: c.total,
      complete: true,
      preSystem: true,
      canUndo: false,
    })),
  };

  it('muestra todo el ciclo en verde, sin casillas que marcar', () => {
    rolActual = 'MANTENEDOR';
    const qc = new QueryClient();
    qc.setQueryData([...MAINTENANCE_PLANS_KEY, 'e1', 'cycle', 'actual'], CICLO_1);
    render(
      <QueryClientProvider client={qc}>
        <CicloMantencionesModal equipmentId="e1" isOpen onOpenChange={() => {}} />
      </QueryClientProvider>,
    );
    const v = within(screen.getByRole('dialog'));

    const [, ...hitos] = v.getAllByRole('columnheader');
    expect(hitos.every((h) => h.className.includes('bg-success-soft') && h.textContent?.includes('Previa al sistema'))).toBe(true);
    expect(v.queryAllByRole('checkbox')).toHaveLength(0);
    expect(v.getByText(/Entró al sistema con 2.100 h/)).toBeTruthy();
  });
});

describe('CicloMantencionesCard', () => {
  it('resume el ciclo en curso en la ficha del equipo', () => {
    renderComo('ADMIN', <CicloMantencionesCard equipmentId="e1" />);

    expect(screen.getByText('Ciclo 2')).toBeTruthy();
    expect(screen.getByText('1 de 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Ver ciclo de mantenciones/ })).toBeTruthy();
  });

  it('no se muestra sin sesión', () => {
    renderComo(null, <CicloMantencionesCard equipmentId="e1" />);
    expect(screen.queryByText('Ciclo de mantenciones')).toBeNull();
  });
});
