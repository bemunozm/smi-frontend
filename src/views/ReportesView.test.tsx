import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent } from '@testing-library/react';

import type { ShiftReportListItem } from '../types/shift';

const { reportesHook, eliminarMutate, permisos, escritorio } = vi.hoisted(() => ({
  reportesHook: vi.fn(),
  eliminarMutate: vi.fn(),
  permisos: { role: 'ADMIN' as string | null },
  escritorio: { value: true },
}));

vi.mock('../hooks/useShiftReports', () => ({
  useShiftReports: () => reportesHook(),
  useDeleteShiftReport: () => ({ mutate: eliminarMutate, isPending: false }),
}));
vi.mock('../hooks/usePermissions', () => ({ usePermissions: () => ({ role: permisos.role, can: () => true }) }));
vi.mock('../hooks/useMediaQuery', () => ({ DESKTOP_QUERY: 'desktop', useMediaQuery: () => escritorio.value }));
// El modal tiene su propio test (`RegistroTurnoModal.test.tsx`): acá solo importa qué reporte abre
// y que ofrezca «Eliminar registro» solo cuando la vista se lo pasa.
vi.mock('../components/reportes/RegistroTurnoModal', () => ({
  RegistroTurnoModal: ({ reporte, onEliminar }: { reporte: ShiftReportListItem | null; onEliminar?: () => void }) =>
    reporte ? (
      <div role="dialog">
        Registro de {reporte.id}
        {onEliminar ? <button onClick={onEliminar}>Eliminar registro</button> : null}
      </div>
    ) : null,
}));

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
  permisos.role = 'ADMIN';
  escritorio.value = true;
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

  it('«Ver registro» abre las tarjetas del turno de esa fila', () => {
    render(<ReportesView />);
    const fila = screen.getByTestId('reporte-fila-r1');
    fireEvent.click(within(fila).getByRole('button', { name: /Ver registro/ }));
    expect(screen.getByRole('dialog').textContent).toContain('Registro de r1');
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

  it('el administrador elimina un envío duplicado previa confirmación', () => {
    render(<ReportesView />);
    fireEvent.click(within(screen.getByTestId('reporte-fila-r1')).getByRole('button', { name: /Eliminar el envío/ }));

    const confirmacion = screen.getByRole('alertdialog');
    expect(confirmacion.textContent).toContain('Ana Soto');
    expect(eliminarMutate).not.toHaveBeenCalled();

    fireEvent.click(within(confirmacion).getByRole('button', { name: 'Eliminar' }));
    expect(eliminarMutate).toHaveBeenCalledWith('r1', expect.anything());
  });

  it('la secretaria no ve la opción de eliminar', () => {
    permisos.role = 'SECRETARIA';
    render(<ReportesView />);
    expect(screen.queryByRole('columnheader', { name: 'Eliminar' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Eliminar el envío/ })).toBeNull();
  });

  describe('en celular', () => {
    beforeEach(() => {
      escritorio.value = false;
    });

    it('muestra una tabla con fecha, turno, supervisor, equipos y enviado (sin tarjetas)', () => {
      render(<ReportesView />);
      const columnas = screen.getAllByRole('columnheader').map((c) => c.textContent);
      expect(columnas).toEqual(['Fecha', 'Turno', 'Supervisor', 'Equipos', 'Enviado']);
      expect(within(screen.getByTestId('reporte-fila-r1')).getByText('Ana Soto')).toBeTruthy();
      expect(screen.queryByRole('link', { name: /Descargar PDF/ })).toBeNull();
    });

    it('tocar una fila abre su registro, y desde ahí el administrador lo elimina', () => {
      render(<ReportesView />);
      fireEvent.click(within(screen.getByTestId('reporte-fila-r1')).getByText('Ana Soto'));
      expect(screen.getByRole('dialog').textContent).toContain('Registro de r1');

      fireEvent.click(screen.getByRole('button', { name: 'Eliminar registro' }));
      fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }));
      expect(eliminarMutate).toHaveBeenCalledWith('r1', expect.anything());
    });
  });
});
