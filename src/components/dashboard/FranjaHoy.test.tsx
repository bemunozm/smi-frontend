import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent } from '@testing-library/react';

const { hoyHook } = vi.hoisted(() => ({ hoyHook: vi.fn() }));

vi.mock('../../hooks/useDashboard', () => ({ useDashboardHoy: () => hoyHook() }));

import type { MaintenanceStatusRow } from '../../types/maintenance-plan';
import { EstadoEquipoHoySchema } from '../../types/dashboard';
import { FranjaHoy } from './FranjaHoy';

const DATA = {
  totales: { enUso: 1, disponibles: 1, inoperativos: 2 },
  equipos: [
    { equipmentId: 'e1', internalCode: 'CG-002', estado: 'EN_USO', status: 'OPERATIONAL', operador: 'P. Rojas', turno: 'DIURNO', supervisor: 'Limbert', unidadControl: 'HOURS', contadorActual: 1234.5, nivelCombustible: 65 },
    { equipmentId: 'e2', internalCode: 'EX-001', estado: 'DISPONIBLE', status: 'OPERATIONAL', unidadControl: 'KM', contadorActual: 80500, nivelCombustible: 30 },
    { equipmentId: 'e3', internalCode: 'CM-006', estado: 'INOPERATIVO', status: 'IN_WORKSHOP', unidadControl: 'HOURS', contadorActual: null, nivelCombustible: null },
    { equipmentId: 'e4', internalCode: 'CN-007', estado: 'INOPERATIVO', status: 'OUT_OF_SERVICE' },
  ],
};

const mockHoy = (value: object) =>
  hoyHook.mockReturnValue({ isPending: false, isError: false, error: null, refetch: vi.fn(), ...value });

const mant = (equipmentId: string, remaining: number, alertBefore: number | null) =>
  [
    equipmentId,
    { equipmentId, unit: 'h', alertBefore, status: { next: { remaining } } } as unknown as MaintenanceStatusRow,
  ] as const;

const card = (id: string) => within(screen.getByTestId(`equipo-card-${id}`));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('FranjaHoy', () => {
  it('los contadores son chips compactos', () => {
    mockHoy({ data: DATA });
    render(<FranjaHoy />);
    expect(screen.getByTestId('contador-EN_USO').textContent).toBe('1 en uso');
    expect(screen.getByTestId('contador-DISPONIBLE').textContent).toBe('1 disponibles');
    expect(screen.getByTestId('contador-INOPERATIVO').textContent).toBe('2 inoperativos');
  });

  it('una tarjeta por equipo, en el orden servido, dentro de una lista', () => {
    mockHoy({ data: DATA });
    render(<FranjaHoy />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((li) => li.textContent?.slice(0, 6))).toEqual(['CG-002', 'EX-001', 'CM-006', 'CN-007']);
  });

  it('en uso: operador, turno y supervisor', () => {
    mockHoy({ data: DATA });
    render(<FranjaHoy />);
    expect(card('e1').getByText('En uso')).toBeTruthy();
    expect(card('e1').getByText('P. Rojas · DIURNO')).toBeTruthy();
    expect(card('e1').getByText('Limbert')).toBeTruthy();
  });

  it('muestra combustible % y contador con unidad (HOURS) o Odómetro (KM)', () => {
    mockHoy({ data: DATA });
    render(<FranjaHoy />);
    expect(card('e1').getByText('Combustible')).toBeTruthy();
    expect(card('e1').getByText('65%')).toBeTruthy();
    expect(card('e1').getByText('Horómetro actual')).toBeTruthy();
    expect(card('e1').getByText('1.234,5 h')).toBeTruthy();
    expect(card('e2').getByText('Odómetro actual')).toBeTruthy();
    expect(card('e2').getByText('80.500 km')).toBeTruthy();
    expect(card('e2').getByText('30%')).toBeTruthy();
  });

  it('operador y supervisor son filas etiquetadas; sin turno en uso muestran —', () => {
    mockHoy({ data: DATA });
    render(<FranjaHoy />);
    expect(card('e1').getByText('Operador')).toBeTruthy();
    expect(card('e1').getByText('Supervisor')).toBeTruthy();
    expect(card('e2').getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('nivel y contador nulos (o ausentes en payload cacheado) muestran —', () => {
    mockHoy({
      data: {
        ...DATA,
        equipos: [
          DATA.equipos[2],
          { equipmentId: 'e8', internalCode: 'XX-008', estado: 'DISPONIBLE' },
        ],
      },
    });
    render(<FranjaHoy />);
    for (const id of ['e3', 'e8']) {
      const fila = (t: string) => card(id).getByText(t).parentElement!;
      expect(within(fila('Combustible')).getByText('—')).toBeTruthy();
      expect(within(fila('Horómetro actual')).getByText('—')).toBeTruthy();
    }
  });

  it('el schema acepta payloads cacheados sin los campos nuevos', () => {
    const viejo = { equipmentId: 'e1', internalCode: 'A', estado: 'EN_USO' };
    expect(EstadoEquipoHoySchema.safeParse(viejo).success).toBe(true);
    expect(
      EstadoEquipoHoySchema.safeParse({ ...viejo, unidadControl: 'KM', contadorActual: null, nivelCombustible: null })
        .success,
    ).toBe(true);
  });

  it('en taller y fuera de servicio se distinguen', () => {
    mockHoy({ data: DATA });
    render(<FranjaHoy />);
    expect(card('e3').getByText('Inoperativo')).toBeTruthy();
    expect(card('e3').getByText('En taller')).toBeTruthy();
    expect(card('e4').getByText('Fuera de servicio')).toBeTruthy();
  });

  it('inoperativo sin status (payload cacheado) muestra Fuera de servicio', () => {
    mockHoy({
      data: { ...DATA, equipos: [{ equipmentId: 'e9', internalCode: 'XX-009', estado: 'INOPERATIVO' }] },
    });
    render(<FranjaHoy />);
    expect(card('e9').getByText('Fuera de servicio')).toBeTruthy();
  });

  it('disponible: sin turno abierto', () => {
    mockHoy({ data: DATA });
    render(<FranjaHoy />);
    expect(card('e2').getByText('Disponible')).toBeTruthy();
    expect(card('e2').getByText('Sin turno abierto')).toBeTruthy();
  });

  it('badge de mantención solo si remaining <= alertBefore', () => {
    mockHoy({ data: DATA });
    render(<FranjaHoy mantenciones={new Map([mant('e1', 30, 50), mant('e2', 80, 50), mant('e3', 10, null)])} />);
    expect(card('e1').getByText('Mantención: quedan 30 h')).toBeTruthy();
    expect(card('e2').queryByText(/Mantención/)).toBeNull();
    expect(card('e3').queryByText(/Mantención/)).toBeNull();
  });

  it('los botones del carrusel hacen scrollBy sobre la lista', () => {
    mockHoy({ data: DATA });
    const scrollBy = vi.fn();
    render(<FranjaHoy />);
    const lista = screen.getByRole('list');
    lista.scrollBy = scrollBy;
    fireEvent.click(screen.getByRole('button', { name: 'Equipos siguientes' }));
    expect(scrollBy).toHaveBeenCalledWith({ left: lista.clientWidth, behavior: 'smooth' });
    fireEvent.click(screen.getByRole('button', { name: 'Equipos anteriores' }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -lista.clientWidth, behavior: 'smooth' });
  });

  it('error con reintento', () => {
    const refetch = vi.fn();
    hoyHook.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('Falló'), refetch });
    render(<FranjaHoy />);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });
});
