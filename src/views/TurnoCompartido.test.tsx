import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1' }, role: null, isOfflineSnapshot: false }),
}));

import { useTurnoActual } from '../hooks/useTurnoActual';
import { useTurnoSelector } from '../hooks/useTurnoSelector';
import { saveTurnoOverride } from '../lib/shift-turno-override';
import { HallazgosView } from './HallazgosView';
import { ReporteDiarioView } from './ReporteDiarioView';
import { TrabajosExtraView } from './TrabajosExtraView';

/**
 * El turno elegido es uno solo en todo Terreno. Con el supervisor adelantado
 * al turno siguiente (override del selector de Registro de equipo), las cuatro
 * pantallas tienen que mostrar ese mismo turno y no el del reloj.
 */
const NOCTURNO = 'NOCTURNO · 20–08';

function setViewport(): void {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function conProveedor(vista: React.ReactElement) {
  const qc = new QueryClient();
  qc.setQueryData(['equipment'], []);
  qc.setQueryData(['hallazgos'], []);
  qc.setQueryData(['trabajos-extra'], []);
  qc.setQueryData(['operators', { isActive: true }], []);
  return render(<QueryClientProvider client={qc}>{vista}</QueryClientProvider>);
}

beforeEach(() => {
  setViewport();
  window.localStorage.clear();
  // 19:00 del lunes 28/09: el reloj dice DIURNO, dentro de la ventana de adelanto.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 28, 19, 0));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const adelantarTurno = () => saveTurnoOverride('u1', { baseTurno: 'DIURNO', baseFecha: '2026-09-28' });

describe('un solo turno elegido para todo Terreno', () => {
  it('sin override, las pantallas muestran el turno del reloj', () => {
    conProveedor(<HallazgosView />);

    expect(screen.getByText('DIURNO · 08–20')).toBeTruthy();
  });

  it('Registro de equipo (useTurnoSelector) y el resto leen el mismo turno adelantado', () => {
    adelantarTurno();

    const registro = renderHook(() => useTurnoSelector('u1')).result.current;
    const lectora = renderHook(() => useTurnoActual()).result.current;

    expect(registro.turnoSeleccion).toBe('siguiente');
    expect(registro.ctx.etiqueta).toBe(NOCTURNO);
    expect(lectora).toEqual(registro.ctx);
  });

  it('Hallazgos muestra el turno adelantado', () => {
    adelantarTurno();
    conProveedor(<HallazgosView />);

    expect(screen.getByText(NOCTURNO)).toBeTruthy();
    expect(screen.queryByText('DIURNO · 08–20')).toBeNull();
  });

  it('Trabajos extra propone el turno adelantado', () => {
    adelantarTurno();
    conProveedor(<TrabajosExtraView />);

    const turno = within(screen.getByRole('group', { name: 'Turno' }));
    expect(turno.getByRole('button', { name: /NOCTURNO/ }).getAttribute('aria-pressed')).toBe('true');
    expect(turno.getByRole('button', { name: /DIURNO/ }).getAttribute('aria-pressed')).toBe('false');
  });

  it('Reporte diario muestra el turno y la fecha del turno adelantado', () => {
    adelantarTurno();
    render(<ReporteDiarioView />);

    const dato = (label: string) => screen.getByText(label).closest('div')?.textContent ?? '';
    expect(dato('Turno')).toContain(NOCTURNO);
    expect(dato('Fecha')).toContain('28-09-2026');
  });

  it('un override de otro turno del reloj queda obsoleto y se ignora', () => {
    saveTurnoOverride('u1', { baseTurno: 'NOCTURNO', baseFecha: '2026-09-27' });
    conProveedor(<HallazgosView />);

    expect(screen.getByText('DIURNO · 08–20')).toBeTruthy();
  });
});
