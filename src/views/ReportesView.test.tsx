import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, within } from '@testing-library/react';

import type { ShiftReportListItem } from '../types/shift';

const { reportesHook } = vi.hoisted(() => ({ reportesHook: vi.fn() }));

vi.mock('../hooks/useShiftReports', () => ({ useShiftReports: () => reportesHook() }));

import { ReportesView } from './ReportesView';

const reporte = (over: Partial<ShiftReportListItem> & Pick<ShiftReportListItem, 'id'>): ShiftReportListItem => ({
  shiftDate: '2026-10-21',
  shiftType: 'DIURNO',
  supervisor: 'Jorge SMI',
  cardCount: 4,
  emailStatus: 'SENT',
  fileName: 'reporte-salida-2026-10-21-diurno.pdf',
  createdAt: '2026-10-21T18:05:00.000Z',
  ...over,
});

const LISTA: ShiftReportListItem[] = [
  reporte({ id: 'r2' }),
  reporte({
    id: 'r1',
    shiftDate: '2026-10-20',
    shiftType: 'NOCTURNO',
    supervisor: 'Ana Soto',
    cardCount: 2,
    emailStatus: 'SKIPPED',
    createdAt: '2026-10-20T23:40:00.000Z',
  }),
];

const ok = (data: ShiftReportListItem[]) => ({ data, isPending: false, isError: false, error: null });

beforeEach(() => {
  reportesHook.mockReturnValue(ok(LISTA));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ReportesView', () => {
  it('lista cada reporte de salida con turno, supervisor y equipos reportados', () => {
    render(<ReportesView />);

    const filaR2 = screen.getByTestId('reporte-fila-r2');
    expect(within(filaR2).getByText('Diurno')).toBeTruthy();
    expect(within(filaR2).getByText('Jorge SMI')).toBeTruthy();
    expect(within(filaR2).getByText('4')).toBeTruthy();

    const filaR1 = screen.getByTestId('reporte-fila-r1');
    expect(within(filaR1).getByText('Nocturno')).toBeTruthy();
    expect(within(filaR1).getByText('Ana Soto')).toBeTruthy();
  });

  it('cada fila ofrece descargar el PDF (link a /api/shift-reports/:id/file)', () => {
    render(<ReportesView />);

    const enlace = within(screen.getByTestId('reporte-fila-r2')).getByRole('link', { name: /Descargar PDF/ });
    expect(enlace.getAttribute('href')).toContain('/api/shift-reports/r2/file');
    expect(enlace.getAttribute('target')).toBe('_blank');
  });

  it('muestra el estado del correo de cada envío', () => {
    render(<ReportesView />);

    expect(within(screen.getByTestId('reporte-fila-r2')).getByText('Correo enviado')).toBeTruthy();
    // SKIPPED = no había SMTP configurado: el aviso quedó solo in-app.
    expect(within(screen.getByTestId('reporte-fila-r1')).getByText('Sin correo')).toBeTruthy();
  });

  it('sin reportes lo dice, y muestra el error del listado cuando falla', () => {
    reportesHook.mockReturnValue(ok([]));
    const { unmount } = render(<ReportesView />);
    expect(screen.getByText(/Todavía no hay reportes de salida/)).toBeTruthy();
    unmount();

    reportesHook.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('Falló Reportes') });
    render(<ReportesView />);
    expect(screen.getByText('Falló Reportes')).toBeTruthy();
  });
});
