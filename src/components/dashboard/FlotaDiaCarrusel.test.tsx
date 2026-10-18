import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent } from '@testing-library/react';

import type { MaintenanceStatusRow } from '../../types/maintenance-plan';
import { EstadoEquipoHoySchema, FlotaDiaSchema, ResumenDiaSchema, type FlotaDia } from '../../types/dashboard';
const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }));

import { FlotaDiaCarrusel } from './FlotaDiaCarrusel';

const FLOTA_HOY: FlotaDia[] = [
  { equipmentId: 'e1', internalCode: 'CG-002', estado: 'EN_USO', status: 'OPERATIONAL', operador: 'P. Rojas', turno: 'DIURNO', supervisor: 'Limbert', unidadControl: 'HOURS', contadorActual: 1234.5, nivelCombustible: 65 },
  { equipmentId: 'e2', internalCode: 'EX-001', estado: 'DISPONIBLE', status: 'OPERATIONAL', unidadControl: 'KM', contadorActual: 80500, nivelCombustible: 30 },
  { equipmentId: 'e3', internalCode: 'CM-006', estado: 'INOPERATIVO', status: 'IN_WORKSHOP', unidadControl: 'HOURS', contadorActual: null, nivelCombustible: null },
  { equipmentId: 'e4', internalCode: 'CN-007', estado: 'INOPERATIVO', status: 'OUT_OF_SERVICE' },
];

const FLOTA_PASADA: FlotaDia[] = [
  { equipmentId: 'e1', internalCode: 'CG-002', estado: 'OPERO', operador: 'P. Rojas', turno: 'NOCTURNO', supervisor: 'Limbert', unidadControl: 'HOURS', contadorActual: 1234.5, nivelCombustible: 40 },
  { equipmentId: 'e2', internalCode: 'EX-001', estado: 'SIN_ACTIVIDAD', unidadControl: 'KM', contadorActual: 80500, nivelCombustible: null },
  { equipmentId: 'e3', internalCode: 'CM-006', estado: 'SIN_ACTIVIDAD', unidadControl: 'HOURS', contadorActual: 10, nivelCombustible: null },
];

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

describe('FlotaDiaCarrusel (hoy)', () => {
  it('los contadores son chips compactos contados desde la flota', () => {
    render(<FlotaDiaCarrusel esHoy flota={FLOTA_HOY} />);
    expect(screen.getByTestId('contador-EN_USO').textContent).toBe('1 en uso');
    expect(screen.getByTestId('contador-DISPONIBLE').textContent).toBe('1 disponibles');
    expect(screen.getByTestId('contador-INOPERATIVO').textContent).toBe('2 inoperativos');
  });

  it('una tarjeta por equipo, en el orden servido, dentro de una lista', () => {
    render(<FlotaDiaCarrusel esHoy flota={FLOTA_HOY} />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((li) => li.textContent?.slice(0, 6))).toEqual(['CG-002', 'EX-001', 'CM-006', 'CN-007']);
  });

  it('en uso: operador, turno y supervisor', () => {
    render(<FlotaDiaCarrusel esHoy flota={FLOTA_HOY} />);
    expect(card('e1').getByText('En uso')).toBeTruthy();
    expect(card('e1').getByText('P. Rojas · DIURNO')).toBeTruthy();
    expect(card('e1').getByText('Limbert')).toBeTruthy();
  });

  it('muestra combustible % y contador con unidad (HOURS) o Odómetro (KM)', () => {
    render(<FlotaDiaCarrusel esHoy flota={FLOTA_HOY} />);
    expect(card('e1').getByText('Combustible')).toBeTruthy();
    expect(card('e1').getByText('65%')).toBeTruthy();
    expect(card('e1').getByText('Horómetro actual')).toBeTruthy();
    expect(card('e1').getByText('1.234,5 h')).toBeTruthy();
    expect(card('e2').getByText('Odómetro actual')).toBeTruthy();
    expect(card('e2').getByText('80.500 km')).toBeTruthy();
    expect(card('e2').getByText('30%')).toBeTruthy();
  });

  it('operador y supervisor son filas etiquetadas; sin turno en uso muestran —', () => {
    render(<FlotaDiaCarrusel esHoy flota={FLOTA_HOY} />);
    expect(card('e1').getByText('Operador')).toBeTruthy();
    expect(card('e1').getByText('Supervisor')).toBeTruthy();
    expect(card('e2').getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('nivel y contador nulos (o ausentes en payload cacheado) muestran —', () => {
    render(
      <FlotaDiaCarrusel
        esHoy
        flota={[FLOTA_HOY[2], { equipmentId: 'e8', internalCode: 'XX-008', estado: 'DISPONIBLE' }]}
      />,
    );
    for (const id of ['e3', 'e8']) {
      const fila = (t: string) => card(id).getByText(t).parentElement!;
      expect(within(fila('Combustible')).getByText('—')).toBeTruthy();
      expect(within(fila('Horómetro actual')).getByText('—')).toBeTruthy();
    }
  });

  it('el schema acepta payloads cacheados sin los campos nuevos', () => {
    const viejo = { equipmentId: 'e1', internalCode: 'A', estado: 'EN_USO' };
    expect(EstadoEquipoHoySchema.safeParse(viejo).success).toBe(true);
    expect(FlotaDiaSchema.safeParse(viejo).success).toBe(true);
    expect(
      FlotaDiaSchema.safeParse({ ...viejo, unidadControl: 'KM', contadorActual: null, nivelCombustible: null }).success,
    ).toBe(true);
    expect(FlotaDiaSchema.safeParse({ ...viejo, estado: 'OPERO' }).success).toBe(true);
    expect(FlotaDiaSchema.safeParse({ ...viejo, estado: 'SIN_ACTIVIDAD' }).success).toBe(true);
    expect(FlotaDiaSchema.safeParse({ ...viejo, estado: 'OTRO' }).success).toBe(false);
  });

  it('ResumenDiaSchema acepta un payload cacheado sin flota', () => {
    const base = {
      fecha: '2026-10-16',
      hm: { total: 0, dia: 0, noche: 0 },
      diesel: { total: 0, dia: 0, noche: 0, porHm: null },
      reports: { totalHoras: 0, porEquipo: [] },
      produccion: { internos: 0, minaCaleta: 0, mineras: 0 },
      adBlue: null,
      operacionPorEquipo: [],
      lecturas: [],
    };
    expect(ResumenDiaSchema.safeParse(base).success).toBe(true);
    expect(ResumenDiaSchema.safeParse({ ...base, flota: [] }).success).toBe(true);
  });

  it('en taller y fuera de servicio se distinguen', () => {
    render(<FlotaDiaCarrusel esHoy flota={FLOTA_HOY} />);
    expect(card('e3').getByText('Inoperativo')).toBeTruthy();
    expect(card('e3').getByText('En taller')).toBeTruthy();
    expect(card('e4').getByText('Fuera de servicio')).toBeTruthy();
  });

  it('inoperativo sin status (payload cacheado) muestra Fuera de servicio', () => {
    render(<FlotaDiaCarrusel esHoy flota={[{ equipmentId: 'e9', internalCode: 'XX-009', estado: 'INOPERATIVO' }]} />);
    expect(card('e9').getByText('Fuera de servicio')).toBeTruthy();
  });

  it('disponible: sin turno abierto', () => {
    render(<FlotaDiaCarrusel esHoy flota={FLOTA_HOY} />);
    expect(card('e2').getByText('Disponible')).toBeTruthy();
    expect(card('e2').getByText('Sin turno abierto')).toBeTruthy();
  });

  it('badge de mantención solo si remaining <= alertBefore', () => {
    render(
      <FlotaDiaCarrusel
        esHoy
        flota={FLOTA_HOY}
        mantenciones={new Map([mant('e1', 30, 50), mant('e2', 80, 50), mant('e3', 10, null)])}
      />,
    );
    expect(card('e1').getByText('Mantención: quedan 30 h')).toBeTruthy();
    expect(card('e2').queryByText(/Mantención/)).toBeNull();
    expect(card('e3').queryByText(/Mantención/)).toBeNull();
  });

  it('los botones del carrusel hacen scrollBy sobre la lista', () => {
    const scrollBy = vi.fn();
    render(<FlotaDiaCarrusel esHoy flota={FLOTA_HOY} />);
    const lista = screen.getByRole('list');
    lista.scrollBy = scrollBy;
    fireEvent.click(screen.getByRole('button', { name: 'Equipos siguientes' }));
    expect(scrollBy).toHaveBeenCalledWith({ left: lista.clientWidth, behavior: 'smooth' });
    fireEvent.click(screen.getByRole('button', { name: 'Equipos anteriores' }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -lista.clientWidth, behavior: 'smooth' });
  });
});

describe('FlotaDiaCarrusel (día pasado)', () => {
  it('chips «N operaron» (amarillo) y «N sin actividad» (neutro), contados desde la flota', () => {
    render(<FlotaDiaCarrusel esHoy={false} flota={FLOTA_PASADA} />);
    expect(screen.getByTestId('contador-OPERO').textContent).toBe('1 operaron');
    expect(screen.getByTestId('contador-SIN_ACTIVIDAD').textContent).toBe('2 sin actividad');
    expect(screen.queryByTestId('contador-EN_USO')).toBeNull();
  });

  it('tarjeta: «Operó» con operador/turno/supervisor; «Sin actividad» con —', () => {
    render(<FlotaDiaCarrusel esHoy={false} flota={FLOTA_PASADA} />);
    expect(card('e1').getByText('Operó')).toBeTruthy();
    expect(card('e1').getByText('P. Rojas · NOCTURNO')).toBeTruthy();
    expect(card('e1').getByText('Limbert')).toBeTruthy();
    expect(card('e1').getByText('40%')).toBeTruthy();
    expect(card('e2').getByText('Sin actividad')).toBeTruthy();
    expect(card('e2').getAllByText('—').length).toBeGreaterThanOrEqual(3); // operador, supervisor, combustible
  });

  it('sin motivo («En taller», «Sin turno abierto») ni badge de mantención aunque haya alerta', () => {
    render(
      <FlotaDiaCarrusel
        esHoy={false}
        flota={[{ ...FLOTA_PASADA[2], status: 'IN_WORKSHOP' }, FLOTA_PASADA[0]]}
        mantenciones={new Map([mant('e1', 10, 50), mant('e3', 10, 50)])}
      />,
    );
    expect(screen.queryByText('En taller')).toBeNull();
    expect(screen.queryByText('Sin turno abierto')).toBeNull();
    expect(screen.queryByText(/Mantención/)).toBeNull();
  });

  it('el contador se rotula «(actual)» para no leerlo como histórico', () => {
    render(<FlotaDiaCarrusel esHoy={false} flota={FLOTA_PASADA} />);
    expect(card('e1').getByText('Horómetro (actual)')).toBeTruthy();
    expect(card('e2').getByText('Odómetro (actual)')).toBeTruthy();
    expect(card('e1').getByText('1.234,5 h')).toBeTruthy();
  });
});

describe('FlotaDiaCarrusel (sin datos)', () => {
  it('flota ausente (payload cacheado) muestra estado vacío neutro sin romper', () => {
    render(<FlotaDiaCarrusel esHoy flota={undefined} />);
    expect(screen.getByTestId('flota-sin-datos')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByTestId('contador-EN_USO')).toBeNull();
  });

  it('flota vacía: sin equipos registrados', () => {
    render(<FlotaDiaCarrusel esHoy flota={[]} />);
    expect(screen.getByText('No hay equipos registrados.')).toBeTruthy();
  });
});

describe('FlotaDiaCarrusel (navegación)', () => {
  it('clic en la tarjeta navega a /equipos/<id> y es un botón accesible por teclado', () => {
    render(<FlotaDiaCarrusel esHoy flota={FLOTA_HOY} />);
    fireEvent.click(screen.getByTestId('equipo-card-e2'));
    expect(navigateMock).toHaveBeenCalledWith('/equipos/e2', { state: { from: '/' } });
    expect(screen.getByRole('button', { name: 'Ver ficha de CG-002' }).tagName).toBe('BUTTON');
  });
});
