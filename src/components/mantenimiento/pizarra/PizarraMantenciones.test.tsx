import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { MaintenanceBoardRow } from '../../../types/maintenance-board';
import type { MaintenanceForecastRow } from '../../../types/maintenance-forecast';
import { filaPizarra } from './fixtures';

const { boardHook, forecastHook, escritorio, rol } = vi.hoisted(() => ({
  boardHook: vi.fn(),
  forecastHook: vi.fn(),
  escritorio: { value: false },
  rol: { value: 'ADMIN' as 'ADMIN' | 'SECRETARIA' },
}));

vi.mock('../../../hooks/useMaintenancePlans', () => ({
  useMaintenanceBoard: () => boardHook(),
  useMaintenanceForecastByEquipment: () => forecastHook(),
}));
vi.mock('../../../hooks/useMediaQuery', () => ({
  DESKTOP_QUERY: '(min-width: 1024px)',
  useMediaQuery: () => escritorio.value,
}));
vi.mock('../../../hooks/usePermissions', async () => {
  const { canWrite } = await import('../../../lib/permissions');
  return {
    usePermissions: () => ({
      role: rol.value,
      can: (action: Parameters<typeof canWrite>[1]) => canWrite(rol.value, action),
    }),
  };
});
// Los dos modales existentes tienen sus propios tests: acá importa que se
// abran y con qué equipo.
vi.mock('../MantencionAnteriorModal', () => ({
  MantencionAnteriorModal: ({
    equipo,
    isOpen,
    pauta,
    lecturaObligatoria,
  }: {
    equipo: { id: string; controlUnit: string };
    isOpen: boolean;
    pauta?: unknown;
    lecturaObligatoria?: boolean;
  }) =>
    isOpen ? (
      <div
        data-control-unit={equipo.controlUnit}
        data-equipo={equipo.id}
        data-lectura-obligatoria={String(lecturaObligatoria)}
        data-pauta={JSON.stringify(pauta ?? null)}
        data-testid="modal-anterior"
      />
    ) : null,
}));
vi.mock('../PautaMantencionModal', () => ({
  PautaMantencionModal: ({ equipo, isOpen }: { equipo: { id: string }; isOpen: boolean }) =>
    isOpen ? <div data-equipo={equipo.id} data-testid="modal-pauta" /> : null,
}));

import { PizarraMantenciones } from './PizarraMantenciones';

const FILAS: MaintenanceBoardRow[] = [
  filaPizarra({
    equipmentId: 'p1',
    internalCode: 'SEM 02',
    items: [
      {
        id: 'i1',
        kind: 'FILTRO',
        description: 'Filtro de aceite motor',
        quantity: 2,
        unit: 'un',
        partNumber: '1R-0739',
        inventoryItemId: null,
        milestones: [500],
      },
      {
        id: 'i2',
        kind: 'ACEITE',
        description: 'Aceite 15W-40',
        quantity: 38,
        unit: 'L',
        partNumber: null,
        inventoryItemId: null,
        milestones: [500],
      },
    ],
  }),
  // Atrasado y sin último cambio registrado (respaldo estimado).
  filaPizarra({
    equipmentId: 'p2',
    internalCode: 'WA470',
    counter: 1538,
    lastChange: null,
    estimated: true,
    dueAt: 1500,
    remaining: -38,
  }),
  filaPizarra({
    equipmentId: 'p3',
    internalCode: 'SANY 01',
    source: 'SIN_PAUTA',
    lastChange: null,
    interval: null,
    nextMilestone: null,
    dueAt: null,
    remaining: null,
    alertBefore: null,
    milestones: [],
  }),
  filaPizarra({
    equipmentId: 'l1',
    internalCode: 'CAM 07',
    type: 'Camioneta',
    equipmentClass: 'LIGHT',
    unit: 'km',
    source: 'LIVIANO',
    counter: 84306,
    lastChange: null,
    estimated: true,
    interval: 10000,
    nextMilestone: 10000,
    dueAt: 90000,
    remaining: 5694,
    alertBefore: 1000,
    milestones: [],
  }),
];

const pronostico = (over: Partial<MaintenanceForecastRow>): MaintenanceForecastRow => ({
  equipmentId: 'p1',
  unit: 'h',
  source: 'PAUTA',
  nextAt: 2500,
  remaining: 100,
  status: 'ESTIMADA',
  dailyUsage: 10,
  basedOnDays: 28,
  estimatedDate: '2026-11-27',
  weekStart: '2026-11-21',
  suggestedDate: null,
  ...over,
});

beforeEach(() => {
  rol.value = 'ADMIN';
  escritorio.value = false;
  boardHook.mockReturnValue({ data: FILAS, isPending: false, isError: false, error: null });
  forecastHook.mockReturnValue({ data: new Map([['p1', pronostico({})]]) });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPizarra(entrada = '/mantenciones', onVerRegistro = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <PizarraMantenciones onVerRegistro={onVerRegistro} />
    </MemoryRouter>,
  );
}

const tarjetas = () => screen.getAllByTestId(/^pizarra-fila-/).map((f) => f.getAttribute('data-testid'));

describe('PizarraMantenciones', () => {
  it('el panel de pesados muestra solo los pesados, lo atrasado arriba y sin pauta al final', () => {
    renderPizarra();

    expect(tarjetas()).toEqual(['pizarra-fila-p2', 'pizarra-fila-p1', 'pizarra-fila-p3']);
    const atrasado = screen.getByTestId('pizarra-fila-p2');
    expect(within(atrasado).getByText('+38 h atrasado')).toBeTruthy();
    expect(within(atrasado).getByText('estimado')).toBeTruthy();
    expect(within(atrasado).getByText('Vencida')).toBeTruthy();
    // El pronóstico del equipo con datos de uso.
    expect(within(screen.getByTestId('pizarra-fila-p1')).getByText(/vie 27-11/)).toBeTruthy();
    expect(within(screen.getByTestId('pizarra-fila-p3')).getByText('Sin pauta')).toBeTruthy();
  });

  it('al pasar a livianos cambia a km y sin pronóstico dice «Sin datos de uso»', () => {
    renderPizarra();

    fireEvent.click(screen.getByRole('radio', { name: 'Equipos livianos' }));

    expect(tarjetas()).toEqual(['pizarra-fila-l1']);
    const liviano = screen.getByTestId('pizarra-fila-l1');
    expect(within(liviano).getByText('Km actual')).toBeTruthy();
    expect(within(liviano).getByText('5.694 km')).toBeTruthy();
    expect(within(liviano).getByText('Sin datos de uso')).toBeTruthy();
  });

  it('?panel=livianos abre directo en livianos; la tabla de escritorio usa encabezados en km', () => {
    escritorio.value = true;
    renderPizarra('/mantenciones?panel=livianos');

    expect(screen.getByRole('columnheader', { name: 'Km actual' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Km pendientes' })).toBeTruthy();
    expect(screen.queryByText('SEM 02')).toBeNull();
    expect(screen.getByText('CAM 07')).toBeTruthy();
  });

  it('la tabla de escritorio de pesados tiene las columnas de la pizarra', () => {
    escritorio.value = true;
    renderPizarra();

    for (const nombre of [
      'Equipo',
      'Horas cambio',
      'Fecha último cambio',
      'Horómetro último cambio',
      'Horómetro próximo cambio',
      'Horómetro actual',
      'Horas pendientes',
      'Fecha estimada de mantención',
    ]) {
      expect(screen.getByRole('columnheader', { name: nombre })).toBeTruthy();
    }
    expect(within(screen.getByTestId('pizarra-fila-p2')).getByText('+38 h atrasado')).toBeTruthy();
  });

  it('sin último cambio, el ADMIN ve «Registrar mantención anterior» y lo abre con el equipo', () => {
    renderPizarra();

    const fila = screen.getByTestId('pizarra-fila-p2');
    fireEvent.click(within(fila).getByRole('button', { name: 'Registrar mantención anterior' }));
    const modal = screen.getByTestId('modal-anterior');
    expect(modal.getAttribute('data-equipo')).toBe('p2');
    expect(modal.getAttribute('data-control-unit')).toBe('HOURS');
    // Con pauta: los hitos de la fila; la lectura es siempre obligatoria desde la pizarra.
    expect(JSON.parse(modal.getAttribute('data-pauta') ?? 'null')).toEqual({
      milestones: [250, 500, 750, 1000],
      initialMilestone: null,
    });
    expect(modal.getAttribute('data-lectura-obligatoria')).toBe('true');
  });

  it('un liviano abre «Registrar mantención anterior» sin pauta pero con lectura obligatoria', () => {
    renderPizarra();
    fireEvent.click(screen.getByRole('radio', { name: 'Equipos livianos' }));
    fireEvent.click(
      within(screen.getByTestId('pizarra-fila-l1')).getByRole('button', { name: 'Registrar mantención anterior' }),
    );
    const modal = screen.getByTestId('modal-anterior');
    expect(modal.getAttribute('data-pauta')).toBe('null');
    expect(modal.getAttribute('data-lectura-obligatoria')).toBe('true');
  });

  it('sin próximo hito el título no dice «0 h»', () => {
    boardHook.mockReturnValue({
      data: [filaPizarra({ equipmentId: 'x1', internalCode: 'SEM 09', nextMilestone: null, dueAt: null })],
      isPending: false,
      isError: false,
      error: null,
    });
    renderPizarra();
    fireEvent.click(screen.getByRole('button', { name: 'Ver mantención a realizar' }));
    expect(within(screen.getByRole('dialog')).getByText('Mantención a realizar · SEM 09')).toBeTruthy();
  });

  it('la SECRETARIA no ve «Registrar mantención anterior» ni «Asignar pauta»', () => {
    rol.value = 'SECRETARIA';
    renderPizarra();

    expect(screen.queryByRole('button', { name: 'Registrar mantención anterior' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Asignar pauta' })).toBeNull();
    expect(screen.getByTestId('pizarra-fila-p2')).toBeTruthy();
  });

  it('un pesado sin pauta ofrece «Asignar pauta» al ADMIN', () => {
    renderPizarra();

    fireEvent.click(within(screen.getByTestId('pizarra-fila-p3')).getByRole('button', { name: 'Asignar pauta' }));
    expect(screen.getByTestId('modal-pauta').getAttribute('data-equipo')).toBe('p3');
  });

  it('«Ver mantención a realizar» lista las operaciones del próximo hito', () => {
    renderPizarra();

    fireEvent.click(
      within(screen.getByTestId('pizarra-fila-p1')).getByRole('button', { name: 'Ver mantención a realizar' }),
    );

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Mantención de 500 h · SEM 02')).toBeTruthy();
    expect(within(dialog).getByText('Filtro de aceite motor')).toBeTruthy();
    expect(within(dialog).getByText('Filtro')).toBeTruthy();
    expect(within(dialog).getByText('2 un')).toBeTruthy();
    expect(within(dialog).getByText('cód. 1R-0739')).toBeTruthy();
    expect(within(dialog).getByText('Aceite 15W-40')).toBeTruthy();
  });

  it('un liviano muestra el servicio de 10.000 km; un sin pauta no tiene mantención que ver', () => {
    renderPizarra();
    const verSinPauta = within(screen.getByTestId('pizarra-fila-p3')).getByRole('button', {
      name: 'Ver mantención a realizar',
    });
    expect(verSinPauta.hasAttribute('disabled') || verSinPauta.getAttribute('aria-disabled') === 'true').toBe(true);

    fireEvent.click(screen.getByRole('radio', { name: 'Equipos livianos' }));
    fireEvent.click(
      within(screen.getByTestId('pizarra-fila-l1')).getByRole('button', { name: 'Ver mantención a realizar' }),
    );
    expect(within(screen.getByRole('dialog')).getByText('Servicio de 10.000 km')).toBeTruthy();
  });

  it('un equipo sin lectura lo dice en vez de inventar pendientes', () => {
    boardHook.mockReturnValue({
      data: [filaPizarra({ equipmentId: 'x', counter: null, remaining: null })],
      isPending: false,
      isError: false,
      error: null,
    });
    renderPizarra();
    expect(within(screen.getByTestId('pizarra-fila-x')).getAllByText('Sin lectura').length).toBeGreaterThanOrEqual(1);
  });

  it('el botón «Ver registro de mantención» avisa a la vista', () => {
    const onVerRegistro = vi.fn();
    renderPizarra('/mantenciones', onVerRegistro);
    fireEvent.click(screen.getByRole('button', { name: 'Ver registro de mantención' }));
    expect(onVerRegistro).toHaveBeenCalled();
  });

  it('muestra el error de la pizarra', () => {
    boardHook.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Falló la pizarra'),
    });
    renderPizarra();
    expect(screen.getByText('Falló la pizarra')).toBeTruthy();
  });

  it('horas pendientes: atrasado en rojo con triángulo, alerta en ámbar con exclamación y normal sin ícono', () => {
    boardHook.mockReturnValue({
      data: [
        filaPizarra({ equipmentId: 'a1', internalCode: 'ATR', remaining: -5 }),
        filaPizarra({ equipmentId: 'a2', internalCode: 'ALE', remaining: 40, alertBefore: 50 }),
        filaPizarra({ equipmentId: 'a3', internalCode: 'NOR', remaining: 300, alertBefore: 50 }),
      ],
      isPending: false,
      isError: false,
      error: null,
    });
    renderPizarra();

    const atrasado = screen.getByTestId('pizarra-fila-a1');
    expect(within(atrasado).getByText('+5 h atrasado').className).toContain('text-danger');
    expect(atrasado.querySelector('svg.text-danger')).toBeTruthy();
    const alerta = screen.getByTestId('pizarra-fila-a2');
    expect(within(alerta).getByText('40 h').className).toContain('text-warning');
    expect(alerta.querySelector('svg.text-warning')).toBeTruthy();
    expect(alerta.querySelector('svg.text-danger')).toBeNull();
    const normal = screen.getByTestId('pizarra-fila-a3');
    expect(normal.querySelector('svg.text-danger, svg.text-warning')).toBeNull();
  });

  it('la tabla pinta de gris las columnas por índice lógico aunque haya celda con colSpan, y lleva íconos', () => {
    escritorio.value = true;
    renderPizarra();

    // p1 tiene último cambio (9 celdas); p2 no (8 celdas, una con colSpan 2): ambas con el mismo gris de partida.
    const conCambio = screen.getByTestId('pizarra-fila-p1').querySelectorAll('td');
    expect([...conCambio].map((td) => td.hasAttribute('data-gris'))).toEqual([
      true, false, true, false, true, false, true, false, true,
    ]);
    const sinCambio = screen.getByTestId('pizarra-fila-p2').querySelectorAll('td');
    expect([...sinCambio].map((td) => td.hasAttribute('data-gris'))).toEqual([
      true, false, true, true, false, true, false, true,
    ]);
    // Íconos decorativos junto a los valores.
    expect(screen.getByTestId('pizarra-fila-p1').querySelectorAll('svg[aria-hidden="true"]').length).toBeGreaterThan(5);
  });
});
